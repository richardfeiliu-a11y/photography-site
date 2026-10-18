// WP-27 unit tests — the one shared discovery-card component
// (src/components/GalleryCard.astro), rendered through Astro's
// experimental_AstroContainer and asserted at the DOM-string level.
//
// Visual redesign updates: photographed dates render via the shared
// formatter (spec §7), counts carry a unit (spec §6.2), and the place line
// is dropped only on a full title/place duplication (spec §6.2).
// Frozen references: FDS §3.3 (Archive cards: cover uncropped,
// photographed date, Place, count — metadata hierarchy in that order),
// §3.4 (no counts on Places-index usage), §2.2 (card title serif role;
// metadata sans; tabular numerals for counts), IMAGE_PIPELINE §15 (uncropped
// covers — aspect preserved), PERFORMANCE_BUDGET §6.1 (card covers lazy +
// decoding async, no preload).
//
// RED first: this file fails before src/components/GalleryCard.astro exists
// (import/render failure), then the component is implemented to satisfy it.
import { describe, expect, test } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import GalleryCard from "../../src/components/GalleryCard.astro";
import type { ViewGalleryCard } from "../../src/lib/views/types";

// ---------------------------------------------------------------------------
// Fixtures — synthesized card data (the pure ViewGalleryCard shape from WP-25)
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<ViewGalleryCard> = {}): ViewGalleryCard {
  return {
    id: "g_lofoten_light",
    slug: "lofoten-light",
    title: "Lofoten Light",
    photographedStart: "2025-02-01",
    photographedEnd: "2025-02-07",
    places: [
      { id: "pl_reine", name: "Reine", region: "Nordland", country: "Norway" },
    ],
    photoCount: 8,
    cover: {
      photoId: "p_lofoten_001",
      src: "/media/p_lofoten_001-cover-w2048-h1234.jpeg",
      srcset: "/media/p_lofoten_001-cover-w480.jpeg 480w, /media/p_lofoten_001-cover-w2048.jpeg 2048w",
      width: 2048,
      height: 1234,
    },
    isDraft: false,
    ...overrides,
  };
}

async function renderCard(card: ViewGalleryCard, props: Record<string, unknown> = {}) {
  const container = await AstroContainer.create();
  const result = await container.renderToString(GalleryCard, {
    props: { card, ...props },
  });
  return result;
}

// ---------------------------------------------------------------------------
// Catalogue plate number (Monograph §6.1 wall + the mount-board frame)
// ---------------------------------------------------------------------------

describe("GalleryCard plate number", () => {
  test("renders a zero-padded catalogue plate ABOVE the title when asked", async () => {
    const html = await renderCard(makeCard(), { plateNumber: 1 });
    expect(html).toMatch(/<span class="card-plate-num"[^>]*>PL\. 01</);
    // It sits in the text block, ahead of the title.
    const plateAt = html.indexOf("PL. 01");
    const titleAt = html.indexOf("Lofoten Light");
    expect(plateAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(plateAt);
  });

  test("pads two-digit plates and keeps three-digit ones whole", async () => {
    expect(await renderCard(makeCard(), { plateNumber: 9 })).toContain("PL. 09");
    expect(await renderCard(makeCard(), { plateNumber: 12 })).toContain("PL. 12");
    expect(await renderCard(makeCard(), { plateNumber: 100 })).toContain("PL. 100");
  });

  test("renders NO plate number by default (Archive/Places are unordered corpora)", async () => {
    const html = await renderCard(makeCard());
    expect(html).not.toContain("card-plate-num");
    expect(html).not.toContain("PL.");
  });

  test("rejects a non-positive or non-integer plate number instead of fabricating one", async () => {
    for (const plateNumber of [0, -3, 1.5, Number.NaN]) {
      const html = await renderCard(makeCard(), { plateNumber });
      expect(html, `plateNumber=${plateNumber}`).not.toContain("card-plate-num");
    }
  });
});

// ---------------------------------------------------------------------------
// Cover geometry (uncropped, CLS prevention, manifest-verbatim URLs)
// ---------------------------------------------------------------------------

describe("GalleryCard cover", () => {
  test("renders the cover img with intrinsic width/height from the cover data (CLS prevention)", async () => {
    const html = await renderCard(makeCard());
    expect(html).toContain('width="2048"');
    expect(html).toContain('height="1234"');
  });

  test("embeds src and srcset VERBATIM from the cover data (no filename parsing)", async () => {
    const card = makeCard();
    const html = await renderCard(card);
    expect(html).toContain(`src="${card.cover!.src}"`);
    expect(html).toContain(`srcset="${card.cover!.srcset}"`);
  });

  test("card covers load lazy + decode async with no preload (PERFORMANCE_BUDGET §6.1)", async () => {
    const html = await renderCard(makeCard());
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).not.toContain("preload");
    expect(html).not.toContain("fetchpriority");
  });

  test("cover data has an aspect-ratio-conserving geometry (uncropped — no fixed square frame)", async () => {
    // The uncropped-cover invariant: the img renders at its intrinsic aspect
    // ratio (width/height attributes present), and the component must not
    // introduce object-fit cover cropping or a forced square geometry.
    const html = await renderCard(makeCard());
    expect(html).not.toContain("object-fit");
    // No square-crop wrapper class from this component.
    expect(html).not.toContain("card-frame");
  });
});

// ---------------------------------------------------------------------------
// Frozen metadata hierarchy: cover → title (serif) → date → Place → count
// ---------------------------------------------------------------------------

describe("GalleryCard metadata hierarchy", () => {
  test("DOM order is title, then photographed date, then Place, then count (FDS §3.3)", async () => {
    const html = await renderCard(makeCard(), { showCount: true });
    const titleAt = html.indexOf("Lofoten Light");
    const dateAt = html.indexOf("February 2025");
    const placeAt = html.indexOf("Reine");
    // The count is its own element; match it exactly (bare "8" would hit
    // "2048" in the srcset first). Scoped-style data attributes may follow
    // the class attribute, so tolerate markup between class and value.
    const countAt = html.search(/<span class="card-count tnum"[^>]*>8 photographs</);
    expect(titleAt).toBeGreaterThan(-1);
    expect(dateAt).toBeGreaterThan(titleAt);
    expect(placeAt).toBeGreaterThan(dateAt);
    expect(countAt).toBeGreaterThan(placeAt);
  });

  test("the photographed date spells the month in full (immersive spec §6: January 2025)", async () => {
    const html = await renderCard(makeCard());
    expect(html).toMatch(/class="card-date tnum"[^>]*>February 2025</);
    expect(html).not.toContain("Feb 2025");
  });

  test("title renders as a link to /galleries/{slug} (card = navigation affordance)", async () => {
    const html = await renderCard(makeCard());
    expect(html).toContain('href="/galleries/lofoten-light"');
  });

  test("multi-place metadata renders compact and factual (all place names, comma-separated)", async () => {
    const card = makeCard({
      places: [
        { id: "pl_reine", name: "Reine", region: null, country: null },
        { id: "pl_tromso", name: "Tromsø", region: null, country: null },
      ],
    });
    const html = await renderCard(card);
    expect(html).toContain("Reine");
    expect(html).toContain("Tromsø");
  });
});

// ---------------------------------------------------------------------------
// Variant probe: count display is prop-level, never a fork
// ---------------------------------------------------------------------------

describe("GalleryCard showCount variant probe", () => {
  test("showCount=true renders the photoCount (Archive cards, FDS §3.3)", async () => {
    const html = await renderCard(makeCard(), { showCount: true });
    // Element-level (a bare "8" would match the srcset "w2048" first).
    // Visual redesign spec §6.2: counts carry a unit ("8 photographs").
    expect(html).toMatch(/<span class="card-count tnum"[^>]*>8 photographs</);
  });

  test("showCount=false renders NO count string anywhere (Home/Places usage)", async () => {
    const html = await renderCard(makeCard(), { showCount: false });
    // The count must be entirely absent from the rendered DOM.
    expect(html).not.toMatch(/>\s*8\s*</);
    expect(html).not.toContain("8 photographs");
    expect(html).not.toContain("8 photos");
  });
});

// ---------------------------------------------------------------------------
// Draft indicator (preview builds only) + null cover (preview draft)
// ---------------------------------------------------------------------------

describe("GalleryCard draft handling", () => {
  test("isDraft card shows a plain Draft text indicator", async () => {
    const html = await renderCard(makeCard({ isDraft: true }), { showCount: true });
    expect(html).toContain("Draft");
  });

  test("published card shows no Draft indicator", async () => {
    const html = await renderCard(makeCard());
    expect(html).not.toContain("Draft");
  });

  test("null cover (preview draft without cover_photo_id) renders text composition without an img and without a fabricated URL", async () => {
    const html = await renderCard(makeCard({ cover: null, isDraft: true }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("/media/");
    expect(html).toContain("Lofoten Light");
  });
});

// ---------------------------------------------------------------------------
// Title/place duplication (visual redesign spec §6.2)
// ---------------------------------------------------------------------------

describe("GalleryCard title/place dedupe", () => {
  test("hides the place line ONLY on a full title/place duplication", async () => {
    const card = makeCard({
      title: "reine ",
      places: [{ id: "pl_reine", name: "Reine", region: null, country: null }],
    });
    const html = await renderCard(card);
    expect(html).not.toMatch(/class="card-place"/);
  });

  test("keeps the place line when the title differs from the place name", async () => {
    const card = makeCard({
      title: "Winter Light",
      places: [{ id: "pl_reine", name: "Reine", region: null, country: null }],
    });
    const html = await renderCard(card);
    expect(html).toMatch(/class="card-place"[^>]*>Reine</);
  });

  test("never hides the place list on a multi-place card, even on a name match", async () => {
    const card = makeCard({
      title: "Lofoten",
      places: [
        { id: "pl_reine", name: "Lofoten", region: null, country: null },
        { id: "pl_tromso", name: "Tromsø", region: null, country: null },
      ],
    });
    const html = await renderCard(card);
    expect(html).toMatch(/class="card-place"/);
    expect(html).toContain("Tromsø");
  });
});
