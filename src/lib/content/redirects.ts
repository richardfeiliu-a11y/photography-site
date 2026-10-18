// WP-12 — Redirects: loading, fail-closed validation, and resolution.
//
// Authority:
//   - CONTENT_MODEL.md §11 (UD-008): redirects.yaml supports HISTORICAL Gallery
//     and Place aliases; each entry carries exactly one target type —
//     `gallery_id` XOR `place_id`; targets are STABLE IDs, never slugs.
//   - CONTENT_MODEL.md §11.2 (production validation, fail-closed): old path is
//     historical only (never a current canonical route); target exists; target
//     resolves to a public/published canonical route in production; no loops
//     (A -> B -> A or longer); no route collision (§11.2 defines this family as
//     duplicate old paths + redirect targets that are themselves redirect
//     sources); §13.1#15/#16 number these rules.
//   - CONTENT_MODEL.md §11.3 (SLUG AUTHORITY): Gallery/Place YAML `slug` is the
//     ONLY current-slug authority — no second slug registry, no generated slug
//     index, no separate mapping file. Every destination below is derived from
//     the caller-supplied gallery/place registries at call time; this module
//     stores and emits no slug of its own.
//   - CONTENT_MODEL.md §12 (canonical routes: /, /archive, /places,
//     /places/{slug}, /galleries/{slug}, /about).
//   - BUILD_AND_ROUTING.md §5 (redirect validation rules; delivery is a
//     GENERATED NGINX 301 INCLUDE produced by WP-52 — this module emits only
//     the structured data contract, no nginx syntax).
//   - IC-02 verification (CANONICAL_REWRITE_TRACEABILITY.md RT-010/IC-02).
//   - CONTENT_MODEL.md §13.1#15/#16, §13.2 (warnings: "local preview / draft
//     only"; "Warnings must never allow broken published content to pass a
//     production build").
//
// Shape: everything is PURE over raw data (mirrors src/lib/validate/* and
// src/lib/content/home.ts) so WP-13 can compose it into the production gate
// and WP-52 can consume the resolution output.
//
// MODE SEMANTICS (documented reading, see docs/implementation/WP-12.md):
//   - §13.1#15 has NO production qualifier (cf. WP-09's treatment of
//     status-scoped §4.2 table contracts): malformed path, XOR violations,
//     unknown entry fields, and a target ID that does not exist fail in BOTH
//     modes. Old-path-equals-canonical-route is also mode-independent.
//   - §13.1#16 is explicitly production-scoped ("Redirect target unresolved in
//     production ... or redirect loop / route collision"). Reading:
//       * target EXISTS but is a DRAFT gallery (does not resolve to a
//         public/published route in production) -> ERROR in production;
//         WARNING in preview (the draft route exists there, ADR-020; §13.2
//         defines no warning token for this case — we emit
//         `13.1#16-warn-draft-target` as a clearly-labelled extrapolation so
//         the condition is never silently swallowed; warnings never affect ok).
//       * LOOPS, DUPLICATE OLD PATHS, and REDIRECT-TO-REDIRECT are STRUCTURAL
//         breakage that exists in every mode -> errors in BOTH modes (§13.2's
//         closing sentence forbids warnings from letting broken content pass,
//         and §13.2 defines no loop/collision warning conditions).
//   - A target ID that does not exist at all fires §13.1#15 ("target Gallery
//     or Place does not exist") in both modes AND §13.1#16 ("does not resolve
//     to a public/published canonical route") in production: both rule texts
//     describe the same physical condition; both gates fire (fail-closed,
//     belt-and-braces — mirrors the doc stating canonical-route equality in
//     both rule 15 and the rule 16 route-collision family).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";
import { redirectEntrySchema, redirectOldPathSchema } from "../../content-schemas";

/** The fixed authored location of the redirect map (§11.1). */
export const REDIRECTS_RELATIVE_PATH = "content/redirects.yaml";

/** Build modes, shared with the WP-09/WP-10/WP-11 validators' vocabulary. */
export type RedirectValidationMode = "preview" | "production";

/**
 * Minimal Gallery shape the validator/resolution consults. Deliberately
 * structural (a parsed Gallery satisfies it): id, current slug, status.
 * The slug comes from the gallery registry — the single slug authority (§11.3).
 */
export interface GalleryRedirectRef {
  id: string;
  slug: string;
  status: "draft" | "published";
}

/**
 * Minimal Place shape. Places have no draft lifecycle (§6 defines no status),
 * so a Place target always resolves to a public route.
 */
export interface PlaceRedirectRef {
  id: string;
  slug: string;
}

/** One raw redirect entry: its old path plus unvalidated target data. */
export interface RedirectEntryInput {
  oldPath: string;
  data: unknown;
  filePath?: string;
}

export interface RedirectValidationIssue {
  severity: "error" | "warning";
  /**
   * Machine-readable rule label: "13.1#15"/"13.1#16" for the CONTENT_MODEL
   * §13.1 redirect rules, "13.1#16-warn-draft-target" for the preview-only
   * draft-target warning (documented extrapolation — see module docblock),
   * "11.1:file-shape" for top-level file shape, "schema" for other shape
   * errors with no numbered rule.
   */
  rule: string;
  message: string;
  oldPath?: string;
  field?: string;
  file?: string;
}

export interface RedirectValidationResult {
  ok: boolean;
  errors: RedirectValidationIssue[];
  warnings: RedirectValidationIssue[];
}

/** Rule labels used by the redirect checks. */
const RULE = {
  invalidEntry: "13.1#15",
  unresolvedInProduction: "13.1#16",
  warnDraftTarget: "13.1#16-warn-draft-target",
  fileShape: "11.1:file-shape",
  schema: "13.1#15",
} as const;

/** Message rule-token prefix, e.g. "[13.1#15] ...". */
const RULE_TOKEN = /^\[(\d+\.\d+(?:[:#][a-z0-9-]+)+)\]\s*/;

function issue(
  rule: string,
  message: string,
  rest: Partial<Omit<RedirectValidationIssue, "severity" | "rule" | "message">> = {},
): RedirectValidationIssue {
  return { severity: "error", rule, message, ...rest };
}

function warning(
  rule: string,
  message: string,
  rest: Partial<Omit<RedirectValidationIssue, "severity" | "rule" | "message">> = {},
): RedirectValidationIssue {
  return { severity: "warning", rule, message, ...rest };
}

// ---------------------------------------------------------------------------
// File loading (redirects.yaml is NOT a collection — WP-03 contract).
// ---------------------------------------------------------------------------

function resolveRoot(repoRoot: string | URL): string {
  return typeof repoRoot === "string" ? repoRoot : fileURLToPath(repoRoot);
}

/**
 * Reads `content/redirects.yaml` from its fixed authored location via a DIRECT
 * file read (not a Content Layer collection, per src/content.config.ts).
 * FAIL-CLOSED on missing/unreadable/malformed YAML — including DUPLICATE old
 * paths, which a parsed mapping cannot represent: the YAML parser rejects
 * duplicate mapping keys and this loader propagates the parse error.
 * Shape validation is separate (entriesFromRedirectsFile) so tests can
 * exercise raw data.
 */
export function readRedirects(
  repoRoot: string | URL,
  filePath: string = REDIRECTS_RELATIVE_PATH,
): { data: unknown; filePath: string } {
  const root = resolveRoot(repoRoot);
  const absolute = resolve(root, filePath);
  let contents: string;
  try {
    contents = readFileSync(absolute, "utf8");
  } catch (cause) {
    throw new Error(
      `[11.1] The redirect map is required at ${filePath} (content/redirects.yaml, §11.1) and could not be read: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
  try {
    return { data: parseYaml(contents, { filename: absolute }), filePath: absolute };
  } catch (cause) {
    throw new Error(
      `[11.1] Redirect map ${filePath} is not parseable YAML (duplicate old paths are also rejected here — fail-closed, §11.2): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
}

/**
 * Converts raw redirects-file data into per-entry inputs. Pure. The file is a
 * MAPPING of old path → target entry (§11.1); arrays, null and scalars are
 * rejected with an 11.1:file-shape error. Insertion order is preserved and
 * becomes the deterministic entry order.
 */
export function entriesFromRedirectsFile(data: unknown): {
  entries: RedirectEntryInput[];
  fileErrors: RedirectValidationIssue[];
} {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      entries: [],
      fileErrors: [
        issue(
          RULE.fileShape,
          `[${RULE.fileShape}] content/redirects.yaml must be a mapping of old path → target entry ({ gallery_id } XOR { place_id }), got ${
            data === null ? "null" : Array.isArray(data) ? "an array" : typeof data
          } (§11.1)`,
        ),
      ],
    };
  }
  const entries = Object.entries(data as Record<string, unknown>).map(([oldPath, value]) => ({
    oldPath,
    data: value,
  }));
  return { entries, fileErrors: [] };
}

// ---------------------------------------------------------------------------
// Pure graph helpers (brief step 3: graph checks as pure functions).
// ---------------------------------------------------------------------------

/** The canonical route set (§12): static routes + registry-derived detail routes. */
export function canonicalRoutes(refs: {
  galleries?: ReadonlyArray<GalleryRedirectRef>;
  places?: ReadonlyArray<PlaceRedirectRef>;
}): string[] {
  return [
    "/",
    "/archive",
    "/places",
    "/about",
    ...(refs.galleries ?? []).map((g) => `/galleries/${g.slug}`),
    ...(refs.places ?? []).map((p) => `/places/${p.slug}`),
  ];
}

/** Old paths that appear more than once, sorted (§11.2 route-collision family). */
export function findDuplicateOldPaths(oldPaths: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const path of oldPaths) {
    if (seen.has(path)) duplicates.add(path);
    seen.add(path);
  }
  return [...duplicates].sort();
}

/**
 * Redirect loops (§13.1#16 / BUILD_AND_ROUTING §5). `edges` maps old path →
 * resolved destination. A loop is a walk old path -> destination -> (destination
 * is itself an old path) -> ... that revisits a node; includes self-loops
 * (A -> A). Returns one cycle per distinct member set (sorted signature
 * dedupe), each as the ordered chain of old paths.
 */
export function detectRedirectLoops(edges: ReadonlyMap<string, string>): string[][] {
  const cycles: string[][] = [];
  const seenSignatures = new Set<string>();
  for (const start of [...edges.keys()].sort()) {
    const stack: string[] = [];
    const position = new Map<string, number>();
    let current: string | undefined = start;
    while (current !== undefined && edges.has(current)) {
      const seenAt = position.get(current);
      if (seenAt !== undefined) {
        const cycle = stack.slice(seenAt);
        const signature = [...cycle].sort().join("|");
        if (!seenSignatures.has(signature)) {
          seenSignatures.add(signature);
          cycles.push(cycle);
        }
        break;
      }
      position.set(current, stack.length);
      stack.push(current);
      current = edges.get(current);
    }
  }
  return cycles;
}

/**
 * Redirect-to-redirect chains (§11.2 "redirect targets are not themselves
 * redirect sources"; BUILD_AND_ROUTING §5): old paths whose resolved
 * destination is another entry's old path (or their own — a self-destination,
 * which detectRedirectLoops reports as a self-loop).
 */
export function findRedirectToRedirect(
  edges: ReadonlyMap<string, string>,
): Array<{ oldPath: string; destination: string }> {
  const chains: Array<{ oldPath: string; destination: string }> = [];
  for (const oldPath of [...edges.keys()].sort()) {
    const destination = edges.get(oldPath);
    if (destination !== undefined && edges.has(destination)) {
      chains.push({ oldPath, destination });
    }
  }
  return chains;
}

/** Old paths that equal a canonical route, sorted (§13.1#16 route collision). */
export function findCanonicalRouteCollisions(
  oldPaths: ReadonlyArray<string>,
  canonical: ReadonlySet<string>,
): string[] {
  return oldPaths.filter((p) => canonical.has(p)).sort();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface RedirectValidateOptions {
  mode: RedirectValidationMode;
  /**
   * The gallery registry (single slug authority, §11.3). When supplied, target
   * existence, draft-target, canonical-collision and graph checks run; when
   * omitted those checks are skipped — the composer (WP-13) supplies the full
   * set, exactly like validateGalleries' knownPlaceIds contract.
   */
  galleries?: ReadonlyArray<GalleryRedirectRef>;
  /** The place registry. Same composition contract as `galleries`. */
  places?: ReadonlyArray<PlaceRedirectRef>;
}

interface ParsedEntry {
  oldPath: string;
  targetType: "gallery" | "place";
  targetId: string;
  filePath?: string;
}

/**
 * Maps one zod issue to a structured error, naming the old path and the field.
 */
function issueFromZod(
  input: RedirectEntryInput,
  path: readonly PropertyKey[],
  message: string,
  keys?: readonly string[],
  code?: string,
): RedirectValidationIssue {
  const token = RULE_TOKEN.exec(message)?.[1] ?? RULE.schema;
  let field: string | undefined;
  if (keys && keys.length > 0 && code === "unrecognized_keys") {
    field = keys.join(", ");
  } else if (path.length > 0) {
    field = path.map(String).join(".");
  }
  const body = message.replace(RULE_TOKEN, "").trim();
  const text = body.startsWith("redirect ") ? body : `redirect entry '${input.oldPath}': ${body}`;
  return issue(token, `[${token}] ${text}`, {
    oldPath: input.oldPath,
    field,
    file: input.filePath,
  });
}

/**
 * Validates a set of redirect entries. Pure; never throws on invalid content —
 * every failure is reported as a structured issue.
 *
 * Phases:
 *   1. Per-entry schema validation (real redirectOldPathSchema +
 *      redirectEntrySchema): malformed path, XOR target type, unknown fields.
 *   2. Registry-supplied checks: canonical-route equality/collision, target
 *      existence, draft targets (mode-dependent), and the resolved graph
 *      checks (loops, redirect-to-redirect). Duplicate old paths are checked
 *      unconditionally (they need no registry).
 */
export function validateRedirects(
  entries: ReadonlyArray<RedirectEntryInput>,
  options: RedirectValidateOptions,
): RedirectValidationResult {
  const { mode } = options;
  const errors: RedirectValidationIssue[] = [];
  const warnings: RedirectValidationIssue[] = [];

  // Phase 1 — per-entry fail-closed schema validation.
  const parsed: ParsedEntry[] = [];
  for (const input of entries) {
    const pathResult = redirectOldPathSchema.safeParse(input.oldPath);
    if (!pathResult.success) {
      for (const zodIssue of pathResult.error.issues) {
        const token = RULE_TOKEN.exec(zodIssue.message)?.[1] ?? RULE.schema;
        errors.push(
          issue(token, zodIssue.message, {
            oldPath: input.oldPath,
            field: "oldPath",
            file: input.filePath,
          }),
        );
      }
    }

    const entryResult = redirectEntrySchema.safeParse(input.data);
    if (!entryResult.success) {
      for (const zodIssue of entryResult.error.issues) {
        const keys =
          zodIssue.code === "unrecognized_keys"
            ? (zodIssue as { keys?: string[] }).keys
            : undefined;
        errors.push(issueFromZod(input, zodIssue.path, zodIssue.message, keys, zodIssue.code));
      }
      continue;
    }

    if (!pathResult.success) continue;
    const target = entryResult.data;
    parsed.push({
      oldPath: input.oldPath,
      targetType: target.gallery_id != null ? "gallery" : "place",
      targetId: (target.gallery_id ?? target.place_id) as string,
      filePath: input.filePath,
    });
  }

  // Duplicate old paths (§13.1#16 route-collision family / BUILD_AND_ROUTING
  // §5) — structural, needs no registry, fails in both modes. (In a parsed
  // YAML map duplicates cannot occur; the loader fails closed on duplicate
  // mapping keys at parse time. The check keeps the pure entry-list contract
  // complete.)
  for (const duplicate of findDuplicateOldPaths(parsed.map((e) => e.oldPath))) {
    errors.push(
      issue(
        RULE.unresolvedInProduction,
        `[${RULE.unresolvedInProduction}] Duplicate redirect old path '${duplicate}': redirects.yaml must not carry duplicate entries for the same old path (§11.2 route-collision family; BUILD_AND_ROUTING §5)`,
        { oldPath: duplicate, field: "oldPath" },
      ),
    );
  }

  const hasRegistries = options.galleries !== undefined || options.places !== undefined;
  if (hasRegistries) {
    const galleryById = new Map((options.galleries ?? []).map((g) => [g.id, g]));
    const placeById = new Map((options.places ?? []).map((p) => [p.id, p]));
    const canonical = new Set(canonicalRoutes(options));

    // Canonical-route equality (§13.1#15 entry gate) and route collision
    // (§13.1#16 graph gate / BUILD_AND_ROUTING §5): two gates over the same
    // physical condition — the doc states it in both places.
    for (const collision of findCanonicalRouteCollisions(
      parsed.map((e) => e.oldPath),
      canonical,
    )) {
      errors.push(
        issue(
          RULE.invalidEntry,
          `[${RULE.invalidEntry}] redirect entry '${collision}': old path equals a current canonical route — redirects.yaml stores HISTORICAL route aliases only and never duplicates a current Gallery or Place slug (§11.2)`,
          { oldPath: collision, field: "oldPath" },
        ),
      );
      errors.push(
        issue(
          RULE.unresolvedInProduction,
          `[${RULE.unresolvedInProduction}] Route collision: redirect old path '${collision}' equals a canonical route — redirect destinations must never collide with canonical routes (§13.1#16; BUILD_AND_ROUTING §5)`,
          { oldPath: collision, field: "oldPath" },
        ),
      );
    }

    // Target existence + publication (§13.1#15 / §13.1#16) and the resolved
    // edge map for the graph checks. NOTE: canonical-colliding entries keep
    // their edges — a redirect loop in this architecture necessarily passes
    // through old paths that equal canonical routes (each hop lands on a
    // target's current-slug route), so excluding them would make loop
    // detection vacuous. The canonical gates above fire independently.
    const edges = new Map<string, string>();
    for (const parsedEntry of parsed) {
      const galleryRef =
        parsedEntry.targetType === "gallery" ? galleryById.get(parsedEntry.targetId) : undefined;
      const placeRef =
        parsedEntry.targetType === "place" ? placeById.get(parsedEntry.targetId) : undefined;
      const ref = galleryRef ?? placeRef;

      if (!ref) {
        errors.push(
          issue(
            RULE.invalidEntry,
            `[${RULE.invalidEntry}] redirect entry '${parsedEntry.oldPath}': target ${parsedEntry.targetType === "gallery" ? "Gallery" : "Place"} ID '${parsedEntry.targetId}' does not exist in the archive (§13.1#15)`,
            {
              oldPath: parsedEntry.oldPath,
              field: parsedEntry.targetType === "gallery" ? "gallery_id" : "place_id",
              file: parsedEntry.filePath,
            },
          ),
        );
        if (mode === "production") {
          errors.push(
            issue(
              RULE.unresolvedInProduction,
              `[${RULE.unresolvedInProduction}] redirect entry '${parsedEntry.oldPath}': target ${parsedEntry.targetType === "gallery" ? "Gallery" : "Place"} ID '${parsedEntry.targetId}' does not resolve to a public/published canonical route in production (§13.1#16)`,
              { oldPath: parsedEntry.oldPath, file: parsedEntry.filePath },
            ),
          );
        }
        continue;
      }

      if (galleryRef && galleryRef.status === "draft") {
        // §13.1#16: does not resolve to a public/published canonical route in
        // PRODUCTION. In preview the draft route exists (ADR-020) — warn.
        // §13.2 defines no token for this condition; the warning is a
        // documented extrapolation (see module docblock / WP-12.md) and never
        // affects ok.
        if (mode === "production") {
          errors.push(
            issue(
              RULE.unresolvedInProduction,
              `[${RULE.unresolvedInProduction}] redirect entry '${parsedEntry.oldPath}': target Gallery '${parsedEntry.targetId}' is a DRAFT and does not resolve to a public/published canonical route in production (§13.1#16; §8.3)`,
              { oldPath: parsedEntry.oldPath, file: parsedEntry.filePath },
            ),
          );
        } else {
          warnings.push(
            warning(
              RULE.warnDraftTarget,
              `[${RULE.warnDraftTarget}] redirect entry '${parsedEntry.oldPath}': target Gallery '${parsedEntry.targetId}' is a draft — it resolves to a preview route only and will FAIL production validation until it is published (§13.1#16)`,
              { oldPath: parsedEntry.oldPath, file: parsedEntry.filePath },
            ),
          );
        }
      }

      edges.set(
        parsedEntry.oldPath,
        parsedEntry.targetType === "gallery" ? `/galleries/${ref.slug}` : `/places/${ref.slug}`,
      );
    }

    // Graph checks (structural; both modes).
    for (const chain of detectRedirectLoops(edges)) {
      errors.push(
        issue(
          RULE.unresolvedInProduction,
          `[${RULE.unresolvedInProduction}] Redirect loop detected: ${chain.join(" -> ")} -> ${chain[0]} (each arrow resolves through the target's current slug; §13.1#16; BUILD_AND_ROUTING §5)`,
          { oldPath: chain[0], field: "oldPath" },
        ),
      );
    }
    for (const { oldPath, destination } of findRedirectToRedirect(edges)) {
      if (oldPath === destination) continue; // reported as a self-loop above
      errors.push(
        issue(
          RULE.unresolvedInProduction,
          `[${RULE.unresolvedInProduction}] redirect entry '${oldPath}': resolved destination '${destination}' is itself a redirect source — redirect targets must never be redirect sources (§11.2; BUILD_AND_ROUTING §5)`,
          { oldPath, field: "oldPath" },
        ),
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Resolution — the WP-52 data contract (structured JSON; no nginx syntax).
// ---------------------------------------------------------------------------

export interface ResolvedRedirect {
  /** The historical old path, exactly as authored. */
  oldPath: string;
  targetType: "gallery" | "place";
  /** The stable target ID (never a slug — §11.2). */
  targetId: string;
  /** The target's CURRENT slug, read from the single slug registry (§11.3). */
  slug: string;
  /** The final canonical route: /galleries/{slug} or /places/{slug}. */
  destination: string;
}

export interface RedirectResolution {
  /**
   * Validated redirect mappings, sorted by old path — a deterministic,
   * diff-stable input for WP-52's generated nginx include (whose reload-only-
   * when-changed lifecycle depends on stable output).
   */
  redirects: ResolvedRedirect[];
  /** Preview-mode draft-target warnings (empty in production). */
  warnings: RedirectValidationIssue[];
}

export interface RedirectResolveOptions {
  mode: RedirectValidationMode;
  galleries: ReadonlyArray<GalleryRedirectRef>;
  places: ReadonlyArray<PlaceRedirectRef>;
}

/**
 * Resolves redirect entries old path → target ID → current slug → canonical
 * route. Pure. Entries that fail the per-entry schema, carry duplicate old
 * paths, or whose target does not resolve are OMITTED: WP-52 consumes this
 * output only after validateRedirects is green in production mode (the
 * composition contract — validate first, then resolve).
 */
export function resolveRedirects(
  entries: ReadonlyArray<RedirectEntryInput>,
  options: RedirectResolveOptions,
): RedirectResolution {
  const validation = validateRedirects(entries, options);
  const galleryById = new Map(options.galleries.map((g) => [g.id, g]));
  const placeById = new Map(options.places.map((p) => [p.id, p]));
  const redirects: ResolvedRedirect[] = [];
  const seen = new Set<string>();

  for (const input of entries) {
    const pathResult = redirectOldPathSchema.safeParse(input.oldPath);
    const entryResult = redirectEntrySchema.safeParse(input.data);
    if (!pathResult.success || !entryResult.success) continue;
    if (seen.has(input.oldPath)) continue; // duplicates are never resolved
    seen.add(input.oldPath);

    const target = entryResult.data;
    const targetType = target.gallery_id != null ? "gallery" : "place";
    const targetId = (target.gallery_id ?? target.place_id) as string;
    const ref = targetType === "gallery" ? galleryById.get(targetId) : placeById.get(targetId);
    if (!ref) continue;

    redirects.push({
      oldPath: input.oldPath,
      targetType,
      targetId,
      slug: ref.slug,
      destination: targetType === "gallery" ? `/galleries/${ref.slug}` : `/places/${ref.slug}`,
    });
  }

  redirects.sort((a, b) => (a.oldPath < b.oldPath ? -1 : a.oldPath > b.oldPath ? 1 : 0));
  return { redirects, warnings: validation.warnings };
}

/** Convenience formatter for build logs (used by WP-13's gate). */
export function formatRedirectIssues(issues: ReadonlyArray<RedirectValidationIssue>): string[] {
  return issues.map((i) => `${i.severity.toUpperCase()} [${i.rule}] ${i.message}`);
}
