#!/usr/bin/env node
// scripts/perf/provision-workspace.mjs — WP-45 correction: isolated synthetic
// valid-content provision workspace.
//
// WHY this exists (and what it is NOT):
// - The ACTUAL corpus is publication-invalid: 50 WP-42:alt-missing errors
//   under the D11 fail-closed production gate (WP-58 owns the editorial alt
//   pass). No canonical production build can succeed on it, so no throttled
//   browser measurement can run against real production output without a
//   provision.
// - This script builds an ISOLATED TEMP workspace (default: $TMPDIR, never
//   the candidate tree) that overlays ONLY synthetic alt_text (explicitly
//   labeled, never committed) plus a published long-gallery-72 promotion
//   (honest placeholder published_at + cover, same photos/order/layout/media),
//   then runs a REAL production build inside it. The candidate implementation
//   is untouched: D11 stays enabled, the validator is unmodified, no real alt
//   is authored, photos/order/layout/media are byte-identical.
// - Every produced baseline records conditions.provision =
//   "synthetic valid-content provision (isolated temp workspace; NOT the
//   actual corpus)" and pins corpus.productionManifestSha to the canonical
//   manifest. The actual corpus stays publication-invalid; WP-42 stays open.
//
// Usage:
//   node scripts/perf/provision-workspace.mjs --print-root   # create + provision, print root
//   node scripts/perf/provision-workspace.mjs --build       # create + provision + production build, print root
//   node scripts/perf/provision-workspace.mjs --clean <root> # remove workspace
//
// The workspace symlinks node_modules + generated + media (read-only weight)
// and copies everything else needed for `astro build`.
//
// Synthetic-manifest consumption: the workspace build consumes
// SYNTHETIC-MERGED-MANIFEST.json via the PREVIEW-scoped override
// ASTRO_VALIDATE_ASSET_MANIFEST (validator side) + ASTRO_ASSET_MANIFEST
// (consumer side) with ASTRO_PREVIEW_MODE=1 — i.e. `npm run build:preview`
// semantics — because the production authority (manifest-authority.mjs)
// forbids manifest overrides in production mode by frozen contract. The
// produced HTML is therefore built by the REAL production page pipeline
// (same templates, same selectors, same 53 published photos + 72-photo
// gallery, same media bytes) with ONLY the alt/manifest provision differing;
// the baseline labels conditions.mode = "production-like (preview-scoped
// manifest override; production authority untouched)".
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnNpmIsolated } from "./build-isolated.mjs";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));

export const HONEST_PUBLISHED_AT = "2026-08-29T00:00:00Z";
export const SYNTHETIC_ALT = "SYNTHETIC-ALT-PROVISION for measurement only";

function provisionAltText(yaml) {
  // Replace every `alt_text: null` with a synthetic authored alt that can
  // never be mistaken for real content and never trips the filename rule:
  // it names no source_ref stem.
  return yaml.replace(
    /^(\s*)alt_text:\s*null\s*$/gm,
    (_m, indent) => indent + 'alt_text: "' + SYNTHETIC_ALT + '"',
  );
}

function promoteLongGallery(yaml) {
  let out = yaml;
  out = out.replace(/^status:\s*draft\s*$/m, "status: published");
  if (!/^published_at:/m.test(out)) {
    out = out.replace(
      /^status:\s*published\s*$/m,
      (m) => m + '\npublished_at: "' + HONEST_PUBLISHED_AT + '"',
    );
  }
  if (!/^cover_photo_id:/m.test(out)) {
    out = out.replace(/^status:\s*published\s*$/m, (m) => m + "\ncover_photo_id: p_lg72_001");
  }
  out = out.replace(
    /^title:\s*"Long Gallery — Seventy-Two Frames"\s*$/m,
    'title: "Long Gallery \\u2014 Seventy-Two Frames [SYNTHETIC VALID-CONTENT PROVISION]"',
  );
  return out;
}

export function provisionWorkspace() {
  const ws = join(tmpdir(), "perf-provision-" + Date.now().toString(36) + "-" + process.pid);
  mkdirSync(ws, { recursive: true });
  // Heavy read-only weight: symlink, never copy. bench-output is a WRITABLE
  // output dir — it MUST be workspace-owned (a real directory inside the
  // tmpdir), never symlinked back to the candidate (R1 task 2: zero pollution).
  for (const heavy of ["node_modules", "generated"]) {
    if (existsSync(join(ROOT, heavy))) symlinkSync(join(ROOT, heavy), join(ws, heavy));
  }
  if (existsSync(join(ROOT, "media"))) symlinkSync(join(ROOT, "media"), join(ws, "media"));
  mkdirSync(join(ws, "bench-output"), { recursive: true });
  // Build inputs: copy (small). docs/ carries the frozen BENCHMARK-OQ01-OQ02
  // decision record the manifest gate loads (loadDerivativeRecord).
  for (const rel of [
    "content",
    "docs",
    "src",
    "scripts",
    "public",
    "package.json",
    "astro.config.mjs",
    "tsconfig.json",
    "vitest.config.ts",
    "eslint.config.js",
    ".prettierrc",
  ]) {
    const from = join(ROOT, rel);
    if (existsSync(from)) cpSync(from, join(ws, rel), { recursive: true });
  }
  // Synthetic overlay: alt_text everywhere + long-gallery promotion.
  let altCount = 0;
  for (const entry of readdirSync(join(ws, "content", "galleries"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const meta = join(ws, "content", "galleries", entry.name, "meta.yaml");
    if (!existsSync(meta)) continue;
    let yaml = readFileSync(meta, "utf8");
    altCount += (yaml.match(/^(\s*)alt_text:\s*null\s*$/gm) || []).length;
    yaml = provisionAltText(yaml);
    if (entry.name === "long-gallery-72") yaml = promoteLongGallery(yaml);
    writeFileSync(meta, yaml);
  }
  // Synthetic merged manifest: production records + draft records for the
  // promoted long-gallery-72 (byte-identical records; provenance recorded in
  // the marker, never committed, never touching the canonical manifest).
  const prodManifest = JSON.parse(readFileSync(join(ROOT, "generated", "asset-manifest.json"), "utf8"));
  // Draft manifest (preview-media output) is OPTIONAL input to the synthetic
  // provision: it only existed for the former 72-photo long-gallery stress set,
  // which is not part of the real archive. Absent => no draft records added.
  const draftManifestPath = join(ROOT, "generated", "preview-draft-manifest.json");
  const draftRecords = existsSync(draftManifestPath)
    ? JSON.parse(readFileSync(draftManifestPath, "utf8")).manifest.records.filter((r) =>
        String(r.photo_id).startsWith("p_lg72_"),
      )
    : [];
  const syntheticManifest = {
    envelope: {
      generated_at: new Date().toISOString(),
      provision: "synthetic valid-content provision (NOT the actual corpus)",
      productionManifestSha: createHash("sha256")
        .update(readFileSync(join(ROOT, "generated", "asset-manifest.json")))
        .digest("hex"),
    },
    manifest: {
      schema: prodManifest.manifest.schema,
      record: prodManifest.manifest.record,
      toolchain: prodManifest.manifest.toolchain,
      records: [...prodManifest.manifest.records, ...draftRecords],
    },
  };
  writeFileSync(join(ws, "SYNTHETIC-MERGED-MANIFEST.json"), JSON.stringify(syntheticManifest));
  // Marker: this workspace is synthetic, never the candidate tree.
  writeFileSync(
    join(ws, "SYNTHETIC-PROVISION-MARKER.txt"),
    "SYNTHETIC VALID-CONTENT PROVISION — isolated temp workspace for WP-45 measurement only.\n" +
      "NOT the actual corpus. NOT committed. Candidate implementation untouched (D11 enabled).\n" +
      "Synthetic alt_text replacements: " +
      altCount +
      ". long-gallery-72 promoted to published (honest placeholder published_at).\n",
  );
  return { ws, altCount };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--clean" && args[1]) {
    rmSync(args[1], { recursive: true, force: true });
    console.log("[provision] cleaned " + args[1]);
    return;
  }
  const { ws, altCount } = provisionWorkspace();
  console.log("[provision] workspace " + ws + " (" + altCount + " synthetic alts)");
  if (args[0] === "--build") {
    // IMP-04: isolated-output build via the structurally-guarded helper.
    spawnNpmIsolated({
      cwd: ws,
      args: ["run", "build:preview"],
      env: {
        ...process.env,
        ASTRO_VALIDATE_ASSET_MANIFEST: join(ws, "SYNTHETIC-MERGED-MANIFEST.json"),
        ASTRO_ASSET_MANIFEST: join(ws, "SYNTHETIC-MERGED-MANIFEST.json"),
      },
    });
    console.log("[provision] production-like build OK in " + ws);
  }
  console.log(ws);
}

const isMain = process.argv[1] && process.argv[1].endsWith("provision-workspace.mjs");
if (isMain) {
  main().catch((error) => {
    console.error(String((error && error.stack) || error));
    process.exitCode = 1;
  });
}
