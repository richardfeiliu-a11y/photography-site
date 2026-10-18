// D6 (2026-09-15, owner-authorized): COLD-SESSION transfer budget.
//
// The budget itself lives in src/lib/perf/budget.ts (SESSION_BUDGET) and is
// enforced by scripts/perf/validate-baseline.mjs (SESSION_BYTES_OVER /
// SESSION_PAYLOAD_MISSING). This suite pins the COMPOSITION rule (Home + worst
// gallery + worst place, per profile) and proves the gate has teeth.
import { describe, expect, test } from "vitest";

import { SESSION_BUDGET } from "../../src/lib/perf/budget";
import { sessionBytes, validateBaseline } from "../../scripts/perf/validate-baseline.mjs";

function page(path: string, bytes: { desktop: number; mobile: number }, included = true) {
  const payload = (value: number) => ({
    unit: "bytes-transferred",
    runs: included
      ? [{ htmlBytes: value, cssBytes: 0, jsBytes: 0, imgBytes: 0, fontBytes: 0, otherBytes: 0 }]
      : [],
  });
  return {
    path,
    label: path,
    profiles: {
      desktop: {
        lcp: { medianMs: 100 },
        cls: { median: 0 },
        payload: payload(bytes.desktop),
      },
      mobileLowEnd: {
        lcp: { medianMs: 100 },
        cls: { median: 0 },
        payload: payload(bytes.mobile),
      },
    },
  };
}

function record(pages: Array<ReturnType<typeof page>>): Record<string, any> {
  return {
    version: 2,
    tool: "scripts/perf/measure.mjs",
    host: { node: "v22.14.0", nodeEnginesRequired: ">=22.12.0 <23" },
    pages,
    interactions: [],
  };
}

describe("sessionBytes() composition", () => {
  test("takes Home plus the WORST gallery and place page per profile", () => {
    const data = record([
      page("/", { desktop: 1000, mobile: 300 }),
      page("/galleries/small", { desktop: 100, mobile: 500 }),
      page("/galleries/big", { desktop: 2000, mobile: 90 }),
      page("/places/one", { desktop: 500, mobile: 400 }),
      page("/places/two", { desktop: 300, mobile: 700 }),
      page("/archive", { desktop: 9999, mobile: 9999 }),
    ]);
    const desktop = sessionBytes(data, "desktop");
    expect(desktop.parts.map((p) => p.path)).toEqual(["/", "/galleries/big", "/places/one"]);
    expect(desktop.total).toBe(3500);
    const mobile = sessionBytes(data, "mobileLowEnd");
    expect(mobile.parts.map((p) => p.path)).toEqual(["/", "/galleries/small", "/places/two"]);
    expect(mobile.total).toBe(1500);
    // /archive and /about are NOT part of a session definition.
    expect(desktop.parts.some((p) => p.path === "/archive")).toBe(false);
  });

  test("reports missing pages/ payloads instead of counting them as zero", () => {
    const noPayload = record([
      page("/", { desktop: 1000, mobile: 300 }, false),
      page("/galleries/big", { desktop: 2000, mobile: 90 }),
      page("/places/one", { desktop: 500, mobile: 400 }),
    ]);
    const missingHome = sessionBytes(noPayload, "desktop");
    expect(missingHome.missing).toContain("/");
    expect(missingHome.total).toBe(2500);
    expect(validateBaseline(noPayload).issues.map((i: any) => i.code)).toContain(
      "SESSION_PAYLOAD_MISSING",
    );

    const noScenarioPages = record([page("/", { desktop: 1000, mobile: 300 })]);
    expect(sessionBytes(noScenarioPages, "desktop").missing).toEqual([
      "a /galleries/<slug> page",
      "a /places/<slug> page",
    ]);
  });
});

describe("SESSION_BYTES_OVER gate", () => {
  test("inside-budget record passes with no session issue", () => {
    const data = record([
      page("/", { desktop: SESSION_BUDGET.desktopBytes / 3, mobile: SESSION_BUDGET.mobileLowEndBytes / 3 }),
      page("/galleries/g", {
        desktop: SESSION_BUDGET.desktopBytes / 3,
        mobile: SESSION_BUDGET.mobileLowEndBytes / 3,
      }),
      page("/places/p", {
        desktop: SESSION_BUDGET.desktopBytes / 3,
        mobile: SESSION_BUDGET.mobileLowEndBytes / 3,
      }),
    ]);
    const codes = validateBaseline(data).issues.map((i: any) => i.code);
    expect(codes).not.toContain("SESSION_BYTES_OVER");
    expect(codes).not.toContain("SESSION_PAYLOAD_MISSING");
  });

  test("one oversized gallery page fails the desktop gate (RED)", () => {
    const data = record([
      page("/", { desktop: 800 * 1024, mobile: 300 * 1024 }),
      page("/galleries/huge", { desktop: 1_500 * 1024, mobile: 300 * 1024 }),
      page("/places/p", { desktop: 300 * 1024, mobile: 300 * 1024 }),
    ]);
    const issues = validateBaseline(data).issues.filter(
      (i: any) => i.code === "SESSION_BYTES_OVER",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("session.desktop.transferredBytes");
    expect(issues[0].detail).toContain("/galleries/huge");
  });

  test("mobile budget is enforced with its own limit", () => {
    // 3 x 300 KB = 900 KB mobile, inside the 1,024 KB mobile limit.
    const data = record([
      page("/", { desktop: 800 * 1024, mobile: 300 * 1024 }),
      page("/galleries/g", { desktop: 800 * 1024, mobile: 300 * 1024 }),
      page("/places/p", { desktop: 200 * 1024, mobile: 300 * 1024 }),
    ]);
    const codes = validateBaseline(data).issues.map((i: any) => i.code);
    expect(codes).not.toContain("SESSION_BYTES_OVER");
    // 3 x 400 KB = 1,200 KB mobile: over the mobile limit while the desktop
    // composition (1,800 KB) stays inside its own 2,048 KB limit.
    // 3 x 400 KB = 1,200 KB mobile: over the mobile limit while the desktop
    // composition (1,800 KB) stays inside its own 2,048 KB limit.
    const tighter = record([
      page("/", { desktop: 800 * 1024, mobile: 500 * 1024 }),
      page("/galleries/g", { desktop: 800 * 1024, mobile: 500 * 1024 }),
      page("/places/p", { desktop: 200 * 1024, mobile: 500 * 1024 }),
    ]);
    expect(
      validateBaseline(tighter).issues.filter((i: any) => i.code === "SESSION_BYTES_OVER"),
    ).toHaveLength(1);
  });
});
