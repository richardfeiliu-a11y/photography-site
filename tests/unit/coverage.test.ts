// WP-23 unit tests — derivative coverage validator (IMAGE_PIPELINE.md §8
// manifest closure, §11.1 build-blocking failure semantics, §11.3 drafts).
//
// Coverage-join pins: content graph (published photos × galleries) × the
// FROZEN variant plan (planDerivatives over the WP-15 record, honoring D5/§15
// source-capping) × the asset manifest rows (structural §10.2 subset). The
// frozen corpus is NEVER touched: masters are tiny sharp-generated JPEGs in a
// tmpdir, and file-resolution checks run against tiny synthetic files in the
// same tmpdir.
//
// Pinned here:
//   1. CAP semantics: a ladder rung ABOVE the source display width produces
//      NO expected variant at that rung — the single source-capped variant at
//      the source width is what coverage requires (a manifest missing the
//      capped variant is build-blocking; extra rows above the cap never are).
//   2. Missing manifest entirely with published photos → 11.1:manifest-missing
//      (build-blocking); with DRAFT-only photos → NOT blocking (§11.3).
//   3. A missing variant for a published photo → 13.1#18 with the exact
//      purpose × format × effective width enumerated (per-purpose
//      completeness).
//   4. A manifest record whose public_url does not resolve to an existing
//      file under the media root, or whose bytes do not hash to
//      derivative_hash, fails closed (11.1:manifest-entry-unresolved).
//   5. Findings are deterministically ordered regardless of input order.
//   6. Draft photos absent from the manifest never produce findings (§11.3).
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  loadDerivativeRecord,
  planDerivatives,
  type FrozenDerivativeRecord,
} from "../../scripts/media/derive";
import { extractSourceMetadata } from "../../scripts/media/extract";
import {
  COVERAGE_RULE,
  MANIFEST_MISSING_RULE,
  MANIFEST_UNRESOLVED_RULE,
  MANIFEST_RECORD_MISMATCH_RULE,
  MANIFEST_URL_SHAPE_RULE,
  validateCoverage,
  type CoverageManifestRow,
  type CoveragePhotoInput,
} from "../../scripts/media/coverage";

let workDir: string;
let mediaRoot: string;
let frozen: FrozenDerivativeRecord;

/** A content-graph photo whose 1365px source caps every rung above 1365. */
let cappedMaster: string;
/** A content-graph photo wider than the largest ladder rung: no capping. */
let fullMaster: string;

const CAPPED_PHOTO: CoveragePhotoInput = {
  galleryId: "g_test",
  photoId: "p_capped_1365",
  masterFile: "", // set in beforeAll
};
const FULL_PLAN_PHOTO: CoveragePhotoInput = {
  galleryId: "g_test",
  photoId: "p_full_2048",
  masterFile: "", // set in beforeAll
};

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp23-coverage-"));
  mediaRoot = join(workDir, "media");
  await sharp({
    create: { width: 1365, height: 900, channels: 3, background: { r: 120, g: 120, b: 120 } },
  })
    .jpeg()
    .toFile(join(workDir, "capped-1365.jpg"));
  await sharp({
    create: { width: 2048, height: 1200, channels: 3, background: { r: 60, g: 60, b: 60 } },
  })
    .jpeg()
    .toFile(join(workDir, "full-2048.jpg"));
  cappedMaster = join(workDir, "capped-1365.jpg");
  fullMaster = join(workDir, "full-2048.jpg");
  CAPPED_PHOTO.masterFile = cappedMaster;
  FULL_PLAN_PHOTO.masterFile = fullMaster;
  frozen = await loadDerivativeRecord();
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

/** The exact bytes materialized for every fabricated row (hash-matching). */
const FILE_BODY = "synthetic-derivative-bytes";

/**
 * Fabricate manifest rows for the FULL planned variant set of one photo:
 * the same plan join the validator runs (planDerivatives over the frozen
 * record at the master's display width), with synthetic public_urls whose
 * basenames can be materialized as real files for the resolution checks.
 */
async function planRows(
  photoId: string,
  masterFile: string,
  options: {
    drop?: { purpose: string; format: string; width: number };
    /** Write the fabricated files under mediaRoot (hash-matching). */
    materialize?: boolean;
    /** Unique seed per test: the fabricated file bytes AND their hash input. */
    seed?: string;
  } = {},
): Promise<CoverageManifestRow[]> {
  const seed = options.seed ?? FILE_BODY;
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  const record = await extractSourceMetadata(masterFile);
  const displayWidth = record.displayWidth!;
  const rows: CoverageManifestRow[] = [];
  for (const variant of planDerivatives(frozen, photoId, displayWidth)) {
    if (
      options.drop !== undefined &&
      options.drop.purpose === variant.purpose &&
      options.drop.format === variant.format &&
      options.drop.width === variant.width
    ) {
      continue;
    }
    const name = `${photoId}-${variant.format}-w${variant.width}-${hash.slice(0, 16)}.${
      variant.format === "avif" ? "avif" : "jpg"
    }`;
    rows.push({
      photo_id: photoId,
      purpose: variant.purpose,
      format: variant.format,
      width: variant.width,
      height: Math.round((variant.width * 2) / 3),
      public_url: `/media/${name}`,
      derivative_hash: `sha256:${hash}`,
    });
    if (options.materialize === true) {
      await mkdir(mediaRoot, { recursive: true });
      await writeFile(join(mediaRoot, name), seed);
    }
  }
  return rows;
}

function rulesOf(result: { findings: Array<{ rule: string }> }): string[] {
  return result.findings.map((f) => f.rule);
}

describe("WP-23 coverage — CAP semantics (D5/§15 no-upscale)", () => {
  test("no expected variant exists above the source display width; the capped variant at the source width is required", async () => {
    // The frozen ladder's top rungs (1600/2048/2560) exceed the 1365px source:
    // the planner collapses them into ONE variant at width 1365. A manifest
    // holding exactly the planned set is complete — nothing at 1600/2048/2560
    // is ever required (a variant above source width is NOT "missing").
    const rows = await planRows("p_capped_1365", cappedMaster, { materialize: true });
    const result = await validateCoverage({
      publishedPhotos: [CAPPED_PHOTO],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    // The expected set contains NO width above 1365 for this photo.
    const widths = [...new Set(rows.map((r) => r.width))];
    expect(Math.max(...widths)).toBe(1365);
  });

  test("missing the source-capped variant for a published photo is build-blocking (13.1#18), not excused by the cap", async () => {
    const cappedWidth = 1365;
    const rows = await planRows("p_capped_1365", cappedMaster, {
      seed: "seed-capped2",
      drop: { purpose: "overview", format: "jpeg", width: 480 },
    });
    const result = await validateCoverage({
      publishedPhotos: [CAPPED_PHOTO],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(rulesOf(result)).toContain(COVERAGE_RULE);
    const finding = result.findings.find((f) => f.rule === COVERAGE_RULE)!;
    expect(finding.message).toContain("overview");
    expect(finding.message).toContain("jpeg");
    expect(finding.message).toContain(String(cappedWidth));
  });

  test("extra manifest rows above the source width never block", async () => {
    const rows = [
      ...(await planRows("p_capped_1365", cappedMaster, { seed: "seed-capped3" })),
      // A stale/extra row at a rung the source can never serve. It is not an
      // expected variant, so its absence-from-plan (and unresolvable file)
      // is not a coverage failure — the stale-file story belongs to the
      // pipeline's pruning, not to the coverage join.
      {
        photo_id: "p_capped_1365",
        purpose: "cover",
        format: "avif",
        width: 2560,
        height: 1707,
        public_url: "/media/extra-2560.avif",
        derivative_hash: "sha256:" + createHash("sha256").update("extra").digest("hex"),
      },
    ];
    const result = await validateCoverage({
      publishedPhotos: [CAPPED_PHOTO],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(rulesOf(result)).not.toContain(COVERAGE_RULE);
    expect(result.ok).toBe(true);
  });
});

describe("WP-23 coverage — manifest presence (11.1)", () => {
  test("missing manifest entirely with published photos is build-blocking", async () => {
    const result = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: undefined,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(rulesOf(result)).toContain(MANIFEST_MISSING_RULE);
  });

  test("missing manifest with draft-only content does NOT block (IMAGE_PIPELINE §11.3)", async () => {
    const result = await validateCoverage({
      publishedPhotos: [{ ...FULL_PLAN_PHOTO, draft: true }],
      manifest: undefined,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  test("draft photos missing from an existing manifest never block (§11.3)", async () => {
    const rows = await planRows("p_full_2048", fullMaster, { materialize: true });
    const result = await validateCoverage({
      publishedPhotos: [
        FULL_PLAN_PHOTO,
        { galleryId: "g_draft", photoId: "p_draft_001", masterFile: fullMaster, draft: true },
      ],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(true);
    expect(rulesOf(result)).not.toContain(COVERAGE_RULE);
  });
});

describe("WP-23 coverage — manifest record resolution (11.1)", () => {
  test("public_url that does not resolve to an existing file fails closed", async () => {
    // A UNIQUE seed keeps the fabricated names distinct from any file other
    // tests materialized into the shared mediaRoot.
    const rows = await planRows("p_full_2048", fullMaster, { seed: "seed-unresolved" });
    // Deliberately do NOT materialize the files.
    const result = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(rulesOf(result)).toContain(MANIFEST_UNRESOLVED_RULE);
  });

  test("file present but bytes not matching derivative_hash fails closed", async () => {
    const rows = await planRows("p_full_2048", fullMaster, { materialize: true });
    const tampered = rows.map((r) => ({
      ...r,
      derivative_hash: "sha256:" + createHash("sha256").update("other-bytes").digest("hex"),
    }));
    const result = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: tampered,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(rulesOf(result)).toContain(MANIFEST_UNRESOLVED_RULE);
    const finding = result.findings.find((f) => f.rule === MANIFEST_UNRESOLVED_RULE)!;
    expect(finding.message).toContain("derivative_hash");
  });
});

describe("WP-23 coverage — deterministic enumeration", () => {
  test("per-purpose completeness is enumerated; findings are order-stable", async () => {
    const rows = await planRows("p_full_2048", fullMaster, {
      seed: "seed-order",
      drop: { purpose: "gallery_display", format: "avif", width: 2048 },
    });
    const a = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
      verifyFiles: false,
    });
    const b = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: [...rows].reverse(),
      mediaRoot,
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(a.findings).toEqual(b.findings);
    expect(a.findings.length).toBeGreaterThan(0);
    const fields = new Set(
      a.findings.filter((f) => f.rule === COVERAGE_RULE).map((f) => f.field),
    );
    // The single dropped variant is enumerated precisely.
    expect(fields.has("derivatives[p_full_2048][gallery_display][avif@2048]")).toBe(true);
    // Per-purpose counters name the incompleteness.
    expect(a.perPurpose["gallery_display"]!.covered).toBe(
      a.perPurpose["gallery_display"]!.expected - 1,
    );
    expect(a.perPurpose["overview"]!.covered).toBe(a.perPurpose["overview"]!.expected);
  });

  test("a complete manifest over a full-plan source is silent and counts every expected variant", async () => {
    const rows = await planRows("p_full_2048", fullMaster);
    const result = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.expectedVariants).toBe(rows.length);
    expect(result.coveredVariants).toBe(rows.length);
    expect(result.photosMissingCoverage).toBe(0);
  });
});

describe("WP-23 coverage — envelope record identity + URL shape (fix round 1)", () => {
  test("a manifest whose envelope record id disagrees with the live FROZEN record is rejected", async () => {
    const rows = await planRows("p_full_2048", fullMaster);
    const drifted = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: rows,
      manifestRecord: { id: "SOME-OTHER-RECORD", frozen_at: "2026-01-01" },
      mediaRoot,
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(drifted.ok).toBe(false);
    expect(rulesOf(drifted)).toContain(MANIFEST_RECORD_MISMATCH_RULE);
    const finding = drifted.findings.find((f) => f.rule === MANIFEST_RECORD_MISMATCH_RULE)!;
    expect(finding.message).toContain("SOME-OTHER-RECORD");
    expect(finding.message).toContain("BENCHMARK-OQ01-OQ02");

    // The matching identity stays silent.
    const matching = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: rows,
      manifestRecord: { id: frozen.recordId, frozen_at: frozen.frozenAt },
      mediaRoot,
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(rulesOf(matching)).not.toContain(MANIFEST_RECORD_MISMATCH_RULE);
  });

  test("a manifest record whose public_url is not the flat layout fails closed", async () => {
    const rows = await planRows("p_full_2048", fullMaster);
    const nested: CoverageManifestRow = {
      ...rows[0]!,
      public_url: "/media/nested/deep/file.avif",
    };
    const result = await validateCoverage({
      publishedPhotos: [FULL_PLAN_PHOTO],
      manifest: [nested],
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(rulesOf(result)).toContain(MANIFEST_URL_SHAPE_RULE);
    const finding = result.findings.find((f) => f.rule === MANIFEST_URL_SHAPE_RULE)!;
    expect(finding.message).toContain("flat layout");
  });
});
