#!/usr/bin/env node
// scripts/perf/validate-baseline.mjs — R2: THE formal performance-evidence
// validation entry. Single source of truth for the enforced gates; the four
// perf integration tests and the mutation tests both go through THIS entry
// (via subprocess), never mirroring a second copy of the gate logic (方案 §6.1).
import { readFileSync } from "node:fs";
import { FROZEN_WEB_VITALS, ENGINEERING_BUDGETS, SESSION_BUDGET } from "../../src/lib/perf/budget.ts";
import { versionSatisfiesRange } from "./engine.mjs";

/**
 * Compose the measured cold session for one profile: Home + the WORST gallery
 * page + the WORST place page in the record. Returns byte totals and the pages
 * that contributed, or `missing` when a page has no measured payload (a
 * fail-closed condition, never a silent zero).
 */
export function sessionBytes(data, profile) {
  const payloadBytes = (page) => {
    const run = page?.profiles?.[profile]?.payload?.runs?.[0];
    if (!run) return null;
    return (
      (run.htmlBytes ?? 0) +
      (run.cssBytes ?? 0) +
      (run.jsBytes ?? 0) +
      (run.imgBytes ?? 0) +
      (run.fontBytes ?? 0) +
      (run.otherBytes ?? 0)
    );
  };
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const home = pages.find((p) => p.path === "/");
  const galleries = pages.filter((p) => String(p.path).startsWith("/galleries/"));
  const places = pages.filter((p) => String(p.path).startsWith("/places/"));
  const worst = (list) => {
    let best = null;
    for (const page of list) {
      const bytes = payloadBytes(page);
      if (bytes === null) continue;
      if (best === null || bytes > best.bytes) best = { page, bytes };
    }
    return best;
  };
  const picked = [home, worst(galleries)?.page, worst(places)?.page].filter(Boolean);
  const parts = [];
  const missing = [];
  for (const page of picked) {
    const bytes = payloadBytes(page);
    if (bytes === null) missing.push(page.path);
    else parts.push({ path: page.path, bytes });
  }
  if (!home) missing.push("/ (home)");
  if (galleries.length === 0) missing.push("a /galleries/<slug> page");
  if (places.length === 0) missing.push("a /places/<slug> page");
  return { total: parts.reduce((sum, p) => sum + p.bytes, 0), parts, missing };
}

export function validateBaseline(data) {
  const issues = [];
  const add = (code, path, detail) => issues.push({ code, path, detail });

  if (data.version !== 2) add("VERSION", "version", `expected 2 got ${data.version}`);
  if (data.tool !== "scripts/perf/measure.mjs") add("TOOL", "tool", data.tool);
  if (!data.pages?.length) add("NO_PAGES", "pages", "empty");

  for (const p of data.pages ?? []) {
    if (!p.profiles?.desktop || !p.profiles?.mobileLowEnd) {
      add("PROFILE_MISSING", `${p.path}.profiles`, "desktop/mobileLowEnd required");
      continue;
    }
    for (const [name, prof] of Object.entries(p.profiles)) {
      const base = `${p.path}.profiles.${name}`;
      const lcp = prof.lcp;
      if (!(lcp?.medianMs > 0)) add("LCP_ZERO", `${base}.lcp.medianMs`, String(lcp?.medianMs));
      if (lcp?.medianMs > FROZEN_WEB_VITALS.lcpMs)
        add(
          "LCP_OVER_FROZEN",
          `${base}.lcp.medianMs`,
          `${lcp.medianMs} > ${FROZEN_WEB_VITALS.lcpMs}`,
        );
      if (!Number.isFinite(prof.cls?.median))
        add("CLS_MISSING", `${base}.cls.median`, "not finite");
      if (prof.cls?.median > FROZEN_WEB_VITALS.cls)
        add("CLS_OVER_FROZEN", `${base}.cls.median`, String(prof.cls.median));
      if (prof.memory) {
        const mem = prof.memory;
        if ("decodedImageBytes" in mem)
          add(
            "OLD_DECODED_FIELD",
            `${base}.memory.decodedImageBytes`,
            "mislabeled field must be gone",
          );
        if (!(mem.jsHeapBytes > 0))
          add("HEAP_ZERO", `${base}.memory.jsHeapBytes`, String(mem.jsHeapBytes));
        if (!(mem.decodedImageEstimateBytes > 0))
          add(
            "DECODED_ESTIMATE_ZERO",
            `${base}.memory.decodedImageEstimateBytes`,
            String(mem.decodedImageEstimateBytes),
          );
      }
    }
  }

  for (const i of data.interactions ?? []) {
    if (i.status === "na") continue;
    if (!String(i.method ?? "").match(/event-timing-attributed/i))
      add("INP_METHOD", `${i.id}.method`, i.method);
    for (const [name, prof] of Object.entries(i.profiles ?? {})) {
      if (prof.attribution !== true)
        add("INP_NOT_ATTRIBUTED", `${i.id}.profiles.${name}.attribution`, "attribution !== true");
      if (!Array.isArray(prof.runs) || prof.runs.length < 3)
        add("INP_TOO_FEW_RUNS", `${i.id}.profiles.${name}.runs`, `len=${prof.runs?.length}`);
      for (const r of prof.runs ?? []) {
        if (!r.interactionId)
          add(
            "INP_MISSING_INTERACTION_ID",
            `${i.id}.profiles.${name}.runs.interactionId`,
            String(r.interactionId),
          );
        if (r.targetAction !== i.id)
          add(
            "INP_WRONG_TARGET",
            `${i.id}.profiles.${name}.runs.targetAction`,
            `${r.targetAction} != ${i.id}`,
          );
        if (!(r.durationMs > 0))
          add(
            "INP_ZERO_DURATION",
            `${i.id}.profiles.${name}.runs.durationMs`,
            String(r.durationMs),
          );
      }
      if (!(prof.medianMs <= FROZEN_WEB_VITALS.inpMs))
        add("INP_OVER_FROZEN", `${i.id}.profiles.${name}.medianMs`, String(prof.medianMs));
    }
  }

  if (data.bundles?.jsGzipBytes > ENGINEERING_BUDGETS.jsGzipBytes)
    add("JS_BUNDLE_OVER", "bundles.jsGzipBytes", String(data.bundles.jsGzipBytes));
  if (data.bundles?.cssGzipBytes > ENGINEERING_BUDGETS.cssGzipBytes)
    add("CSS_BUNDLE_OVER", "bundles.cssGzipBytes", String(data.bundles.cssGzipBytes));

  // R4 B3: the authoritative JS budget (20,480B) applies to what a cold
  // visitor actually executes per route — inline gzip + the external files
  // referenced by that route — not just the sum of external files.
  const perRoute = data.bundles?.perRouteScriptGzipBytes;
  if (perRoute) {
    for (const [route, r] of Object.entries(perRoute)) {
      if (!(Number(r?.routeJsGzipBytes) <= ENGINEERING_BUDGETS.jsGzipBytes))
        add(
          "JS_ROUTE_OVER",
          `bundles.perRouteScriptGzipBytes.${route}.routeJsGzipBytes`,
          String(r?.routeJsGzipBytes),
        );
    }
  }

  // D6 (2026-09-15, owner-authorized): COLD-SESSION transfer budget.
  // A session is Home + one gallery page + one place page, taking the WORST
  // gallery/place page in the record so single-page growth cannot hide inside an
  // average. See SESSION_BUDGET for why the sum is a conservative upper bound.
  for (const [profile, limit] of [
    ["desktop", SESSION_BUDGET.desktopBytes],
    ["mobileLowEnd", SESSION_BUDGET.mobileLowEndBytes],
  ]) {
    const session = sessionBytes(data, profile);
    if (session.missing.length > 0) {
      add(
        "SESSION_PAYLOAD_MISSING",
        `session.${profile}`,
        `no measured payload for: ${session.missing.join(", ")}`,
      );
    } else if (session.total > limit) {
      add(
        "SESSION_BYTES_OVER",
        `session.${profile}.transferredBytes`,
        `${session.parts.map((p) => `${p.path}=${p.bytes}`).join(" + ")} = ${session.total} > ${limit}`,
      );
    }
  }

  // R4 B3: gitDirty alone does not identify the candidate; the run must
  // record the fingerprint (dirty list + tracked diff hash + untracked hashes).
  const fp = data.fingerprint;
  if (!fp || typeof fp !== "object") add("FINGERPRINT_MISSING", "fingerprint", "absent");
  else {
    const untrackedEntries = Object.entries(fp.untrackedSourceHashes ?? {});
    if (
      fp.gitDirty &&
      !fp.trackedContentDiffSha256 &&
      untrackedEntries.length === 0
    )
      add("FINGERPRINT_EMPTY", "fingerprint", "dirty run recorded no diff hash or untracked hashes");

    // T7: the fingerprint must be COMPLETE, not merely non-empty. A directory
    // recorded as an entry with no hash (`null`) or an unhashable marker used
    // to pass silently; and a dirty-file list that does not even contain the
    // first path character cannot identify the candidate.
    const unhashed = untrackedEntries.filter(
      ([, value]) => typeof value !== "string" || value.length === 0 || value === "UNREADABLE",
    );
    if (unhashed.length > 0)
      add(
        "FINGERPRINT_INCOMPLETE",
        "fingerprint.untrackedSourceHashes",
        `${unhashed.length} entr(ies) without a usable hash: ${unhashed
          .slice(0, 3)
          .map(([k]) => k)
          .join(", ")}`,
      );

    if (
      fp.gitDirty &&
      Array.isArray(fp.dirtyFiles) &&
      fp.dirtyFiles.some((f) => typeof f === "string" && f.length === 0)
    )
      add("FINGERPRINT_TORN_PATH", "fingerprint.dirtyFiles", "empty path in the dirty file list");
  }

  // R4 B3: a measurement run on a Node version outside the package engine
  // range cannot serve as that environment's acceptance. T7: the recorded
  // version is re-checked HERE against the recorded range — the harness's own
  // boolean is not trusted, and a range like `>=22.12.0 <23` no longer accepts
  // v22.11.0 through a major-only comparison.
  const engineRange = data.host?.nodeEnginesRequired;
  if (typeof engineRange === "string" && engineRange.length > 0 && engineRange !== "unavailable") {
    if (typeof data.host?.node === "string" && !versionSatisfiesRange(data.host.node, engineRange)) {
      add(
        "NODE_ENGINE_UNSUPPORTED",
        "host.node",
        `${data.host.node} does not satisfy engines.node ${engineRange}`,
      );
    }
  } else if (data.host?.nodeEngineSatisfied === false) {
    add(
      "NODE_ENGINE_UNSUPPORTED",
      "host.node",
      `${data.host?.node} does not satisfy engines.node ${engineRange}`,
    );
  }

  return { ok: issues.length === 0, issues };
}

const isMain = process.argv[1] && process.argv[1].endsWith("validate-baseline.mjs");
if (isMain) {
  // Accept both `--input path`, `--input=path`, and (rarely) `path` as a
  // positional argument. Default the positional form to the second arg.
  let inputPath = null;
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--input" && i + 1 < process.argv.length) {
      inputPath = process.argv[++i];
      break;
    }
    if (typeof a === "string" && a.startsWith("--input=")) {
      inputPath = a.slice("--input=".length);
      break;
    }
  }
  if (!inputPath) {
    console.error("usage: node scripts/perf/validate-baseline.mjs --input <json-path>");
    process.exitCode = 2;
  } else {
    const data = JSON.parse(readFileSync(inputPath, "utf8"));
    const { ok, issues } = validateBaseline(data);
    process.stdout.write(JSON.stringify({ ok, issues }, null, 2) + "\n");
    if (!ok) process.exitCode = 1;
  }
}
