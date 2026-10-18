// WP-11 — Home editorial settings loading + deterministic featured/Recent
// resolution.
//
// Authority:
//   - CONTENT_MODEL.md §10.1 (home settings schema: exactly one authored key,
//     `featured_gallery_id` — Gallery ID or null; strict shape)
//   - CONTENT_MODEL.md §10.2 (featured resolution algorithm, implemented
//     EXACTLY: valid published configured ID → use it; otherwise latest
//     published Gallery by published_at DESC; tie-break by stable Gallery ID
//     lexicographic ascending; invalid configured ID → warn + fall back,
//     NEVER a production build failure)
//   - CONTENT_MODEL.md §10.3 (forbidden concepts — featured state has exactly
//     one owner: content/site/home.yaml, UD-004)
//   - CONTENT_MODEL.md §10.4 (Recent Galleries: published_at DESC + stable
//     Gallery ID tie-break; display count is P4 presentation — the FULL
//     ordered list is returned)
//   - ADR-019 (single authoritative Home editorial settings file; deterministic
//     fallback; no scheduled rotation, no curated states)
//   - UD-003 via TESTING_AND_VISUAL_REGRESSION.md §3.1 (published_at ordering:
//     never photographed time, EXIF, mtime, Git timestamp, or folder name)
//   - ADR-020 (status-based draft model; production builds include only
//     published Galleries; see "Mode semantics" below)
//
// Shape: everything here is PURE over raw data (mirrors src/lib/validate/*),
// so WP-13 can compose it into the production gate and WP-25 (HomeView) can
// consume the resolved results. The resolution functions never throw and have
// no error channel: an invalid configured featured ID produces a WARNING and
// the deterministic §10.2 fallback — warnings can never fail a build.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";
import { homeSchema, type HomeSettings } from "../../content-schemas";

/** The fixed authored location of the Home editorial settings file (§10.1). */
export const HOME_SETTINGS_RELATIVE_PATH = "content/site/home.yaml";

/** Build modes, shared with the WP-09/WP-10 validators' vocabulary. */
export type HomeResolutionMode = "preview" | "production";

/**
 * The minimal Gallery shape the §10.2/§10.4 algorithms may consult. Deliberately
 * structural: any object with these fields works (a parsed Gallery does), and
 * nothing else — photographed dates, EXIF, mtimes, folders (UD-003) are not
 * part of the input contract, so ordering CANNOT depend on them by construction.
 */
export interface GalleryResolutionRef {
  id: string;
  status: "draft" | "published";
  /** ISO-8601 instant (as authored); null/undefined where §8.3 permits. */
  published_at?: string | null;
}

/** One §10.2 warning. Warnings never affect any ok/validity — they cannot fail a build. */
export interface HomeResolutionWarning {
  /** Contract-section label, e.g. "10.2:featured-unresolved". */
  rule: string;
  message: string;
  /** The configured featured_gallery_id the warning is about, when set. */
  gallery?: string;
}

export interface FeaturedResolution {
  /** Resolved hero Gallery ID, or null when no published Gallery exists at all. */
  galleryId: string | null;
  warnings: HomeResolutionWarning[];
}

/** Structured home-settings validation issue (mirrors GalleryValidationIssue). */
export interface HomeSettingsIssue {
  severity: "error" | "warning";
  /** Rule token: "10.1:featured-id", "10.1:unknown-key", "10.1:singular-settings", "10.1:schema". */
  rule: string;
  message: string;
  field?: string;
  file?: string;
}

export interface HomeSettingsValidationResult {
  ok: boolean;
  errors: HomeSettingsIssue[];
  /**
   * Always empty: CONTENT_MODEL §13.2 defines no home-settings warning
   * conditions, and §10.1 is a strict shape contract in both modes.
   */
  warnings: HomeSettingsIssue[];
  /** Parsed settings, or null when invalid. */
  settings: HomeSettings | null;
}

/** Rule labels for the home-settings validator. */
const RULE = {
  featuredId: "10.1:featured-id",
  unknownKey: "10.1:unknown-key",
  singularSettings: "10.1:singular-settings",
  schema: "10.1:schema",
} as const;

/** Rule labels for the §10.2/§10.4 resolution functions. */
const RESOLUTION_RULE = {
  featuredUnresolved: "10.2:featured-unresolved",
  noPublishedGalleries: "10.2:no-published-galleries",
} as const;

function resolveRoot(repoRoot: string | URL): string {
  return typeof repoRoot === "string" ? repoRoot : fileURLToPath(repoRoot);
}

/**
 * Reads `content/site/home.yaml` from its fixed authored location via a DIRECT
 * file read — it is intentionally NOT a Content Layer collection (WP-03
 * contract, src/content.config.ts). FAIL-CLOSED on missing/unreadable/malformed
 * YAML: featured state has exactly one owner (§10.3/UD-004), so silent absence
 * would silently change the hero. Shape validation is separate
 * (validateHomeSettings) so tests can exercise raw data.
 */
export function readHomeSettings(
  repoRoot: string | URL,
  filePath: string = HOME_SETTINGS_RELATIVE_PATH,
): { data: unknown; filePath: string } {
  const root = resolveRoot(repoRoot);
  const absolute = resolve(root, filePath);
  let contents: string;
  try {
    contents = readFileSync(absolute, "utf8");
  } catch (cause) {
    throw new Error(
      `[10.1] Home editorial settings are required at ${filePath} (the single featured-state owner, §10.3/UD-004) and could not be read: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
  try {
    return { data: parseYaml(contents, { filename: absolute }), filePath: absolute };
  } catch (cause) {
    throw new Error(
      `[10.1] Home editorial settings ${filePath} is not parseable YAML: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
}

/**
 * Validates raw home-settings data against the real §10.1 homeSchema (strict).
 * Pure; never throws on invalid content — every failure is a structured error.
 * Identical in both modes: §10.1 defines a strict shape contract and §13.2
 * defines no home-settings warnings, so there is no preview-lenient variant.
 */
export function validateHomeSettings(
  data: unknown,
  options: { file?: string } = {},
): HomeSettingsValidationResult {
  const errors: HomeSettingsIssue[] = [];
  const result = homeSchema.safeParse(data);
  if (result.success) {
    return { ok: true, errors, warnings: [], settings: result.data };
  }
  for (const zodIssue of result.error.issues) {
    const message = zodIssue.message;
    const token =
      /^\[(10\.1:[a-z-]+)\]/.exec(message)?.[1] ??
      (zodIssue.code === "unrecognized_keys"
        ? RULE.unknownKey
        : zodIssue.code === "invalid_type"
          ? RULE.featuredId
          : RULE.schema);
    let field: string | undefined;
    if (zodIssue.code === "unrecognized_keys") {
      field = zodIssue.keys.join(", ");
    } else if (zodIssue.path.length > 0) {
      field = zodIssue.path.map(String).join(".");
    }
    errors.push({
      severity: "error",
      rule: token,
      message: message.startsWith("[") ? message : `[${token}] ${message}`,
      field,
      file: options.file,
    });
  }
  return { ok: false, errors, warnings: [], settings: null };
}

/**
 * Loads + validates home settings in one call. Throws (fail-closed) when the
 * file is missing, unparseable, or shape-invalid — the file's EXISTENCE and
 * SHAPE are build-blocking contracts; the correctness of the configured
 * featured ID is NOT (§10.2: warn + fall back). For WP-13's gate.
 */
export function loadHomeSettings(repoRoot: string | URL, filePath?: string): HomeSettings {
  const file = readHomeSettings(repoRoot, filePath);
  const result = validateHomeSettings(file.data, { file: file.filePath });
  if (!result.ok || result.settings === null) {
    const details = result.errors.map((e) => e.message).join("; ");
    throw new Error(`[10.1] Invalid home editorial settings (${file.filePath}): ${details}`);
  }
  return result.settings;
}

/** Parses an authored ISO-8601 instant to epoch ms; null when absent/invalid. */
function instantOf(ref: GalleryResolutionRef): number | null {
  if (ref.published_at == null) return null;
  const ms = Date.parse(ref.published_at);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * §10.2 "valid published Gallery": status published WITH a usable published_at
 * (§8.2 requires published_at for published status; a published Gallery
 * missing it is invalid content that the WP-13 gate rejects separately).
 */
function isValidPublished(ref: GalleryResolutionRef): boolean {
  return ref.status === "published" && instantOf(ref) !== null;
}

/**
 * Total deterministic order: published_at DESC, then stable Gallery ID
 * lexicographic ascending (§10.2 step 3 / §10.4). The comparator depends only
 * on (published_at, id) — never on input order, photographed time, EXIF,
 * mtime, Git timestamps, or folder names (UD-003).
 */
function compareRecent(a: GalleryResolutionRef, b: GalleryResolutionRef): number {
  const aMs = instantOf(a) as number;
  const bMs = instantOf(b) as number;
  if (aMs !== bMs) return bMs - aMs; // newest first
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * §10.2 featured resolution, implemented EXACTLY:
 *   1. If `featured_gallery_id` is set and references a valid published
 *      Gallery, use that Gallery.
 *   2. Otherwise, select the latest published Gallery by `published_at`
 *      descending.
 *   3. Tie-break by stable Gallery ID (lexicographic ascending) when two
 *      Galleries share the same `published_at`.
 *
 * An invalid configured ID (nonexistent, draft, or published-without-
 * published_at) records a WARNING and falls back to step 2/3 — it NEVER fails
 * the production build (ADR-019: "Deterministic fallback"; §13.2 principle:
 * warnings never block on their own).
 *
 * Mode semantics (documented reading, see docs/implementation/WP-11.md):
 * §10.2 and ADR-019 are mode-AGNOSTIC — they say "published", not "published
 * in production only", and neither §10 nor §13.2 defines any preview-specific
 * featured behavior. Behavior is therefore IDENTICAL in both modes; `mode` is
 * accepted so WP-13/WP-25 can call this uniformly with the shared mode switch.
 * Draft Galleries are never featured candidates in either mode (ADR-020's
 * "local preview may include draft content" governs route/page generation
 * scope, not §10.2's published-only selection contract).
 *
 * Pure and deterministic: same input → same output, independent of array order.
 */
export function resolveFeatured<T extends GalleryResolutionRef>(
  home: Pick<HomeSettings, "featured_gallery_id">,
  galleries: ReadonlyArray<T>,
  _options: { mode?: HomeResolutionMode } = {},
): FeaturedResolution {
  const warnings: HomeResolutionWarning[] = [];

  // Step 1 — the configured ID, when it references a valid published Gallery.
  const configured = home.featured_gallery_id;
  if (configured != null) {
    const match = galleries.find((g) => g.id === configured);
    if (match && isValidPublished(match)) {
      return { galleryId: match.id, warnings };
    }
    // §10.3/UD-004: this file is the single featured-state owner; an
    // unresolvable configuration warns and falls back — never fails a build.
    const reason =
      match === undefined
        ? "references Gallery ID which does not exist"
        : match.status !== "published"
          ? "references a draft Gallery (drafts are not featured candidates, §8.3/ADR-020)"
          : "references a published Gallery without a usable published_at (§8.2)";
    warnings.push({
      rule: RESOLUTION_RULE.featuredUnresolved,
      message: `featured_gallery_id '${configured}' ${reason} — falling back to the latest published Gallery by published_at DESC with stable Gallery ID tie-break (§10.2)`,
      gallery: configured,
    });
  }

  // Steps 2+3 — latest published by published_at DESC, tie-break ID ascending.
  const candidates = galleries.filter(isValidPublished);
  if (candidates.length === 0) {
    warnings.push({
      rule: RESOLUTION_RULE.noPublishedGalleries,
      message:
        "no published Gallery is available for the featured fallback — featured resolves to null (§10.2)",
    });
    return { galleryId: null, warnings };
  }
  const latest = [...candidates].sort(compareRecent)[0];
  return { galleryId: latest.id, warnings };
}

/**
 * §10.4 Recent Galleries ordering: published-only, `published_at` descending,
 * tie-break by stable Gallery ID lexicographic ascending. Returns the FULL
 * ordered list — the display count is a P4 presentation concern (HomeView,
 * WP-25), never a content-model rule. Ordering consults only (published_at,
 * id); photographed time/EXIF/mtime/Git/folder cannot influence it by
 * construction (UD-003). Mode semantics mirror resolveFeatured (identical in
 * both modes; see docs/implementation/WP-11.md).
 *
 * Pure and deterministic: same input → same output, independent of array order.
 */
export function orderRecentGalleries<T extends GalleryResolutionRef>(
  galleries: ReadonlyArray<T>,
  _options: { mode?: HomeResolutionMode } = {},
): T[] {
  return galleries.filter(isValidPublished).sort(compareRecent);
}

/** Formats home-settings issues for build logs (used by WP-13's gate). */
export function formatHomeSettingsIssues(issues: ReadonlyArray<HomeSettingsIssue>): string[] {
  return issues.map((i) => `${i.severity.toUpperCase()} [${i.rule}] ${i.message}`);
}
