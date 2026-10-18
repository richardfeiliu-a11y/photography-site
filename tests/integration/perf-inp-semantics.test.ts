// WP-45 Round 2 IMP-02 — INP attribution semantics (RED first).
//
// The v2 harness started the observer before the setup-open click and took the
// max over the full window, so open/close/jump reported identical distributions.
// These gates require: attributed Event Timing method label, per-run
// interactionId + targetAction, no zero-entry runs, and close/jump
// distributions differing from open (setup excluded).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const BASELINE_FILE = new URL("../../docs/implementation/PERF-BASELINE.json", import.meta.url).pathname;

function load(): any {
  expect(existsSync(BASELINE_FILE), "run npm run perf:measure first").toBe(true);
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as any;
}

describe("INP attribution semantics (IMP-02)", () => {
  test("method is event-timing-attributed, never wall-clock/click-to-visible", () => {
    const b = load();
    expect(String(b.inpMethod ?? "")).toMatch(/event-timing-attributed/i);
    expect(String(b.inpMethod ?? "")).not.toMatch(/wall-clock/i);
    expect(String(b.inpMethod ?? "")).not.toMatch(/click-to-visible/i);
  });

  test("every gated run carries interactionId + targetAction, zero-entry runs absent", () => {
    const b = load();
    for (const i of b.interactions as Array<any>) {
      if (i.status === "na") continue;
      for (const name of ["desktop", "mobileLowEnd"]) {
        const s = i.profiles?.[name];
        expect(s?.attribution, `${i.id} ${name} attributed`).toBe(true);
        expect(s?.runs?.length, `${i.id} ${name} runs`).toBeGreaterThanOrEqual(3);
        for (const r of s.runs) {
          expect(r.interactionId, `${i.id} run has interactionId`).toBeTruthy();
          expect(r.targetAction, `${i.id} run has targetAction`).toBe(i.id);
          expect(r.durationMs, `${i.id} nonzero`).toBeGreaterThan(0);
        }
      }
    }
  });

  test("close/jump exclude setup-open (distributions differ from open)", () => {
    const b = load();
    const get = (id: string, p: string): string =>
      ((b.interactions as Array<any>).find((x) => x.id === id)?.profiles?.[p]?.runs?.map(
        (r: any) => r.durationMs ?? r,
      ) ?? []).join(",");
    expect(get("overview-close", "desktop")).not.toBe(get("overview-open", "desktop"));
    expect(get("overview-jump", "desktop")).not.toBe(get("overview-open", "desktop"));
  });
});
