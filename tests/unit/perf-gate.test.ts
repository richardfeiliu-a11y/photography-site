// R2 — validateBaseline() pure gate (RED first). These are UNIT inputs, not the
// real baseline: prove positive pass first, then mutate ONE thing at a time and
// prove rejection. 方案 §6.1.
import { describe, expect, test } from "vitest";
import { validateBaseline } from "../../scripts/perf/validate-baseline.mjs";

// D6: a valid record must now also carry a measurable cold session
// (Home + one gallery page + one place page), so the fixture includes one.
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

function validInput() {
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
              transferredImageBytes: 200_000,
              decodedImageMethod:
                "MODEL ESTIMATE: sum of current-src naturalWidth × naturalHeight × 4",
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
              transferredImageBytes: 200_000,
              decodedImageMethod:
                "MODEL ESTIMATE: sum of current-src naturalWidth × naturalHeight × 4",
            },
          },
        },
      },
      sessionPage("/galleries/fixture"),
      sessionPage("/places/fixture"),
    ],
    interactions: [
      {
        id: "overview-open",
        method: "event-timing-attributed",
        profiles: {
          desktop: {
            attribution: true,
            medianMs: 48,
            runs: [
              { interactionId: 11, targetAction: "overview-open", durationMs: 48 },
              { interactionId: 22, targetAction: "overview-open", durationMs: 48 },
              { interactionId: 33, targetAction: "overview-open", durationMs: 48 },
            ],
          },
          mobileLowEnd: {
            attribution: true,
            medianMs: 48,
            runs: [
              { interactionId: 11, targetAction: "overview-open", durationMs: 48 },
              { interactionId: 22, targetAction: "overview-open", durationMs: 48 },
              { interactionId: 33, targetAction: "overview-open", durationMs: 48 },
            ],
          },
        },
      },
    ],
    bundles: {
      jsGzipBytes: 1000,
      cssGzipBytes: 1000,
      perRouteScriptGzipBytes: {
        "/": {
          inlineJsGzipBytes: 400,
          externalJsGzipBytes: 600,
          routeJsGzipBytes: 1000,
        },
      },
    },
    host: { node: "v22.14.0", nodeEnginesRequired: ">=22.12 <23", nodeEngineSatisfied: true },
    fingerprint: {
      gitBranch: "chatGPT/gallery-visual-redesign",
      gitSha: "c0495d905ce3180ac6984c9371154b24b1d201ab",
      gitDirty: false,
      dirtyFileCount: 0,
      dirtyFiles: [],
      trackedContentDiffSha256: null,
      untrackedSourceHashes: {},
    },
  };
}

describe("validateBaseline() rejects tampered data", () => {
  test("valid input passes", () => {
    const { ok, issues } = validateBaseline(validInput());
    expect(ok).toBe(true);
    expect(issues).toEqual([]);
  });

  test("LCP=99999 rejected", () => {
    const b = validInput();
    b.pages[0].profiles.desktop.lcp.medianMs = 99999;
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(
      issues.some((i) => i.code === "LCP_OVER_FROZEN" && i.path.includes("desktop.lcp.medianMs")),
    ).toBe(true);
  });

  test("zero-value LCP run rejected", () => {
    const b = validInput();
    b.pages[0].profiles.mobileLowEnd.lcp.medianMs = 0;
    const { ok } = validateBaseline(b);
    expect(ok).toBe(false);
  });

  test("wrong targetAction rejected", () => {
    const b = validInput();
    b.interactions[0].profiles.desktop.runs[0].targetAction = "overview-close";
    const { ok } = validateBaseline(b);
    expect(ok).toBe(false);
  });

  test("old mislabeled decodedImageBytes field rejected", () => {
    const b: any = validInput();
    b.pages[0].profiles.desktop.memory = { decodedImageBytes: 123 };
    const { ok } = validateBaseline(b);
    expect(ok).toBe(false);
  });

  test("missing page/profile rejected", () => {
    const b: any = validInput();
    delete b.pages[0].profiles.mobileLowEnd;
    const { ok } = validateBaseline(b);
    expect(ok).toBe(false);
  });

  test("R4: per-route JS over the 20480B budget rejected", () => {
    const b: any = validInput();
    b.bundles.perRouteScriptGzipBytes["/"].routeJsGzipBytes = 20_481;
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "JS_ROUTE_OVER")).toBe(true);
  });

  test("R4: missing fingerprint rejected", () => {
    const b: any = validInput();
    delete b.fingerprint;
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "FINGERPRINT_MISSING")).toBe(true);
  });

  test("R4: dirty run without any diff hash rejected", () => {
    const b: any = validInput();
    b.fingerprint = { gitDirty: true, trackedContentDiffSha256: null, untrackedSourceHashes: {} };
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "FINGERPRINT_EMPTY")).toBe(true);
  });

  test("R4: measurement on an unsupported Node engine rejected", () => {
    const b: any = validInput();
    b.host.nodeEngineSatisfied = false;
    b.host.node = "v26.5.0";
    const { ok, issues } = validateBaseline(b);
    expect(ok).toBe(false);
    expect(issues.some((i) => i.code === "NODE_ENGINE_UNSUPPORTED")).toBe(true);
  });
});
