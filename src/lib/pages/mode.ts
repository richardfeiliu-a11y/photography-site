// WP-25/WP-28..31 — the shared build-mode selector (the dropped WP-25
// handoff, restored by the P4 integration review Finding 2).
//
// BUILD_AND_ROUTING §6: mode is selected by ENVIRONMENT CONFIGURATION, never
// content inspection. The npm script contract (plan §3.2) wires:
//   npm run build          → ASTRO_PRODUCTION_VALIDATE=1 (fail-closed)
//   npm run build:preview  → ASTRO_PREVIEW_MODE=1 (draft-friendly, ADR-020)
// The astro-gate resolves the same plan (scripts/validate/astro-gate.mjs
// resolveGatePlan) for the validation pass; pages use this helper for the
// VIEW composition mode so preview builds surface drafts (isDraft indicator)
// while production stays published-only.
export type ViewMode = "production" | "preview";

export function viewModeFromEnv(env: NodeJS.ProcessEnv = process.env): ViewMode {
  if (env.ASTRO_PREVIEW_MODE === "1" && env.ASTRO_PRODUCTION_VALIDATE === "1") {
    throw new Error(
      "[mode] ambiguous mode configuration: both ASTRO_PRODUCTION_VALIDATE=1 and ASTRO_PREVIEW_MODE=1 are set (BUILD_AND_ROUTING §6 requires exactly one environment configuration)",
    );
  }
  return env.ASTRO_PREVIEW_MODE === "1" ? "preview" : "production";
}
