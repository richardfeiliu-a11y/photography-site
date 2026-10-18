// WP-09 — cross-item Gallery validation with draft-vs-production severity modes.
//
// Authority:
//   - CONTENT_MODEL.md §3 (global uniqueness of Gallery/Photo IDs, slug namespaces)
//   - CONTENT_MODEL.md §8.2/§8.3/§8.4 (published requirements; draft leniency; cover policy)
//   - CONTENT_MODEL.md §9 (next_gallery_id: exists, published-in-production, not self,
//     dangling forbidden, cycles ALLOWED — §9.3)
//   - CONTENT_MODEL.md §13.1 (numbered fail-closed rules) / §13.2 (warnings,
//     "local preview / draft only"; "Warnings must never allow broken published
//     content to pass a production build")
//   - SOURCE_OF_TRUTH_MATRIX.md §1 (source_ref resolves to an existing WEB INGEST
//     MASTER under media/ingest-masters/)
//
// Shape: `validateGalleries(entries, { mode, ... })` is a PURE function over raw
// entry data so WP-13 can compose it into the production gate. It re-parses every
// entry with the real gallerySchema (fail-closed per-item), then runs the
// cross-item identity/reference checks, then (preview mode only) emits §13.2
// warnings. Warnings NEVER affect `ok`; only errors do, and every §13.1 rule
// implemented here fails production validation regardless of warning state.
//
// Modes (documented in docs/implementation/WP-09.md):
//   - preview  : draft-lenient. §13.2 conditions are emitted as WARNINGS. §13.1
//                rules that are intrinsically status-scoped (published cover/
//                published_at) stay errors — they are §4.2 table contracts.
//   - production: fail-closed per §13.1. In addition the production-only rule
//                §13.1#12 (next_gallery_id → draft) is enforced, and §13.2
//                warnings are not emitted (they are a local-preview concept).
import { statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { FORBIDDEN_GALLERY_FIELDS, gallerySchema, type Gallery } from "../../content-schemas";

export type GalleryValidationMode = "preview" | "production";

/** One raw collection entry: unvalidated data plus its source path (for messages). */
export interface GalleryEntryInput {
  data: unknown;
  filePath?: string;
}

export interface GalleryValidateOptions {
  mode: GalleryValidationMode;
  /**
   * Known Place IDs (from the places collection). When supplied, every Gallery
   * places[] entry must reference one of them (§13.1#9). When omitted the check
   * is skipped — the composer (WP-13) supplies the full set.
   */
  knownPlaceIds?: ReadonlySet<string>;
  /**
   * WEB INGEST MASTER root (media/ingest-masters/). When supplied, every Photo
   * source_ref must resolve to an existing file inside it (§13.1#1).
   */
  ingestRoot?: string | URL;
}

export interface GalleryValidationIssue {
  severity: "error" | "warning";
  /**
   * Machine-readable rule label: "13.1#N" for CONTENT_MODEL §13.1 numbered rules,
   * "13.2#warn-..." for §13.2 warning conditions, or a contract-section label
   * ("4.2:photos-nonempty", "4.3:forbidden-field", "5.2:rhythm-enum").
   * "schema" marks shape errors with no numbered rule.
   */
  rule: string;
  message: string;
  gallery?: string;
  photo?: string;
  field?: string;
  file?: string;
}

export interface GalleryValidationResult {
  ok: boolean;
  errors: GalleryValidationIssue[];
  warnings: GalleryValidationIssue[];
}

/** Rule labels used by the cross-item checks. */
const RULE = {
  missingIngestMaster: "13.1#1",
  duplicateGalleryId: "13.1#2",
  duplicateGallerySlug: "13.1#3",
  duplicatePhotoId: "13.1#4",
  placeReferenceMissing: "13.1#9",
  photoPlaceReferenceMissing: "13.1#19",
  nextTargetMissing: "13.1#10",
  nextTargetsDraftInProduction: "13.1#12",
  routeCollision: "13.1#17",
  warnMissingCoverDraft: "13.2#warn-missing-cover",
  warnMissingPublishedAtDraft: "13.2#warn-missing-published-at",
  warnMissingDescription: "13.2#warn-missing-description",
  warnSinglePhoto: "13.2#warn-single-photo",
} as const;

/** Message rule-token prefix, e.g. "[13.1#8] ..." or "[4.3:forbidden-field] ...". */
const RULE_TOKEN = /^\[(\d+\.\d+(?:[:#][a-z0-9-]+)+)\]\s*/;

interface ParsedEntry {
  data: Gallery;
  filePath?: string;
}

function issue(
  rule: string,
  message: string,
  rest: Partial<Omit<GalleryValidationIssue, "severity" | "rule" | "message">> = {},
): GalleryValidationIssue {
  return { severity: "error", rule, message, ...rest };
}

function warning(
  rule: string,
  message: string,
  rest: Partial<Omit<GalleryValidationIssue, "severity" | "rule" | "message">> = {},
): GalleryValidationIssue {
  return { severity: "warning", rule, message, ...rest };
}

function describeFile(filePath?: string): string {
  return filePath ?? "<unknown source>";
}

/**
 * Maps one zod issue to a structured error, naming the gallery (raw id when the
 * entry failed to parse), the photo item (from the issue path), and the field.
 */
function issueFromZod(
  entry: GalleryEntryInput,
  path: readonly PropertyKey[],
  message: string,
  keys?: readonly string[],
  code?: string,
): GalleryValidationIssue {
  const token = RULE_TOKEN.exec(message)?.[1] ?? "schema";
  let photo: string | undefined;
  if (path[0] === "photos" && typeof path[1] === "number") {
    const photos = (entry.data as { photos?: unknown } | null)?.photos;
    const raw = Array.isArray(photos) ? photos[path[1]] : undefined;
    if (typeof raw === "object" && raw !== null && "id" in raw) {
      const id = (raw as { id?: unknown }).id;
      if (typeof id === "string" && id.length > 0) photo = id;
    }
  }
  const rawId =
    typeof entry.data === "object" && entry.data !== null && "id" in entry.data
      ? (entry.data as { id?: unknown }).id
      : undefined;
  const gallery = typeof rawId === "string" && rawId.length > 0 ? rawId : undefined;
  let field: string | undefined;
  if (keys && keys.length > 0 && code === "unrecognized_keys") {
    field = keys.join(", ");
  } else if (path.length > 0) {
    field = path.map(String).join(".");
  }
  const who = gallery ? `Gallery '${gallery}'` : describeFile(entry.filePath);
  // superRefine-produced messages already self-identify ("Gallery 'x': ...");
  // only wrap bare field messages with the gallery/file context.
  const body = message.replace(RULE_TOKEN, "").trim();
  const text = body.startsWith("Gallery '") ? body : `${who}: ${body}`;
  return issue(token, `[${token}] ${text}`, {
    gallery,
    photo,
    field,
    file: entry.filePath,
  });
}

function ingestRootPath(ingestRoot: string | URL): string {
  return typeof ingestRoot === "string" ? resolve(ingestRoot) : fileURLToPath(ingestRoot);
}

/** §13.1#1: source_ref must resolve to an existing file inside the master root. */
export function masterExists(rootPath: string, sourceRef: string): boolean {
  const abs = resolve(rootPath, sourceRef);
  const inside = abs === rootPath || abs.startsWith(rootPath + sep);
  if (!inside) return false;
  try {
    return statSync(abs).isFile();
  } catch {
    return false;
  }
}

function isMissingText(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

/**
 * Validates a set of Gallery entries. Pure; never throws on invalid content —
 * every failure is reported as a structured issue.
 */
export function validateGalleries(
  entries: ReadonlyArray<GalleryEntryInput>,
  options: GalleryValidateOptions,
): GalleryValidationResult {
  const { mode } = options;
  const errors: GalleryValidationIssue[] = [];
  const warnings: GalleryValidationIssue[] = [];

  // Phase 1 — per-item fail-closed schema validation (real gallerySchema).
  const parsed: ParsedEntry[] = [];
  for (const entry of entries) {
    const result = gallerySchema.safeParse(entry.data);
    if (result.success) {
      parsed.push({ data: result.data, filePath: entry.filePath });
    } else {
      for (const zodIssue of result.error.issues) {
        const keys =
          zodIssue.code === "unrecognized_keys"
            ? (zodIssue as { keys?: string[] }).keys
            : undefined;
        errors.push(issueFromZod(entry, zodIssue.path, zodIssue.message, keys, zodIssue.code));
      }
    }
  }

  // Phase 2 — cross-item identity and reference checks over parsed entries.
  const galleryById = new Map<string, ParsedEntry>();
  const slugOwners = new Map<string, ParsedEntry>();
  const photoOwners = new Map<string, { gallery: string; file?: string; sourceRef: string }>();

  for (const entry of parsed) {
    const { data } = entry;
    const file = describeFile(entry.filePath);

    // §13.1#2 duplicate Gallery ID.
    const idOwner = galleryById.get(data.id);
    if (idOwner) {
      errors.push(
        issue(
          RULE.duplicateGalleryId,
          `[${RULE.duplicateGalleryId}] Duplicate Gallery ID '${data.id}': ${describeFile(idOwner.filePath)} and ${file} share the same id (globally unique, §3)`,
          { gallery: data.id, field: "id", file: entry.filePath },
        ),
      );
    } else {
      galleryById.set(data.id, entry);
    }

    // §13.1#3 duplicate slug + §13.1#17 canonical route collision.
    const slugOwner = slugOwners.get(data.slug);
    if (slugOwner) {
      errors.push(
        issue(
          RULE.duplicateGallerySlug,
          `[${RULE.duplicateGallerySlug}] Duplicate Gallery slug '${data.slug}': ${describeFile(slugOwner.filePath)} and ${file} share the same slug (unique in /galleries/, §3)`,
          { gallery: data.id, field: "slug", file: entry.filePath },
        ),
      );
      errors.push(
        issue(
          RULE.routeCollision,
          `[${RULE.routeCollision}] Canonical route collision: ${describeFile(slugOwner.filePath)} and ${file} would both produce /galleries/${data.slug} (§13.1#17)`,
          { gallery: data.id, field: "slug", file: entry.filePath },
        ),
      );
    } else {
      slugOwners.set(data.slug, entry);
    }

    // §13.1#4 duplicate Photo ID (across galleries AND within one gallery).
    for (const photo of data.photos) {
      const owner = photoOwners.get(photo.id);
      if (owner) {
        errors.push(
          issue(
            RULE.duplicatePhotoId,
            `[${RULE.duplicatePhotoId}] Duplicate Photo ID '${photo.id}': already defined in Gallery '${owner.gallery}' (${describeFile(owner.file)}), redefined in Gallery '${data.id}' (${file}) — Photo IDs are globally unique (§3)`,
            { gallery: data.id, photo: photo.id, field: "photos[].id", file: entry.filePath },
          ),
        );
      } else {
        photoOwners.set(photo.id, {
          gallery: data.id,
          file: entry.filePath,
          sourceRef: photo.source_ref,
        });
      }
    }
  }

  for (const entry of parsed) {
    const { data } = entry;

    // §13.1#9 place references (requires the composer-supplied Place ID set).
    if (options.knownPlaceIds) {
      data.places.forEach((placeId, index) => {
        if (!options.knownPlaceIds?.has(placeId)) {
          errors.push(
            issue(
              RULE.placeReferenceMissing,
              `[${RULE.placeReferenceMissing}] Gallery '${data.id}': places[${index}] references Place ID '${placeId}' which does not exist (§8.2 requirement 3)`,
              { gallery: data.id, field: `places[${index}]`, file: entry.filePath },
            ),
          );
        }
      });
    }

    // R3 photo-level place references (§13.1#19): a photo `place` value must
    // reference an existing Place ID — same authority as gallery places[],
    // never inferred from captions. Absent stays absent (unconfirmed is a
    // valid state; the composer may warn separately).
    if (options.knownPlaceIds) {
      for (const photo of data.photos) {
        if (photo.place != null && !options.knownPlaceIds.has(photo.place)) {
          errors.push(
            issue(
              RULE.photoPlaceReferenceMissing,
              `[${RULE.photoPlaceReferenceMissing}] Gallery '${data.id}' photo '${photo.id}': place references Place ID '${photo.place}' which does not exist (photo-level place refs must use existing Place IDs)`,
              { gallery: data.id, field: `photos[${photo.id}].place`, file: entry.filePath },
            ),
          );
        }
      }
    }

    // §9.2 / §13.1#10 / §13.1#12.
    if (data.next_gallery_id != null) {
      const target = galleryById.get(data.next_gallery_id);
      if (!target) {
        errors.push(
          issue(
            RULE.nextTargetMissing,
            `[${RULE.nextTargetMissing}] Gallery '${data.id}': next_gallery_id references Gallery ID '${data.next_gallery_id}' which does not exist (dangling next is a build error, §9.2)`,
            { gallery: data.id, field: "next_gallery_id", file: entry.filePath },
          ),
        );
      } else if (mode === "production" && target.data.status === "draft") {
        errors.push(
          issue(
            RULE.nextTargetsDraftInProduction,
            `[${RULE.nextTargetsDraftInProduction}] Gallery '${data.id}': next_gallery_id targets draft Gallery '${target.data.id}' — forbidden in a production build (§8.3/§9.2)`,
            { gallery: data.id, field: "next_gallery_id", file: entry.filePath },
          ),
        );
      }
    }

    // §13.1#1 WEB INGEST MASTER resolution (requires the master root).
    if (options.ingestRoot) {
      const rootPath = ingestRootPath(options.ingestRoot);
      for (const photo of data.photos) {
        if (!masterExists(rootPath, photo.source_ref)) {
          errors.push(
            issue(
              RULE.missingIngestMaster,
              `[${RULE.missingIngestMaster}] Gallery '${data.id}' photo '${photo.id}': source_ref '${photo.source_ref}' does not resolve to an existing WEB INGEST MASTER under media/ingest-masters/ (§13.1#1)`,
              { gallery: data.id, photo: photo.id, field: "source_ref", file: entry.filePath },
            ),
          );
        }
      }
    }
  }

  // Phase 3 — §13.2 warnings: local preview / draft only. Never emitted in
  // production mode; never affect `ok`.
  if (mode === "preview") {
    for (const entry of parsed) {
      const { data } = entry;
      if (data.status === "draft" && data.cover_photo_id == null) {
        warnings.push(
          warning(
            RULE.warnMissingCoverDraft,
            `[${RULE.warnMissingCoverDraft}] Gallery '${data.id}': draft Gallery has no cover_photo_id (§13.2; it may be omitted locally, §8.4)`,
            { gallery: data.id, field: "cover_photo_id", file: entry.filePath },
          ),
        );
      }
      if (data.status === "draft" && data.published_at == null) {
        warnings.push(
          warning(
            RULE.warnMissingPublishedAtDraft,
            `[${RULE.warnMissingPublishedAtDraft}] Gallery '${data.id}': draft Gallery has no published_at (§13.2; it may be omitted locally, §8.3)`,
            { gallery: data.id, field: "published_at", file: entry.filePath },
          ),
        );
      }
      if (isMissingText(data.description)) {
        warnings.push(
          warning(
            RULE.warnMissingDescription,
            `[${RULE.warnMissingDescription}] Gallery '${data.id}': no description (§13.2)`,
            { gallery: data.id, field: "description", file: entry.filePath },
          ),
        );
      }
      if (data.photos.length === 1) {
        warnings.push(
          warning(
            RULE.warnSinglePhoto,
            `[${RULE.warnSinglePhoto}] Gallery '${data.id}': single-photo Gallery (§13.2)`,
            { gallery: data.id, file: entry.filePath },
          ),
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Convenience formatter for build logs (used by WP-13's gate). */
export function formatGalleryIssues(issues: ReadonlyArray<GalleryValidationIssue>): string[] {
  return issues.map((i) => `${i.severity.toUpperCase()} [${i.rule}] ${i.message}`);
}

/** Re-exported so composers can name the banned fields without importing schemas. */
export { FORBIDDEN_GALLERY_FIELDS };
