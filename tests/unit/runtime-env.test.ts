// R1 — runtime.mjs environment check (RED first).
// 方案 §5.2: the declared engines range is the contract; the acceptance
// process must match it. We never silently widen the range to the current
// environment — a mismatch is a blocker to record, not a number to edit.
import { describe, expect, test } from "vitest";
import { checkRuntime } from "../../scripts/validate/runtime.mjs";

describe("runtime.mjs environment check", () => {
  test("a Node version outside the declared engines range fails", () => {
    const result = checkRuntime({
      nodeVersion: "v26.5.0",
      declaredRange: ">=22.12.0 <23",
      npmRoot: "/repo",
      packageManager: "npm",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "NODE_VERSION_OUT_OF_RANGE")).toBe(true);
    // 实际值与要求都要输出，便于人类读
    expect(JSON.stringify(result)).toContain("v26.5.0");
  });

  test("a Node version inside the declared range passes", () => {
    const result = checkRuntime({
      nodeVersion: "v22.14.0",
      declaredRange: ">=22.12.0 <23",
      npmRoot: "/repo",
      packageManager: "npm",
    });
    expect(result.ok).toBe(true);
  });

  test("missing dependency install identity is detected", () => {
    const result = checkRuntime({
      nodeVersion: "v22.14.0",
      declaredRange: ">=22.12.0 <23",
      npmRoot: "/repo",
      packageManager: "npm",
      nodeModulesExists: false,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "DEPS_NOT_INSTALLED")).toBe(true);
  });
});
