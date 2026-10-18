// WP-38 — isolated preview-media derivation for the draft long-gallery-72
// stress state (`npm run media:preview`).
//
// The production asset manifest is published-only by frozen contract
// (IMAGE_PIPELINE §11.3): the draft long-gallery-72 photos have no production
// records, so the preview long-gallery page honestly renders the
// missing-media composition. The governed WP-38 long-gallery baseline must
// instead depict RENDERED media — which requires draft derivatives plus a
// preview-only merged manifest. BOTH live under generated/ (gitignored,
// regenerable) on paths the production build/gate NEVER reads:
//
//   generated/preview-media/               draft-only derivatives
//   generated/preview-draft-manifest.json  draft-only manifest (pipeline output)
//   generated/preview-asset-manifest.json  MERGED manifest (production records
//                                          + draft records) consumed ONLY by
//                                          the preview capture build via the
//                                          ASTRO_ASSET_MANIFEST override.
//
// "Cannot become production authority": the production manifest path,
// production media dir, production build, and production gate are untouched;
// the merged manifest is consumed exclusively when ASTRO_ASSET_MANIFEST is
// set (preview capture only). Idempotent: when the merged record set exactly
// equals the current production + draft record sets AND every referenced
// draft file exists AND the production manifest fingerprint is unchanged,
// derivation is skipped (a full 72-photo derivation costs ~10 minutes). A
// production-only change re-merges without re-derivation; anything
// draft-side re-derives. Logs always distinguish RECORD counts from physical
// derivative FILE counts.
//
// Usage: node scripts/media/preview-media.mjs [--gallery <id>]
//   (default gallery: g_long_gallery_72, the WP-38 stress set)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const PROD_MANIFEST = join(ROOT, "generated", "asset-manifest.json");
const PREVIEW_MEDIA_DIR = join(ROOT, "generated", "preview-media");
const DRAFT_MANIFEST = join(ROOT, "generated", "preview-draft-manifest.json");
const MERGED_MANIFEST = join(ROOT, "generated", "preview-asset-manifest.json");
const FINGERPRINT_FILE = join(ROOT, "generated", "preview-merge-fingerprint.json");

function parseArgs(argv) {
  const args = { gallery: "g_long_gallery_72" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--gallery") args.gallery = argv[++i];
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function draftFileName(record) {
  return record.public_url.slice("/media/".length);
}

/**
 * Pure freshness decision (ROUND-2 Minor: preview fast-path precision). All
 * inputs are already-read values plus a file-exists predicate, so tests can
 * exercise every branch without touching shared generated/ state. Fresh ONLY
 * when the merged RECORD set exactly equals the current production + draft
 * record sets (record identity, not just photo IDs), every draft record's
 * physical derivative file exists, AND the production manifest bytes are
 * unchanged since the recorded merge (its fingerprint matches the sidecar) —
 * so a stale production portion can never be accepted as current.
 * Returns { fresh, action, reason, stats } where action is one of:
 *   "skip"     — fully current; skip derivation AND merge.
 *   "remerge"  — draft side intact but the production portion or fingerprint
 *                is stale/missing; rebuild the merge WITHOUT re-derivation.
 *   "rederive" — draft records/files changed, or anything unreadable.
 * stats always carries record counts AND the physical file count separately.
 */
export function decidePreviewFreshness({ prodBytes, prodDoc, draftBytes, draftDoc, mergedDoc, sidecar, draftFileExists }) {
  const stats = { prodRecords: 0, draftRecords: 0, draftFilesPresent: 0 };
  const rederive = (reason) => ({ fresh: false, action: "rederive", reason, stats });
  const remerge = (reason) => ({ fresh: false, action: "remerge", reason, stats });
  if (!prodDoc || !prodBytes || !draftDoc || !draftBytes) {
    return rederive("production or draft manifest unreadable");
  }
  const prodRecords = prodDoc.manifest.records;
  const draftRecords = draftDoc.manifest.records;
  stats.prodRecords = prodRecords.length;
  stats.draftRecords = draftRecords.length;
  const missingFiles = draftRecords.filter((r) => !draftFileExists(draftFileName(r)));
  // Physical files are DISTINCT from records: several records (purposes and
  // formats) can share one derivative file, so 1396 records may sit on 914
  // files. Logs must never label a record count as files.
  stats.draftFilesPresent = new Set(
    draftRecords.filter((r) => draftFileExists(draftFileName(r))).map((r) => draftFileName(r)),
  ).size;
  const mergedRecords = mergedDoc?.manifest?.records;
  const setsMatch =
    Array.isArray(mergedRecords) &&
    mergedRecords.length === prodRecords.length + draftRecords.length &&
    JSON.stringify(mergedRecords.slice(0, prodRecords.length)) === JSON.stringify(prodRecords) &&
    JSON.stringify(mergedRecords.slice(prodRecords.length)) === JSON.stringify(draftRecords);
  // Byte-exact fingerprints: prodBytes/draftBytes are the raw manifest file
  // bytes (Buffer) in the CLI and plain strings in tests — createHash accepts
  // both, so hash them directly without re-serialization.
  const prodSha = sha256Bytes(prodBytes);
  const draftSha = sha256Bytes(draftBytes);
  const prodUnchanged = sidecar?.prodSha256 === prodSha;
  const draftUnchanged = sidecar?.draftSha256 === draftSha;
  if (setsMatch && missingFiles.length === 0) {
    if (prodUnchanged && draftUnchanged) {
      return {
        fresh: true,
        action: "skip",
        reason: "merged record set exact, all draft files present, production fingerprint unchanged",
        stats,
      };
    }
    return remerge("merged set exact but the merge fingerprint is stale or missing — refreshing the merge record without re-derivation");
  }
  if (draftUnchanged && missingFiles.length === 0) {
    return remerge("draft side intact but the production portion is stale — rebuilding the merge without re-derivation");
  }
  if (!setsMatch) {
    return rederive("merged record set does not equal production + draft records");
  }
  return rederive(`${missingFiles.length} draft derivative file(s) missing`);
}

/**
 * Merge: production records (authority, untouched) + draft records, then
 * record the production/draft fingerprints so the fast path can tell a stale
 * production portion from a current one. Refuses when draft photo IDs overlap
 * production IDs. Logs record counts and physical file counts separately.
 */
export function mergePreviewManifests({ prodDoc, draftDoc }) {
  const prodIds = new Set(prodDoc.manifest.records.map((r) => r.photo_id));
  const overlap = draftDoc.manifest.records.filter((r) => prodIds.has(r.photo_id));
  if (overlap.length > 0) {
    throw new Error(
      `[media:preview] REFUSED: draft manifest overlaps production photo IDs: ` +
        overlap.map((r) => r.photo_id).join(", "),
    );
  }
  const merged = {
    envelope: prodDoc.envelope,
    manifest: { ...prodDoc.manifest, records: [...prodDoc.manifest.records, ...draftDoc.manifest.records] },
  };
  return merged;
}

function main() {
  const { gallery } = parseArgs(process.argv.slice(2));

  if (!existsSync(PROD_MANIFEST)) {
    console.error(`[media:preview] REFUSED: production manifest missing at ${PROD_MANIFEST} — run \`npm run media:pipeline\` first.`);
    process.exit(1);
  }

  // Fast path (ROUND-2 Minor): exact record-set + production-fingerprint +
  // physical-file validity. A production-only change re-merges without the
  // ~10-minute re-derivation; anything draft-side re-derives.
  const prodBytes = readFileSync(PROD_MANIFEST);
  const prod = JSON.parse(prodBytes.toString("utf8"));
  let draftBytes = null;
  let draft = null;
  let merged = null;
  let sidecar = null;
  try {
    draftBytes = readFileSync(DRAFT_MANIFEST);
    draft = JSON.parse(draftBytes.toString("utf8"));
  } catch {
    // falls through to re-derive below
  }
  try {
    merged = readJson(MERGED_MANIFEST);
  } catch {
    // falls through below
  }
  try {
    sidecar = readJson(FINGERPRINT_FILE);
  } catch {
    // absent on first run after this hardening — remerge records it
  }
  const draftFileExists = (name) => existsSync(join(PREVIEW_MEDIA_DIR, name));
  const decision = decidePreviewFreshness({
    prodBytes,
    prodDoc: prod,
    draftBytes,
    draftDoc: draft,
    mergedDoc: merged,
    sidecar,
    draftFileExists,
  });
  if (decision.fresh) {
    console.log(
      `[media:preview] up to date: ${decision.stats.prodRecords} production + ` +
        `${decision.stats.draftRecords} draft record(s) merged, ` +
        `${decision.stats.draftFilesPresent} physical draft derivative file(s) present — skipping derivation.`,
    );
    return;
  }
  if (decision.action === "remerge" && draft) {
    console.log(`[media:preview] stale merge (${decision.reason}) — re-merging without re-derivation.`);
    writeMerge(prod, draft);
    return;
  }
  console.log(`[media:preview] stale: ${decision.reason} — re-deriving.`);

  // Derive the draft gallery in isolation: own out dir + own manifest, no
  // coverage gate (drafts are excluded from blocking coverage by §11.3; this
  // manifest is never production authority).
  console.log(`[media:preview] deriving draft gallery ${gallery} (this takes minutes on first run)…`);
  const derive = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--import",
      join(ROOT, "scripts", "validate", "register-ts-resolve.mjs"),
      join(ROOT, "scripts", "media", "pipeline.ts"),
      "--gallery",
      gallery,
      "--include-drafts",
      "--out",
      PREVIEW_MEDIA_DIR,
      "--manifest",
      DRAFT_MANIFEST,
      "--no-coverage",
    ],
    { cwd: ROOT, stdio: "inherit", timeout: 30 * 60_000 },
  );
  if (derive.status !== 0) {
    console.error(`[media:preview] draft derivation FAILED (exit ${derive.status})`);
    process.exit(derive.status ?? 1);
  }

  // Merge: production records (authority, untouched) + draft records.
  const freshProd = readJson(PROD_MANIFEST);
  const freshDraft = readJson(DRAFT_MANIFEST);
  try {
    writeMerge(freshProd, freshDraft);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

function writeMerge(prod, draft) {
  const merged = mergePreviewManifests({ prodDoc: prod, draftDoc: draft });
  writeFileSync(MERGED_MANIFEST, JSON.stringify(merged, null, 2) + "\n");
  const prodBytes = readFileSync(PROD_MANIFEST);
  const draftBytes = readFileSync(DRAFT_MANIFEST);
  const draftFilesPresent = new Set(
    draft.manifest.records
      .filter((r) => existsSync(join(PREVIEW_MEDIA_DIR, draftFileName(r))))
      .map((r) => draftFileName(r)),
  ).size;
  writeFileSync(
    FINGERPRINT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        prodSha256: sha256Bytes(prodBytes),
        draftSha256: sha256Bytes(draftBytes),
        prodRecords: prod.manifest.records.length,
        draftRecords: draft.manifest.records.length,
        mergedRecords: merged.manifest.records.length,
        draftFilesPresent,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `[media:preview] merged ${prod.manifest.records.length} production + ` +
      `${draft.manifest.records.length} draft record(s) -> ${MERGED_MANIFEST} ` +
      `(${draftFilesPresent} physical draft derivative file(s) present; production manifest and media untouched).`,
  );
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
