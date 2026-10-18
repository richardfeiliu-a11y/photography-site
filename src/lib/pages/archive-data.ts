// WP-28/WP-29 — shared page-level data composition (one canonical
// implementation; pages are consumers).
//
// The astro build gate (scripts/validate/astro-gate.mjs) has already run the
// fail-closed content validation BEFORE any page generation. This helper
// composes the SAME validation in-process to obtain the published data set
// (WP-13 publishedDataSet) for page assembly, binding the WP-24 selector
// surface as the CoverResolver for the WP-25 view builders.
//
// Repo-root resolution mirrors src/lib/assets/manifest.ts defaultManifestRoot:
// under `astro build` page modules are relocated into dist/.prerender chunks,
// so the module-relative root is walked upward until content/galleries is
// found (deterministic; process.cwd() as the last resort).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadArchive } from "../../../scripts/validate/content";
import { composeArchiveValidation } from "../validate/production";
import { createPhotoSelectors, getManifest } from "../assets/manifest";
import type { PurposeVariants } from "../assets/manifest";
import { viewModeFromEnv } from "./mode";
import type { CoverResolver, ViewMode } from "../views/types";
import type { HomeSettings } from "../../content-schemas";
import type { Gallery, Place } from "../../content-schemas";

export function repoRoot(): string {
  let dir = fileURLToPath(new URL("../../../", import.meta.url));
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, "content/galleries"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export interface PageDataSet {
  galleries: Gallery[];
  places: Place[];
  /** WP-25 cover resolution bound to the WP-24 selector surface. */
  resolveCover: CoverResolver;
  /** Full-bleed cover resolution for the Home stage/preload (T6): the same
   *  manifest authority WITHOUT the discovery-card 1280 rung cap. */
  resolveHeroCover: CoverResolver;
  home: { settings: HomeSettings | null };
  mode: ViewMode;
  /** Gallery ID → published next_gallery_id (null = none); WP-33 input. */
  nextGalleryMap: Record<string, string | null>;
}

export function loadPublishedDataSet(modeOverride?: ViewMode): PageDataSet {
  const mode = modeOverride ?? viewModeFromEnv();
  const root = repoRoot();
  const validation = composeArchiveValidation(loadArchive(root), {
    mode,
    ingestRoot: join(root, "media/ingest-masters"),
    // §13.1#18 coverage input takes {rows: [{photo_id, purpose}]}; adapt the
    // manifest document's records the same way the CLI's loadAssetManifest.
    assetManifest: {
      rows: getManifest().manifest.records.map((r) => ({
        photo_id: r.photo_id,
        purpose: r.purpose,
      })),
    },
  });
  if (!validation.ok) {
    throw new Error(
      `[pages] composed validation failed — the build gate should have failed first: ${validation.errors
        .slice(0, 5)
        .map((e) => e.message)
        .join("; ")}`,
    );
  }
  const { galleries, places, home } = validation.publishedDataSet;

  const selectors = createPhotoSelectors(getManifest());

  // R4 perf: discovery cards show the cover at "(min-width: 900px) 33vw"
  // (≤475 CSS px at the 1440 layout; w1280 already covers 2× DPR). The
  // frozen `cover` purpose ladder starts at w1280, so the mobile archive
  // LCP card had to fetch a ~150KB w1280 AVIF behind the other cards' w1280
  // requests (measured mobile LCP 4704ms, 2026-09-13 r4-rework run). The
  // same uncropped source already has a gallery_display ladder from w480
  // (IMAGE_PIPELINE §15 no-upscale/no-crop is shared by both purposes);
  // cards consume that ladder capped at CARD_MAX_RUNG. URLs remain
  // manifest-verbatim and fail-closed — nothing is parsed or fabricated.
  const CARD_MAX_RUNG = 1280;
  const toCardDisplay = (v: PurposeVariants) => {
    const formats = v.formats
      .map((format) => {
        const entries = format.entries.filter((entry) => entry.width <= CARD_MAX_RUNG);
        return {
          format: format.format,
          entries,
          srcset: entries.map((entry) => `${entry.url} ${entry.width}w`).join(", "),
        };
      })
      .filter((format) => format.entries.length > 0);
    const fallback = formats.find((format) => format.format === "jpeg") ?? formats[0];
    if (!fallback) {
      throw new Error("24:variant-missing: no card-rung derivatives at or below 1280w");
    }
    const widest = [...fallback.entries].sort((a, b) => a.width - b.width).at(-1)!;
    const avif = formats.find((format) => format.format === "avif");
    return {
      src: widest.url,
      srcset: fallback.srcset,
      avifSrcset: avif?.srcset,
      width: widest.width,
      height: widest.height,
    };
  };

  // R4 round4 (T6): the CARD cap is a discovery-card decision, not a cover
  // decision. The full-bleed Home stage has its own ladder context (100vw at
  // up to a 2560px window) and the manifest already carries the whole
  // gallery_display ladder (480..2560) for those photos — the earlier
  // "cover == capped card" binding silently handed the stage a ladder that
  // ended at w1280, so a 1440px-wide stage could only ever consume w1280
  // (measured currentSrc w1280 at 1440/DPR1). Nothing is generated or
  // fabricated here: the same manifest entries, without the card cap.
  const toFullDisplay = (v: PurposeVariants) => {
    const formats = v.formats
      .filter((format) => format.entries.length > 0)
      .map((format) => ({
        format: format.format,
        entries: format.entries,
        srcset: format.entries.map((entry) => `${entry.url} ${entry.width}w`).join(", "),
      }));
    const fallback = formats.find((format) => format.format === "jpeg") ?? formats[0];
    if (!fallback) {
      throw new Error("24:variant-missing: no derivatives for the full-bleed cover");
    }
    const widest = [...fallback.entries].sort((a, b) => a.width - b.width).at(-1)!;
    const avif = formats.find((format) => format.format === "avif");
    return {
      src: widest.url,
      srcset: fallback.srcset,
      avifSrcset: avif?.srcset,
      width: widest.width,
      height: widest.height,
    };
  };

  const resolveCover: CoverResolver = (photoId) => {
    try {
      const v = selectors.getGalleryVariants(photoId, {
        sizes: "(min-width: 900px) 33vw, 90vw",
      });
      return { photoId, ...toCardDisplay(v) } as ReturnType<CoverResolver>;
    } catch (error) {
      if (mode === "preview") {
        // §8.4/WP-25 contract: a PREVIEW draft's cover_photo_id may reference
        // derivatives the pipeline never produced (drafts are outside the
        // published manifest) — the card renders its null-cover composition
        // (never a fabricated URL). Production keeps fail-closed propagation.
        return { photoId, src: "", srcset: "", width: 0, height: 0, missing: true } as never;
      }
      throw error;
    }
  };

  /** Full-bleed cover resolution (Home stage / preload): the same manifest
   *  authority as `resolveCover`, with the full gallery_display ladder. */
  const resolveFullCover: CoverResolver = (photoId) => {
    try {
      const v = selectors.getGalleryVariants(photoId, { sizes: "100vw" });
      return { photoId, ...toFullDisplay(v) } as ReturnType<CoverResolver>;
    } catch (error) {
      if (mode === "preview") {
        return { photoId, src: "", srcset: "", width: 0, height: 0, missing: true } as never;
      }
      throw error;
    }
  };

  return {
    galleries,
    places,
    resolveCover,
    /** Full-bleed ladder resolver for the Home stage (T6). */
    resolveHeroCover: resolveFullCover,
    home: { settings: home.settings },
    mode,
    nextGalleryMap: validation.publishedDataSet.nextGalleryMap,
  };
}
