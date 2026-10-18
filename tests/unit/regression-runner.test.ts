// R1 — the serial regression runner must surface every exit code and never
// swallow a failure to reach "success".
import { describe, expect, test } from "vitest";
import { planSteps, summarize } from "../../scripts/verify/implementation-regression.mjs";

describe("implementation-regression.mjs planning + summary", () => {
  test("planSteps covers the frozen serial suite in order", () => {
    const steps = planSteps({ includePreview: true });
    const names = steps.map((s) => s.name);
    for (const n of [
      "check",
      "test:unit",
      "test:integration",
      "test:e2e",
      "test:a11y",
      "build",
      "test:e2e:preview",
    ]) {
      expect(names).toContain(n);
    }
    expect(names.indexOf("build")).toBeGreaterThan(names.indexOf("test:unit"));
  });

  test("a single failing step makes overall FAIL with its exit code preserved", () => {
    const summary = summarize([
      { name: "check", code: 0 },
      { name: "test:unit", code: 1 },
      { name: "build", code: 0 },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.failed).toEqual(["test:unit"]);
    expect(summary.byName["test:unit"]).toBe(1);
  });

  test("performance-red known items are listed separately, not mixed into generic failure", () => {
    const summary = summarize([
      {
        name: "test:integration",
        code: 1,
        perfRed: ["LCP mobile Home", "LCP desktop Long-72"],
      },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.perfRed).toContain("LCP mobile Home");
  });
});
