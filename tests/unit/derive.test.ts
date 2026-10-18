// WP-20 — derivative generation core UNIT tests (IMAGE_PIPELINE.md §5 stage 5,
// §10.3, §15; WP-15 decision record BENCHMARK-OQ01-OQ02.md).
//
// What is pinned here, WITHOUT real photo pixels (fast, isolated):
//   1. Planner–record linkage (parse-level honesty): the derivation plan is
//      parsed at runtime from the machine-readable JSON block of the FROZEN
//      decision record docs/implementation/decisions/BENCHMARK-OQ01-OQ02.md —
//      NOT hardcoded. Mutating the record's JSON (widths, qualities) changes
//      the plan; a parser that drifts from the record fails.
//   2. Variant matrix equals the decision record: for an uncapped source the
//      plan is exactly purposes × record widths × {primary AVIF, fallback
//      JPEG} with the frozen qualities/progressive flag; no 2880 anywhere;
//      only avif/jpeg formats (no WebP by construction, and the parsed
//      record's own webp field is pinned "not-generated" here, in the test,
//      so the format literal never needs to exist in module code).
//   3. No-enlargement planning (§15): requested widths above the source's
//      display width collapse to ONE source-capped variant at the source
//      width, recording its actual width (D5: natural source caps mandatory).
//   4. Stage-plan wiring (the WP-19 reviewer's forward obligation): the
//      derive module composes stages 1–5 and validates through
//      validateStagePlan; a mis-ordered plan fails closed with rule-precise
//      tokens.
//   5. Static greps (brief item f): comment-stripped derive.ts contains NO
//      keepIccProfile / withIccProfile / keepExif / keepMetadata / webp as
//      CODE — D10 and sharp's strip-by-default are pinned — while the header
//      documents the forbidden methods by name.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  DERIVE_STAGE_PLAN,
  DeriveStagePlanError,
  DeriveError,
  derivativeFileName,
  deriveStagePlan,
  deriveAll,
  parseDerivativeRecord,
  planDerivatives,
  validateDeriveStagePlan,
  type FrozenDerivativeRecord,
  type PlannedVariant,
} from "../../scripts/media/derive";
import { COLOR_STAGE_PLAN } from "../../scripts/media/color";
import { validateStagePlan } from "../../scripts/media/stage-order";

const DECISION_DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "implementation",
  "decisions",
  "BENCHMARK-OQ01-OQ02.md",
);
const DERIVE_MODULE = join(import.meta.dirname, "..", "..", "scripts", "media", "derive.ts");

/** Remove comments so static greps pin CODE, not the documentation of rules. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** The frozen record as the tests independently expect it (the pin). */
const FROZEN = {
  gallery_display: {
    widths: [480, 800, 1024, 1280, 1600, 2048, 2560],
    avifQuality: 65,
  },
  overview: { widths: [480], avifQuality: 55 },
  cover: { widths: [1280, 1600, 2048, 2560], avifQuality: 65 },
  jpegFallbackQuality: 75,
  jpegProgressive: true,
  maxDerivativeWidth: 2560,
};

let cachedRecord: FrozenDerivativeRecord | null = null;
async function record(): Promise<FrozenDerivativeRecord> {
  if (cachedRecord === null) {
    cachedRecord = parseDerivativeRecord(await readFile(DECISION_DOC, "utf8"));
  }
  return cachedRecord;
}

async function planUncapped(photoId = "p_test"): Promise<PlannedVariant[]> {
  return planDerivatives(await record(), photoId, 6000);
}

describe("WP-20 planner–record linkage (parsed from the FROZEN decision doc)", () => {
  test("the decision doc's machine-readable JSON parses into the frozen record", async () => {
    const rec = await record();
    expect(rec.recordId).toBe("BENCHMARK-OQ01-OQ02");
    expect(rec.frozenAt).toBe("2026-08-29");
    expect(rec.purposes.gallery_display).toEqual(FROZEN.gallery_display);
    expect(rec.purposes.overview).toEqual(FROZEN.overview);
    expect(rec.purposes.cover).toEqual(FROZEN.cover);
    expect(rec.jpegFallbackQuality).toBe(FROZEN.jpegFallbackQuality);
    expect(rec.jpegProgressive).toBe(FROZEN.jpegProgressive);
    expect(rec.maxDerivativeWidth).toBe(FROZEN.maxDerivativeWidth);
    // The parsed record's own no-WebP declaration (D2) — read from the raw
    // JSON here so the format literal never has to exist in module code.
    expect(rec.raw.webp).toBe("not-generated");
    expect(rec.raw.digest_hex_characters).toBe(16); // WP-22's concern, recorded not consumed
    expect(rec.rules).toEqual({
      aspectPreserving: true,
      noCrop: true,
      noEnlargement: true,
      sourceCappedVariantsValid: true,
      noFixed2xOr3xArtifacts: true,
    });
  });

  test("parser rejects a doc whose JSON block is missing or not the WP-15 record", () => {
    expect(() => parseDerivativeRecord("no json block here")).toThrow();
    expect(() =>
      parseDerivativeRecord('```json\n{"record": "SOMETHING-ELSE"}\n```'),
    ).toThrow();
  });

  test("parser fails closed on a non-ascending width ladder", () => {
    const doc =
      '```json\n{"record": "BENCHMARK-OQ01-OQ02", "frozen_at": "2026-08-29", "purposes": {' +
      '"gallery_display": {"widths": [800, 480], "avif_quality": 65}},' +
      '"formats": {"primary": "avif", "fallback": "jpeg"},' +
      '"jpeg_fallback_quality": 75, "jpeg_progressive": true,' +
      '"webp": "not-generated", "max_derivative_width": 2560,' +
      '"rules": {"aspect_preserving": true, "no_crop": true, "no_enlargement": true,' +
      '"source_capped_variants_valid": true, "no_fixed_2x_or_3x_artifacts": true}}\n```';
    expect(() => parseDerivativeRecord(doc)).toThrow(/ascending/);
  });

  test("parser fails closed on a width above max_derivative_width", () => {
    const doc =
      '```json\n{"record": "BENCHMARK-OQ01-OQ02", "frozen_at": "2026-08-29", "purposes": {' +
      '"gallery_display": {"widths": [480, 2880], "avif_quality": 65}},' +
      '"formats": {"primary": "avif", "fallback": "jpeg"},' +
      '"jpeg_fallback_quality": 75, "jpeg_progressive": true,' +
      '"webp": "not-generated", "max_derivative_width": 2560,' +
      '"rules": {"aspect_preserving": true, "no_crop": true, "no_enlargement": true,' +
      '"source_capped_variants_valid": true, "no_fixed_2x_or_3x_artifacts": true}}\n```';
    expect(() => parseDerivativeRecord(doc)).toThrow(/max_derivative_width/);
  });

  test("parser fails closed if the frozen formats are altered (D2 re-decision required)", () => {
    const base =
      '```json\n{"record": "BENCHMARK-OQ01-OQ02", "frozen_at": "2026-08-29", "purposes": {' +
      '"gallery_display": {"widths": [480], "avif_quality": 65}},' +
      '"jpeg_fallback_quality": 75, "jpeg_progressive": true,' +
      '"webp": "not-generated", "max_derivative_width": 2560,' +
      '"rules": {"aspect_preserving": true, "no_crop": true, "no_enlargement": true,' +
      '"source_capped_variants_valid": true, "no_fixed_2x_or_3x_artifacts": true},';
    expect(() =>
      parseDerivativeRecord(base + '"formats": {"primary": "webp", "fallback": "jpeg"}}\n```'),
    ).toThrow(/FROZEN/);
  });

  test("PARSING HONESTY: mutating the record's JSON changes the plan (not hardcoded)", async () => {
    const original = await readFile(DECISION_DOC, "utf8");

    // Mutation 1 — gallery AVIF quality 65 → 66: the plan's gallery quality
    // follows the record, cover (also 65, later in the JSON) is untouched.
    const qMutated = original.replace('"avif_quality": 65', '"avif_quality": 66');
    expect(qMutated).not.toBe(original);
    const qPlan = planDerivatives(parseDerivativeRecord(qMutated), "p", 6000);
    const galleryAvif = qPlan.filter((v) => v.purpose === "gallery_display" && v.format === "avif");
    expect(galleryAvif.length).toBeGreaterThan(0);
    expect(galleryAvif.every((v) => v.quality === 66)).toBe(true);
    const coverAvif = qPlan.filter((v) => v.purpose === "cover" && v.format === "avif");
    expect(coverAvif.every((v) => v.quality === 65)).toBe(true);

    // Mutation 2 — drop the 480 rung from the gallery ladder: the plan loses
    // the 480 gallery variants (the overview 480 rung remains — different key).
    const wMutated = original.replace(
      '"widths": [480, 800, 1024, 1280, 1600, 2048, 2560]',
      '"widths": [800, 1024, 1280, 1600, 2048, 2560]',
    );
    expect(wMutated).not.toBe(original);
    const wPlan = planDerivatives(parseDerivativeRecord(wMutated), "p", 6000);
    expect(wPlan.some((v) => v.purpose === "gallery_display" && v.width === 480)).toBe(false);
    expect(wPlan.some((v) => v.purpose === "overview" && v.width === 480)).toBe(true);

    // Mutation 3 — add a 2880 rung (the D6-REJECTED width) and raise the cap:
    // if 2560/2880 were hardcoded the plan could not gain 2880 from the record.
    const mut3 = original
      .replace(
        '"widths": [480, 800, 1024, 1280, 1600, 2048, 2560]',
        '"widths": [480, 800, 1024, 1280, 1600, 2048, 2560, 2880]',
      )
      .replace('"max_derivative_width": 2560', '"max_derivative_width": 2880');
    expect(mut3).not.toBe(original);
    const mut3Plan = planDerivatives(parseDerivativeRecord(mut3), "p", 6000);
    expect(mut3Plan.some((v) => v.width === 2880)).toBe(true);
  });
});

describe("WP-20 variant matrix equals the decision record (uncapped source)", () => {
  test("plan = purposes × widths × {avif, jpeg} with frozen qualities", async () => {
    const plan = await planUncapped();
    const expected: Array<[string, string, number, number, boolean]> = [];
    for (const [purpose, spec] of Object.entries(FROZEN)) {
      if (typeof spec !== "object" || spec === null || !("widths" in spec)) continue;
      for (const width of spec.widths) {
        expected.push([purpose, "avif", width, spec.avifQuality, false]);
        expected.push([purpose, "jpeg", width, FROZEN.jpegFallbackQuality, FROZEN.jpegProgressive]);
      }
    }
    const actual = plan.map(
      (v) =>
        [v.purpose, v.format, v.width, v.quality, v.progressive] as [
          string,
          string,
          number,
          number,
          boolean,
        ],
    );
    expect(actual).toEqual(expected);
  });

  test("no 2880, only avif/jpeg formats, no WebP anywhere in the plan", async () => {
    const plan = await planUncapped();
    expect(plan.some((v) => v.width === 2880)).toBe(false);
    expect(new Set(plan.map((v) => v.format))).toEqual(new Set(["avif", "jpeg"]));
  });

  test("every planned variant carries exactly the frozen field set", async () => {
    const plan = await planUncapped("p_fields");
    for (const v of plan) {
      expect(Object.keys(v).sort()).toEqual(
        ["format", "photoId", "progressive", "purpose", "quality", "requestedWidth", "width"].sort(),
      );
      expect(v.photoId).toBe("p_fields");
      expect(v.requestedWidth).toBe(v.width); // uncapped: requested = actual
    }
  });
});

describe("WP-20 no-enlargement planning (IMAGE_PIPELINE §15)", () => {
  test("a 1365-wide source caps the ladders at one 1365 variant recording its actual width", async () => {
    const plan = planDerivatives(await record(), "p_1365", 1365);
    expect(plan.some((v) => v.width > 1365)).toBe(false);

    const gallery = plan.filter((v) => v.purpose === "gallery_display");
    expect([...new Set(gallery.map((v) => v.width))]).toEqual([480, 800, 1024, 1280, 1365]);
    // The single capped rung: requested 1600 (first rung above the source),
    // actual width 1365 — deduplicated, NOT encoded three times for 1600/2048/2560.
    const capped = gallery.filter((v) => v.width === 1365);
    expect(capped.map((v) => v.requestedWidth)).toEqual([1600, 1600]); // avif + jpeg
    expect(capped).toHaveLength(2); // avif + jpeg

    const cover = plan.filter((v) => v.purpose === "cover");
    expect([...new Set(cover.map((v) => v.width))]).toEqual([1280, 1365]);
    const coverCapped = cover.filter((v) => v.width === 1365);
    expect(coverCapped.map((v) => v.requestedWidth)).toEqual([1600, 1600]); // avif + jpeg

    // Qualities survive the cap unchanged (frozen per purpose).
    expect(capped.find((v) => v.format === "avif")?.quality).toBe(FROZEN.gallery_display.avifQuality);
  });

  test("a source narrower than the overview width collapses every purpose to its width", async () => {
    const plan = planDerivatives(await record(), "p_tiny", 300);
    expect(plan.some((v) => v.width !== 300)).toBe(false);
    expect([...new Set(plan.map((v) => v.purpose))]).toEqual([
      "gallery_display",
      "overview",
      "cover",
    ]);
  });
});

describe("WP-20 deterministic intermediate file names", () => {
  test("names are {photoId}-{purpose}-{format}-w{actualWidth}.{ext} and derivable", () => {
    expect(derivativeFileName("p_reine", "gallery_display", "avif", 1024)).toBe(
      "p_reine-gallery_display-avif-w1024.avif",
    );
    expect(derivativeFileName("p_reine", "overview", "jpeg", 480)).toBe(
      "p_reine-overview-jpeg-w480.jpg",
    );
    // Source-capped variant records its ACTUAL width in the name.
    expect(derivativeFileName("p_1365", "cover", "avif", 1365)).toBe(
      "p_1365-cover-avif-w1365.avif",
    );
  });
});

describe("WP-20 deriveAll input guards", () => {
  test("duplicate photoIds fail closed before any pixel work (filename collision)", async () => {
    await expect(
      deriveAll(
        [
          { photoId: "dup_id", source: "/nonexistent/a.jpg" },
          { photoId: "dup_id", source: "/nonexistent/b.jpg" },
        ],
        { outDir: "/nonexistent/wp20-out" },
      ),
    ).rejects.toThrow(DeriveError);
    await expect(
      deriveAll(
        [
          { photoId: "dup_id", source: "/nonexistent/a.jpg" },
          { photoId: "dup_id", source: "/nonexistent/b.jpg" },
        ],
        { outDir: "/nonexistent/wp20-out" },
      ),
    ).rejects.toThrow(/duplicate photoId/);
  });
});

describe("WP-20 stage-plan wiring (validateStagePlan — the WP-19 forward obligation)", () => {
  test("the derive plan is the canonical stages 1–5 subsequence on top of the stage-4 plan", () => {
    expect([...DERIVE_STAGE_PLAN]).toEqual([...COLOR_STAGE_PLAN, "resize-encode"]);
    const result = validateStagePlan(DERIVE_STAGE_PLAN);
    expect(result.ok).toBe(true);
  });

  test("validateDeriveStagePlan returns the validated plan; drift throws DeriveStagePlanError", () => {
    expect(deriveStagePlan()).toEqual([...COLOR_STAGE_PLAN, "resize-encode"]);
    try {
      validateDeriveStagePlan([
        "read-decode",
        "resize-encode",
        "normalize-orientation",
        "color-transform",
      ]);
      expect.unreachable("mis-ordered plan must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DeriveStagePlanError);
      // Both out-of-place stages are reported by the subsequence check
      // (normalize-orientation and color-transform each follow resize-encode
      // in the plan but precede it canonically).
      expect((error as DeriveStagePlanError).rules).toContain("5:stage-order");
      expect((error as DeriveStagePlanError).rules.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("a resize-encode plan without normalize-orientation fails closed", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "color-transform",
      "resize-encode",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.rule)).toContain("5:resize-requires-orientation");
    }
  });
});

describe("WP-20 static assertions on the derive module (brief item f)", () => {
  test("no keepIccProfile/withIccProfile/keepExif/keepMetadata/webp as CODE in derive.ts", async () => {
    const source = await readFile(DERIVE_MODULE, "utf8");
    const code = stripComments(source);
    expect(code).not.toMatch(/keepIccProfile|withIccProfile|keepExif|keepMetadata/i);
    expect(code).not.toMatch(/webp/i);
  });

  test("the header documents the forbidden methods and the record linkage (comment presence)", async () => {
    const source = await readFile(DERIVE_MODULE, "utf8");
    expect(source).toMatch(/D10/);
    expect(source).toMatch(/keepIccProfile|withIccProfile/); // documented by name
    expect(source).toMatch(/sharp's default metadata handling/);
    expect(source).toMatch(/BENCHMARK-OQ01-OQ02/);
  });

  test("guard wiring and record linkage exist as CODE (not just comments)", async () => {
    const code = stripComments(await readFile(DERIVE_MODULE, "utf8"));
    expect(code).toMatch(/validateStagePlan/);
    expect(code).toMatch(/parseDerivativeRecord/);
    expect(code).toMatch(/colorToSrgb/);
    expect(code).toMatch(/withoutEnlargement:\s*true/);
  });
});
