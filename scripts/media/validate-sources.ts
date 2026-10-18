// WP-17 — source validation: the fail-closed join between WP-13's content
// graph (authored galleries/photos, drafts included) and the WP-17 discovery
// record (scripts/media/discover.ts over the WEB INGEST MASTER root).
//
// Authority:
//   - IMAGE_PIPELINE.md §5 stages 1–2 (this module closes stage 1–2 for the
//     pipeline: every authored source_ref is resolved AND its master is
//     admitted by the §14 matrix + strict decode check)
//   - IMAGE_PIPELINE.md §11.1 (build-blocking failures: missing source for
//     published content; decode error) / §11.2 (duplicate content
//     fingerprints: WARNING, never a failure) / §11.3 (drafts: production
//     builds exclude draft content entirely; drafts relaxed in preview)
//   - CONTENT_MODEL.md §13.1 rule 1 (missing WEB INGEST MASTER for a Photo
//     source_ref) — rule ID and message token style match WP-13's
//     src/lib/validate/gallery.ts exactly ("13.1#1", "[13.1#1] Gallery 'x'
//     photo 'y': ...")
//   - REPOSITORY_STRUCTURE.md §4 (mount/symlink is environment configuration;
//     the root is an option, never authored YAML)
//   - BUILD_AND_ROUTING.md §6 (mode is environment configuration, never
//     content inspection)
//
// RULE IDS emitted by this module (WP-13 token style: "13.1#N" for numbered
// CONTENT_MODEL rules, "<section>:<kebab-label>" for contract-section rules):
//   13.1#1                     error   published photo's source_ref does not
//                                      resolve to a discovered master (both
//                                      modes — published is never relaxed)
//   11.1:decode-error          error   published photo's master failed the
//                                      strict decode check (§11.1 bullet 1)
//   14:<format-not-supported>  error   published photo's master is rejected
//                                      by the §14 matrix (14:raw-not-supported
//                                      | 14:heic-not-supported |
//                                      14:format-not-supported)
//   11.3:draft-master-absent   preview WARNING only — draft gallery photo
//                                      whose master is missing (drafts
//                                      relaxed; §11.3)
//   11.2:duplicate-fingerprint warning ALWAYS (both modes) — two distinct
//                                      files share identical bytes (§11.2)
//   context:ingest-root-required error  no master root supplied — the gate
//                                      refuses to run blind (WP-13's closed
//                                      fail-open surface, same token)
//   context:gallery-schema-skipped warning entries that fail gallerySchema
//                                      are out of WP-17's scope (shape rules
//                                      are WP-13's); the skip is explicit,
//                                      never silent
//
// PREVIEW vs PRODUCTION semantics (exact contract implemented here):
//   production: published photos → fail-closed (13.1#1 / decode / §14 rules
//     are ERRORS); draft photos → NO findings at all (§11.3: production
//     excludes draft content entirely); duplicate fingerprints → warnings
//     (§11.2); unreferenced rejected/corrupt files → warnings (media
//     hygiene, not build state).
//   preview: identical fail-closed treatment for PUBLISHED photos (preview
//     never relaxes published content); draft photos → WARNINGS
//     (11.3:draft-master-absent and the §14/decode rules as warnings);
//     duplicate fingerprints → warnings. ok === errors.length === 0 in both
//     modes; warnings never block either mode.
//
// Relationship to WP-13 (composited gate): WP-13's composed validator owns
// authored-shape rules (§13.1#2–#17) and performs its own pure §13.1#1
// existence check when handed an ingestRoot. WP-17 owns the SOURCE side of
// stages 1–2: real discovery, decode admission (§14 + §11.1 decode), and the
// §11.2 fingerprint warnings. No WP-13 code is modified.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gallerySchema, type Gallery } from "../../src/content-schemas";
import type { GalleryEntryInput } from "../../src/lib/validate/gallery";
import {
  classifyIngestFormat,
  discoverMasters,
  UNKNOWN_FORMAT_RULE,
  type DiscoveryRecord,
} from "./discover";

export type SourceValidationMode = "preview" | "production";

/** One structured finding (same field conventions as WP-13's issues). */
export interface SourceValidationIssue {
  severity: "error" | "warning";
  rule: string;
  message: string;
  gallery?: string;
  photo?: string;
  field?: string;
  file?: string;
}

export interface SourceValidateOptions {
  mode: SourceValidationMode;
  /**
   * WEB INGEST MASTER root (media/ingest-masters/). REQUIRED — without it the
   * gate would fail open, so its absence is itself an error
   * (context:ingest-root-required). Environment configuration (mount/symlink
   * at this path is REPOSITORY_STRUCTURE §4), never authored YAML.
   */
  ingestRoot: string | URL;
  /**
   * A precomputed discovery record (scripts/media/discover.ts). When omitted,
   * discovery runs against `ingestRoot` as part of validation.
   */
  discovery?: DiscoveryRecord;
}

export interface SourceValidationSummary {
  discoveredFiles: number;
  rejectedFiles: number;
  decodeErrors: number;
  publishedGalleries: number;
  draftGalleries: number;
  publishedPhotos: number;
  draftPhotos: number;
  /** Published photos with no discovered master (build-blocking 13.1#1). */
  missingPublished: number;
  /** Published photos whose master failed decode admission. */
  decodeErrorsPublished: number;
  /** Published photos whose master is rejected by the §14 matrix. */
  rejectedPublished: number;
  /** Draft photos with findings (preview only; always 0 in production). */
  draftFindings: number;
  /** Groups of distinct files sharing identical bytes (§11.2 warnings). */
  duplicateGroups: number;
}

export interface SourceValidationResult {
  ok: boolean;
  errors: SourceValidationIssue[];
  warnings: SourceValidationIssue[];
  summary: SourceValidationSummary;
}

/** Rule tokens (exported for consumers/telemetry, mirrors WP-13's RULE map). */
export const SOURCE_RULES = {
  missingIngestMaster: "13.1#1",
  decodeError: "11.1:decode-error",
  duplicateFingerprint: "11.2:duplicate-fingerprint",
  draftMasterAbsent: "11.3:draft-master-absent",
  gallerySchemaSkipped: "context:gallery-schema-skipped",
  ingestRootRequired: "context:ingest-root-required",
} as const;

/**
 * Deterministic total order over findings — identical to WP-13's
 * compareProductionIssues keying: (file, rule, field, message), each
 * compared lexicographically, missing values first. Input permutation can
 * never change reported order (UD-003 determinism).
 */
export function compareSourceIssues(a: SourceValidationIssue, b: SourceValidationIssue): number {
  const key = (i: SourceValidationIssue): string =>
    `${i.file ?? ""}\u0000${i.rule}\u0000${i.field ?? ""}\u0000${i.message}`;
  const ka = key(a);
  const kb = key(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** §11.2: group discovered files by SHA-256; >1 distinct path = one group. */
function duplicateFingerprintWarnings(record: DiscoveryRecord): SourceValidationIssue[] {
  const byHash = new Map<string, string[]>();
  for (const file of record.files) {
    const owners = byHash.get(file.sha256);
    if (owners) owners.push(file.path);
    else byHash.set(file.sha256, [file.path]);
  }
  const warnings: SourceValidationIssue[] = [];
  for (const [sha256, paths] of byHash) {
    if (paths.length < 2) continue;
    const sorted = [...paths].sort();
    warnings.push({
      severity: "warning",
      rule: SOURCE_RULES.duplicateFingerprint,
      message: `[${SOURCE_RULES.duplicateFingerprint}] Duplicate content fingerprint '${sha256.slice(0, 16)}': ${sorted
        .map((p) => `'${p}'`)
        .join(", ")} share identical bytes (IMAGE_PIPELINE §11.2 — warning, never a build failure)`,
      file: sorted[0],
      field: "sha256",
    });
  }
  return warnings;
}

/**
 * Joins the content graph with the discovery record. Never throws on content
 * defects — every failure is a structured finding with a rule ID. Async only
 * because it may run discovery internally.
 */
export async function validateSources(
  galleries: ReadonlyArray<GalleryEntryInput>,
  options: SourceValidateOptions,
): Promise<SourceValidationResult> {
  const { mode } = options;
  const errors: SourceValidationIssue[] = [];
  const warnings: SourceValidationIssue[] = [];

  // 0. Fail-open guard: no root → the gate refuses to run blind (both modes;
  //    a source-validation pass without a master root proves nothing).
  if (options.ingestRoot === undefined) {
    errors.push({
      severity: "error",
      rule: SOURCE_RULES.ingestRootRequired,
      message: `[${SOURCE_RULES.ingestRootRequired}] Source validation requires ingestRoot (the media/ingest-masters/ root): without it the §13.1#1/§11.1/§14 checks could not run and the gate would fail open (WP-17)`,
      field: "ingestRoot",
    });
    return emptyResult(errors, warnings);
  }

  // 1. Discovery (or the supplied precomputed record).
  const record = options.discovery ?? (await discoverMasters(options.ingestRoot));
  const masterByPath = new Map(record.files.map((f) => [f.path, f]));
  const issueByPath = new Map<string, { rule: string; message: string }>();
  for (const r of record.rejected) issueByPath.set(r.path, r);
  for (const d of record.decodeErrors) issueByPath.set(d.path, d);

  // 2. Parse the content graph with the REAL gallery schema (WP-13's own
  //    shape contract). Entries that fail shape validation are skipped here
  //    EXPLICITLY (warning) — shape rules belong to WP-13's gate, and this
  //    module never turns a shape defect into a missing-master false positive.
  const parsed: Array<{ data: Gallery; filePath?: string }> = [];
  for (const entry of galleries) {
    const result = gallerySchema.safeParse(entry.data);
    if (result.success) {
      parsed.push({ data: result.data, filePath: entry.filePath });
    } else {
      warnings.push({
        severity: "warning",
        rule: SOURCE_RULES.gallerySchemaSkipped,
        message: `[${SOURCE_RULES.gallerySchemaSkipped}] ${
          entry.filePath ?? "<unknown source>"
        }: entry failed gallerySchema (${result.error.issues.length} shape issue(s)) — skipped by source validation; shape rules are enforced by the WP-13 content gate`,
        file: entry.filePath,
      });
    }
  }

  // 3. Referential pass — join every authored photo with the discovery record.
  let publishedGalleries = 0;
  let draftGalleries = 0;
  let publishedPhotos = 0;
  let draftPhotos = 0;
  let missingPublished = 0;
  let decodeErrorsPublished = 0;
  let rejectedPublished = 0;
  let draftFindings = 0;
  const referencedPaths = new Set<string>();

  for (const { data, filePath } of parsed) {
    const isPublished = data.status === "published";
    if (isPublished) publishedGalleries++;
    else draftGalleries++;

    for (const photo of data.photos) {
      if (isPublished) publishedPhotos++;
      else draftPhotos++;
      referencedPaths.add(photo.source_ref);

      const admitted = masterByPath.get(photo.source_ref);
      if (admitted) continue; // resolved AND decode-admitted — nothing to report

      const problem = issueByPath.get(photo.source_ref);
      const draftFinding = (rule: string, message: string): SourceValidationIssue => ({
        severity: "warning",
        rule,
        message,
        gallery: data.id,
        photo: photo.id,
        field: "source_ref",
        file: filePath,
      });
      const publishedError = (rule: string, message: string): SourceValidationIssue => ({
        severity: "error",
        rule,
        message,
        gallery: data.id,
        photo: photo.id,
        field: "source_ref",
        file: filePath,
      });

      if (problem) {
        // Master file exists but was NOT admitted (§14 rejection or decode
        // error) — escalate per §11.1 for published content.
        if (isPublished) {
          if (problem.rule === SOURCE_RULES.decodeError) decodeErrorsPublished++;
          else rejectedPublished++;
          errors.push(publishedError(problem.rule, `[${problem.rule}] Gallery '${data.id}' photo '${photo.id}': WEB INGEST MASTER '${photo.source_ref}' is not admissible — ${problem.message} (IMAGE_PIPELINE §11.1 fail-closed)`));
        } else if (mode === "preview") {
          draftFindings++;
          warnings.push(draftFinding(problem.rule, `[${problem.rule}] Gallery '${data.id}' photo '${photo.id}': draft photo's master '${photo.source_ref}' is not admissible — ${problem.message} (drafts relaxed, IMAGE_PIPELINE §11.3)`));
        }
        continue;
      }

      // No such file in the discovery record at all → §13.1#1 missing master.
      if (isPublished) {
        missingPublished++;
        errors.push(
          publishedError(
            SOURCE_RULES.missingIngestMaster,
            `[${SOURCE_RULES.missingIngestMaster}] Gallery '${data.id}' photo '${photo.id}': source_ref '${photo.source_ref}' does not resolve to an existing WEB INGEST MASTER under media/ingest-masters/ (§13.1#1; WP-17 discovery record over the canonical root)`,
          ),
        );
      } else if (mode === "preview") {
        draftFindings++;
        warnings.push(
          draftFinding(
            SOURCE_RULES.draftMasterAbsent,
            `[${SOURCE_RULES.draftMasterAbsent}] Gallery '${data.id}' photo '${photo.id}': source_ref '${photo.source_ref}' does not resolve to an existing WEB INGEST MASTER (draft content — relaxed, IMAGE_PIPELINE §11.3; production excludes draft content entirely)`,
          ),
        );
      }
    }
  }

  // 4. Unreferenced rejected/corrupt files: media hygiene, never build state —
  //    a warning in BOTH modes (published content is what §11.1 blocks on).
  for (const r of [...record.rejected, ...record.decodeErrors]) {
    if (referencedPaths.has(r.path)) continue;
    warnings.push({
      severity: "warning",
      rule: r.rule,
      message: `[${r.rule}] Unreferenced master file '${r.path}' is not admissible — ${r.message} (not referenced by any authored Gallery photo)`,
      file: r.path,
    });
  }

  // 5. §11.2 duplicate content fingerprints — warnings, never failures.
  const duplicateWarnings = duplicateFingerprintWarnings(record);
  warnings.push(...duplicateWarnings);

  errors.sort(compareSourceIssues);
  warnings.sort(compareSourceIssues);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      discoveredFiles: record.files.length,
      rejectedFiles: record.rejected.length,
      decodeErrors: record.decodeErrors.length,
      publishedGalleries,
      draftGalleries,
      publishedPhotos,
      draftPhotos,
      missingPublished,
      decodeErrorsPublished,
      rejectedPublished,
      draftFindings,
      duplicateGroups: duplicateWarnings.length,
    },
  };
}

function emptyResult(
  errors: SourceValidationIssue[],
  warnings: SourceValidationIssue[],
): SourceValidationResult {
  errors.sort(compareSourceIssues);
  warnings.sort(compareSourceIssues);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      discoveredFiles: 0,
      rejectedFiles: 0,
      decodeErrors: 0,
      publishedGalleries: 0,
      draftGalleries: 0,
      publishedPhotos: 0,
      draftPhotos: 0,
      missingPublished: 0,
      decodeErrorsPublished: 0,
      rejectedPublished: 0,
      draftFindings: 0,
      duplicateGroups: 0,
    },
  };
}

/** Convenience formatter for build logs: "ERROR [13.1#1] <file> (field): <message>". */
export function formatSourceIssues(issues: ReadonlyArray<SourceValidationIssue>): string[] {
  return issues.map((i) => {
    const body = i.message.replace(/^\[[^\]]+\]\s*/, "");
    return `${i.severity.toUpperCase()} [${i.rule}] ${i.file ?? "<unknown source>"}${
      i.gallery ? ` (gallery '${i.gallery}'${i.photo ? ` photo '${i.photo}'` : ""})` : ""
    }: ${body}`;
  });
}

// ---------------------------------------------------------------------------
// CLI — the standalone WP-17 source gate (stages 1–2).
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: validate-sources.ts --mode preview|production [--content-root <dir>]",
      "                           [--ingest-root <dir>]",
      "",
      "WP-17 fail-closed source validation: joins the WP-13 content graph with",
      "the WP-17 discovery record (IMAGE_PIPELINE §5 stages 1–2, §11, §14).",
      "Exit 0 = valid (warnings possible); exit 1 = any error.",
    ].join("\n"),
  );
}

interface CliOptions {
  mode: "preview" | "production";
  contentRoot: string;
  ingestRoot: string;
}

function parseCli(argv: ReadonlyArray<string>): CliOptions {
  const options: CliOptions = { mode: "production", contentRoot: process.cwd(), ingestRoot: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i] as string;
    };
    if (arg === "--mode") {
      const mode = value();
      if (mode !== "preview" && mode !== "production") {
        throw new Error(`--mode must be 'preview' or 'production', got '${mode}'`);
      }
      options.mode = mode;
    } else if (arg === "--content-root") {
      options.contentRoot = value();
    } else if (arg === "--ingest-root") {
      options.ingestRoot = value();
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument '${arg}' (see --help)`);
    }
  }
  options.ingestRoot ||= join(options.contentRoot, "media", "ingest-masters");
  return options;
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  (async (): Promise<number> => {
    let cli: CliOptions;
    try {
      cli = parseCli(process.argv.slice(2));
    } catch (error) {
      console.error(`source validation: ${error instanceof Error ? error.message : String(error)}`);
      printUsage();
      return 1;
    }
    console.info(
      `[wp17] source validation — mode=${cli.mode} content-root=${cli.contentRoot} ingest-root=${cli.ingestRoot}`,
    );
    // Late import keeps the WP-13 loader wiring out of the module import path
    // used by tests (and documents the composition direction: WP-17 consumes
    // WP-13's graph, never the reverse).
    const { loadArchive } = await import("../validate/content");
    let galleries;
    try {
      galleries = loadArchive(cli.contentRoot).galleries;
    } catch (error) {
      console.error(
        `source validation: fail-closed load error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 1;
    }
    const result = await validateSources(galleries, {
      mode: cli.mode,
      ingestRoot: cli.ingestRoot,
    });
    for (const line of formatSourceIssues(result.errors)) console.error(line);
    for (const line of formatSourceIssues(result.warnings)) console.warn(line);
    const s = result.summary;
    console.info(
      `source validation: ${result.errors.length} errors, ${result.warnings.length} warnings ` +
        `(mode=${cli.mode}; discovered=${s.discoveredFiles} publishedPhotos=${s.publishedPhotos} ` +
        `missingPublished=${s.missingPublished} decodeErrorsPublished=${s.decodeErrorsPublished} ` +
        `rejectedPublished=${s.rejectedPublished} duplicateGroups=${s.duplicateGroups}) — ${result.ok ? "OK" : "FAILED"}`,
    );
    return result.ok ? 0 : 1;
  })().then(
    (code) => process.exit(code),
    (error) => {
      console.error(
        `source validation: fail-closed error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    },
  );
}

// classifyIngestFormat/UNKNOWN_FORMAT_RULE are re-exported for consumers that
// want the §14 admission predicate without walking (e.g. pipeline stage 1).
export { classifyIngestFormat, UNKNOWN_FORMAT_RULE };
