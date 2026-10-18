// WP-33 integration — real corpus GalleryView + route contract.
import { describe, expect, test } from "vitest";
import { loadCollection } from "../support/content-layer";
import { loadArchive } from "../../scripts/validate/content";
import { composeArchiveValidation } from "../../src/lib/validate/production";
import { buildGalleryView } from "../../src/lib/views/gallery";
import type { Gallery, Place } from "../../src/content-schemas";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

const resolveDisplay = (photoId: string) => ({
  photoId,
  src: `/display/${photoId}.jpg`,
  srcset: `/display/${photoId}.jpg 480w, /display/${photoId}.jpg 2048w`,
  width: 2048,
  height: 1365,
});

describe("WP-33 GalleryView over the real corpus", () => {
  test("published getStaticPaths scope = exactly the 13 published slugs", async () => {
    const { entries } = await loadCollection("galleries");
    const galleries = entries.map((e) => e.data as unknown as Gallery);
    const published = galleries.filter((g) => g.status === "published");
    expect(published).toHaveLength(13);
    // The real archive is published-only (no drafts in the corpus).
    const slugs = published.map((g) => g.slug);
    expect(slugs).toContain("netherlands");
    expect(slugs).toContain("swiss-and-dolomites");
  });

  test("lofoten-polar-night GalleryView: authored order, header data, standard continuation", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);
    const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
      mode: "production",
      ingestRoot: `${REPO_ROOT}media/ingest-masters`,
    });
    expect(validation.ok).toBe(true);
    const { nextGalleryMap } = validation.publishedDataSet;

    const lofoten = galleries.find((g) => g.slug === "lofoten-polar-night")!;
    const view = buildGalleryView({
      gallery: lofoten,
      places,
      nextGalleryMap,
      allGalleries: galleries,
      resolveDisplay,
    });
    expect(view.photos.map((p) => p.photoId)).toEqual(lofoten.photos.map((p) => p.id));
    expect(view.header.photoCount).toBe(11);
    expect(view.header.places[0]?.name).toBe("Lofoten");
    expect(view.continuation).toMatchObject({
      kind: "standard",
      nextSlug: "south-china-summer",
      nextTitle: "South China, Summer",
    });
  });

  test("every published gallery's GalleryView assembles over the corpus (stub resolver; real closure = the build's throwing selector)", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);
    const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
      mode: "production",
      ingestRoot: `${REPO_ROOT}media/ingest-masters`,
    });
    const { nextGalleryMap } = validation.publishedDataSet;

    for (const gallery of galleries.filter((g) => g.status === "published")) {
      const view = buildGalleryView({
        gallery,
        places,
        nextGalleryMap,
        allGalleries: galleries,
        resolveDisplay,
      });
      expect(view.photos).toHaveLength(gallery.photos.length);
    }
  });
});

