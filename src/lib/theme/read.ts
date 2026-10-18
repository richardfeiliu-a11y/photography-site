// Build-time reader for generated/atmosphere.json (Light Field ambient color).
//
// Degradation semantics mirror src/lib/exif/read.ts: a missing file, invalid
// JSON, or a document that fails the contract check all resolve to "no
// ambient color" (null) — this is a data layer, NOT a gate, so nothing here
// may fail a build. Callers that need a field color fall back to the theme's
// own defaults.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../pages/archive-data";
import {
  ATMOSPHERE_RELATIVE_PATH,
  isValidAtmosphereSidecar,
  type AtmosphereEntry,
  type AtmosphereSidecar,
} from "./atmosphere-contract";

let cache: AtmosphereSidecar | null | undefined;

/** Load + validate the sidecar. Missing/unreadable/invalid → null. */
export function loadAtmosphere(root: string = repoRoot()): AtmosphereSidecar | null {
  if (cache !== undefined) return cache;
  const path = join(root, ATMOSPHERE_RELATIVE_PATH);
  if (!existsSync(path)) {
    cache = null;
    return cache;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    cache = null;
    return cache;
  }
  cache = isValidAtmosphereSidecar(parsed) ? parsed : null;
  return cache;
}

/** The ambient pair for a gallery, or null when absent (or no sidecar). */
export function ambientFor(
  sidecar: AtmosphereSidecar | null,
  galleryId: string,
): AtmosphereEntry | null {
  return sidecar?.entries[galleryId] ?? null;
}
