// WP-42 -- Alt text publication enforcement (D11/OQ-04, policy (b) PROPOSED).
//
// Authority:
//   - CONTENT_MODEL.md 5.2 (alt_text semantics: no filename fallback;
//     caption is not automatically alt)
//   - ADR-016 (schema support adopted; enforcement deferred to P7)
//   - OPEN_QUESTIONS.md OQ-04; RUNTIME 3.3 (caption-as-alt prohibited)
//   - PRODUCTION_IMPLEMENTATION_PLAN.md WP-42; PHASE_GATES.md P7 entry
//   - Decision record (PROPOSED, pending user sign-off):
//     docs/implementation/decisions/ALT-POLICY.md
//
// Policy (b): a published Photo passes with authored meaningful alt OR with
// an explicit decorative alt="" (empty string). Missing alt (null/undefined
// or whitespace-only) fails production and warns in preview. Filename-derived
// alt (source_ref basename or stem, exact or case-insensitive) always fails.
// Caption-to-alt auto-copy never happens -- enforced at the view-model
// boundary (buildGalleryView passes alt_text through verbatim; null stays
// null) and covered by tests/unit/alt-policy.test.ts.
//
// Pure function over parsed Gallery objects; the WP-13 composer
// (src/lib/validate/production.ts) owns mode scoping (published-only in
// production) and file attribution via fileByGalleryId.
import type { Gallery } from "../../content-schemas";

export type AltValidationMode = "preview" | "production";

export const ALT_MISSING_RULE = "WP-42:alt-missing";
export const ALT_FILENAME_FALLBACK_RULE = "WP-42:alt-filename-fallback";

export interface AltValidationIssue {
  severity: "error" | "warning";
  rule: typeof ALT_MISSING_RULE | typeof ALT_FILENAME_FALLBACK_RULE;
  message: string;
  gallery?: string;
  photo?: string;
  field?: string;
  file?: string;
}

export interface ValidateAltOptions {
  mode: AltValidationMode;
  /** Gallery ID -> source file (for messages); omitted entries report without file. */
  fileByGalleryId?: ReadonlyMap<string, string>;
}

function fileOf(
  galleryId: string,
  fileByGalleryId: ValidateAltOptions["fileByGalleryId"],
): string | undefined {
  if (fileByGalleryId === undefined) return undefined;
  return fileByGalleryId.get(galleryId);
}

function basenameOf(sourceRef: string): string {
  const parts = sourceRef.split("/");
  return parts[parts.length - 1] ?? sourceRef;
}

function stemOf(basename: string): string {
  const dot = basename.lastIndexOf(".");
  return dot > 0 ? basename.slice(0, dot) : basename;
}

/** True when the authored alt is filename-derived (basename or stem match). */
function isFilenameDerived(alt: string, sourceRef: string): boolean {
  const candidate = alt.trim();
  if (candidate.length === 0) return false;
  const basename = basenameOf(sourceRef);
  const stem = stemOf(basename);
  const lower = candidate.toLowerCase();
  return (
    candidate === basename ||
    candidate === stem ||
    lower === basename.toLowerCase() ||
    lower === stem.toLowerCase()
  );
}

/**
 * Validates alt_text across the given galleries (caller scopes publication
 * state: pass published-only in production, all parsed in preview).
 * Draft galleries are always skipped -- enforcement is a publication gate.
 */
export function validateAltText(
  galleries: ReadonlyArray<Gallery>,
  options: ValidateAltOptions,
): AltValidationIssue[] {
  const severity = options.mode === "production" ? "error" : "warning";
  const issues: AltValidationIssue[] = [];
  for (const gallery of galleries) {
    if (gallery.status !== "published") continue;
    const file = fileOf(gallery.id, options.fileByGalleryId);
    for (const photo of gallery.photos) {
      const field = "photos[" + photo.id + "].alt_text";
      const alt = photo.alt_text;
      if (alt == null || alt.trim().length === 0) {
        // Explicit decorative alt="" passes; missing/null/whitespace fails.
        if (alt === "") continue;
        issues.push({
          severity,
          rule: ALT_MISSING_RULE,
          message:
            "[" +
            ALT_MISSING_RULE +
            "] Gallery '" +
            gallery.id +
            "' photo '" +
            photo.id +
            '\': published Photo requires authored alt_text or an explicit decorative alt="" (WP-42 policy (b); no filename fallback; caption is not alt)',
          gallery: gallery.id,
          photo: photo.id,
          field,
          ...(file !== undefined ? { file } : {}),
        });
        continue;
      }
      if (isFilenameDerived(alt, photo.source_ref)) {
        issues.push({
          severity,
          rule: ALT_FILENAME_FALLBACK_RULE,
          message:
            "[" +
            ALT_FILENAME_FALLBACK_RULE +
            "] Gallery '" +
            gallery.id +
            "' photo '" +
            photo.id +
            "': alt_text must not be derived from the filename/source_ref ('" +
            basenameOf(photo.source_ref) +
            '\'); author meaningful alt or explicit decorative alt=""',
          gallery: gallery.id,
          photo: photo.id,
          field,
          ...(file !== undefined ? { file } : {}),
        });
      }
    }
  }
  return issues;
}
