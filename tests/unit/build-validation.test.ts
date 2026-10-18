// WP-06 unit tests for the build-validation scaffold (tests/support/build-validation.mjs).
// TDD: written before the module exists — RED first, then the module is implemented
// to satisfy these contracts. Later WPs (WP-13/WP-23/WP-51) plug real hooks in.
import { describe, expect, test } from "vitest";
import { BUILD_VALIDATION_STAGES, runBuildValidation } from "../support/build-validation.mjs";

describe("BUILD_VALIDATION_STAGES", () => {
  test("declares the frozen lifecycle stage order", () => {
    expect(BUILD_VALIDATION_STAGES).toEqual([
      "beforeBuild",
      "build",
      "afterBuild",
      "validateRelease",
    ]);
  });
});

describe("runBuildValidation", () => {
  test("rejects unknown hook stage names up front", async () => {
    await expect(runBuildValidation({ notAStage: async () => {} })).rejects.toThrow(
      /unknown hook stage/i,
    );
  });

  test("runs provided hooks in stage order and passes a shared context", async () => {
    const order: string[] = [];
    const seen: unknown[] = [];
    const result = await runBuildValidation({
      beforeBuild: async (ctx) => {
        order.push("beforeBuild");
        seen.push(ctx);
      },
      build: async (ctx) => {
        order.push("build");
        seen.push(ctx);
      },
      afterBuild: async (ctx) => {
        order.push("afterBuild");
        seen.push(ctx);
      },
      validateRelease: async (ctx) => {
        order.push("validateRelease");
        seen.push(ctx);
      },
    });
    expect(order).toEqual(["beforeBuild", "build", "afterBuild", "validateRelease"]);
    expect(seen.length).toBe(4);
    for (const ctx of seen) expect(ctx).toBe(seen[0]);
    expect(result.ok).toBe(true);
    expect(result.results.map((r) => r.status)).toEqual(["passed", "passed", "passed", "passed"]);
  });

  // WP-12: this test runs a REAL astro build (~3.5s standalone) inside the
  // default 5s vitest timeout — it flaked once once the suite grew past 12
  // files. Give the real build headroom instead of a timeout that assumes an
  // idle machine.
  test(
    "stages without hooks are skipped, except build which defaults to a real build",
    { timeout: 120_000 },
    async () => {
      const result = await runBuildValidation({});
      expect(result.ok).toBe(true);
      const byStage = Object.fromEntries(result.results.map((r) => [r.stage, r]));
      expect(byStage.beforeBuild?.status).toBe("skipped");
      expect(byStage.build?.status).toBe("passed");
      expect(byStage.afterBuild?.status).toBe("skipped");
      expect(byStage.validateRelease?.status).toBe("skipped");
    },
  );

  test("fail-closed: a failing stage stops later stages and reports the error", async () => {
    const laterRan: string[] = [];
    const result = await runBuildValidation({
      beforeBuild: async () => {
        throw new Error("content pre-flight failed");
      },
      afterBuild: async () => {
        laterRan.push("afterBuild");
      },
      validateRelease: async () => {
        laterRan.push("validateRelease");
      },
    });
    expect(result.ok).toBe(false);
    expect(laterRan).toEqual([]);
    const failed = result.results.find((r) => r.stage === "beforeBuild");
    expect(failed).toBeDefined();
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toMatch(/content pre-flight failed/);
    for (const stage of ["build", "afterBuild", "validateRelease"]) {
      const skipped = result.results.find((r) => r.stage === stage);
      expect(skipped).toBeDefined();
      expect(skipped?.status).toBe("skipped");
    }
  });
});
