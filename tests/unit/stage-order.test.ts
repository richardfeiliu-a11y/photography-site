// WP-18 — stage-ordering guard unit tests (IMAGE_PIPELINE.md §5 "Stage
// ordering invariants", machine-enforced).
//
// The canonical pipeline stage order (§5) carries correctness dependencies:
//   - Metadata needed for color conversion (ICC) must not be stripped before
//     conversion → extract-metadata before color-transform, color-transform
//     before strip-metadata.
//   - Orientation must be normalized before resize → normalize-orientation
//     before resize-encode.
//   - Hashing must occur after all pixel and metadata transforms →
//     hash-output last.
// WP-19..21 compose their pipelines through this validator, so a strip-first
// or resize-before-orient plan is structurally impossible without failing here.
import { describe, expect, test } from "vitest";
import {
  PIPELINE_STAGES,
  STAGE_ORDER_NOTE,
  validateStagePlan,
} from "../../scripts/media/stage-order";

const CANONICAL = [
  "read-decode",
  "extract-metadata",
  "normalize-orientation",
  "color-transform",
  "resize-encode",
  "strip-metadata",
  "embed-output-icc",
  "hash-output",
] as const;

describe("WP-18 stage-order guard — canonical plan acceptance", () => {
  test("the canonical full pipeline plan is accepted", () => {
    const result = validateStagePlan(CANONICAL);
    expect(result.ok).toBe(true);
  });

  test("PIPELINE_STAGES matches IMAGE_PIPELINE §5 exactly", () => {
    expect([...PIPELINE_STAGES]).toEqual([...CANONICAL]);
  });

  test("valid sub-plans are accepted (partial pipelines compose too)", () => {
    expect(validateStagePlan(["read-decode", "extract-metadata"]).ok).toBe(true);
    expect(validateStagePlan(["read-decode", "extract-metadata", "normalize-orientation"]).ok).toBe(
      true,
    );
    expect(
      validateStagePlan([
        "read-decode",
        "extract-metadata",
        "normalize-orientation",
        "color-transform",
        "resize-encode",
      ]).ok,
    ).toBe(true);
  });

  test("the empty plan is valid (nothing to violate)", () => {
    expect(validateStagePlan([]).ok).toBe(true);
  });

  test("STAGE_ORDER_NOTE documents the enforced authority", () => {
    expect(STAGE_ORDER_NOTE).toContain("IMAGE_PIPELINE");
    expect(STAGE_ORDER_NOTE).toContain("orientation");
  });
});

describe("WP-18 stage-order guard — strip-first rejection (the brief's RED case)", () => {
  test("a strip-first plan (strip before extract/color) is rejected", () => {
    const stripFirst = [
      "read-decode",
      "strip-metadata", // strips metadata BEFORE it was read / color used it
      "extract-metadata",
      "normalize-orientation",
      "color-transform",
      "resize-encode",
      "hash-output",
    ];
    const result = validateStagePlan(stripFirst);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const rules = result.issues.map((i) => i.rule);
    // strip before extract kills the ICC read; strip before color kills the
    // conversion source — at least one order violation must fire.
    expect(rules.some((r) => r.startsWith("5:"))).toBe(true);
    expect(result.issues.some((i) => i.message.includes("strip-metadata"))).toBe(true);
  });

  test("color-transform without any extract-metadata is rejected (ICC never read)", () => {
    const result = validateStagePlan(["read-decode", "normalize-orientation", "color-transform"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:color-requires-extract")).toBe(true);
  });
});

describe("WP-18 stage-order guard — subsequence enforcement (fix round 1)", () => {
  test("the adversarial out-of-order plan (orient before extract) is rejected", () => {
    // The old hand-listed five-pair table PASSED this plan: orientation was
    // normalized before metadata extraction — dangerous, because extraction
    // must read the RAW orientation tag before anything consumes it. The
    // subsequence check catches every such co-present pair.
    const result = validateStagePlan([
      "read-decode",
      "normalize-orientation",
      "extract-metadata",
      "color-transform",
      "resize-encode",
      "hash-output",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:stage-order")).toBe(true);
    expect(result.issues.some((i) => i.message.includes("extract-metadata"))).toBe(true);
  });
});

describe("WP-18 stage-order guard — resize-before-orient rejection", () => {
  test("resize before orientation normalization is rejected", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "color-transform",
      "resize-encode", // resize BEFORE normalize-orientation — invariant breach
      "normalize-orientation",
      "hash-output",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:stage-order")).toBe(true);
    expect(result.issues.some((i) => i.message.includes("resize-encode"))).toBe(true);
  });

  test("resize with no orientation stage at all is rejected", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "color-transform",
      "resize-encode",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:resize-requires-orientation")).toBe(true);
  });
});

describe("WP-18 stage-order guard — remaining §5 invariants", () => {
  test("strip before color-transform is rejected (ICC needed for conversion)", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "normalize-orientation",
      "strip-metadata",
      "color-transform",
      "hash-output",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:stage-order")).toBe(true);
  });

  test("hash-output not last is rejected (hash reflects all transforms)", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "hash-output",
      "normalize-orientation",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:hash-last")).toBe(true);
  });

  test("embed-output-icc before strip-metadata is rejected (CR-01 final-byte order)", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "normalize-orientation",
      "color-transform",
      "embed-output-icc",
      "strip-metadata",
      "hash-output",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:stage-order")).toBe(true);
  });

  test("embed-output-icc without color-transform is rejected (post-conversion decision)", () => {
    // In canonical relative order (strip before embed), so ONLY the hard
    // requirement catches it: IMAGE_PIPELINE §5 stage 7 is a post-conversion
    // decision — embedding output ICC without a color transform is meaningless.
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "strip-metadata",
      "embed-output-icc",
      "hash-output",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:embed-requires-color")).toBe(true);
  });

  test("unknown stage names are rejected", () => {
    const result = validateStagePlan(["read-decode", "photoshop-filter", "hash-output"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:unknown-stage")).toBe(true);
    expect(result.issues.some((i) => i.message.includes("photoshop-filter"))).toBe(true);
  });

  test("duplicate stages are rejected (each stage runs exactly once)", () => {
    const result = validateStagePlan([
      "read-decode",
      "extract-metadata",
      "normalize-orientation",
      "normalize-orientation",
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.rule === "5:duplicate-stage")).toBe(true);
  });
});
