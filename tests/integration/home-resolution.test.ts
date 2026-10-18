// WP-11 integration tests — home.yaml loading + featured/Recent resolution over
// the REAL WP-08 fixture corpus and the REAL authored settings file.
//
// Requirements: frozen WP-11 brief verification line — "Unit + integration tests
// green; resolution trace logged for the fixture corpus" — plus the RED-set item
// that needs the real pipeline: per-Gallery `featured` fields anywhere are
// rejected (integration-level pin; unit-level pin lives in
// tests/unit/gallery-schema.test.ts §4.3 coverage).
//
// Authority: research/production-architecture/CONTENT_MODEL.md §10 (§10.2
// algorithm implemented EXACTLY, §10.4 Recent ordering), UD-004, ADR-019,
// TESTING_AND_VISUAL_REGRESSION.md §3.1, CONTENT_MODEL §13 (§13.1#5/#6
// pattern; warnings never fail builds).
//
// Handoff fact honored: ALL fixture galleries share ONE honest archive-import
// published_at instant (TEST DATA per §7 rule 3), so DESC-ordering assertions
// SYNTHESIZE distinct published_at values in-test via in-memory refs derived
// from the real corpus.
import { describe, expect, test } from "vitest";
import type { HomeSettings } from "../../src/content-schemas";
import { PROJECT_ROOT_URL, loadCollection } from "../support/content-layer";
import { validateGalleries } from "../../src/lib/validate/gallery";
import {
  HOME_SETTINGS_RELATIVE_PATH,
  orderRecentGalleries,
  readHomeSettings,
  resolveFeatured,
  validateHomeSettings,
  type GalleryResolutionRef,
} from "../../src/lib/content/home";

interface CorpusRef extends GalleryResolutionRef {
  slug: string;
  title: string;
  photographed_start: string;
}

function trace(label: string, value: unknown): void {
  // Resolution trace: the brief requires the corpus run to be logged.
  console.info(`[WP-11 trace] ${label}: ${JSON.stringify(value)}`);
}

describe("WP-11 integration: real home.yaml loads via DIRECT file read (not a collection)", () => {
  test("content/site/home.yaml is read from its fixed authored location and validates green", () => {
    const file = readHomeSettings(PROJECT_ROOT_URL);
    expect(file.filePath.endsWith(HOME_SETTINGS_RELATIVE_PATH)).toBe(true);
    const result = validateHomeSettings(file.data, { file: file.filePath });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.settings).toEqual({
      featured_gallery_id: "g_lofoten_polar_night",
    });
    trace("home settings", result.settings);
  });
});

describe("WP-11 integration: §10.2 featured resolution over the REAL corpus", () => {
  test("configured featured_gallery_id resolves to the referenced published corpus gallery", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);
    const home: HomeSettings = { featured_gallery_id: "g_lofoten_polar_night" };

    const result = resolveFeatured(home, refs, { mode: "production" });
    expect(result.galleryId).toBe("g_lofoten_polar_night");
    expect(result.warnings).toEqual([]);
    trace("featured (configured)", result);
  });

  test("null featured: all corpus published instants tie → lexicographic Gallery ID ascending", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);
    const published = refs.filter((g) => g.status === "published");
    expect(published).toHaveLength(13); // real archive is published-only

    // Every real-archive gallery shares the same go-live published instant.
    const instants = new Set(published.map((g) => g.published_at));
    expect(instants.size).toBe(1);

    const result = resolveFeatured({ featured_gallery_id: null }, refs, {
      mode: "production",
    });
    const smallestId = published.map((g) => g.id).sort()[0];
    expect(result.galleryId).toBe(smallestId);
    expect(result.warnings).toEqual([]);
    trace("featured (null → tie-break)", { galleryId: result.galleryId, smallestId });
  });

  test("synthesized distinct instants: latest published wins; draft corpus galleries are never candidates", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);
    // Synthesize distinct instants keyed off the real corpus (in-memory only —
    // the corpus itself keeps its single honest instant).
    const synthesized: CorpusRef[] = refs.map((g, i) => ({
      ...g,
      status: g.status,
      published_at:
        g.status === "published"
          ? `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`
          : g.published_at ?? null,
    }));
    const latestPublished = synthesized
      .filter((g) => g.status === "published")
      .sort((a, b) => (a.published_at! < b.published_at! ? 1 : -1))[0];

    const result = resolveFeatured({ featured_gallery_id: null }, synthesized, {
      mode: "production",
    });
    expect(result.galleryId).toBe(latestPublished.id);
    expect(result.warnings).toEqual([]);
    trace("featured (synthesized instants)", result);
  });

  test("featured referencing a DRAFT corpus gallery (production) warns + falls back; build not failed", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);
    // The real archive has no drafts; synthesize one from the first gallery so
    // the same guard path is exercised without mutating the corpus.
    const drafts = [{ id: "g_synthetic_draft", status: "draft" }];

    const result = resolveFeatured(
      { featured_gallery_id: drafts[0]!.id },
      refs,
      { mode: "production" },
    );
    expect(result.galleryId).not.toBe(drafts[0]!.id);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.rule).toBe("10.2:featured-unresolved");
    expect(result.warnings[0]!.message).toContain(drafts[0]!.id);
    trace("featured (draft target)", result);
  });

  test("featured referencing a nonexistent corpus ID warns + falls back deterministically", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);

    const viaConfigured = resolveFeatured({ featured_gallery_id: "g_does_not_exist" }, refs, {
      mode: "production",
    });
    const viaNull = resolveFeatured({ featured_gallery_id: null }, refs, { mode: "production" });
    // Same fallback algorithm → same deterministic outcome.
    expect(viaConfigured.galleryId).toBe(viaNull.galleryId);
    expect(viaConfigured.warnings.map((w) => w.rule)).toEqual(["10.2:featured-unresolved"]);
    expect(viaNull.warnings).toEqual([]);
    trace("featured (nonexistent target)", viaConfigured);
  });

  test("DETERMINISM over the real corpus: repeated runs and input permutations agree", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);
    const home: HomeSettings = { featured_gallery_id: "g_lofoten_polar_night" };
    const baseline = resolveFeatured(home, refs, { mode: "production" });
    const baselineNull = resolveFeatured({ featured_gallery_id: null }, refs, {
      mode: "production",
    });
    for (let i = 0; i < 5; i++) {
      expect(resolveFeatured(home, refs, { mode: "production" })).toEqual(baseline);
      expect(resolveFeatured(home, [...refs].reverse(), { mode: "production" })).toEqual(baseline);
      expect(resolveFeatured({ featured_gallery_id: null }, refs, { mode: "production" })).toEqual(
        baselineNull,
      );
    }
  });
});

describe("WP-11 integration: §10.4 Recent ordering over the REAL corpus (UD-003)", () => {
  test("published-only corpus ordering; published order ≠ photographed order is pinned with synthesized instants", async () => {
    const { entries } = await loadCollection("galleries");
    const refs = entries.map((e) => e.data as unknown as CorpusRef);

    const publishedOnly = orderRecentGalleries(refs, { mode: "production" });
    expect(publishedOnly).toHaveLength(13);
    expect(publishedOnly.every((g) => g.status === "published")).toBe(true);

    // Scramble: assign synthesized published instants ANTI-chronologically to
    // photographed_start, so published order ≠ photographed order by
    // construction. Ordering must follow published_at only (UD-003: never
    // photographed time/EXIF/mtime/Git/folder).
    const byPhotographed = [...refs]
      .filter((g) => g.status === "published")
      .sort((a, b) => (a.photographed_start < b.photographed_start ? -1 : 1));
    const scrambled = byPhotographed.map((g, i) => ({
      ...g,
      published_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, // earliest photographed → earliest published
    }));
    const ordered = orderRecentGalleries(scrambled, { mode: "production" });
    expect(ordered.map((g) => g.id)).toEqual([...byPhotographed].reverse().map((g) => g.id));
    trace("recent (scrambled published vs photographed)", ordered.map((g) => g.id));

    for (let i = 0; i < 5; i++) {
      expect(orderRecentGalleries(scrambled, { mode: "production" }).map((g) => g.id)).toEqual(
        ordered.map((g) => g.id),
      );
    }
  });
});

describe("WP-11 integration: per-Gallery featured fields are rejected anywhere (UD-004 pin)", () => {
  test("a corpus gallery authored with `featured`/`is_featured` fails production validation (§4.3 via WP-09)", async () => {
    const { entries } = await loadCollection("galleries");
    const base = entries[0]!.data as Record<string, unknown>;

    for (const field of ["featured", "is_featured", "is_curated"]) {
      const tagged = { ...base, [field]: true };
      const result = validateGalleries([{ data: tagged, filePath: `synthetic:${field}` }], {
        mode: "production",
      });
      expect(result.ok, `${field} must not pass production validation`).toBe(false);
      expect(result.errors.map((e) => e.rule)).toContain("4.3:forbidden-field");
      const err = result.errors.find((e) => e.rule === "4.3:forbidden-field");
      expect(err?.message).toContain(field);
    }
  });
});
