// WP-09 — fail-closed Zod schemas for Gallery and inline Photo items.
//
// Authority (verbatim field contracts):
//   - CONTENT_MODEL.md §4.1/§4.2/§4.3 (Gallery schema, field contracts, forbidden fields)
//   - CONTENT_MODEL.md §5.1/§5.2/§5.4 (Photo item shape, caption/rhythm/alt semantics,
//     derived properties never authored)
//   - CONTENT_MODEL.md §8 (publication lifecycle: published requirements, draft leniency)
//   - SOURCE_OF_TRUTH_MATRIX.md §1/§2/§6 (source_ref relative to media/ingest-masters/;
//     no duplicate authorities)
//   - CONTENT_MODEL.md §6 (Place: §6.1 ONE PLACE = ONE YAML FILE singular schema,
//     §6.2 field contracts, §6.3 constraints — no Visit/Trip concept, no public
//     coordinates, no counts)
//   - TECHNICAL_API_VERIFICATION.md §1 (Astro 7.2.9 Content Layer; astro bundles zod ^4;
//     IC-01: glob loader + singular schema ⇒ one collection entry per file)
//
// Zod choice: `z` is imported from "astro/zod" (zod 4.5.2, the single hoisted instance
// astro itself uses). No separate zod dependency is added — this keeps the schema
// instances type- and runtime-identical to what Astro's Content Layer applies, and the
// WP-03 test harness (tests/support/content-layer.ts parseData) uses the same instance.
//
// Error-message convention: every issue this schema can produce carries a machine-
// readable rule token prefix "[<rule>]" — a CONTENT_MODEL §13.1 failure number
// ("13.1#8") where one exists, otherwise the contract section ("4.3:forbidden-field").
// src/lib/validate/gallery.ts and src/lib/validate/place.ts extract these tokens
// for structured findings.
import { z } from "astro/zod";

/**
 * Fields that must NEVER appear in Gallery YAML (CONTENT_MODEL.md §4.3).
 * Reverse relations are derived (UD-011), featured state lives in
 * content/site/home.yaml (UD-004), CJK rendering is a font concern,
 * display labels are derived, and captions/rhythms live inline on photos.
 */
export const FORBIDDEN_GALLERY_FIELDS: ReadonlyArray<string> = [
  "prev_gallery",
  "prev_gallery_id",
  "has_continuation",
  "featured",
  "is_featured",
  "is_curated",
  "title_cjk",
  "photographed_date_label",
  "captions",
  "rhythms",
];

const FORBIDDEN_SET: ReadonlySet<string> = new Set(FORBIDDEN_GALLERY_FIELDS);

/**
 * URL-safe route segment for /galleries/{slug} and /places/{slug}
 * (CONTENT_MODEL.md §4.2/§6.2 "Valid URL-safe segment" / §12): lowercase
 * letters and digits, internal hyphens only.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Formats key/value lists for error messages ('a', 'b'). */
function quoteList(values: ReadonlyArray<string>): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/** Best-effort record id from a raw (unparsed) input, for error messages. */
function rawRecordId(input: unknown): string | undefined {
  if (typeof input === "object" && input !== null && "id" in input) {
    const id = (input as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return undefined;
}

/** Required-string schema that labels a missing key with a rule token. */
function requiredString(token: string, label: string) {
  return z.string({
    error: (issue) =>
      issue.input === undefined
        ? `[${token}] ${label} is required`
        : `[${token}] ${label} must be a string`,
  });
}

/**
 * source_ref (CONTENT_MODEL §5.2 / SOTM §1): required, non-empty, and a RELATIVE
 * path from the media/ingest-masters/ root — never absolute, never a traversal.
 * Existence of the underlying WEB INGEST MASTER is enforced by
 * validateGalleries (§13.1#1) against the real master root.
 */
const sourceRefSchema = requiredString("13.1#7", "Photo source_ref")
  .min(1, "[13.1#7] Photo source_ref must not be empty")
  .refine((v) => v.trim().length > 0, "[13.1#7] Photo source_ref must not be empty")
  .refine(
    (v) => !v.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(v) && !v.includes("\\"),
    "[5.2:source-ref-relative] Photo source_ref must be a relative path from media/ingest-masters/ (absolute host paths never appear in authored YAML; SOURCE_OF_TRUTH_MATRIX §1)",
  )
  .refine(
    (v) =>
      v.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    "[5.2:source-ref-relative] Photo source_ref must stay inside media/ingest-masters/ (no '.', '..' or empty path segments)",
  );

/**
 * Inline Photo item (CONTENT_MODEL §5.1/§5.2). Strict shape: unknown keys fail
 * (per P2 scope; authored derived properties are banned by §5.4).
 * caption/alt_text: optional string OR explicit null — null is VALID and distinct
 * from the key being absent (no reserved caption space) and from "".
 */
export const galleryPhotoSchema = z
  .strictObject(
    {
      id: requiredString("5.2:photo-id", "Photo id").min(
        1,
        "[5.2:photo-id] Photo id must not be empty",
      ),
      source_ref: sourceRefSchema,
      caption: z.string().nullish(),
      /* Photo-level Place reference (R3 place-aggregation contract,
       * docs/reports/gallery-r3-fix-agent-handoff-2026-09-13.md §3): an
       * EXPLICIT, per-photo Place ID. Absent = place not (yet) confirmed —
       * never inferred from the caption or inherited from the gallery's
       * places[]. Referential integrity is enforced by 13.1#19 in
       * src/lib/validate/gallery.ts. */
      place: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? undefined
              : "[5.2:photo-place-type] Photo place must be a Place ID string",
        })
        .min(1, "[5.2:photo-place-empty] Photo place must not be empty")
        .nullish(),
      /* Evidence-backed capture timestamp read from the ingest master's EXIF
       * DateTimeOriginal. Naive local time (no timezone in the source
       * record): stored without a Z suffix on purpose — no invented
       * precision. Display collapses to month precision via
       * formatPhotographedDate; ordering uses the raw string. */
      captured_at: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? undefined
              : "[5.2:captured-at-type] Photo captured_at must be a string",
        })
        .regex(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
          "[5.2:captured-at-format] Photo captured_at must be a naive local timestamp 'YYYY-MM-DDTHH:MM:SS' (EXIF DateTimeOriginal; no timezone suffix)",
        )
        .nullish(),
      rhythm_after: z
        .enum(["base", "compact", "breathing"], {
          error: () =>
            "[5.2:rhythm-enum] Photo rhythm_after must be one of 'base' | 'compact' | 'breathing' (CONTENT_MODEL §5.2; the value 'spacious' does not exist; default 'base')",
        })
        .default("base"),
      alt_text: z.string().nullish(),
    },
    {
      error: (issue) => {
        if (issue.code !== "unrecognized_keys") return undefined;
        const keys = issue.keys;
        return `[5.2:photo-unknown-field] Photo item: unknown field(s) ${quoteList(keys)} not part of the canonical Photo schema (§5.1; derived/generated properties are never authored, §5.4)`;
      },
    },
  )
  .refine((photo) => photo.id.trim().length > 0, {
    message: "[5.2:photo-id] Photo id must not be empty",
  });

/**
 * Gallery schema (CONTENT_MODEL §4.1/§4.2). Strict shape: any unknown/orphan key
 * fails, with §4.3-labelled errors for the enumerated forbidden fields.
 * Conditional requirements (published ⇒ cover_photo_id + published_at, §8.2/§8.4)
 * are enforced unconditionally by the schema — they are §4.2 table contracts, not
 * mode-dependent; draft leniency (omit both, §8.3) holds because the requirements
 * key off `status`.
 */
export const gallerySchema = z
  .strictObject(
    {
      id: requiredString("4.2:id", "Gallery id").min(1, "[4.2:id] Gallery id must not be empty"),
      slug: z
        .string({
          error: (issue) =>
            issue.input === undefined ? "[4.2:slug] Gallery slug is required" : undefined,
        })
        .min(1, "[4.2:slug] Gallery slug must not be empty")
        .regex(
          SLUG_PATTERN,
          "[4.2:slug-urlsafe] Gallery slug must be a URL-safe segment: lowercase letters/digits with internal hyphens (§4.2, route /galleries/{slug})",
        ),
      status: z.enum(["draft", "published"], {
        error: () =>
          "[13.1#13] Gallery status must be 'draft' or 'published' (CONTENT_MODEL §8.1 — the only publication-state mechanism)",
      }),
      title: z
        .string({
          error: (issue) =>
            issue.input === undefined ? "[4.2:title] Gallery title is required" : undefined,
        })
        .min(1, "[4.2:title-nonempty] Gallery title must be non-empty")
        .refine((v) => v.trim().length > 0, "[4.2:title-nonempty] Gallery title must be non-empty"),
      description: z.string().nullish(),
      photographed_start: z.iso.date({
        error: (issue) =>
          issue.input === undefined
            ? "[4.2:photographed-dates] Gallery photographed_start is required (ISO date YYYY-MM-DD)"
            : "[4.2:photographed-dates] Gallery photographed_start must be an ISO calendar date YYYY-MM-DD",
      }),
      photographed_end: z.iso.date({
        error: (issue) =>
          issue.input === undefined
            ? "[4.2:photographed-dates] Gallery photographed_end is required (ISO date YYYY-MM-DD)"
            : "[4.2:photographed-dates] Gallery photographed_end must be an ISO calendar date YYYY-MM-DD",
      }),
      published_at: z.iso
        .datetime({
          offset: true,
          error: (issue) =>
            issue.input === undefined
              ? "[4.2:published-at-format] published_at must be an ISO-8601 instant"
              : "[4.2:published-at-format] published_at must be a valid ISO-8601 instant (e.g. 2026-08-29T14:31:20Z)",
        })
        .nullish(),
      places: z
        .array(z.string().min(1, "[4.2:places] Place reference must be a non-empty Place ID"))
        .min(1, "[4.2:places-nonempty] Gallery places[] requires at least one Place ID (§4.2)"),
      cover_photo_id: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? undefined
              : "[4.2:cover] cover_photo_id must be a Photo ID string",
        })
        .min(1, "[4.2:cover] cover_photo_id must not be empty")
        .optional(),
      next_gallery_id: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? undefined
              : "[9.1] next_gallery_id must be a Gallery ID string (never a slug)",
        })
        .min(1, "[9.1] next_gallery_id must not be empty")
        .optional(),
      photos: z
        .array(galleryPhotoSchema)
        .min(
          1,
          "[4.2:photos-nonempty] Gallery photos[] must be a non-empty ordered sequence (§4.2)",
        ),
    },
    {
      error: (issue) => {
        if (issue.code !== "unrecognized_keys") return undefined;
        const keys = issue.keys;
        const forbidden = keys.filter((k) => FORBIDDEN_SET.has(k));
        const who = rawRecordId(issue.input);
        const label = who ? `Gallery '${who}'` : "Gallery";
        if (forbidden.length > 0) {
          return `[4.3:forbidden-field] ${label}: forbidden field(s) ${quoteList(keys)} must never appear in Gallery YAML (CONTENT_MODEL §4.3)`;
        }
        return `[4.3:unknown-field] ${label}: unknown field(s) ${quoteList(keys)} not part of the canonical Gallery schema (strict object shape, §4.1)`;
      },
    },
  )
  .superRefine((gallery, ctx) => {
    const label = `Gallery '${gallery.id}'`;

    // §4.2: photographed_start <= photographed_end.
    if (gallery.photographed_start > gallery.photographed_end) {
      ctx.addIssue({
        code: "custom",
        message: `[4.2:photographed-range] ${label}: photographed_start (${gallery.photographed_start}) must be <= photographed_end (${gallery.photographed_end})`,
      });
    }

    // §8.4: cover must reference a Photo IN this Gallery's photos[]; never a
    // silent first-Photo default; cross-Gallery covers are invalid for any status.
    if (gallery.cover_photo_id != null) {
      const photoIds = new Set(gallery.photos.map((p) => p.id));
      if (!photoIds.has(gallery.cover_photo_id)) {
        ctx.addIssue({
          code: "custom",
          message: `[13.1#8] ${label}: cover_photo_id '${gallery.cover_photo_id}' does not reference a Photo in this Gallery's photos[] (§8.4)`,
        });
      }
    }

    // §8.2 published requirements (conditional on status — drafts may omit, §8.3).
    if (gallery.status === "published") {
      if (gallery.cover_photo_id == null) {
        ctx.addIssue({
          code: "custom",
          message: `[13.1#8] ${label}: cover_photo_id is required when status is 'published' (§8.2/§8.4; there is never a silent first-Photo default)`,
        });
      }
      if (gallery.published_at == null) {
        ctx.addIssue({
          code: "custom",
          message: `[13.1#14] ${label}: published_at is required when status is 'published' (§8.2; never derived from EXIF/mtime/Git/folder, UD-003)`,
        });
      }
    }

    // §9.2 rule 3 / §13.1#11: next_gallery_id must not equal the Gallery's own id.
    if (gallery.next_gallery_id != null && gallery.next_gallery_id === gallery.id) {
      ctx.addIssue({
        code: "custom",
        message: `[13.1#11] ${label}: next_gallery_id must not equal the Gallery's own id (self-loop; §9.2)`,
      });
    }
  });

export type Gallery = z.output<typeof gallerySchema>;
export type GalleryPhoto = z.output<typeof galleryPhotoSchema>;

/**
 * Fields that must NEVER appear in Place YAML (CONTENT_MODEL.md §6.3): no Visit
 * concept, no Trip concept, no geographic coordinates exposed publicly, no counts.
 * These are rejected via strict-shape unknown-key handling, each labelled with the
 * §6.3 rule token.
 */
export const FORBIDDEN_PLACE_FIELDS: ReadonlyArray<string> = [
  "coordinates",
  "latitude",
  "longitude",
  "lat",
  "lng",
  "lon",
  "gallery_count",
  "photo_count",
  "count",
  "counts",
  "visit",
  "visits",
  "visited",
  "trip",
  "trips",
];

const PLACE_FORBIDDEN_SET: ReadonlySet<string> = new Set(FORBIDDEN_PLACE_FIELDS);

/**
 * Singular Place schema (CONTENT_MODEL.md §6.1/§6.2/§6.3).
 *
 * Canonical cardinality: ONE PLACE = ONE YAML FILE (§6.1 / IC-01). The schema
 * validates exactly ONE Place object — never an array or aggregate. Astro loads
 * the places collection with the glob loader and this singular schema, so each
 * file becomes exactly one collection entry; no aggregate (`file()`) or custom
 * flattening loader exists anywhere in this architecture.
 *
 * Strict shape (§6.2 field table, exactly): `id`, `slug` (URL-safe segment),
 * `name` required; `region`, `country` optional. Unknown keys fail — enumerated
 * §6.3 forbidden concepts (coordinates, counts, Visit/Trip fields) get their own
 * rule token; every other orphan key gets a §6.1 unknown-field token.
 * Aggregate arrays / non-object files fail with a §6.1 cardinality token.
 */
export const placeSchema = z.strictObject(
  {
    id: requiredString("6.2:id", "Place id")
      .min(1, "[6.2:id] Place id must not be empty")
      .refine((v) => v.trim().length > 0, "[6.2:id] Place id must not be empty"),
    slug: z
      .string({
        error: (issue) =>
          issue.input === undefined ? "[6.2:slug] Place slug is required" : undefined,
      })
      .min(1, "[6.2:slug] Place slug must not be empty")
      .regex(
        SLUG_PATTERN,
        "[6.2:slug-urlsafe] Place slug must be a URL-safe segment: lowercase letters/digits with internal hyphens (§6.2, route /places/{slug})",
      ),
    name: requiredString("6.2:name", "Place name")
      .min(1, "[6.2:name] Place name must not be empty")
      .refine((v) => v.trim().length > 0, "[6.2:name] Place name must not be empty"),
    region: z.string().nullish(),
    country: z.string().nullish(),
  },
  {
    error: (issue) => {
      if (issue.code === "unrecognized_keys") {
        const keys = issue.keys;
        const forbidden = keys.filter((k) => PLACE_FORBIDDEN_SET.has(k));
        const who = rawRecordId(issue.input);
        const label = who ? `Place '${who}'` : "Place";
        if (forbidden.length > 0) {
          return `[6.3:forbidden-concept] ${label}: forbidden field(s) ${quoteList(keys)} must never appear in Place YAML (CONTENT_MODEL §6.3 — no Visit/Trip concept, no public coordinates, no counts)`;
        }
        return `[6.1:unknown-field] ${label}: unknown field(s) ${quoteList(keys)} not part of the canonical Place schema (strict object shape, §6.1)`;
      }
      if (issue.code === "invalid_type") {
        if (Array.isArray(issue.input)) {
          return "[6.1:one-place-one-file] A Place file must contain exactly ONE Place object — arrays of Places are not part of this architecture (CONTENT_MODEL §6.1 / IC-01; the glob loader yields one collection entry per file)";
        }
        return `[6.1:singular-place] A Place file must be a single Place object (mapping), got ${Array.isArray(issue.input) ? "an array" : issue.input === null ? "null" : typeof issue.input} (CONTENT_MODEL §6.1)`;
      }
      return undefined;
    },
  },
);

export type Place = z.output<typeof placeSchema>;
export type PlaceInput = z.input<typeof placeSchema>;

// ---------------------------------------------------------------------------
// WP-11 — Home editorial settings schema (CONTENT_MODEL §10.1, UD-004, ADR-019).
//
// `content/site/home.yaml` is NOT a collection (WP-03 contract: single authored
// file consumed via direct file reads, src/content.config.ts). Featured state
// has exactly ONE owner: this file (§10.3) — no per-Gallery featured field
// exists anywhere (those are §4.3 forbidden fields on Gallery YAML).
// Strict shape: §10.1 defines EXACTLY one authored key, `featured_gallery_id`
// (Gallery ID or null). The key is required-but-nullable so the file always
// states featured state explicitly; unknown keys are rejected.
export const homeSchema = z.strictObject(
  {
    featured_gallery_id: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "[10.1:featured-id] featured_gallery_id is required (Gallery ID string or null — CONTENT_MODEL §10.1)"
            : "[10.1:featured-id] featured_gallery_id must be a Gallery ID string or null (CONTENT_MODEL §10.1)",
      })
      .min(
        1,
        "[10.1:featured-id] featured_gallery_id must be a non-empty Gallery ID string or null (CONTENT_MODEL §10.1)",
      )
      .nullable(),
  },
  {
    error: (issue) => {
      if (issue.code === "unrecognized_keys") {
        const who = rawRecordId(issue.input);
        const label = who ? `Home settings ('${who}')` : "Home settings";
        return `[10.1:unknown-key] ${label}: unknown key(s) ${quoteList(issue.keys)} not part of the canonical home settings schema (strict object shape, §10.1 — the single authored key is featured_gallery_id)`;
      }
      if (issue.code === "invalid_type" && Array.isArray(issue.input)) {
        return "[10.1:singular-settings] Home settings must be a single mapping, not an array (CONTENT_MODEL §10.1)";
      }
      return undefined;
    },
  },
);

export type HomeSettings = z.output<typeof homeSchema>;

// ---------------------------------------------------------------------------
// WP-12 — Redirect entry schema (CONTENT_MODEL §11.1, UD-008, IC-02).
//
// `content/redirects.yaml` is NOT a collection (WP-03 contract,
// src/content.config.ts): it is a single authored file — a mapping of old
// path → target entry — consumed via direct file reads. The per-entry schema
// lives here so it is type/runtime-identical to the other content schemas.
//
// Contract (§11.1): each entry carries EXACTLY ONE target type —
// `gallery_id` XOR `place_id`. Targets are STABLE IDs, never slugs (§11.2:
// the build resolves the target's current slug from the single slug
// registries; §11.3: no second slug registry). Strict shape: unknown keys
// fail. Old paths are HISTORICAL only — equality with a current canonical
// route is rejected by validateRedirects (§13.1#15/#16), not here: the
// canonical route set depends on the gallery/place registries.
export const REDIRECT_PATH_PATTERN = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/**
 * Old-path key of a redirects.yaml entry (§11.1/§13.1#15 "malformed path"):
 * an absolute path of URL-safe segments — leading "/", no trailing slash,
 * no empty/double segments, no uppercase, no query/fragment characters.
 * "/" itself is malformed here (a zero-segment path is never a historical
 * alias; it is a canonical route and rejected by validation regardless).
 */
export const redirectOldPathSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "[13.1#15] redirect old path is required"
        : "[13.1#15] redirect old path must be a string",
  })
  .min(1, "[13.1#15] redirect old path must not be empty")
  .regex(
    REDIRECT_PATH_PATTERN,
    "[13.1#15] redirect old path is malformed: it must be an absolute path of URL-safe segments (leading '/', lowercase letters/digits with internal hyphens, no trailing slash or empty segments — §11.1)",
  );

export const redirectEntrySchema = z
  .strictObject(
    {
      gallery_id: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? undefined
              : "[13.1#15] redirect gallery_id must be a Gallery ID string",
        })
        .min(1, "[13.1#15] redirect gallery_id must not be empty")
        .optional(),
      place_id: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? undefined
              : "[13.1#15] redirect place_id must be a Place ID string",
        })
        .min(1, "[13.1#15] redirect place_id must not be empty")
        .optional(),
    },
    {
      error: (issue) => {
        if (issue.code === "unrecognized_keys") {
          const keys = issue.keys;
          return `[13.1#15] redirect entry: unknown field(s) ${quoteList(keys)} not part of the canonical redirect schema (§11.1 — exactly one target field: gallery_id XOR place_id)`;
        }
        if (issue.code === "invalid_type") {
          return `[13.1#15] redirect entry must be a mapping with exactly one target field: gallery_id XOR place_id (§11.1), got ${
            issue.input === null
              ? "null"
              : Array.isArray(issue.input)
                ? "an array"
                : typeof issue.input
          }`;
        }
        return undefined;
      },
    },
  )
  .superRefine((entry, ctx) => {
    if (entry.gallery_id != null && entry.place_id != null) {
      ctx.addIssue({
        code: "custom",
        message: `[13.1#15] redirect entry carries BOTH gallery_id ('${entry.gallery_id}') and place_id ('${entry.place_id}') — exactly ONE target type per entry: gallery_id XOR place_id (§11.1)`,
      });
    }
    if (entry.gallery_id == null && entry.place_id == null) {
      ctx.addIssue({
        code: "custom",
        message: `[13.1#15] redirect entry carries NEITHER gallery_id nor place_id — exactly ONE target type per entry: gallery_id XOR place_id (§11.1)`,
      });
    }
  });

export type RedirectEntry = z.output<typeof redirectEntrySchema>;

// ---------------------------------------------------------------------------
// About colophon content (Monograph §6.7). Strict shape; every section is
// optional (an absent file is a safe default), unknown keys are rejected.
// ---------------------------------------------------------------------------
const aboutContactSchema = z
  .object({
    email: z.email().nullish(),
    url: z
      .string()
      .refine((v) => v.startsWith("/") || v.startsWith("https://"), {
        message: "[about:url] contact.url must be https or root-relative",
      })
      .nullish(),
  })
  .strict();

const aboutPortraitSchema = z
  .object({
    src: z.string().refine((v) => v.startsWith("/"), "[about:portrait] src must start with /"),
    alt: z.string().min(1, "[about:portrait] alt is required"),
  })
  .strict();

export const aboutSchema = z
  .object({
    statement: z.string().nullish().default(null),
    approach: z.string().nullish().default(null),
    gear: z.array(z.string().min(1)).nullish().default(null),
    contact: aboutContactSchema.nullish().default(null),
    portrait: aboutPortraitSchema.nullish().default(null),
  })
  .strict();

export type AboutSettings = z.output<typeof aboutSchema>;
