// WP-16 ICC enforcement policy (decision D9) — pure decision logic, no I/O.
//
// Authority split (docs/implementation/decisions/ICC-POLICY.md):
//   - The INTERPRETATION of untagged pixels is NOT a WP-16 choice: ADR-011
//     (ARCHITECTURE_DECISIONS.md) freezes it as the documented assume-sRGB
//     limitation. Untagged pixels follow the canonical sRGB interpretation;
//     this is a documented assumption, not proven truth about the image.
//   - D9 decides ONLY the enforcement mode applied when a WEB INGEST MASTER
//     arrives without a valid ICC profile.
//
// Measured context (WP-16): an explicit `toColourspace('srgb')` on an untagged
// source changes NO pixels (mean abs delta 0.0000 on real corpus data), so the
// three modes differ only in logging/failure behavior, never in output pixels.
// Corpus reality: all 113 frozen stage3c fixtures carry an IEC sRGB profile;
// the author's future JPEG exports may be untagged. No camera-model guessing
// exists anywhere in this module (ADR-011) — the only inputs are ICC presence
// and the configured mode.

/** The three candidate enforcement modes for untagged sources (OQ-03). */
export const ICC_ENFORCEMENT_MODES = ["assume", "warn", "fail"] as const;
export type IccEnforcementMode = (typeof ICC_ENFORCEMENT_MODES)[number];

/**
 * D9 (CLOSED 2026-08-29): untagged sources are silently assumed sRGB, per the
 * ADR-011 frozen interpretation. "assume" is the pipeline default; "warn" and
 * "fail" remain selectable modes for a future policy hardening, and a test
 * pins this default so WP-19 consumes the decision, not a hardcode.
 */
export const DEFAULT_UNTAGGED_ENFORCEMENT_MODE: IccEnforcementMode = "assume";

/** What the pipeline should do with this source's color handling. */
export type IccAction =
  | "convert-srgb" // valid source ICC: honor it, convert pixels to sRGB
  | "assume-srgb" // no source ICC: document assumption, pixels pass through
  | "fail"; // no source ICC, fail mode: abort before any encode

export interface IccLogEntry {
  level: "info" | "warn";
  code: "ICC_UNTAGGED_ASSUMED_SRGB" | "ICC_UNTAGGED_REJECTED";
  message: string;
}

export interface IccDecision {
  action: IccAction;
  /** Log entry to emit, or null for silent paths. */
  log: IccLogEntry | null;
}

export interface IccSourceState {
  /** Does the source carry a valid ICC profile? (sharp metadata.icc) */
  hasValidIcc: boolean;
}

/**
 * Decide how a source is handled for color, given ICC presence and the
 * configured enforcement mode. Tagged sources always convert; the mode only
 * shapes the untagged path.
 */
export function evaluateIccSource(
  state: IccSourceState,
  mode: IccEnforcementMode = DEFAULT_UNTAGGED_ENFORCEMENT_MODE,
): IccDecision {
  if (state.hasValidIcc) {
    // ADR-011 primary path: honor the profile and convert to sRGB.
    return { action: "convert-srgb", log: null };
  }
  switch (mode) {
    case "assume":
      // D9 default: silent documented assumption, no log noise.
      return { action: "assume-srgb", log: null };
    case "warn":
      // Recorded alternative: proceed but surface the assumption.
      return {
        action: "assume-srgb",
        log: {
          level: "warn",
          code: "ICC_UNTAGGED_ASSUMED_SRGB",
          message:
            "untagged source: no ICC profile; pixels follow the documented assume-sRGB interpretation (ADR-011), not proven truth",
        },
      };
    case "fail":
      // Recorded alternative: fail closed before any encode happens.
      return {
        action: "fail",
        log: {
          level: "warn",
          code: "ICC_UNTAGGED_REJECTED",
          message:
            "untagged source rejected by ICC enforcement mode 'fail' (ADR-011 documented assume-sRGB is disabled)",
        },
      };
  }
}
