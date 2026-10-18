// scripts/perf/measurement-records.mjs — R2: pure sample/stat/resource
// accounting helpers, unit-testable without a browser. Statistics read the
// numeric array ONLY; identity (interactionId) travels with the raw samples and
// is never reverse-derived from a duration value (方案 §6.1).
export function runStats(values) {
  const runs = [...values].sort((a, b) => a - b);
  const sum = runs.reduce((a, b) => a + b, 0);
  return {
    runs,
    min: runs[0],
    max: runs[runs.length - 1],
    median: runs[Math.floor(runs.length / 2)],
    mean: runs.length ? Math.round((sum / runs.length) * 100) / 100 : 0,
  };
}

// Keep the raw samples verbatim (identity preserved); stats are derived from
// the numeric array only.
export function keepRawSamples(raw) {
  return raw.map((r) => ({
    durationMs: r.durationMs,
    interactionId: r.interactionId,
    targetAction: r.targetAction,
  }));
}

// Network resource ledger: one entry per URL (dedupe repeated references to
// the same request). encodedBodySize = transferred (compressed) bytes.
export function dedupeResourceEntries(entries) {
  const byUrl = new Map();
  let transferredBytes = 0;
  for (const e of entries) {
    if (!e.name) continue;
    if (byUrl.has(e.name)) continue;
    byUrl.set(e.name, e);
    transferredBytes += e.encodedBodySize || 0;
  }
  return { transferredBytes, byUrl };
}

// Bitmap estimate: decodedBodySize where exposed, else w*h*4, method recorded.
// This is a MODEL ESTIMATE, never claimed as browser/GPU resident memory.
// NOTE: R2 task 7 will remove the decodedBodySize branch (方案 §6.2: never
// count decodedBodySize as resident memory). The fallback remains so the
// pure helper is reusable; the measure.mjs caller will skip the decodedBodySize
// branch and use w*h*4 only.
export function decodedImageAccounting(images, resourceMap) {
  let transferred = 0;
  let estimate = 0;
  let viaDecodedBodySize = 0;
  let viaBitmapFallback = 0;
  for (const img of images) {
    const hit = resourceMap.get(img.src);
    if (hit && hit.encodedBodySize) transferred += hit.encodedBodySize;
    if (hit && hit.decodedBodySize) {
      estimate += hit.decodedBodySize;
      viaDecodedBodySize += 1;
    } else if (img.w > 0 && img.h > 0) {
      estimate += img.w * img.h * 4;
      viaBitmapFallback += 1;
    }
  }
  const method =
    `decodedBodySize where exposed (${viaDecodedBodySize} imgs), else w*h*4 decoded-bitmap estimate (${viaBitmapFallback} imgs); ` +
    `transferredImageBytes is encodedBodySize (compressed transfer), NOT decoded memory`;
  return { transferred, estimate, method, viaDecodedBodySize, viaBitmapFallback };
}
