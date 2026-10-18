// WP-03 — Content Layer wiring (glob loaders).
//
// Frozen references:
//   - TECHNICAL_API_VERIFICATION.md §1 — verified Astro 7 Content Layer API:
//     collections live in `src/content.config.ts`; `glob({ pattern, base })`
//     loads local YAML from anywhere on disk (base may point outside src/).
//   - CONTENT_MODEL.md §2 — authored content locations (no `src/content/` mirror).
//   - CONTENT_MODEL.md §6 / IC-01 — ONE PLACE = ONE YAML FILE; the places
//     collection uses the glob loader with a singular Place schema, so each
//     matched file becomes exactly one collection entry.
//   - BUILD_AND_ROUTING.md §3 — build-time loading contract.
//
// Authored YAML is loaded directly from the external content roots under
// `content/`. There is intentionally NO mirror under `src/content/`
// (REPOSITORY_STRUCTURE.md explicit prohibition).
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { gallerySchema, placeSchema } from "./content-schemas";

// Gallery metadata + inline photos: content/galleries/{gallery}/meta.yaml.
const galleries = defineCollection({
  loader: glob({ pattern: "**/meta.yaml", base: "./content/galleries" }),
  // WP-09: real fail-closed Gallery + inline Photo schema (CONTENT_MODEL §4/§5).
  // Per-entry shape/identity contracts live in the schema; cross-item validation
  // (duplicates, references, §13.1 rules, §13.2 warnings, mode switch) is composed
  // from src/lib/validate/gallery.ts (validateGalleries) — wired into the build
  // gate by WP-13.
  schema: gallerySchema,
});

// Place definitions: content/places/{place}.yaml, exactly ONE Place object per
// file — glob() makes each matched file exactly one collection entry (IC-01).
// WP-10: real fail-closed singular Place schema (CONTENT_MODEL §6.1/§6.2/§6.3).
// Per-file shape/forbidden-concept contracts live in the schema; cross-file
// identity validation (duplicate Place ID §13.1#5 / slug §13.1#6) is composed
// from src/lib/validate/place.ts (validatePlaces) — wired into the build gate
// by WP-13. There is intentionally NO aggregate (`file()`) or custom
// flattening loader for places: ONE PLACE = ONE YAML FILE.
const places = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./content/places" }),
  schema: placeSchema,
});

export const collections = { galleries, places };

// Home editorial settings (`content/site/home.yaml`) and historical route
// aliases (`content/redirects.yaml`) are intentionally NOT collections: each is
// a single authored file consumed via direct file reads at build time
// (BUILD_AND_ROUTING.md §3). Authored locations are fixed. Loading ownership:
//   - home.yaml      → WP-11 (Home page data)
//   - redirects.yaml → WP-12 (redirect generation)
