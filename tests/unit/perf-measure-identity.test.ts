// R4 round4 (T7) — measurement-identity hardening, RED first.
//
// The reconciliation plan (§4 T7) requires the measurement record to be
// judged on its full engine range and on a COMPLETE fingerprint, instead of
// trusting a self-reported boolean and a non-empty object:
//   - `>=22.12.0 <23` must reject v22.11.0 (below the floor) and v23.x,
//     while v22.14.0 passes — the old check compared only the first number.
//   - an untracked entry recorded as `null` (a directory read that threw) or
//     as the explicit UNREADABLE marker is a fingerprint gap, not a pass.
//   - a dirty file list whose first path character was eaten by the old
//     `slice(3)` cannot identify the candidate.
import { describe, expect, test } from "vitest";
import { validateBaseline } from "../../scripts/perf/validate-baseline.mjs";
import { nodeEngineSatisfied, versionSatisfiesRange } from "../../scripts/perf/engine.mjs";

const ENGINE_RANGE = ">=22.12.0 <23";

// Loosely typed on purpose: each case mutates one field to a value the
// validator must REJECT (null hash, torn path, unsupported engine).
// D6: the record must also carry a measurable cold session (Home + one gallery
// page + one place page) for the transfer-budget gate to have inputs.
function sessionPage(path: string) {
  const profile = () => ({
    lcp: { medianMs: 500, runs: [500, 500, 500, 500, 500] },
    cls: { median: 0 },
    payload: {
      unit: "bytes-transferred",
      runs: [
        {
          htmlBytes: 20_000,
          cssBytes: 15_000,
          jsBytes: 1_000,
          imgBytes: 200_000,
          fontBytes: 70_000,
          otherBytes: 0,
        },
      ],
    },
  });
  return { path, label: path, profiles: { desktop: profile(), mobileLowEnd: profile() } };
}

function validInput(): Record<string, any> {
  return {
    version: 2,
    tool: "scripts/perf/measure.mjs",
    pages: [
      {
        path: "/",
        profiles: {
          desktop: {
            lcp: { medianMs: 840, runs: [836, 836, 840, 840, 840] },
            cls: { median: 0 },
            payload: {
              unit: "bytes-transferred",
              runs: [
                {
                  htmlBytes: 20_000,
                  cssBytes: 15_000,
                  jsBytes: 1_000,
                  imgBytes: 200_000,
                  fontBytes: 70_000,
                  otherBytes: 0,
                },
              ],
            },
            memory: {
              jsHeapBytes: 1_000_000,
              domNodes: 100,
              decodedImageEstimateBytes: 1_000_000,
            },
          },
          mobileLowEnd: {
            lcp: { medianMs: 1800, runs: [1, 2, 3, 4, 5] },
            cls: { median: 0 },
            payload: {
              unit: "bytes-transferred",
              runs: [
                {
                  htmlBytes: 20_000,
                  cssBytes: 15_000,
                  jsBytes: 1_000,
                  imgBytes: 200_000,
                  fontBytes: 70_000,
                  otherBytes: 0,
                },
              ],
            },
            memory: {
              jsHeapBytes: 1_000_000,
              domNodes: 100,
              decodedImageEstimateBytes: 1_000_000,
            },
          },
        },
      },
      sessionPage("/galleries/fixture"),
      sessionPage("/places/fixture"),
    ],
    interactions: [],
    bundles: { jsGzipBytes: 1000, cssGzipBytes: 1000 },
    host: {
      node: "v22.14.0",
      nodeEngineSatisfied: true,
      nodeEnginesRequired: ENGINE_RANGE,
    },
    fingerprint: {
      gitBranch: "chatGPT/gallery-visual-redesign",
      gitSha: "c0495d905ce3180ac6984c9371154b24b1d201ab",
      gitDirty: true,
      dirtyFileCount: 2,
      dirtyFiles: ["content/galleries/aegean/meta.yaml", "scripts/perf/measure.mjs"],
      trackedContentDiffSha256: "a".repeat(64),
      untrackedSourceHashes: { "src/lib/presentation/photographed-date.ts": "b".repeat(64) },
    },
  };
}

describe("T7: Node engine range is checked in full, not by major version", () => {
  test("22.14.0 satisfies >=22.12.0 <23", () => {
    expect(versionSatisfiesRange("v22.14.0", ENGINE_RANGE)).toBe(true);
    expect(nodeEngineSatisfied(ENGINE_RANGE, "v22.14.0")).toBe(true);
  });

  test("22.11.0 is BELOW the floor and must not satisfy the range", () => {
    expect(versionSatisfiesRange("v22.11.0", ENGINE_RANGE)).toBe(false);
  });

  test("a future major (23.x) must not satisfy the range", () => {
    expect(versionSatisfiesRange("v23.0.0", ENGINE_RANGE)).toBe(false);
  });

  test("an unparseable or empty range is never satisfied", () => {
    expect(versionSatisfiesRange("v22.14.0", "")).toBe(false);
    expect(versionSatisfiesRange("v22.14.0", "not-a-range")).toBe(false);
  });

  test("the validator re-checks the recorded version (a lying boolean is rejected)", () => {
    const b = validInput();
    b.host.node = "v22.11.0";
    b.host.nodeEngineSatisfied = true; // harness self-report must not be trusted
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(
      issues.some(
        (i) => i.code === "NODE_ENGINE_UNSUPPORTED" && i.detail.includes("v22.11.0"),
      ),
    ).toBe(true);
  });

  test("the recorded supported version passes the same re-check", () => {
    const { ok, issues } = validateBaseline(validInput());
    expect(issues.filter((i) => i.code === "NODE_ENGINE_UNSUPPORTED")).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("T7: fingerprint completeness", () => {
  test("a null (directory) entry without a hash is rejected", () => {
    const b = validInput();
    b.fingerprint.untrackedSourceHashes["scripts/reports/"] = null;
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "FINGERPRINT_INCOMPLETE")).toBe(true);
  });

  test("an UNREADABLE marker is rejected instead of passing as a hash", () => {
    const b = validInput();
    b.fingerprint.untrackedSourceHashes["src/lib/presentation/photographed-date.ts"] = "UNREADABLE";
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "FINGERPRINT_INCOMPLETE")).toBe(true);
  });

  test("a torn dirty-file path (truncated first character) is rejected", () => {
    const b = validInput();
    // What the old `slice(3)` produced for `content/...`.
    b.fingerprint.dirtyFiles = ["ontent/galleries/aegean/meta.yaml", ""];
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "FINGERPRINT_TORN_PATH")).toBe(true);
  });

  test("a complete fingerprint passes", () => {
    const { issues } = validateBaseline(validInput());
    expect(issues.filter((i) => i.code.startsWith("FINGERPRINT"))).toEqual([]);
  });
});
