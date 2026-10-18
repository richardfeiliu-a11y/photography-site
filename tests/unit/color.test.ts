// WP-19 — color transform unit tests (IMAGE_PIPELINE.md §5 stage 4 + §6).
//
// Pins the structural guarantees of scripts/media/color.ts that do NOT need
// real photo pixels:
//   1. The stage-4 plan is composed through the WP-18 guard
//      (validateStagePlan) and a deliberately mis-ordered plan fails closed —
//      WP-19 is the first work package to WIRE the guard into a pipeline
//      (the WP-18 reviewer explicitly flagged that nothing mechanically
//      forced the wiring).
//   2. The D9 policy flows through evaluateIccSource: the frozen default is
//      the imported DEFAULT_UNTAGGED_ENFORCEMENT_MODE (never a hardcode);
//      'fail' rejects with the build-blocking rule token 11.1:color-policy
//      (IMAGE_PIPELINE §11.1 "Color-policy failure"); 'warn' surfaces the
//      recorded ICC_UNTAGGED_ASSUMED_SRGB entry and proceeds.
//   3. Static assertion (brief item d): NO camera-model-guessing code path
//      exists anywhere in scripts/media/*.ts — the grep runs over
//      COMMENT-STRIPPED source so the ADR-011 documentation that forbids the
//      practice cannot false-positive, and actual inference code cannot hide.
//   4. Static assertion (brief item f): no keepIccProfile / withIccProfile /
//      .profile( appears as CODE in scripts/media/color.ts (D10: forbidden on
//      the derivative path) — while the module header DOES document the
//      WP-16-measured mislabel trap by name (comment grep asserts presence).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  COLOR_STAGE_PLAN,
  COLOR_TRANSFORM_NOTE,
  ColorPolicyError,
  colorStagePlan,
  colorToSrgb,
  validateColorStagePlan,
} from "../../scripts/media/color";
import { DEFAULT_UNTAGGED_ENFORCEMENT_MODE } from "../../scripts/media/icc-policy";
import { validateStagePlan } from "../../scripts/media/stage-order";

/** Remove comments so static greps pin CODE, not the documentation of rules. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const MEDIA_DIR = join(import.meta.dirname, "..", "..", "scripts", "media");

// A tiny untagged JPEG built in-memory: sharp strips metadata by default, so
// this buffer has no ICC profile — the exact D9 untagged input, without
// needing corpus fixtures in a unit test.
async function untaggedJpegBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 120, g: 60, b: 200 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("WP-19 guard wiring (stage-4 plan composed through validateStagePlan)", () => {
  test("the module's stage plan is the canonical §5 stages 1–4 subsequence", () => {
    expect([...COLOR_STAGE_PLAN]).toEqual([
      "read-decode",
      "extract-metadata",
      "normalize-orientation",
      "color-transform",
    ]);
    // The composed plan is validated by the WP-18 guard itself.
    expect(validateStagePlan(COLOR_STAGE_PLAN).ok).toBe(true);
  });

  test("colorStagePlan() returns the guard-validated plan", () => {
    const plan = colorStagePlan();
    expect(plan).toEqual([...COLOR_STAGE_PLAN]);
  });

  test("a deliberately mis-ordered stage-4 plan FAILS through the same guard", () => {
    // Color before extract: the ICC read must happen before conversion
    // (IMAGE_PIPELINE §5 hard requirement 5:color-requires-extract).
    const misOrdered = [
      "read-decode",
      "normalize-orientation",
      "color-transform",
      "extract-metadata",
    ];
    expect(validateStagePlan(misOrdered).ok).toBe(false);
    // The module entry point fails closed on it — compose-then-validate is
    // not optional: validateColorStagePlan throws with the guard's rule token.
    // The subsequence check catches the reorder as 5:stage-order (the WP-18
    // fix-round semantics: an increasing-subsequence violation subsumes the
    // pairwise invariants; 5:color-requires-extract additionally fires only
    // when extract-metadata is absent entirely).
    expect(() => validateColorStagePlan(misOrdered)).toThrow(/5:stage-order/);
    // And the token is rule-precise, repo style.
    try {
      validateColorStagePlan(misOrdered);
      expect.unreachable("mis-ordered plan must throw");
    } catch (error) {
      expect((error as Error).message).toContain("5:stage-order");
    }
    // The other hard requirement shape: color-transform with NO extract at
    // all is caught by 5:color-requires-extract.
    expect(() => validateColorStagePlan(["read-decode", "color-transform"])).toThrow(
      /5:color-requires-extract/,
    );
  });
});

describe("WP-19 policy enforcement hook (D9 via evaluateIccSource)", () => {
  test("the default policy is the frozen D9 mode, imported — not a hardcode", () => {
    // Behavioral: an untagged source under the DEFAULT policy proceeds
    // silently (assume) and yields a usable sRGB pipeline.
    expect(DEFAULT_UNTAGGED_ENFORCEMENT_MODE).toBe("assume");
  });

  test("untagged source under the frozen 'assume' default: silent proceed", async () => {
    const buffer = await untaggedJpegBuffer();
    const logs: unknown[] = [];
    const pipeline = await colorToSrgb(buffer, { onLog: (entry) => logs.push(entry) });
    expect(pipeline).toBeDefined();
    expect(logs).toEqual([]); // silent per D9
    // The pipeline is a real sharp instance over the decoded pixels.
    const { info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(8);
  });

  test("'warn' mode proceeds AND surfaces the recorded ICC_UNTAGGED_ASSUMED_SRGB entry", async () => {
    const buffer = await untaggedJpegBuffer();
    const logs: Array<{ level: string; code: string; message: string }> = [];
    const pipeline = await colorToSrgb(buffer, {
      policy: "warn",
      onLog: (entry) => logs.push(entry),
    });
    expect(pipeline).toBeDefined(); // warn proceeds
    expect(logs).toHaveLength(1);
    expect(logs[0]!.code).toBe("ICC_UNTAGGED_ASSUMED_SRGB");
    expect(logs[0]!.level).toBe("warn");
  });

  test("'fail' mode rejects with the build-blocking rule token 11.1:color-policy", async () => {
    const buffer = await untaggedJpegBuffer();
    const attempt = colorToSrgb(buffer, { policy: "fail" });
    await expect(attempt).rejects.toBeInstanceOf(ColorPolicyError);
    await expect(attempt).rejects.toMatchObject({ rule: "11.1:color-policy" });
    await expect(attempt).rejects.toThrow(/11\.1:color-policy/);
  });

  test("tagged source under 'fail' mode still converts (fail targets untagged only)", async () => {
    // A source WITH an ICC profile never trips the untagged policy. Build a
    // tagged buffer with the host sRGB profile (frozen macOS build host, same
    // provenance as the WP-16 fixture factory).
    const tagged = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withIccProfile("/System/Library/ColorSync/Profiles/sRGB Profile.icc")
      .jpeg({ quality: 90 })
      .toBuffer();
    const meta = await sharp(tagged).metadata();
    expect(meta.icc?.length ?? 0).toBeGreaterThan(0);
    const logs: unknown[] = [];
    const pipeline = await colorToSrgb(tagged, {
      policy: "fail",
      onLog: (entry) => logs.push(entry),
    });
    expect(pipeline).toBeDefined();
    expect(logs).toEqual([]);
  });

  test("a provided stage-2 record is consumed (icc.present drives the decision, no re-read needed)", async () => {
    const buffer = await untaggedJpegBuffer();
    // Record claims untagged; fail mode must reject even though we pass the
    // bytes too — the RECORD is the policy input (WP-18 extractor contract).
    const record = {
      width: 8,
      height: 8,
      displayWidth: 8,
      displayHeight: 8,
      orientation: 1 as const,
      icc: { present: false, sizeBytes: null },
      format: "jpeg",
      sha256: "0".repeat(64),
    };
    await expect(colorToSrgb(buffer, { policy: "fail", record })).rejects.toMatchObject({
      rule: "11.1:color-policy",
    });
    // Record claims tagged; the same bytes pass under fail mode.
    const taggedRecord = { ...record, icc: { present: true, sizeBytes: 3144 } };
    const pipeline = await colorToSrgb(buffer, { policy: "fail", record: taggedRecord });
    expect(pipeline).toBeDefined();
  });
});

describe("WP-19 static assertions (brief items d and f)", () => {
  test("NO camera-model-guessing code path exists in scripts/media/*.ts (grep)", async () => {
    const files = (await readdir(MEDIA_DIR)).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(6); // guard: the dir we scanned
    const forbidden: Array<[string, RegExp]> = [
      ["camera token in code", /\bcamera\b/i],
      ["model token in code", /\bmodel\b/i],
      ["EXIF Make inference", /exifmake|cameramake|make\s*[=:]/i],
      ["model inference helpers", /guessmodel|infermodel|modelguess|modelinfer/i],
    ];
    for (const file of files) {
      const code = stripComments(await readFile(join(MEDIA_DIR, file), "utf8"));
      for (const [label, pattern] of forbidden) {
        const match = pattern.exec(code);
        expect(match, `${file}: ${label} must not exist (ADR-011) — matched '${match?.[0]}'`).toBeNull();
      }
    }
  });

  test("no keepIccProfile/withIccProfile/profile( as CODE in scripts/media/color.ts (grep)", async () => {
    const code = stripComments(
      await readFile(join(MEDIA_DIR, "color.ts"), "utf8"),
    );
    expect(/keepIccProfile|withIccProfile|\.profile\(/.test(code)).toBe(false);
  });

  test("the keepIccProfile mislabel trap stays DOCUMENTED in the module header (WP-16 measured)", async () => {
    // D10's rejection rationale (keepIccProfile after conversion retains the
    // SOURCE profile — a mislabel) must remain recorded by name in comments.
    const source = await readFile(join(MEDIA_DIR, "color.ts"), "utf8");
    expect(source).toContain("keepIccProfile");
    expect(source).toContain("withIccProfile");
    expect(source).toContain("mislabel");
  });

  test("the D9 default is IMPORTED, not a same-value hardcode (grep)", async () => {
    // The mode value flowing into evaluateIccSource must come from the WP-16
    // module (evaluateIccSource's own default), not from a literal that
    // happens to equal it today: comment-stripped color.ts must reference
    // DEFAULT_UNTAGGED_ENFORCEMENT_MODE and contain no `policy: "assume"`
    // literal — so a future re-decision of the frozen mode propagates
    // without a code change here.
    const code = stripComments(
      await readFile(join(MEDIA_DIR, "color.ts"), "utf8"),
    );
    expect(code).toContain("DEFAULT_UNTAGGED_ENFORCEMENT_MODE");
    expect(/policy\s*:\s*["']assume["']/.test(code)).toBe(false);
  });

  test("COLOR_TRANSFORM_NOTE documents the stage-4 contract (pinned, STAGE_ORDER_NOTE pattern)", () => {
    // The note IS the contract documentation — pin it so it cannot silently
    // drift from IMAGE_PIPELINE §5 stage 4 + §6 / the WP-16 record.
    expect(COLOR_TRANSFORM_NOTE).toContain("IMAGE_PIPELINE §5 stage 4");
    expect(COLOR_TRANSFORM_NOTE).toContain("orientedPipeline");
    expect(COLOR_TRANSFORM_NOTE).toContain("toColourspace('srgb')");
    expect(COLOR_TRANSFORM_NOTE).toContain("evaluateIccSource");
    expect(COLOR_TRANSFORM_NOTE).toContain("assume");
    expect(COLOR_TRANSFORM_NOTE).toContain("mislabel");
    expect(COLOR_TRANSFORM_NOTE).toContain("D10");
  });
});
