// WP-13 — the single fail-closed production validation pass over the WHOLE
// archive (composition of WP-09/WP-10/WP-11/WP-12 validators).
//
// Authority:
//   - CONTENT_MODEL.md §13.1 (fail-closed rules 1–18) / §13.2 (warnings,
//     "local preview / draft only"; "Warnings must never allow broken
//     published content to pass a production build")
//   - BUILD_AND_ROUTING.md §6 (mode selection by environment configuration,
//     NEVER content inspection; production builds fail closed; preview is
//     draft-friendly) / §7 (validation summary)
//   - CONTENT_MODEL.md §10.2/§10.4 (Home featured/Recent resolution),
//     §11.2/§11.3 (redirect validation + resolution), §12 (canonical routes)
//   - IMAGE_PIPELINE.md §10.3 (derivative purposes) — §13.1#18 realization
//   - UD-003/007/009/010; ADR-020 (draft model per mode)
//
// COMPOSITION CONTRACT (from docs/implementation/WP-09..12.md): this module
// COMPOSES the existing pure validators — it never re-implements their rules:
//   validateGalleries (WP-09), validatePlaces (WP-10),
//   validateHomeSettings + resolveFeatured + orderRecentGalleries (WP-11),
//   validateRedirects + resolveRedirects (WP-12).
//
// CLOSED FAIL-OPEN SURFACE (closes the WP-09 deferred minor): the entity
// validators skip context-dependent rules when the composer forgets the
// context (validateGalleries skips §13.1#1 without `ingestRoot`, and §13.1#9
// without `knownPlaceIds`). WP-13 closes this by construction:
//   - `knownPlaceIds` is ALWAYS derived here from the parsed Place entries;
//   - registries are ALWAYS supplied to validateRedirects;
//   - production mode WITHOUT `ingestRoot` is itself an ERROR
//     (context:ingest-root-required) — the gate refuses to run blind.
//
// §13.1#18 (derivative coverage) is a PIPELINE state, not an authored shape:
// it is enforced here against the asset manifest rows (structural subset of
// IMAGE_PIPELINE.md §10.2) supplied by the caller. The manifest is produced by
// the P3 pipeline at generated/asset-manifest.json BEFORE astro build; until
// that wiring lands, an absent manifest produces the explicit WARNING
// context:asset-manifest-absent (never a silent skip) and the check enforces
// automatically once a manifest is supplied. Rule 18 second owner: the WP-23
// afterBuild stage (tests/support/build-validation.mjs) re-checks closure
// against the assembled release.
import { validateGalleries, type GalleryEntryInput, type GalleryValidationIssue } from "./gallery";
import { validatePlaces, type PlaceEntryInput, type PlaceValidationIssue } from "./place";
import {
  resolveFeatured,
  orderRecentGalleries,
  validateHomeSettings,
  type HomeSettingsIssue,
} from "../content/home";
import {
  resolveRedirects,
  validateRedirects,
  type RedirectEntryInput,
  type RedirectValidationIssue,
} from "../content/redirects";
import type { Gallery, Place, HomeSettings } from "../../content-schemas";
import { validateAltText } from "./alt";

export type ArchiveValidationMode = "preview" | "production";

/** One raw home-settings file input (unvalidated data + source path). */
export interface HomeInput {
  data: unknown;
  filePath?: string;
}

export interface ComposeArchiveInputs {
  galleries: ReadonlyArray<GalleryEntryInput>;
  places: ReadonlyArray<PlaceEntryInput>;
  home: HomeInput;
  redirects: ReadonlyArray<RedirectEntryInput>;
}

/** Structural subset of an IMAGE_PIPELINE.md §10.2 manifest record. */
export interface AssetManifestRow {
  photo_id: string;
  purpose: string;
}

/** The supplied asset-manifest rows (§13.1#18 enforcement input). */
export interface AssetManifestInput {
  rows: ReadonlyArray<AssetManifestRow>;
}

export interface ComposeArchiveOptions {
  mode: ArchiveValidationMode;
  /**
   * WEB INGEST MASTER root (media/ingest-masters/). REQUIRED in production
   * mode — without it §13.1#1 could not run and the gate would fail open.
   * Omitting it in production is itself a validation error.
   */
  ingestRoot?: string | URL;
  /**
   * Asset-manifest rows for §13.1#18. Undefined = manifest absent (explicit
   * context:asset-manifest-absent warning; the P3 pipeline supplies it).
   */
  assetManifest?: AssetManifestInput;
  /**
   * Derivative purposes every published Photo must have (IMAGE_PIPELINE.md
   * §10.3). Defaults to the three canonical purposes.
   */
  requiredDerivativePurposes?: ReadonlyArray<string>;
}

/** Unified structured finding: file + field + rule ID (§13.1 numbering). */
export interface ProductionValidationIssue {
  severity: "error" | "warning";
  /**
   * Machine-readable rule ID: "13.1#N" (CONTENT_MODEL §13.1), "13.2#warn-*"
   * (§13.2), contract-section labels ("4.3:forbidden-field", "10.1:*",
   * "10.2:featured-unresolved", "11.1:file-shape"), or "context:*" gate-level
   * findings (closed fail-open surface / manifest wiring).
   */
  rule: string;
  message: string;
  file?: string;
  field?: string;
}

/** The composed data set every downstream consumer (P4/P5) builds from. */
export interface PublishedDataSet {
  /**
   * Mode-scoped gallery list sorted by slug (deterministic route/sitemap
   * order): production → published ONLY (drafts provably absent); preview →
   * all parsed galleries (ADR-020 draft routes).
   */
  galleries: Gallery[];
  /**
   * Mode-scoped place list sorted by slug: production → places with at least
   * one PUBLISHED gallery; preview → all parsed places.
   */
  places: Place[];
  /** Sorted draft Gallery IDs (empty in production; preview indicator input). */
  draftGalleryIds: string[];
  home: {
    /** Parsed §10.1 settings, or null when the settings file is invalid. */
    settings: HomeSettings | null;
    /** §10.2 resolved featured Gallery ID (never a draft). */
    featuredGalleryId: string | null;
    /** §10.4 Recent list over published-only galleries (full ordered list). */
    recentGalleryIds: string[];
  };
  /** Resolved redirect set (WP-52 contract); production keeps published targets only. */
  redirects: ReturnType<typeof resolveRedirects>["redirects"];
  /** Gallery ID → next_gallery_id (null = none), keys sorted; published-only in production. */
  nextGalleryMap: Record<string, string | null>;
}

export interface ArchiveValidationResult {
  ok: boolean;
  errors: ProductionValidationIssue[];
  warnings: ProductionValidationIssue[];
  /**
   * Best-effort composed data set — meaningful for consumption ONLY when
   * `ok` is true (fail-closed contract: consumers must check ok first).
   */
  publishedDataSet: PublishedDataSet;
}

/** Gate-level rule tokens (the closed fail-open surface). */
export const MISSING_INGEST_ROOT_RULE = "context:ingest-root-required";
export const ASSET_MANIFEST_ABSENT_RULE = "context:asset-manifest-absent";

/** IMAGE_PIPELINE.md §10.3 canonical derivative purposes. */
export const REQUIRED_DERIVATIVE_PURPOSES: ReadonlyArray<string> = [
  "gallery_display",
  "overview",
  "cover",
];

type AnyIssue =
  GalleryValidationIssue | PlaceValidationIssue | HomeSettingsIssue | RedirectValidationIssue;

/**
 * Deterministic total order over findings: (file, rule, field, message),
 * each compared lexicographically; missing values sort first. Documented in
 * docs/implementation/WP-13.md — input permutation can never change the
 * reported order (UD-003 determinism).
 */
export function compareProductionIssues(
  a: ProductionValidationIssue,
  b: ProductionValidationIssue,
): number {
  const key = (i: ProductionValidationIssue): string =>
    `${i.file ?? ""}\u0000${i.rule}\u0000${i.field ?? ""}\u0000${i.message}`;
  const ka = key(a);
  const kb = key(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function toProductionIssue(issue: AnyIssue): ProductionValidationIssue {
  return {
    severity: issue.severity,
    rule: issue.rule,
    message: issue.message,
    file: issue.file,
    field: issue.field,
  };
}

/** Convenience formatter for build logs: "ERROR [13.1#17] <file> (field): <message>". */
export function formatArchiveIssues(issues: ReadonlyArray<ProductionValidationIssue>): string[] {
  return issues.map((i) => {
    const body = i.message.replace(/^\[[^\]]+\]\s*/, "");
    return `${i.severity.toUpperCase()} [${i.rule}] ${i.file ?? "<unknown source>"}${
      i.field ? ` (${i.field})` : ""
    }: ${body}`;
  });
}

/**
 * §13.1#18: every Photo of every PUBLISHED Gallery must have all required
 * derivative purposes in the supplied manifest rows. Pure.
 */
export function validateDerivativeCoverage(
  galleries: ReadonlyArray<Gallery>,
  manifest: AssetManifestInput | undefined,
  options: { requiredPurposes?: ReadonlyArray<string> } = {},
): ProductionValidationIssue[] {
  if (manifest === undefined) return [];
  const purposes = options.requiredPurposes ?? REQUIRED_DERIVATIVE_PURPOSES;
  const byPhoto = new Map<string, Set<string>>();
  for (const row of manifest.rows) {
    if (typeof row?.photo_id !== "string" || typeof row?.purpose !== "string") continue;
    const set = byPhoto.get(row.photo_id) ?? new Set<string>();
    set.add(row.purpose);
    byPhoto.set(row.photo_id, set);
  }
  const errors: ProductionValidationIssue[] = [];
  for (const gallery of galleries) {
    for (const photo of gallery.photos) {
      const have = byPhoto.get(photo.id);
      for (const purpose of purposes) {
        if (!have?.has(purpose)) {
          errors.push({
            severity: "error",
            rule: "13.1#18",
            message: `[13.1#18] Gallery '${gallery.id}' photo '${photo.id}': derivative coverage incomplete — manifest rows are missing the '${purpose}' purpose (IMAGE_PIPELINE §10.3; every published Photo requires all of ${purposes
              .map((p) => `'${p}'`)
              .join(", ")})`,
            file: "generated/asset-manifest.json",
            field: `derivatives[${photo.id}][${purpose}]`,
          });
        }
      }
    }
  }
  return errors;
}

function sortedByIds<T extends { id: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function sortedBySlug<T extends { slug: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/**
 * Composes the whole-archive validation pass. Pure; never throws on invalid
 * content — every failure is a structured finding with a rule ID.
 *
 * Finding merge order is fixed (galleries → places → home → redirects →
 * gate context → derivative coverage) and the merged list is sorted with the
 * documented total order, so the result is fully deterministic.
 */
export function composeArchiveValidation(
  inputs: ComposeArchiveInputs,
  options: ComposeArchiveOptions,
): ArchiveValidationResult {
  const { mode } = options;
  const isProduction = mode === "production";
  const errors: ProductionValidationIssue[] = [];
  const warnings: ProductionValidationIssue[] = [];

  // ---------------------------------------------------------------------
  // 0. Closed fail-open guard (production WITHOUT ingestRoot = error).
  //    In production the gate refuses to run without the master root: the
  //    §13.1#1 check would be silently skipped (WP-09 deferred minor).
  // ---------------------------------------------------------------------
  if (isProduction && options.ingestRoot === undefined) {
    errors.push({
      severity: "error",
      rule: MISSING_INGEST_ROOT_RULE,
      message: `[${MISSING_INGEST_ROOT_RULE}] Production validation requires ingestRoot (the media/ingest-masters/ root): without it the §13.1#1 WEB INGEST MASTER check would silently not run (fail-open guard, WP-13)`,
      field: "ingestRoot",
    });
  }

  // ---------------------------------------------------------------------
  // 1. Places first: the parsed Place set feeds the Gallery place-ref
  //    check (§13.1#9) and the redirect registries (§11.3).
  // ---------------------------------------------------------------------
  const placeResult = validatePlaces(inputs.places, { mode });
  const parsedPlaces = placeResult.ok
    ? sortedByIds(
        inputs.places
          .map((p) => p.data as Place)
          .filter((p) => typeof p?.id === "string" && typeof p?.slug === "string"),
      )
    : [];
  // knownPlaceIds is ALWAYS derived here — never an optional composer input.
  const knownPlaceIds = new Set(parsedPlaces.map((p) => p.id));

  // ---------------------------------------------------------------------
  // 2. Galleries with the FULL context (ingestRoot + derived place IDs).
  // ---------------------------------------------------------------------
  const galleryResult = validateGalleries(inputs.galleries, {
    mode,
    knownPlaceIds,
    ...(options.ingestRoot !== undefined ? { ingestRoot: options.ingestRoot } : {}),
  });
  // Parsed galleries are the schema-valid subset (same criteria the
  // validator used): id/slug/status/published_at/photos are trustworthy.
  const parsedGalleries = sortedByIds(
    inputs.galleries
      .map((g) => g.data as Gallery)
      .filter(
        (g) =>
          typeof g?.id === "string" &&
          typeof g?.slug === "string" &&
          (g?.status === "draft" || g?.status === "published") &&
          Array.isArray(g?.photos),
      ),
  );

  // ---------------------------------------------------------------------
  // 3. Home settings (§10.1) + featured/Recent resolution (§10.2/§10.4).
  // ---------------------------------------------------------------------
  const homeResult = validateHomeSettings(inputs.home.data, { file: inputs.home.filePath });
  const homeSettings = homeResult.settings;
  const featured = resolveFeatured(homeSettings ?? { featured_gallery_id: null }, parsedGalleries, {
    mode,
  });
  const recent = orderRecentGalleries(parsedGalleries, { mode });

  // ---------------------------------------------------------------------
  // 4. Redirects — registries ALWAYS supplied (no fail-open skip).
  // ---------------------------------------------------------------------
  const redirectResult = validateRedirects(inputs.redirects, {
    mode,
    galleries: parsedGalleries,
    places: parsedPlaces,
  });
  const redirectResolution = resolveRedirects(inputs.redirects, {
    mode,
    galleries: parsedGalleries,
    places: parsedPlaces,
  });
  // Production defense-in-depth is applied when composing the data set
  // (step 6): the resolved set provably carries public routes only.

  // ---------------------------------------------------------------------
  // 6. Compose the data set FIRST (the production place-publicity check
  //    below consults it), then merge + sort findings.
  // ---------------------------------------------------------------------
  const publishedParsed = parsedGalleries.filter((g) => g.status === "published");
  const dataSetGalleries = isProduction ? publishedParsed : parsedGalleries;
  const publishedIds = new Set(publishedParsed.map((g) => g.id));
  // R3 place-publicity extension (docs/reports/gallery-r3-fix-agent-handoff-
  // 2026-09-13.md §3): a place is PUBLIC when a PUBLISHED gallery references
  // it at gallery level OR any published photo carries an explicit photo-level
  // `place` reference to it (Cologne has two confirmed photos but no gallery).
  // Caption text never creates publicity.
  const dataSetPlaces = isProduction
    ? sortedBySlug(
        parsedPlaces.filter((p) =>
          parsedGalleries.some(
            (g) =>
              g.status === "published" &&
              (g.places.includes(p.id) ||
                g.photos.some((photo) => photo.place === p.id)),
          ),
        ),
      )
    : sortedBySlug(parsedPlaces);
  const nextGalleryMap: Record<string, string | null> = {};
  for (const gallery of sortedByIds(dataSetGalleries)) {
    nextGalleryMap[gallery.id] = gallery.next_gallery_id ?? null;
  }
  // Resolved redirects: in production the set provably carries PUBLIC routes
  // only. Draft-gallery targets already fail WP-12's §13.1#16; the composed
  // gate adds the place-side statement: a Place with NO published gallery has
  // no public /places/{slug} route (§6/§8.3; the pl_essen edge), so a redirect
  // into it is unresolved in production (§13.1#16). Preview keeps all routes.
  // Findings carry the source entry's file (and target-type field) so the
  // CLI/contract output names content/redirects.yaml, not "<unknown source>".
  const redirectFileByOldPath = new Map(
    inputs.redirects.map((entry) => [entry.oldPath, entry.filePath]),
  );
  const composedPlaceRouteErrors: ProductionValidationIssue[] = isProduction
    ? redirectResolution.redirects
        .filter((r) => r.targetType === "place" && !dataSetPlaces.some((p) => p.id === r.targetId))
        .map((r) => ({
          severity: "error" as const,
          rule: "13.1#16",
          message: `[13.1#16] redirect entry '${r.oldPath}': target Place '${r.targetId}' has no published galleries and therefore no public canonical route in production (§13.1#16; §6/§8.3)`,
          file: redirectFileByOldPath.get(r.oldPath),
          field: r.targetType === "place" ? "place_id" : "gallery_id",
        }))
    : [];
  const finalRedirects = isProduction
    ? redirectResolution.redirects.filter((r) => {
        if (r.targetType === "place") return dataSetPlaces.some((p) => p.id === r.targetId);
        return publishedIds.has(r.targetId);
      })
    : redirectResolution.redirects;

  // ---------------------------------------------------------------------
  // 5b. §13.1#18 derivative coverage (when the manifest is supplied).
  // ---------------------------------------------------------------------
  const derivativeErrors = validateDerivativeCoverage(publishedParsed, options.assetManifest, {
    requiredPurposes: options.requiredDerivativePurposes,
  });

  // WP-42 (D11 FINAL, policy b): alt-text publication enforcement. Drafts
  // are skipped inside validateAltText; severity is mode-scoped there
  // (production errors, preview warnings) and routed here accordingly.
  const fileByGalleryId = new Map(
    inputs.galleries
      .filter((g) => typeof (g.data as Gallery)?.id === "string" && typeof g.filePath === "string")
      .map((g) => [(g.data as Gallery).id, g.filePath as string] as const),
  );
  const altIssues = validateAltText(parsedGalleries, { mode, fileByGalleryId });
  errors.push(
    ...altIssues
      .filter((i) => i.severity === "error")
      .map((i) => ({ severity: i.severity, rule: i.rule, message: i.message, file: i.file, field: i.field })),
    ...galleryResult.errors.map(toProductionIssue),
    ...placeResult.errors.map(toProductionIssue),
    ...homeResult.errors.map(toProductionIssue),
    ...redirectResult.errors.map(toProductionIssue),
    ...composedPlaceRouteErrors,
    ...derivativeErrors,
  );
  warnings.push(
    ...altIssues
      .filter((i) => i.severity === "warning")
      .map((i) => ({ severity: i.severity, rule: i.rule, message: i.message, file: i.file, field: i.field })),
    ...galleryResult.warnings.map(toProductionIssue),
    ...placeResult.warnings.map(toProductionIssue),
    ...homeResult.warnings.map(toProductionIssue),
    ...featured.warnings.map((w) => ({
      severity: "warning" as const,
      rule: w.rule,
      message: w.message,
      file: inputs.home.filePath,
      field: "featured_gallery_id",
    })),
    ...redirectResolution.warnings.map(toProductionIssue),
  );
  // Absent manifest: explicit, visible, never a silent skip. Not a content
  // defect — the P3 pipeline supplies generated/asset-manifest.json.
  if (isProduction && options.assetManifest === undefined) {
    warnings.push({
      severity: "warning",
      rule: ASSET_MANIFEST_ABSENT_RULE,
      message: `[${ASSET_MANIFEST_ABSENT_RULE}] No asset manifest supplied — §13.1#18 derivative coverage is NOT enforced this run (the P3 pipeline provides generated/asset-manifest.json before astro build)`,
      file: "generated/asset-manifest.json",
    });
  }

  errors.sort(compareProductionIssues);
  warnings.sort(compareProductionIssues);

  // ---------------------------------------------------------------------
  // 7. Result. Consumers MUST gate on `ok` before consuming the data set.
  // ---------------------------------------------------------------------
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    publishedDataSet: {
      galleries: sortedBySlug(dataSetGalleries),
      places: dataSetPlaces,
      draftGalleryIds: isProduction
        ? []
        : sortedByIds(parsedGalleries.filter((g) => g.status === "draft")).map((g) => g.id),
      home: {
        settings: homeSettings,
        featuredGalleryId: featured.galleryId,
        recentGalleryIds: recent.map((g) => g.id),
      },
      redirects: finalRedirects,
      nextGalleryMap,
    },
  };
}
