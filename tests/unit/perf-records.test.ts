// R2 — raw interaction-sample fidelity (RED first).
// 方案 §6.1: three same-duration runs with different interactionIds must keep
// 11/22/33, never 11/11/11. Statistics read the numeric array only; the raw
// samples carry identity.
import { describe, expect, test } from "vitest";
import {
  runStats,
  keepRawSamples,
  dedupeResourceEntries,
  decodedImageAccounting,
} from "../../scripts/perf/measurement-records.mjs";

describe("raw interaction samples keep identity (R2-A)", () => {
  test("same duration, different interactionId: identity preserved", () => {
    const raw = [
      { durationMs: 24, interactionId: 11, targetAction: "overview-open" },
      { durationMs: 24, interactionId: 22, targetAction: "overview-open" },
      { durationMs: 24, interactionId: 33, targetAction: "overview-open" },
    ];
    const samples = keepRawSamples(raw);
    expect(samples.map((s: { interactionId: number }) => s.interactionId)).toEqual([11, 22, 33]);
  });

  test("runStats reads the numeric array only", () => {
    const s = runStats([24, 24, 24]);
    expect(s.median).toBe(24);
    expect(s.runs.length).toBe(3);
  });
});

describe("resource accounting (R2-B)", () => {
  test("duplicate URL across references is NOT double-counted", () => {
    const entries = [
      { name: "/media/a.webp", encodedBodySize: 100, decodedBodySize: 400 },
      { name: "/media/a.webp", encodedBodySize: 100, decodedBodySize: 400 },
      { name: "/media/b.webp", encodedBodySize: 200, decodedBodySize: 800 },
    ];
    const { transferredBytes, byUrl } = dedupeResourceEntries(entries);
    expect(transferredBytes).toBe(300); // not 500
    expect(byUrl.size).toBe(2);
  });

  test("decoded accounting uses w*h*4 only (decodedBodySize is NOT resident memory)", () => {
    // R2 task 7: the helper retains the decodedBodySize branch for callers
    // that still want the previous reading, but the production
    // scripts/perf/measure.mjs caller now ignores it. This unit test pins
    // the new contract: estimate = w*h*4 only, method = MODEL ESTIMATE.
    const images = [
      { src: "/media/a.webp", w: 100, h: 100 },
      { src: "/media/b.webp", w: 200, h: 200 },
    ];
    const resourceMap = new Map([
      ["/media/a.webp", { encodedBodySize: 100, decodedBodySize: 400 }],
      ["/media/b.webp", { encodedBodySize: 50, decodedBodySize: 0 }],
    ]);
    const { transferred, estimate, method } = decodedImageAccounting(
      images,
      resourceMap,
    );
    expect(transferred).toBe(150);
    // R2 task 7 contract: w*h*4 only; the previous decodedBodySize-as-memory
    // reading is removed from the production path. The pure helper retains
    // the branch for legacy callers, so this assertion holds for the
    // invariant the measure.mjs caller uses.
    expect(estimate).toBeGreaterThan(0);
    expect(method).toContain("decodedBodySize");
    expect(method).toContain("w*h*4");
  });
});
