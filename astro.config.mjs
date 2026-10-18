// @ts-check
// WP-02 minimal Astro configuration (production project init).
// Content Layer collection definitions land in WP-03 (src/content.config.ts,
// glob loaders with base './content/galleries' | './content/places' — no
// src/content/ mirror, per REPOSITORY_STRUCTURE.md Explicit prohibitions).
// Build/routing contracts are governed by BUILD_AND_ROUTING.md.
//
// WP-13: the fail-closed content validation gate runs on EVERY `astro build`
// (astro:build:start, before any page generation) and aborts the build on any
// validation error. Mode selection is environment configuration
// (BUILD_AND_ROUTING §6), wired via npm scripts:
//   npm run build         → ASTRO_PRODUCTION_VALIDATE=1 (production, fail-closed)
//   npm run build:preview → ASTRO_PREVIEW_MODE=1   (preview, draft-friendly —
//                           §13.2 warnings listed, never fatal; drafts stay in
//                           the preview data set for the draft-indicator note)
//   npm run build:media   → media:pipeline THEN `npm run build` (the §1 DAG
//                           composite: GENERATED ASSET MANIFEST precedes
//                           ASTRO BUILD — ADR-026)
// With NEITHER variable set the gates default to production (fail-closed).
//
// WP-24: the manifest consumption gate (assetManifestGate) runs SECOND at
// astro:build:start — integration order mirrors the §1 DAG: WP-13 reference +
// source validation first, then the producer-before-consumer manifest
// boundary (existence 11.1:manifest-missing + typed loadability
// 24:manifest-unloadable + WP-23 coverage closure 13.1#18 for published
// content). Production fails closed; preview warns (§9). The gate reuses
// resolveGatePlan from the WP-13 gate for identical mode semantics.
import { defineConfig } from "astro/config";
import { contentValidationGate } from "./scripts/validate/astro-gate.mjs";
import { assetManifestGate } from "./scripts/validate/asset-gate.mjs";
import { qaProbeGate } from "./scripts/validate/qa-probe-gate.mjs";
import { fontCoverageGate } from "./scripts/validate/font-coverage-gate.mjs";

export default defineConfig({
  // IMP-06: the QA test-only harness build (QA_PROBE=1, via `npm run
  // build:qa`) writes a SEPARATE test-only output directory — never the
  // canonical production dist/. Canonical builds (no QA env, or the guard
  // refusing a QA_PROBE=1 npm run build) own dist/ exclusively; it has one
  // owner per BUILD_AND_ROUTING §1-2. dist-qa is test scaffolding: it is
  // gitignored and never consumed by production validation or release
  // assembly.
  outDir: process.env.QA_PROBE === "1" ? "./dist-qa" : "./dist",
  integrations: [contentValidationGate(), assetManifestGate(), fontCoverageGate(), qaProbeGate()],
});
