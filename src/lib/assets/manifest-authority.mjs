// WP-24 single production asset-manifest authority (shared contract).
// One owner resolves mode + canonical project root + canonical manifest path.
// Production validators (WP-13 / WP-24) and the Astro consumer MUST use it.
// Preview may use explicit overrides; production has one root and one manifest.
// Plain JS, zero deps: shared by src/lib and scripts/validate.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MANIFEST_RELATIVE_PATH = "generated/asset-manifest.json";

function envRecord(env) {
  return env === undefined ? process.env : env;
}

function nonEmpty(value) {
  return value !== undefined && value !== null && String(value).length > 0;
}

export function isPreviewMode(env) {
  const e = envRecord(env);
  return e.ASTRO_PREVIEW_MODE === "1" && e.ASTRO_PRODUCTION_VALIDATE !== "1";
}

export function resolveDefaultProjectRoot() {
  const fromModule = fileURLToPath(new URL("../../..", import.meta.url));
  if (existsSync(join(fromModule, MANIFEST_RELATIVE_PATH))) return fromModule;
  return process.cwd();
}
export function assertProductionManifestAuthority(env) {
  const e = envRecord(env);
  if (isPreviewMode(e)) return;
  const c = e.ASTRO_ASSET_MANIFEST;
  const v = e.ASTRO_VALIDATE_ASSET_MANIFEST;
  const hasC = nonEmpty(c);
  const hasV = nonEmpty(v);
  if (hasC || hasV) {
    throw new Error(
      "[24:manifest-authority] production builds must validate and consume the canonical asset manifest at " +
      MANIFEST_RELATIVE_PATH +
      " -- ASTRO_ASSET_MANIFEST=" + (c === undefined ? "(unset)" : c) +
      " / ASTRO_VALIDATE_ASSET_MANIFEST=" + (v === undefined ? "(unset)" : v) +
      " are preview-only and must not be set for production builds (validator and consumer must resolve the same manifest)."
    );
  }
}

/**
 * Single production/preview authority. Callers must not resolve a second
 * production root or manifest path from environment variables.
 *
 * Production: one canonical project root (Astro config.root / module / cwd)
 * and exactly join(root, generated/asset-manifest.json). ASTRO_VALIDATE_CONTENT_ROOT
 * is not a production selector; a different value is a fail-closed fork.
 * Preview: content-root and manifest overrides remain mode-scoped.
 */
export function resolveAssetAuthority({ env, configRoot } = {}) {
  const e = envRecord(env);
  const preview = isPreviewMode(e);
  const defaultRoot = nonEmpty(configRoot) ? configRoot : resolveDefaultProjectRoot();
  if (!preview) {
    assertProductionManifestAuthority(e);
    const envRoot = e.ASTRO_VALIDATE_CONTENT_ROOT;
    if (nonEmpty(envRoot) && resolve(envRoot) !== resolve(defaultRoot)) {
      throw new Error(
        "[24:manifest-authority] production builds must validate and consume the canonical project root's " +
        MANIFEST_RELATIVE_PATH +
        " -- ASTRO_VALIDATE_CONTENT_ROOT=" + envRoot +
        " is not a production authority selector and would send validators to a different root than the Astro consumer (" +
        defaultRoot +
        ")."
      );
    }
    const projectRoot = defaultRoot;
    const manifestPath = join(projectRoot, MANIFEST_RELATIVE_PATH);
    return {
      mode: "production",
      projectRoot,
      manifestPath,
      consumerManifestPath: manifestPath,
      validatorManifestPath: manifestPath,
    };
  }
  const projectRoot = nonEmpty(e.ASTRO_VALIDATE_CONTENT_ROOT)
    ? e.ASTRO_VALIDATE_CONTENT_ROOT
    : defaultRoot;
  const defaultManifest = join(projectRoot, MANIFEST_RELATIVE_PATH);
  return {
    mode: "preview",
    projectRoot,
    manifestPath: defaultManifest,
    consumerManifestPath: nonEmpty(e.ASTRO_ASSET_MANIFEST) ? e.ASTRO_ASSET_MANIFEST : join(resolveDefaultProjectRoot(), MANIFEST_RELATIVE_PATH),
    validatorManifestPath: nonEmpty(e.ASTRO_VALIDATE_ASSET_MANIFEST)
      ? e.ASTRO_VALIDATE_ASSET_MANIFEST
      : defaultManifest,
  };
}
