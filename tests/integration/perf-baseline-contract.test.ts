// WP-45 correction — MEASURED BASELINE contract (RED first).
//
// Authority: PERFORMANCE_BUDGET §§2/2.2/3/5/10-11, PRODUCTION_IMPLEMENTATION_PLAN
// WP-45, PHASE_GATES P7, ADR-013. This suite catches the six Gate-B defect
// classes: (1) unthrottled measurement, (2) click-to-visible INP proxy,
// (3) missing DOM size, (4) missing desktop/mobile memory, (5) incomplete
// page/interaction matrix, (6) CI gate without measured baseline.
//
// The baseline is measured on a SYNTHETIC VALID-CONTENT PROVISION (isolated
// temp workspace: production manifest + alt_text fill (R3; the fixture draft
// merged manifest) because the actual corpus is publication-invalid (50
// WP-42:alt-missing errors, D11 fail-closed). conditions.provision carries
// that label; corpus.productionManifestSha pins the canonical manifest.
//
// R2 task 6: the LCP/INP/CLS/bundle threshold assertions route through
// scripts/perf/validate-baseline.mjs (the formal gate) via subprocess — no
// mirrored threshold logic in the test.
//
// R4 round4 (2026-09-15) — D2 promotion: the promoted baseline has NO LCP miss
// (worst cell 1208 ms), so the old hardcoded "exactly 2 red items" no longer
// describes reality. The assertion below is therefore DERIVED from the record:
// for every measured cell it requires the formal gate to report exactly the
// cells above the frozen target — no more, no fewer — and to exit nonzero iff
// at least one cell is over. That is stronger than the replaced snapshot (it
// covers all 16 cells and survives every future promotion) and it still forbids
// renaming or auto-allowing a miss.
import { spawnSync } from "node:child_process";
// R8/I6 — perf CLI spawn chain (see perf-measurements.test.ts): fixed
// --experimental-strip-types + ts-resolve launch, empty NODE_OPTIONS.
const NODE_TS_ARGS = ["--experimental-strip-types", "--import", "./scripts/validate/register-ts-resolve.mjs"];
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ENGINEERING_BUDGETS, FROZEN_WEB_VITALS } from "../../src/lib/perf/budget";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE_FILE = join(REPO_ROOT, "docs", "implementation", "PERF-BASELINE.json");
const VALIDATE_CLI = join(REPO_ROOT, "scripts", "perf", "validate-baseline.mjs");

// R3 re-anchor: the canonical manifest is the real-archive manifest
// (4320 records, sha from generated/asset-manifest.json as measured).
const CANONICAL_MANIFEST_SHA =
  "ca793c250364af46484700e3ab126a20d667d4e6baf510ed6fc803165fa0b9f3";

function loadBaseline(): Record<string, any> {
  expect(existsSync(BASELINE_FILE), "run npm run perf:measure first").toBe(true);
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Record<string, any>;
}

function runValidateCli(baseline: any): { status: number; issues: any[] } {
  const dir = mkdtempSync(join(tmpdir(), "perf-contract-"));
  const file = join(dir, "baseline.json");
  writeFileSync(file, JSON.stringify(baseline));
  const res = spawnSync("node", [...NODE_TS_ARGS, VALIDATE_CLI, "--input", file], {
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  rmSync(dir, { recursive: true, force: true });
  let parsed: any = {};
  try {
    parsed = JSON.parse(res.stdout || "{}");
  } catch {
    parsed = { issues: [] };
  }
  return { status: res.status ?? 0, issues: parsed.issues ?? [] };
}

function profilesOf(page: Record<string, any>): Record<string, any> {
  expect(page.profiles, page.path + " has per-profile measurements").toBeDefined();
  expect(page.profiles.desktop, page.path + " has desktop profile").toBeDefined();
  expect(page.profiles.mobileLowEnd, page.path + " has low-end-mobile profile").toBeDefined();
  return page.profiles;
}

describe("WP-45 correction: throttled conditions (defect class 1)", () => {
  test("baseline v2 from the corrected harness, throttling on every profile", () => {
    const baseline = loadBaseline();
    expect(baseline.version).toBe(2);
    expect(baseline.tool).toBe("scripts/perf/measure.mjs");
    for (const name of ["desktop", "mobileLowEnd"]) {
      const profile = baseline.profiles?.[name];
      expect(profile, name + " profile recorded").toBeDefined();
      expect(profile.network?.throttled, name + " network throttled").toBe(true);
      expect(profile.network?.downKbps, name + " down rate recorded").toBeGreaterThan(0);
      expect(profile.network?.rttMs, name + " RTT recorded").toBeGreaterThan(0);
      expect(String(baseline.conditions?.network ?? "")).not.toMatch(/no throttling/i);
    }
    // CPU slowdown is explicit per profile (0/1 = none, >1 = throttled).
    expect(baseline.profiles.mobileLowEnd.cpuSlowdown).toBeGreaterThan(1);
  });

  test("synthetic provision honestly labeled; canonical manifest SHA pinned", () => {
    const baseline = loadBaseline();
    // R3 provisioning: production manifest + alt_text fill (no fixture drafts).
    expect(String(baseline.conditions?.provision ?? "")).toMatch(/production manifest provision/i);
    expect(baseline.corpus?.productionManifestSha).toBe(CANONICAL_MANIFEST_SHA);
    expect(String(baseline.corpus?.syntheticManifestSha ?? "").length).toBeGreaterThan(0);
  });
});

describe("WP-45 correction: true Event-Timing INP (defect class 2)", () => {
  test("INP uses Event Timing semantics, never the click-to-visible proxy", () => {
    const baseline = loadBaseline();
    expect(String(baseline.inpMethod ?? "")).toMatch(/event timing/i);
    expect(String(baseline.inpMethod ?? "")).toMatch(/event-timing-attributed/i);
    expect(String(baseline.inpMethod ?? "")).not.toMatch(/wall-clock/i);
    expect(String(baseline.inpMethod ?? "")).not.toMatch(/click-to-visible/i);
    expect(String(JSON.stringify(baseline.interactions ?? [])).toLowerCase()).not.toContain(
      "click-to-visible",
    );
  });

  test("every gated interaction reports per-profile Event-Timing runs", () => {
    const baseline = loadBaseline();
    const ids = (baseline.interactions as Array<any>).map((i) => i.id);
    for (const id of ["overview-open", "overview-close", "overview-jump"]) {
      expect(ids, id + " measured").toContain(id);
    }
    for (const interaction of baseline.interactions as Array<any>) {
      if (interaction.status === "na") continue;
      expect(interaction.method, interaction.id + " attributed method").toMatch(
        /event-timing-attributed/i,
      );
      for (const name of ["desktop", "mobileLowEnd"]) {
        const sample = interaction.profiles?.[name];
        expect(sample?.attribution, interaction.id + " " + name + " attributed").toBe(true);
        expect(sample?.runs?.length, interaction.id + " " + name + " runs").toBeGreaterThanOrEqual(3);
        expect(Number.isFinite(sample?.medianMs), interaction.id + " " + name + " median").toBe(true);
        // Zero-entry / unattributed runs must not exist: every run carries a
        // real interactionId, the correct targetAction, and a nonzero duration.
        for (const run of sample?.runs ?? []) {
          expect(run?.interactionId, interaction.id + " " + name + " interactionId").toBeTruthy();
          expect(run?.targetAction, interaction.id + " " + name + " targetAction").toBe(
            interaction.id,
          );
          expect(run?.durationMs, interaction.id + " " + name + " nonzero").toBeGreaterThan(0);
        }
      }
      expect(interaction.gateMs).toBeLessThanOrEqual(FROZEN_WEB_VITALS.inpMs);
    }
  });

  test("menu-toggle recorded N/A with rationale (no JS menu toggle exists)", () => {
    const baseline = loadBaseline();
    const menu = (baseline.interactions as Array<any>).find((i) => i.id === "menu-toggle");
    expect(menu?.status).toBe("na");
    expect(String(menu?.rationale ?? "").length).toBeGreaterThan(0);
  });
});

describe("WP-45 correction: per-page payload + DOM (defect class 3)", () => {
  test("every page records wire payload by type and DOM size, both profiles", () => {
    const baseline = loadBaseline();
    expect(baseline.pages.length).toBeGreaterThanOrEqual(8);
    for (const page of baseline.pages as Array<any>) {
      const profiles = profilesOf(page);
      for (const name of ["desktop", "mobileLowEnd"]) {
        const sample = profiles[name];
        for (const key of ["htmlBytes", "cssBytes", "jsBytes", "imgBytes", "fontBytes"]) {
          expect(Number.isFinite(sample?.payload?.[key]), page.path + " " + name + " " + key).toBe(
            true,
          );
        }
        expect(sample?.dom?.nodes, page.path + " " + name + " DOM nodes").toBeGreaterThan(0);
      }
    }
  });
});

describe("WP-45 correction: desktop + mobile memory (defect class 4)", () => {
  test("72-photo gallery records heap + DOM + decoded-image memory, both profiles", () => {
    const baseline = loadBaseline();
    const long = (baseline.pages as Array<any>).find((p) => p.path === "/galleries/netherlands");
    expect(long, "long gallery measured").toBeDefined();
    const profiles = profilesOf(long);
    for (const name of ["desktop", "mobileLowEnd"]) {
      const mem = profiles[name]?.memory;
      expect(mem?.jsHeapBytes, "long72 " + name + " heap nonzero").toBeGreaterThan(0);
      expect(mem?.jsHeapBytes, "long72 " + name + " under budget").toBeLessThanOrEqual(
        ENGINEERING_BUDGETS.galleryMemoryMB * 1024 * 1024,
      );
      expect(mem?.domNodes, "long72 " + name + " nodes nonzero").toBeGreaterThan(0);
      // IMP-03 Round 2: honest labels — transferred (encoded) bytes and the
      // decoded ESTIMATE are separate fields with a recorded method; the old
      // mislabeled `decodedImageBytes` (encodedBodySize sum) must be gone.
      expect(mem?.transferredImageBytes, "long72 " + name + " transferred nonzero").toBeGreaterThan(
        0,
      );
      expect(
        mem?.decodedImageEstimateBytes,
        "long72 " + name + " decoded estimate nonzero",
      ).toBeGreaterThan(0);
      expect(String(mem?.decodedImageMethod ?? "").length, "long72 " + name + " method").toBeGreaterThan(
        0,
      );
      expect(JSON.stringify(mem ?? {}), "long72 " + name + " no mislabeled field").not.toContain(
        '"decodedImageBytes"',
      );
      // Scroll-jank + traversal evidence (IMP-03): measured, finite, present.
      expect(
        Number.isFinite(mem?.scrollJank?.droppedFrames),
        "long72 " + name + " jank frames",
      ).toBe(true);
      expect(Number.isFinite(mem?.traversalMs), "long72 " + name + " traversal").toBe(true);
    }
  });

  test("low-end-mobile memory is resource-constrained emulation, fully recorded", () => {
    const baseline = loadBaseline();
    const mobile = baseline.profiles?.mobileLowEnd;
    expect(String(mobile?.memoryEmulation ?? "")).not.toMatch(/viewport-only/i);
    expect(String(mobile?.memoryEmulation ?? "").length).toBeGreaterThan(0);
    expect(String(mobile?.limitations ?? "").length).toBeGreaterThan(0);
  });
});

describe("WP-45 correction: complete matrix (defect class 5)", () => {
  test("page matrix covers Home, Place (aggregation), normal Gallery, long Gallery, mixed-orientation", () => {
    const baseline = loadBaseline();
    const paths = (baseline.pages as Array<any>).map((p) => p.path);
    for (const required of [
      "/",
      "/places/amsterdam",
      "/galleries/lofoten-polar-night",
      "/galleries/netherlands",
      "/galleries/autumn-china",
    ]) {
      expect(paths, required + " measured").toContain(required);
    }
  });

  test("repeatability: every LCP/CLS sample keeps all runs with variance", () => {
    const baseline = loadBaseline();
    for (const page of baseline.pages as Array<any>) {
      const profiles = profilesOf(page);
      for (const name of ["desktop", "mobileLowEnd"]) {
        const sample = profiles[name];
        expect(sample?.lcp?.runs?.length, page.path + " LCP runs").toBeGreaterThanOrEqual(3);
        expect(Number.isFinite(sample?.lcp?.medianMs), page.path + " LCP median").toBe(true);
        expect(Number.isFinite(sample?.lcp?.minMs), page.path + " LCP min").toBe(true);
        expect(Number.isFinite(sample?.lcp?.maxMs), page.path + " LCP max").toBe(true);
      }
    }
  });

  test("ADR-013 verdict recorded with measured rationale", () => {
    const baseline = loadBaseline();
    expect(String(baseline.adr013?.verdict ?? "").length).toBeGreaterThan(0);
    expect(String(baseline.adr013?.rationale ?? "").length).toBeGreaterThan(0);
  });
});

describe("WP-45 correction: calibration probes armed (harness self-check)", () => {
  test("throttle probe proves the throttle path constrains load (LCP 0 everywhere is HARNESS-BROKEN)", () => {
    const baseline = loadBaseline();
    expect(baseline.calibration?.throttleProbe?.verdict).toBe("RED-verdict-armed");
  });

  test("event-timing probe proves true INP semantics (proxy would miss the injected handler)", () => {
    const baseline = loadBaseline();
    expect(baseline.calibration?.eventTimingProbe?.verdict).toBe("RED-verdict-armed");
  });

  test("image-heavy pages record a nonzero LCP (no /media/ staging = broken measurement)", () => {
    const baseline = loadBaseline();
    for (const path of ["/galleries/lofoten-polar-night", "/galleries/netherlands"]) {
      const page = (baseline.pages as Array<any>).find((p) => p.path === path);
      expect(page, path + " measured").toBeDefined();
      for (const name of ["desktop", "mobileLowEnd"]) {
        expect(page.profiles[name]?.lcp?.medianMs, `${path} ${name} LCP nonzero`).toBeGreaterThan(0);
      }
    }
  });
});

describe("WP-45 correction: gates backed by measured baselines (defect class 6)", () => {
  // R2 task 6: the LCP <=2500ms STANDARD WEB TARGET gate routes through
  // scripts/perf/validate-baseline.mjs (single formal entry). Every cell above
  // the frozen target surfaces as LCP_OVER_FROZEN — never renamed, never
  // auto-allowed. R4 round4: the expected set is derived from the record.
  test("formal gate reports LCP threshold state honestly for every measured cell", () => {
    const baseline = loadBaseline();
    const { status, issues } = runValidateCli(baseline);
    const expectedOver = new Set<string>();
    for (const page of baseline.pages as Array<any>) {
      for (const name of ["desktop", "mobileLowEnd"]) {
        if (page.profiles[name].lcp.medianMs > FROZEN_WEB_VITALS.lcpMs) {
          expectedOver.add(`${page.path}.profiles.${name}.lcp.medianMs`);
        }
      }
    }
    const reportedOver = new Set(
      issues.filter((i: any) => i.code === "LCP_OVER_FROZEN").map((i: any) => String(i.path)),
    );
    expect(
      [...reportedOver].sort(),
      "the gate reports exactly the cells over the frozen target",
    ).toEqual([...expectedOver].sort());
    expect(
      status,
      expectedOver.size > 0
        ? "CLI exits 1 while any measured cell misses the target"
        : "CLI exits 0 only because no measured cell misses the target",
    ).toBe(expectedOver.size > 0 ? 1 : 0);
    // OLD_DECODED_FIELD must NOT be reported — the old mislabeled field is gone.
    expect(issues.some((i: any) => i.code === "OLD_DECODED_FIELD")).toBe(false);
    // R4 T7: the promoted record carries a complete fingerprint and declares its
    // gzip convention, so neither fingerprint issue may appear.
    expect(
      issues.filter((i: any) => String(i.code).startsWith("FINGERPRINT_")),
      "no fingerprint issues for the promoted record",
    ).toEqual([]);
    expect(baseline.conditions?.gzip, "gzip convention recorded").toBeDefined();
    expect(baseline.fingerprint, "source fingerprint recorded").toBeDefined();
  });

  test("ADR-013 verdict follows the §5.2 evidence rule (heap/INP/DOM/jank triggers, not LCP)", () => {
    const baseline = loadBaseline();
    const long = (baseline.pages as Array<any>).find((p) => p.path === "/galleries/netherlands");
    const heapMB =
      Math.max(
        long.profiles.desktop.memory.jsHeapBytes,
        long.profiles.mobileLowEnd.memory.jsHeapBytes,
      ) /
      1024 /
      1024;
    const gated = (baseline.interactions as Array<any>).filter((i) => !i.status);
    const worstInp = Math.max(
      ...gated.flatMap((i) => [i.profiles.desktop.medianMs, i.profiles.mobileLowEnd.medianMs]),
    );
    const domMax = Math.max(
      long.profiles.desktop.memory.domNodes,
      long.profiles.mobileLowEnd.memory.domNodes,
    );
    const dropMax = Math.max(
      long.profiles.desktop.memory.scrollJank.droppedFrames,
      long.profiles.mobileLowEnd.memory.scrollJank.droppedFrames,
    );
    const expected =
      heapMB >= 200 || worstInp > 200 || domMax >= 10000 || dropMax > 10
        ? "virtualize"
        : "no-virtualization";
    expect(baseline.adr013?.verdict, "ADR-013 follows §5.2 evidence").toBe(expected);
    expect(String(baseline.adr013?.rule ?? "")).toMatch(/5\.2/);
  });

  test("JS/CSS bundles within engineering budgets on the measured build (via formal gate)", () => {
    const baseline = loadBaseline();
    const { issues } = runValidateCli(baseline);
    // The formal gate reports bundle over-budget as JS_BUNDLE_OVER /
    // CSS_BUNDLE_OVER. The real baseline must not trigger them.
    expect(issues.some((i: any) => i.code === "JS_BUNDLE_OVER")).toBe(false);
    expect(issues.some((i: any) => i.code === "CSS_BUNDLE_OVER")).toBe(false);
    // Sanity: the constants agree.
    expect(ENGINEERING_BUDGETS.jsGzipBytes).toBe(20 * 1024);
    expect(ENGINEERING_BUDGETS.cssGzipBytes).toBe(40 * 1024);
  });
});
