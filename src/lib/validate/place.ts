// WP-10 — cross-item Place validation with mode parameter (composition contract).
//
// Authority:
//   - CONTENT_MODEL.md §3 (global uniqueness of Place IDs; slug namespaces)
//   - CONTENT_MODEL.md §6.1 (ONE PLACE = ONE YAML FILE — singular Place object
//     per file; arrays/aggregates/flattening loaders are not part of this
//     architecture; glob loader ⇒ exactly one collection entry per file)
//   - CONTENT_MODEL.md §6.2 (field contracts) / §6.3 (no Visit/Trip concept,
//     no public coordinates, no counts — enforced per-item by the schema via
//     strict-shape unknown-key rejection)
//   - CONTENT_MODEL.md §13.1 #5 (duplicate Place ID) / #6 (duplicate Place slug)
//   - IC-01 verification (TECHNICAL_API_VERIFICATION.md §1)
//
// Shape: `validatePlaces(entries, { mode })` is a PURE function over raw entry
// data so WP-13 can compose it into the production gate, exactly like
// src/lib/validate/gallery.ts. It re-parses every entry with the real
// placeSchema (fail-closed per-item), then runs the cross-file identity checks.
//
// MODE SEMANTICS (documented in docs/implementation/WP-10.md): `mode` is
// ACCEPTED FOR COMPOSITION but INERT. Places have no draft/publication
// lifecycle (§6 defines no status field) and §13.2 defines no Place warning
// conditions, so the doc gives Places no mode-dependent rules — every Place
// rule is a §13.1 fail-closed error in BOTH preview and production. The
// parameter exists so WP-13 can call all validators uniformly; tests pin that
// preview and production behave identically.
export { FORBIDDEN_PLACE_FIELDS, placeSchema, type Place } from "../../content-schemas";
import { placeSchema, type Place } from "../../content-schemas";

export type PlaceValidationMode = "preview" | "production";

/** One raw collection entry: unvalidated data plus its source path (for messages). */
export interface PlaceEntryInput {
  data: unknown;
  filePath?: string;
}

export interface PlaceValidateOptions {
  /**
   * preview | production. INERT for Places (see module docblock): §6 defines
   * no draft concept and §13.2 defines no Place warnings, so there are no
   * mode-dependent Place rules. Kept for uniform composition in WP-13.
   */
  mode: PlaceValidationMode;
}

export interface PlaceValidationIssue {
  severity: "error" | "warning";
  /**
   * Machine-readable rule label: "13.1#N" for CONTENT_MODEL §13.1 numbered
   * rules, or a contract-section label ("6.1:one-place-one-file",
   * "6.2:slug-urlsafe", "6.3:forbidden-concept").
   * "schema" marks shape errors with no numbered rule.
   */
  rule: string;
  message: string;
  place?: string;
  field?: string;
  file?: string;
}

export interface PlaceValidationResult {
  ok: boolean;
  errors: PlaceValidationIssue[];
  /**
   * Always empty for Places: §13.2 warnings are a Gallery/draft concept and
   * §6 defines no warning conditions for Places. Present for interface parity
   * with GalleryValidationResult so WP-13 composes uniformly.
   */
  warnings: PlaceValidationIssue[];
}

/** Rule labels used by the cross-item checks. */
const RULE = {
  duplicatePlaceId: "13.1#5",
  duplicatePlaceSlug: "13.1#6",
} as const;

/** Message rule-token prefix, e.g. "[13.1#5] ..." or "[6.3:forbidden-concept] ...". */
const RULE_TOKEN = /^\[(\d+\.\d+(?:[:#][a-z0-9-]+)+)\]\s*/;

interface ParsedEntry {
  data: Place;
  filePath?: string;
}

function issue(
  rule: string,
  message: string,
  rest: Partial<Omit<PlaceValidationIssue, "severity" | "rule" | "message">> = {},
): PlaceValidationIssue {
  return { severity: "error", rule, message, ...rest };
}

function describeFile(filePath?: string): string {
  return filePath ?? "<unknown source>";
}

/**
 * Maps one zod issue to a structured error, naming the Place (raw id when the
 * entry failed to parse) and the field.
 */
function issueFromZod(
  entry: PlaceEntryInput,
  path: readonly PropertyKey[],
  message: string,
  keys?: readonly string[],
  code?: string,
): PlaceValidationIssue {
  const token = RULE_TOKEN.exec(message)?.[1] ?? "schema";
  const rawId =
    typeof entry.data === "object" && entry.data !== null && "id" in entry.data
      ? (entry.data as { id?: unknown }).id
      : undefined;
  const place = typeof rawId === "string" && rawId.length > 0 ? rawId : undefined;
  let field: string | undefined;
  if (keys && keys.length > 0 && code === "unrecognized_keys") {
    field = keys.join(", ");
  } else if (path.length > 0) {
    field = path.map(String).join(".");
  }
  const who = place ? `Place '${place}'` : describeFile(entry.filePath);
  // Messages that already self-identify ("Place 'x': ...") pass through;
  // bare field messages get the place/file context.
  const body = message.replace(RULE_TOKEN, "").trim();
  const text = body.startsWith("Place '") ? body : `${who}: ${body}`;
  return issue(token, `[${token}] ${text}`, {
    place,
    field,
    file: entry.filePath,
  });
}

/**
 * Validates a set of Place entries. Pure; never throws on invalid content —
 * every failure is reported as a structured issue.
 */
export function validatePlaces(
  entries: ReadonlyArray<PlaceEntryInput>,
  _options: PlaceValidateOptions,
): PlaceValidationResult {
  const errors: PlaceValidationIssue[] = [];

  // Phase 1 — per-item fail-closed schema validation (real placeSchema):
  // §6.1 singular shape (array/aggregate rejection), §6.2 required fields and
  // URL-safe slug, §6.3 forbidden concepts via unknown-key rejection.
  const parsed: ParsedEntry[] = [];
  for (const entry of entries) {
    const result = placeSchema.safeParse(entry.data);
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

  // Phase 2 — cross-file identity checks over parsed entries (§3 uniqueness).
  const placeById = new Map<string, ParsedEntry>();
  const slugOwners = new Map<string, ParsedEntry>();

  for (const entry of parsed) {
    const { data } = entry;
    const file = describeFile(entry.filePath);

    // §13.1#5 duplicate Place ID.
    const idOwner = placeById.get(data.id);
    if (idOwner) {
      errors.push(
        issue(
          RULE.duplicatePlaceId,
          `[${RULE.duplicatePlaceId}] Duplicate Place ID '${data.id}': ${describeFile(idOwner.filePath)} and ${file} share the same id (globally unique, §3)`,
          { place: data.id, field: "id", file: entry.filePath },
        ),
      );
    } else {
      placeById.set(data.id, entry);
    }

    // §13.1#6 duplicate Place slug (unique in the /places/ namespace, §3/§6.2).
    const slugOwner = slugOwners.get(data.slug);
    if (slugOwner) {
      errors.push(
        issue(
          RULE.duplicatePlaceSlug,
          `[${RULE.duplicatePlaceSlug}] Duplicate Place slug '${data.slug}': ${describeFile(slugOwner.filePath)} and ${file} share the same slug (unique in /places/, §3/§6.2)`,
          { place: data.id, field: "slug", file: entry.filePath },
        ),
      );
    } else {
      slugOwners.set(data.slug, entry);
    }
  }

  // Phase 3 — none. §13.2 warnings are a Gallery/draft concept; §6 defines no
  // Place warning conditions and no mode-dependent rules (mode is inert).
  return { ok: errors.length === 0, errors, warnings: [] };
}

/** Convenience formatter for build logs (used by WP-13's gate). */
export function formatPlaceIssues(issues: ReadonlyArray<PlaceValidationIssue>): string[] {
  return issues.map((i) => `${i.severity.toUpperCase()} [${i.rule}] ${i.message}`);
}
