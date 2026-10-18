// Shared contract for the build-time atmosphere sidecar (no side effects).
// Imported by both the generator (scripts/media/atmosphere.ts) and the
// build-time reader (src/lib/theme/read.ts).
//
// The sidecar carries the Light Field per-gallery ambient color: the OKLCH
// pair the field renders with in dark and light view. It is presentation
// data — the reader degrades to "no ambient color" on anything unexpected,
// and neither the generator nor the reader is a gate.

export const ATMOSPHERE_RELATIVE_PATH = "generated/atmosphere.json";

/** Schema version string — the `version` field of the document. */
export const ATMOSPHERE_SIDECAR_SCHEMA = "quiet-editorial-archive/atmosphere@1";

/** One OKLCH triple (h in degrees 0–360; l/c/h already clamped + round3). */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Per-gallery ambient pair: the light-field and dark-field variants. */
export interface AtmosphereEntry {
  light: Oklch;
  dark: Oklch;
}

/** The sidecar document: every published gallery ID → its ambient pair. */
export interface AtmosphereSidecar {
  version: string;
  /** Keyed by gallery ID (the `id` field of a gallery's meta.yaml). */
  entries: Record<string, AtmosphereEntry>;
}

function isOklch(value: unknown): value is Oklch {
  if (typeof value !== "object" || value === null) return false;
  const triple = value as { l?: unknown; c?: unknown; h?: unknown };
  return (
    typeof triple.l === "number" &&
    Number.isFinite(triple.l) &&
    typeof triple.c === "number" &&
    Number.isFinite(triple.c) &&
    typeof triple.h === "number" &&
    Number.isFinite(triple.h)
  );
}

function isAmbientEntry(value: unknown): value is AtmosphereEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as { light?: unknown; dark?: unknown };
  return isOklch(entry.light) && isOklch(entry.dark);
}

/**
 * Structural check of a parsed sidecar document — the reader's degradation
 * line (invalid → treated as absent, never a build failure). Values are NOT
 * range-checked: the generator owns the clamps, the reader only needs a
 * well-formed shape to hand to the theme layer.
 */
export function isValidAtmosphereSidecar(value: unknown): value is AtmosphereSidecar {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as { version?: unknown; entries?: unknown };
  if (doc.version !== ATMOSPHERE_SIDECAR_SCHEMA) return false;
  if (typeof doc.entries !== "object" || doc.entries === null || Array.isArray(doc.entries)) {
    return false;
  }
  return Object.values(doc.entries).every(isAmbientEntry);
}
