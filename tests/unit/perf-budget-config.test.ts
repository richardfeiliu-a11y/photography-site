// WP-45 — frozen performance budget config (unit RED first).
//
// Authority: research/production-architecture/PERFORMANCE_BUDGET.md sections
// 2 (STANDARD WEB TARGET: LCP/CLS/INP) and 3 (PROJECT ENGINEERING BUDGET:
// JS/CSS/memory/build). Values below must match the frozen document exactly;
// this test guards against silent drift. Section 3 values are aspirational
// and must NOT become CI gates without a MEASURED BASELINE (budget 1).
import { describe, expect, test } from "vitest";
import { ENGINEERING_BUDGETS, FROZEN_WEB_VITALS, PROBE_PAGES } from "../../src/lib/perf/budget";

describe("WP-45 frozen web vitals (budget section 2)", () => {
  test("LCP target 2.5s on hero/first-photo/first-card scope", () => {
    expect(FROZEN_WEB_VITALS.lcpMs).toBe(2500);
    expect(FROZEN_WEB_VITALS.lcpScope).toContain("home-hero");
    expect(FROZEN_WEB_VITALS.lcpScope).toContain("gallery-first-photo");
  });
  test("CLS target 0.1 on all pages", () => {
    expect(FROZEN_WEB_VITALS.cls).toBe(0.1);
    expect(FROZEN_WEB_VITALS.clsScope).toBe("all-pages");
  });
  test("INP target 200ms on overview/menu/jump interactions", () => {
    expect(FROZEN_WEB_VITALS.inpMs).toBe(200);
    expect(FROZEN_WEB_VITALS.inpScope).toContain("overview-toggle");
  });
});

describe("WP-45 engineering budgets (budget section 3, aspirational)", () => {
  test("JS/CSS/build budgets match the frozen numbers", () => {
    expect(ENGINEERING_BUDGETS.jsGzipBytes).toBe(20 * 1024);
    expect(ENGINEERING_BUDGETS.cssGzipBytes).toBe(40 * 1024);
    expect(ENGINEERING_BUDGETS.buildIncrementalSecs).toBe(10);
    expect(ENGINEERING_BUDGETS.buildFullSecs).toBe(60);
  });
  test("probe pages cover every LCP role and the CJK case", () => {
    const roles = PROBE_PAGES.map((p) => p.role);
    expect(roles).toContain("home-hero");
    expect(roles).toContain("gallery-first-photo");
    expect(roles).toContain("gallery-cjk-title");
    expect(roles).toContain("place-card");
    expect(roles).toContain("static");
  });
});
