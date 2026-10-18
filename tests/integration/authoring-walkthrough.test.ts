// WP-14 integration tests — executable walkthrough verification of the
// authoring workflow contract (docs/authoring/*.md).
//
// RED set (frozen WP-14 brief): a scripted end-to-end walkthrough over a
// SCRATCH fixture archive (synthesized YAML in a tmp content root — the real
// corpus is never touched):
//   a. ingest a scratch gallery → dry-run (`validate:content --mode preview`
//      wrapper + source-existence report) passes;
//   b. production validation over the same scratch archive (with a masters
//      root) passes;
//   c. the rename/move flow RETAINS the Photo ID while `source_ref` updates
//      (before/after YAML diff rules) — and RISK-001 (move WITHOUT the YAML
//      update) fails closed with §13.1#1;
//   d. the corrected-master replacement flow keeps the same Photo ID and
//      source_ref while the file bytes (and therefore the SHA-256 source
//      hash) change — validation still passes.
// Plus the doc-backed flows the contract names: slug rename + redirect entry
// (§14.6) and unpublish → §13.1#12 on the next_gallery referrer (§8.3).
//
// The tests exercise the REAL validators (composeArchiveValidation, which
// composes the real schemas + WP-09..12 validators) — they never string-match
// the docs. Authority: CONTENT_MODEL §5.3/§14, §7 (UD-003), §8.3/§13.1#12,
// §11 (UD-008), RISK_REGISTER RISK-001.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";
import { describe, expect, test } from "vitest";
import {
  composeArchiveValidation,
  type ComposeArchiveInputs,
  type HomeInput,
} from "../../src/lib/validate/production";
import type { GalleryEntryInput } from "../../src/lib/validate/gallery";
import type { PlaceEntryInput } from "../../src/lib/validate/place";
import {
  detectRedirectLoops,
  entriesFromRedirectsFile,
  type RedirectEntryInput,
} from "../../src/lib/content/redirects";

const DRY_RUN = fileURLToPath(new URL("../../scripts/validate/dry-run.ts", import.meta.url));
const REGISTER = fileURLToPath(
  new URL("../../scripts/validate/register-ts-resolve.mjs", import.meta.url),
);

// ---------------------------------------------------------------------------
// Scratch-archive helpers — synthesized YAML in a tmp content root.
// ---------------------------------------------------------------------------

const WALK_PLACE = { id: "pl_walk", slug: "walk-place", name: "Walk Place" };
const WALK_GALLERY_ID = "g_walk_scratch";
const WALK_SLUG = "walk-scratch";
// Honest archive-import instant (CONTENT_MODEL §7 rule 3 / UD-003) — the
// publication time of this test content is genuinely "now" (test data).
const WALK_PUBLISHED_AT = "2026-08-29T00:00:00Z";

interface WalkPhoto {
  id: string;
  source_ref: string;
  caption: string | null;
  rhythm_after: string;
  alt_text: string | null;
}

// WP-42 (D11 FINAL, policy b): the synthetic walkthrough gallery is authored
// COMPLETE, so its photos carry explicit synthetic alt (test values only —
// no claim on real content). Drafts skip enforcement regardless.
function walkPhotos(dir: string): WalkPhoto[] {
  return [
    { id: "p_walk_001", source_ref: `${dir}/DSC001.jpg`, caption: null, rhythm_after: "base", alt_text: "Synthetic walkthrough photo one" },
    {
      id: "p_walk_002",
      source_ref: `${dir}/DSC002.jpg`,
      caption: "Second frame.",
      rhythm_after: "compact",
      alt_text: "Synthetic walkthrough photo two",
    },
  ];
}

function galleryYaml(options: {
  id: string;
  slug: string;
  status: "draft" | "published";
  photos: WalkPhoto[];
  coverPhotoId?: string;
  publishedAt?: string;
  nextGalleryId?: string;
}): string {
  const lines = [
    `id: ${options.id}`,
    `slug: ${options.slug}`,
    `status: ${options.status}`,
    'title: "Walkthrough scratch gallery"',
    'photographed_start: "2025-03-01"',
    'photographed_end: "2025-03-02"',
  ];
  if (options.publishedAt !== undefined) lines.push(`published_at: "${options.publishedAt}"`);
  lines.push("places:", `  - ${WALK_PLACE.id}`);
  if (options.coverPhotoId !== undefined) lines.push(`cover_photo_id: ${options.coverPhotoId}`);
  if (options.nextGalleryId !== undefined) lines.push(`next_gallery_id: ${options.nextGalleryId}`);
  lines.push("photos:");
  for (const photo of options.photos) {
    lines.push(
      `  - id: ${photo.id}`,
      `    source_ref: ${photo.source_ref}`,
      `    caption: ${photo.caption === null ? "null" : JSON.stringify(photo.caption)}`,
      `    rhythm_after: ${photo.rhythm_after}`,
      `    alt_text: ${photo.alt_text === null ? "null" : JSON.stringify(photo.alt_text)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

interface ScratchPaths {
  root: string;
  meta: string;
  masters: string;
}

/** Creates the full scratch archive: place, home, redirects, masters, ONE draft gallery. */
function makeScratchArchive(prefix: string): ScratchPaths {
  const root = join(tmpdir(), `${prefix}-${Date.now()}-${process.pid}`);
  const meta = join(root, "content/galleries/walk-scratch/meta.yaml");
  const masters = join(root, "media/ingest-masters/walk-scratch");
  mkdirSync(join(root, "content/galleries/walk-scratch"), { recursive: true });
  mkdirSync(join(root, "content/places"), { recursive: true });
  mkdirSync(join(root, "content/site"), { recursive: true });
  mkdirSync(masters, { recursive: true });

  writeFileSync(
    join(root, "content/places/walk-place.yaml"),
    `id: ${WALK_PLACE.id}\nslug: ${WALK_PLACE.slug}\nname: "${WALK_PLACE.name}"\n`,
  );
  writeFileSync(join(root, "content/site/home.yaml"), "featured_gallery_id: null\n");
  writeFileSync(join(root, "content/redirects.yaml"), "{}\n");
  writeFileSync(join(masters, "DSC001.jpg"), "master-bytes-v1-DSC001");
  writeFileSync(join(masters, "DSC002.jpg"), "master-bytes-v1-DSC002");
  writeFileSync(
    meta,
    galleryYaml({
      id: WALK_GALLERY_ID,
      slug: WALK_SLUG,
      status: "draft",
      photos: walkPhotos("walk-scratch"),
    }),
  );
  return { root, meta, masters };
}

function readMeta(path: string): Record<string, unknown> {
  return parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Recursively collects every meta.yaml under a galleries dir (glob "**\/meta.yaml"). */
function findGalleryMetaFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name === "meta.yaml") found.push(child);
    }
  };
  walk(dir);
  return found;
}

/** Loads the scratch archive exactly as the composer sees it. */
function readArchive(root: string): ComposeArchiveInputs {
  const galleriesDir = join(root, "content/galleries");
  const galleries: GalleryEntryInput[] = findGalleryMetaFiles(galleriesDir).map((absolute) => ({
    data: readMeta(absolute),
    filePath: absolute.slice(root.length + 1),
  }));
  const places: PlaceEntryInput[] = [
    {
      data: readMeta(join(root, "content/places/walk-place.yaml")),
      filePath: "content/places/walk-place.yaml",
    },
  ];
  const home: HomeInput = {
    data: readMeta(join(root, "content/site/home.yaml")),
    filePath: "content/site/home.yaml",
  };
  const redirectsDoc = readMeta(join(root, "content/redirects.yaml"));
  const redirects: RedirectEntryInput[] = entriesFromRedirectsFile(redirectsDoc).entries.map(
    (entry) => ({ ...entry, filePath: "content/redirects.yaml" }),
  );
  return { galleries, places, home, redirects };
}

function compose(
  root: string,
  mode: "preview" | "production",
): ReturnType<typeof composeArchiveValidation> {
  return composeArchiveValidation(readArchive(root), {
    mode,
    ingestRoot: join(root, "media/ingest-masters"),
  });
}

interface RunResult {
  status: number;
  output: string;
}

function runDryRun(args: string[]): RunResult {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--import", REGISTER, DRY_RUN, ...args],
    { encoding: "utf8", timeout: 120_000 },
  );
  return { status: result.status ?? -1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

// ---------------------------------------------------------------------------
// a. + b. Ingest → dry-run (preview) → production
// ---------------------------------------------------------------------------

describe("WP-14 walkthrough — ingest → validate (scratch archive)", () => {
  test("a. dry-run (preview wrapper + source-existence report) passes on the ingested scratch gallery", () => {
    const scratch = makeScratchArchive("wp14-a");
    try {
      const run = runDryRun(["--content-root", scratch.root]);
      expect(run.status, run.output).toBe(0);
      // The source-existence report names every photo and its resolution.
      expect(run.output).toContain("p_walk_001");
      expect(run.output).toContain("p_walk_002");
      expect(run.output).toContain("walk-scratch/DSC001.jpg");
      expect(run.output).toContain("walk-scratch/DSC002.jpg");
      expect(run.output).toContain("OK");
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });

  test("a. (fail-closed) a MISSING published master exits non-zero even in preview", () => {
    const scratch = makeScratchArchive("wp14-a-missing");
    try {
      // The gallery is still a DRAFT here, but its master is missing: the
      // dry-run source report is never draft-lenient about masters.
      rmSync(join(scratch.masters, "DSC002.jpg"));
      const run = runDryRun(["--content-root", scratch.root]);
      expect(run.status, run.output).not.toBe(0);
      expect(run.output).toContain("walk-scratch/DSC002.jpg");
      expect(run.output).toContain("MISSING");
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });

  test("b. production validation over the scratch archive (with masters root) passes after publish", () => {
    const scratch = makeScratchArchive("wp14-b");
    try {
      // Publish step (§14.5): status → published + cover + honest published_at.
      writeFileSync(
        scratch.meta,
        galleryYaml({
          id: WALK_GALLERY_ID,
          slug: WALK_SLUG,
          status: "published",
          photos: walkPhotos("walk-scratch"),
          coverPhotoId: "p_walk_001",
          publishedAt: WALK_PUBLISHED_AT,
        }),
      );
      const result = compose(scratch.root, "production");
      expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
      expect(result.ok).toBe(true);
      // The published gallery enters the composed production data set.
      expect(result.publishedDataSet.galleries.map((g) => g.id)).toEqual([WALK_GALLERY_ID]);
      expect(result.publishedDataSet.home.recentGalleryIds).toEqual([WALK_GALLERY_ID]);
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// c. Rename/move master — Photo ID RETAINED, source_ref updated (§14.2)
// ---------------------------------------------------------------------------

describe("WP-14 walkthrough — rename/move master (§14.2, UD-002 retain-ID)", () => {
  test("moving the master updates source_ref, RETAINS the Photo ID, validation passes", () => {
    const scratch = makeScratchArchive("wp14-c");
    try {
      const before = readMeta(scratch.meta);

      // Step 1: move the file on disk; Step 2: update source_ref in the YAML.
      const archiveDir = join(scratch.masters, "archived-2024");
      mkdirSync(archiveDir);
      renameSync(join(scratch.masters, "DSC001.jpg"), join(archiveDir, "DSC001-renamed.jpg"));
      const yaml = readFileSync(scratch.meta, "utf8");
      writeFileSync(
        scratch.meta,
        yaml.replace(
          "source_ref: walk-scratch/DSC001.jpg",
          "source_ref: walk-scratch/archived-2024/DSC001-renamed.jpg",
        ),
      );

      const after = readMeta(scratch.meta);
      // Before/after diff rules: ID unchanged, source_ref changed, rest equal.
      const beforePhotos = before.photos as WalkPhoto[];
      const afterPhotos = after.photos as WalkPhoto[];
      expect(afterPhotos[0].id).toBe(beforePhotos[0].id);
      expect(afterPhotos[0].source_ref).not.toBe(beforePhotos[0].source_ref);
      expect(afterPhotos[1]).toEqual(beforePhotos[1]);
      expect(after.id).toBe(before.id);

      for (const mode of ["preview", "production"] as const) {
        const result = compose(scratch.root, mode);
        expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
        expect(result.ok).toBe(true);
      }
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });

  test("RISK-001: moving the master WITHOUT the source_ref update fails closed (§13.1#1)", () => {
    const scratch = makeScratchArchive("wp14-c-risk");
    try {
      const archiveDir = join(scratch.masters, "archived-2024");
      mkdirSync(archiveDir);
      renameSync(join(scratch.masters, "DSC001.jpg"), join(archiveDir, "DSC001-renamed.jpg"));
      // YAML NOT updated — the exact RISK-001 drift.

      const result = compose(scratch.root, "production");
      expect(result.ok).toBe(false);
      const missing = result.errors.filter((e) => e.rule === "13.1#1");
      expect(missing).toHaveLength(1);
      expect(missing[0].message).toContain("p_walk_001");
      expect(missing[0].message).toContain("walk-scratch/DSC001.jpg");
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// d. Corrected-master replacement — same ID, same source_ref, new bytes (§14.3)
// ---------------------------------------------------------------------------

describe("WP-14 walkthrough — corrected-master replacement (§14.3, UD-002)", () => {
  test("replacing the master bytes changes the source hash; Photo ID + source_ref unchanged; validation passes", () => {
    const scratch = makeScratchArchive("wp14-d");
    try {
      const before = readMeta(scratch.meta);
      const master = join(scratch.masters, "DSC001.jpg");
      const hashBefore = sha256(master);

      // The corrected master (ICC fix / dust cleanup / better export): same
      // path, different bytes.
      writeFileSync(master, "master-bytes-v2-DSC001-corrected");
      const hashAfter = sha256(master);
      expect(hashAfter).not.toBe(hashBefore); // source hash changes — expected, §14.3

      const after = readMeta(scratch.meta);
      // Before/after diff rules: YAML untouched at all — same Photo ID, same
      // source_ref; a hash change never creates a new photograph (§5.3).
      expect(after).toEqual(before);

      for (const mode of ["preview", "production"] as const) {
        const result = compose(scratch.root, mode);
        expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
        expect(result.ok).toBe(true);
      }
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Slug rename + redirect entry (§14.6, UD-008)
// ---------------------------------------------------------------------------

describe("WP-14 walkthrough — slug rename + redirect (§14.6)", () => {
  function publish(scratch: ScratchPaths, slug: string): void {
    writeFileSync(
      scratch.meta,
      galleryYaml({
        id: WALK_GALLERY_ID,
        slug,
        status: "published",
        photos: walkPhotos("walk-scratch"),
        coverPhotoId: "p_walk_001",
        publishedAt: WALK_PUBLISHED_AT,
      }),
    );
  }

  test("old path moves to redirects.yaml → resolves to the NEW slug; no loops; production passes", () => {
    const scratch = makeScratchArchive("wp14-e");
    try {
      publish(scratch, "walk-renamed"); // Step 1: slug changed
      // Step 2: the old path becomes a historical alias to the STABLE ID.
      writeFileSync(
        join(scratch.root, "content/redirects.yaml"),
        `/galleries/${WALK_SLUG}:\n  gallery_id: ${WALK_GALLERY_ID}\n`,
      );

      const result = compose(scratch.root, "production");
      expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
      // §14.6 step 3: no redirect loop; the entry resolves through the CURRENT slug.
      const edges = new Map(result.publishedDataSet.redirects.map((r) => [r.oldPath, r.destination]));
      expect(detectRedirectLoops(edges)).toEqual([]);
      const resolved = result.publishedDataSet.redirects;
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toMatchObject({
        oldPath: `/galleries/${WALK_SLUG}`,
        targetId: WALK_GALLERY_ID,
        destination: "/galleries/walk-renamed",
      });
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });

  test("an old path equal to a CURRENT canonical slug is rejected (§11.2/§13.1#15)", () => {
    const scratch = makeScratchArchive("wp14-e-collision");
    try {
      publish(scratch, WALK_SLUG);
      // Duplicates the CURRENT slug — historical aliases never duplicate a live route.
      writeFileSync(
        join(scratch.root, "content/redirects.yaml"),
        `/galleries/${WALK_SLUG}:\n  gallery_id: ${WALK_GALLERY_ID}\n`,
      );
      const result = compose(scratch.root, "production");
      expect(result.ok).toBe(false);
      expect(result.errors.map((e) => e.rule)).toContain("13.1#15");
    } finally {
      rmSync(scratch.root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Unpublish (status → draft) — §13.1#12 on the next_gallery referrer
// ---------------------------------------------------------------------------

interface ChainArchive {
  root: string;
  referrerMeta: string;
  targetMeta: string;
}

/**
 * Two published galleries: g_walk_a --next_gallery_id--> g_walk_b; B is the
 * featured gallery (home.yaml) and a redirect target — so the unpublish flow
 * demonstrates every documented consequence at once.
 */
function makeChainArchive(prefix: string): ChainArchive {
  const root = join(tmpdir(), `${prefix}-${Date.now()}-${process.pid}`);
  mkdirSync(join(root, "content/galleries/walk-a"), { recursive: true });
  mkdirSync(join(root, "content/galleries/walk-b"), { recursive: true });
  mkdirSync(join(root, "content/places"), { recursive: true });
  mkdirSync(join(root, "content/site"), { recursive: true });
  mkdirSync(join(root, "media/ingest-masters/walk-scratch"), { recursive: true });
  writeFileSync(
    join(root, "content/places/walk-place.yaml"),
    `id: ${WALK_PLACE.id}\nslug: ${WALK_PLACE.slug}\nname: "${WALK_PLACE.name}"\n`,
  );
  writeFileSync(join(root, "media/ingest-masters/walk-scratch/DSC001.jpg"), "master-bytes-v1");
  writeFileSync(join(root, "media/ingest-masters/walk-scratch/DSC002.jpg"), "master-bytes-v1");
  // Photo IDs are globally unique (§3) — gallery B carries its own IDs; source
  // files may legitimately be distinct masters of the same scratch set.
  const photosA = walkPhotos("walk-scratch");
  const photosB = photosA.map((p, i) => ({ ...p, id: `p_walk_b0${i + 1}` }));
  const referrerMeta = join(root, "content/galleries/walk-a/meta.yaml");
  const targetMeta = join(root, "content/galleries/walk-b/meta.yaml");
  writeFileSync(
    referrerMeta,
    galleryYaml({
      id: "g_walk_a",
      slug: "walk-a",
      status: "published",
      photos: photosA,
      coverPhotoId: "p_walk_001",
      publishedAt: WALK_PUBLISHED_AT,
      nextGalleryId: "g_walk_b",
    }),
  );
  writeFileSync(
    targetMeta,
    galleryYaml({
      id: "g_walk_b",
      slug: "walk-b",
      status: "published",
      photos: photosB,
      coverPhotoId: "p_walk_b01",
      publishedAt: "2026-08-28T00:00:00Z",
    }),
  );
  writeFileSync(join(root, "content/site/home.yaml"), "featured_gallery_id: g_walk_b\n");
  writeFileSync(join(root, "content/redirects.yaml"), `/galleries/walk-b-old:\n  gallery_id: g_walk_b\n`);
  return { root, referrerMeta, targetMeta };
}

/** The unpublish step itself: ONE authored field — status → draft (§8.1). */
function unpublish(metaPath: string): void {
  const yaml = readFileSync(metaPath, "utf8");
  writeFileSync(metaPath, yaml.replace("status: published", "status: draft"));
}

describe("WP-14 walkthrough — unpublish consequences (§8.3/§13.1#12)", () => {
  test("unpublishing the next_gallery target: production §13.1#12 names the referrer; preview passes", () => {
    const chain = makeChainArchive("wp14-f");
    try {
      unpublish(chain.targetMeta);

      const production = compose(chain.root, "production");
      expect(production.ok).toBe(false);
      const draftTargets = production.errors.filter((e) => e.rule === "13.1#12");
      expect(draftTargets).toHaveLength(1);
      expect(draftTargets[0].message).toContain("'g_walk_a'"); // referrer named
      expect(draftTargets[0].message).toContain("'g_walk_b'"); // unpublished target named
      expect(draftTargets[0].field).toBe("next_gallery_id");

      // Preview stays draft-friendly (ADR-020) — the same archive passes.
      const preview = compose(chain.root, "preview");
      expect(preview.errors, JSON.stringify(preview.errors)).toEqual([]);
      expect(preview.ok).toBe(true);
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });

  test("unpublishing the featured gallery degrades to a WARNING with deterministic fallback (never a build failure)", () => {
    const chain = makeChainArchive("wp14-f-featured");
    try {
      unpublish(chain.targetMeta);
      const production = compose(chain.root, "production");
      const featured = production.warnings.filter((w) => w.rule === "10.2:featured-unresolved");
      expect(featured).toHaveLength(1);
      // §10.2 fallback: latest PUBLISHED gallery — the draft is never the hero.
      expect(production.publishedDataSet.home.featuredGalleryId).toBe("g_walk_a");
      expect(production.publishedDataSet.galleries.map((g) => g.id)).toEqual(["g_walk_a"]);
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });

  test("a redirect into the unpublished gallery is unresolved in production (§13.1#16)", () => {
    const chain = makeChainArchive("wp14-f-redirect");
    try {
      unpublish(chain.targetMeta);
      const production = compose(chain.root, "production");
      const unresolved = production.errors.filter(
        (e) => e.rule === "13.1#16" && e.message.includes("/galleries/walk-b-old"),
      );
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].file).toBe("content/redirects.yaml");
    } finally {
      rmSync(chain.root, { recursive: true, force: true });
    }
  });
});
