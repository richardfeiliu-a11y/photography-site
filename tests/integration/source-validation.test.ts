// WP-17 — source discovery (pipeline stages 1–2) + source validation, tested
// against a synthetic temp master root AND the real corpus.
//
// RED set (PRODUCTION_IMPLEMENTATION_PLAN.md "WP-17 — Test-first requirement"):
//   (a) removed master for a published photo fails with rule ID 13.1#1
//   (b) decode-corrupt file (truncated copy) fails as a build-blocking
//       decode error (IMAGE_PIPELINE §11.1 bullet 1)
//   (c) draft missing master does NOT block production (§11.3: production
//       excludes draft content); in preview it is a warning (drafts relaxed)
//   (d) two identical-byte files produce a §11.2 duplicate-fingerprint
//       WARNING, never a failure
//   (e) RAW/HEIC-named file is rejected per IMAGE_PIPELINE §14
//   (f) discovery over the real corpus + real-corpus validation result is
//       exactly characterized (deterministic; surfaced honestly)
//
// All synthetic fixtures are created in a mkdtemp() dir — corpus masters and
// stage3c fixtures are never touched.
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discoverMasters, type DiscoveryRecord } from "../../scripts/media/discover";
import { validateSources } from "../../scripts/media/validate-sources";
import { loadArchive } from "../../scripts/validate/content";
import type { GalleryEntryInput } from "../../src/lib/validate/gallery";

// ---------------------------------------------------------------------------
// Synthetic fixture helpers
// ---------------------------------------------------------------------------

async function makeJpeg(width = 48, height = 36): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 40, b: 40 } } })
    .jpeg()
    .toBuffer();
}

function publishedGallery(id: string, slug: string, refs: string[]): unknown {
  return {
    id,
    slug,
    status: "published",
    title: "T",
    description: "d",
    photographed_start: "2025-02-01",
    photographed_end: "2025-02-07",
    published_at: "2026-08-29T00:00:00Z",
    places: ["pl_reine"],
    cover_photo_id: "p_001",
    photos: refs.map((source_ref, i) => ({
      id: `p_${String(i + 1).padStart(3, "0")}`,
      source_ref,
    })),
  };
}

function draftGallery(id: string, slug: string, refs: string[]): unknown {
  return {
    id,
    slug,
    status: "draft",
    title: "D",
    description: "d",
    photographed_start: "2025-03-01",
    photographed_end: "2025-03-02",
    places: ["pl_reine"],
    photos: refs.map((source_ref, i) => ({
      id: `d_${String(i + 1).padStart(3, "0")}`,
      source_ref,
    })),
  };
}

function entries(...galleries: unknown[]): GalleryEntryInput[] {
  return galleries.map((data, i) => ({
    data,
    filePath: `content/galleries/g${i}/meta.yaml`,
  }));
}

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "wp17-sources-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeMaster(ref: string, bytes: Buffer, into: string = root): void {
  const abs = join(into, ref);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, bytes);
}

// ---------------------------------------------------------------------------
// (a) missing master for a published photo → build-blocking 13.1#1
// ---------------------------------------------------------------------------

describe("(a) removed master for a published photo", () => {
  it("fails production validation with rule ID 13.1#1", async () => {
    const jpeg = await makeJpeg();
    writeMaster("g/ok.jpg", jpeg);
    writeMaster("g/cover.jpg", jpeg);
    const g = publishedGallery("g_a", "g-a", ["g/cover.jpg", "g/removed.jpg"]);
    const result = await validateSources(entries(g), {
      mode: "production",
      ingestRoot: root,
    });
    expect(result.ok).toBe(false);
    const missing = result.errors.filter((e) => e.rule === "13.1#1");
    expect(missing).toHaveLength(1);
    expect(missing[0].severity).toBe("error");
    expect(missing[0].gallery).toBe("g_a");
    expect(missing[0].photo).toBe("p_002");
    expect(missing[0].field).toBe("source_ref");
    expect(missing[0].message).toContain("g/removed.jpg");
    // the present master produces no finding
    expect(result.errors).toHaveLength(1);
    expect(result.summary.missingPublished).toBe(1);
    expect(result.summary.publishedPhotos).toBe(2);
  });

  it("removing the master file is reproducible: discovery record does not list it", async () => {
    const record = await discoverMasters(root);
    const paths = record.files.map((f) => f.path).sort();
    expect(paths).toEqual(["g/cover.jpg", "g/ok.jpg"]);
    expect(paths).not.toContain("g/removed.jpg");
  });
});

// ---------------------------------------------------------------------------
// (b) decode-corrupt master → build-blocking decode error
// ---------------------------------------------------------------------------

describe("(b) decode-corrupt master for published content", () => {
  it("fails with rule 11.1:decode-error when bytes are truncated", async () => {
    const jpeg = await makeJpeg(512, 512);
    // Tail truncation: header intact (metadata would still parse) but the
    // pixel data cannot fully decode — the strict full-decode check catches it.
    writeMaster("g/trunc.jpg", jpeg.subarray(0, jpeg.length - Math.floor(jpeg.length * 0.3)));
    writeMaster("g/cover.jpg", jpeg);
    const g = publishedGallery("g_b", "g-b", ["g/cover.jpg", "g/trunc.jpg"]);
    const result = await validateSources(entries(g), {
      mode: "production",
      ingestRoot: root,
    });
    expect(result.ok).toBe(false);
    const decode = result.errors.filter((e) => e.rule === "11.1:decode-error");
    expect(decode).toHaveLength(1);
    expect(decode[0].gallery).toBe("g_b");
    expect(decode[0].photo).toBe("p_002");
    expect(decode[0].severity).toBe("error");
    expect(result.summary.decodeErrorsPublished).toBe(1);
  });

  it("discovery itself records the decode failure with rule 11.1:decode-error", async () => {
    const record = await discoverMasters(root);
    expect(record.decodeErrors.map((e) => e.path)).toContain("g/trunc.jpg");
    expect(record.decodeErrors.every((e) => e.rule === "11.1:decode-error")).toBe(true);
    expect(record.files.map((f) => f.path)).not.toContain("g/trunc.jpg");
  });

  it("an unreferenced corrupt file is a warning, not a build blocker", async () => {
    const jpeg = await makeJpeg();
    const junk = Buffer.from("this is not an image");
    writeMaster("h/lonely-corrupt.jpg", junk);
    const g = publishedGallery("g_b2", "g-b2", ["h/clean.jpg"]);
    writeMaster("h/clean.jpg", jpeg);
    const result = await validateSources(entries(g), {
      mode: "production",
      ingestRoot: root,
    });
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.rule === "11.1:decode-error")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) draft missing master → never blocks
// ---------------------------------------------------------------------------

describe("(c) draft gallery with a missing master", () => {
  let validJpeg: Buffer;
  beforeAll(async () => {
    validJpeg = await makeJpeg();
    writeMaster("d/present.jpg", validJpeg);
    writeMaster("d/cover.jpg", validJpeg);
  });

  it("does NOT block production (no error, no finding for the draft)", async () => {
    const pub = publishedGallery("g_c", "g-c", ["d/cover.jpg"]);
    const draft = draftGallery("g_draft", "g-draft", ["d/present.jpg", "d/absent.jpg"]);
    const result = await validateSources(entries(pub, draft), {
      mode: "production",
      ingestRoot: root,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.filter(
        (w) => w.gallery === "g_draft" && w.rule !== "11.2:duplicate-fingerprint",
      ),
    ).toHaveLength(0);
  });

  it("in preview the same state is a relaxed WARNING (drafts relaxed), never an error", async () => {
    const pub = publishedGallery("g_c", "g-c", ["d/cover.jpg"]);
    const draft = draftGallery("g_draft", "g-draft", ["d/present.jpg", "d/absent.jpg"]);
    const result = await validateSources(entries(pub, draft), {
      mode: "preview",
      ingestRoot: root,
    });
    expect(result.ok).toBe(true); // warnings never block
    const draftWarnings = result.warnings.filter((w) => w.rule === "11.3:draft-master-absent");
    expect(draftWarnings).toHaveLength(1);
    expect(draftWarnings[0].severity).toBe("warning");
    expect(draftWarnings[0].gallery).toBe("g_draft");
    expect(draftWarnings[0].photo).toBe("d_002");
    expect(result.errors).toHaveLength(0);
  });

  it("a MISSING master for a PUBLISHED photo still blocks in preview (published is never relaxed)", async () => {
    const pub = publishedGallery("g_c2", "g-c2", ["d/absent-too.jpg"]);
    const result = await validateSources(entries(pub), {
      mode: "preview",
      ingestRoot: root,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "13.1#1")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (d) duplicate content fingerprints → warning, never failure (§11.2)
// ---------------------------------------------------------------------------

describe("(d) duplicate content fingerprints", () => {
  // Isolated root: the shared fixture root intentionally accumulates files
  // across describes, some of which (same default size) also collide — the
  // duplicate-group COUNT assertions here need a clean tree.
  let dupRoot: string;
  beforeAll(() => {
    dupRoot = mkdtempSync(join(tmpdir(), "wp17-dup-"));
  });
  afterAll(() => {
    rmSync(dupRoot, { recursive: true, force: true });
  });

  it("two distinct files with identical bytes produce a WARNING and ok=true", async () => {
    const jpeg = await makeJpeg(96, 64);
    writeMaster("dup/a.jpg", jpeg, dupRoot);
    writeMaster("dup/b.jpg", Buffer.from(jpeg), dupRoot); // identical bytes, distinct path
    writeMaster("dup/cover.jpg", await makeJpeg(101, 79), dupRoot);
    const g = publishedGallery("g_d", "g-d", ["dup/cover.jpg", "dup/a.jpg", "dup/b.jpg"]);
    const result = await validateSources(entries(g), {
      mode: "production",
      ingestRoot: dupRoot,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    const dups = result.warnings.filter((w) => w.rule === "11.2:duplicate-fingerprint");
    expect(dups).toHaveLength(1);
    expect(dups[0].message).toContain("dup/a.jpg");
    expect(dups[0].message).toContain("dup/b.jpg");
    expect(result.summary.duplicateGroups).toBe(1);
  });

  it("discovery records identical SHA-256 for the identical bytes", async () => {
    const record = await discoverMasters(dupRoot);
    const byPath = new Map(record.files.map((f) => [f.path, f.sha256]));
    expect(byPath.get("dup/a.jpg")).toBe(byPath.get("dup/b.jpg"));
  });
});

// ---------------------------------------------------------------------------
// (e) RAW / HEIC named file rejected per §14
// ---------------------------------------------------------------------------

describe("(e) RAW and HEIC named files are rejected per §14", () => {
  it("discovery rejects a .NEF file with rule 14:raw-not-supported (no decode attempt)", async () => {
    writeMaster("fmt/raw.NEF", Buffer.from("pretend this is a Nikon RAW"));
    const record = await discoverMasters(root);
    const rejected = record.rejected.find((r) => r.path === "fmt/raw.NEF");
    expect(rejected).toBeDefined();
    expect(rejected?.rule).toBe("14:raw-not-supported");
  });

  it("discovery rejects a .heic file with rule 14:heic-not-supported", async () => {
    writeMaster("fmt/phone.heic", Buffer.from("pretend this is HEIC"));
    const record = await discoverMasters(root);
    const rejected = record.rejected.find((r) => r.path === "fmt/phone.heic");
    expect(rejected).toBeDefined();
    expect(rejected?.rule).toBe("14:heic-not-supported");
  });

  it("a PUBLISHED photo whose master is a RAW file fails closed; draft does not block", async () => {
    writeMaster("fmt/cover.jpg", await makeJpeg());
    const pub = publishedGallery("g_e", "g-e", ["fmt/cover.jpg", "fmt/raw.NEF"]);
    const draft = draftGallery("g_e_draft", "g-e-draft", ["fmt/phone.heic"]);
    const result = await validateSources(entries(pub, draft), {
      mode: "production",
      ingestRoot: root,
    });
    expect(result.ok).toBe(false);
    const raw = result.errors.filter((e) => e.rule === "14:raw-not-supported");
    expect(raw).toHaveLength(1);
    expect(raw[0].gallery).toBe("g_e");
    expect(raw[0].photo).toBe("p_002");
    // draft HEIC master: excluded from production entirely
    expect(result.errors.filter((e) => e.rule === "14:heic-not-supported")).toHaveLength(0);
    // ... and surfaced as a preview warning instead
    const preview = await validateSources(entries(pub, draft), {
      mode: "preview",
      ingestRoot: root,
    });
    const heicWarn = preview.warnings.filter(
      (w) => w.rule === "14:heic-not-supported" && w.gallery === "g_e_draft",
    );
    expect(heicWarn).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// (e2) dangling symlink inside the tree → structured record entry, no crash
// ---------------------------------------------------------------------------

describe("dangling symlink in the master tree", () => {
  it("discovery records an 11.1:decode-error instead of throwing", async () => {
    const linkRoot = mkdtempSync(join(tmpdir(), "wp17-link-"));
    try {
      mkdirSync(join(linkRoot, "g"), { recursive: true });
      writeMaster("g/ok.jpg", await makeJpeg(), linkRoot);
      // symlink whose target does not exist anywhere
      symlinkSync(join(linkRoot, "nowhere.jpg"), join(linkRoot, "g/dangling.jpg"));
      const record = await discoverMasters(linkRoot);
      const entry = record.decodeErrors.find((d) => d.path === "g/dangling.jpg");
      expect(entry).toBeDefined();
      expect(entry?.rule).toBe("11.1:decode-error");
      expect(entry?.sha256).toBeNull();
      expect(record.files.map((f) => f.path)).toEqual(["g/ok.jpg"]);
      // deterministic order preserved with mixed entries
      const paths = record.decodeErrors.map((d) => d.path);
      expect([...paths].sort()).toEqual(paths);
    } finally {
      rmSync(linkRoot, { recursive: true, force: true });
    }
  });

  it("a published photo behind a dangling symlink fails closed via the validator", async () => {
    const linkRoot = mkdtempSync(join(tmpdir(), "wp17-link2-"));
    try {
      mkdirSync(join(linkRoot, "g"), { recursive: true });
      writeMaster("g/cover.jpg", await makeJpeg(), linkRoot);
      symlinkSync(join(linkRoot, "gone.jpg"), join(linkRoot, "g/broken.jpg"));
      const pub = publishedGallery("g_link", "g-link", ["g/cover.jpg", "g/broken.jpg"]);
      const result = await validateSources(entries(pub), {
        mode: "production",
        ingestRoot: linkRoot,
      });
      expect(result.ok).toBe(false);
      const decode = result.errors.filter((e) => e.rule === "11.1:decode-error");
      expect(decode).toHaveLength(1);
      expect(decode[0].gallery).toBe("g_link");
      expect(decode[0].photo).toBe("p_002");
    } finally {
      rmSync(linkRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (f) real corpus: discovery + validation fully characterized
// ---------------------------------------------------------------------------

describe("(f) real corpus discovery + validation", () => {
  let record: DiscoveryRecord;

  it(
    "discovers exactly the 257 present masters, all decoding cleanly",
    { timeout: 120_000 },
    async () => {
      record = await discoverMasters(join(process.cwd(), "media", "ingest-masters"));
      expect(record.files).toHaveLength(257);
      expect(record.rejected).toHaveLength(0);
      expect(record.decodeErrors).toHaveLength(0);
      expect(record.files.every((f) => f.size > 0)).toBe(true);
      expect(
        record.files.every((f) => typeof f.sha256 === "string" && f.sha256.length === 64),
      ).toBe(true);
      expect(record.files.every((f) => f.format === "jpeg")).toBe(true);
      // deterministic order (sorted by relative path)
      const paths = record.files.map((f) => f.path);
      expect([...paths].sort()).toEqual(paths);
    },
  );

  it(
    "validation over the real corpus is exactly characterized and deterministic",
    { timeout: 240_000 },
    async () => {
      const archive = loadArchive(process.cwd());
      const result = await validateSources(archive.galleries, {
        mode: "production",
        ingestRoot: join(process.cwd(), "media", "ingest-masters"),
      });
      // Honest current state (2026-09-12 real-archive corpus): every authored
      // source_ref resolves. The ingest root also still carries the OLD
      // fixture-era masters (unreferenced but admissible), hence 257 files
      // against 180 referenced photos (the 180 archived originals were copied
      // in alongside the pre-existing fixture sets). Production builds pass
      // source validation TODAY; if masters are removed, rule 13.1#1 fails
      // closed (tests a/e above prove the blocking path).
      expect(result.summary.discoveredFiles).toBe(257);
      expect(result.summary.publishedGalleries).toBe(13);
      expect(result.summary.draftGalleries).toBe(0);
      expect(result.summary.publishedPhotos).toBe(180);
      expect(result.summary.missingPublished).toBe(0);
      expect(result.summary.decodeErrorsPublished).toBe(0);
      expect(result.summary.rejectedPublished).toBe(0);
      expect(result.summary.duplicateGroups).toBe(15);
      expect(result.ok).toBe(true);
      expect(result.warnings.filter((w) => w.rule === "11.2:duplicate-fingerprint")).toHaveLength(
        15,
      );
      // determinism: identical findings on a second run
      const second = await validateSources(archive.galleries, {
        mode: "production",
        ingestRoot: join(process.cwd(), "media", "ingest-masters"),
      });
      expect(JSON.stringify(second.errors)).toBe(JSON.stringify(result.errors));
      expect(JSON.stringify(second.warnings)).toBe(JSON.stringify(result.warnings));
    },
  );
});
