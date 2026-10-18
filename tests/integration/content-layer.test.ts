// WP-03 integration tests — Content Layer wiring (glob loaders).
// Requirements from the frozen brief (.superpowers/sdd/PRODUCTION_IMPLEMENTATION_PLAN/wp-03-brief.md):
//   (a) collection `galleries` loads an entry from `content/galleries/*/meta.yaml`;
//   (b) collection `places` yields exactly one entry per `content/places/*.yaml` file
//       (the one-Place-one-entry cardinality proof, CONTENT_MODEL.md §6 / IC-01);
//   (c) no file exists under `src/content/` (prohibition assertion — walk src/ and
//       assert the path is absent; there must be no mirror).
// Plus the acceptance-criteria guard: legacy collection syntax (`type: 'content'`,
// `collections.folder`, `getEntryData`) absent from the WP-03 content sources.
//
// 2026-09-12 (go-live content swap, commit c0495d9): the WP-08 test-fixture
// corpus was replaced by the REAL archive — 13 galleries / 36 places. The
// smoke assertions enumerate the authored corpus exactly.
//
// Mechanism: see tests/support/content-layer.ts and docs/implementation/WP-03.md —
// the real src/content.config.ts is imported and its real glob() loaders run against
// the real filesystem. Nothing is mocked on the filesystem.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loadCollection } from "../support/content-layer";

const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));
const PLACES_DIR = fileURLToPath(new URL("../../content/places", import.meta.url));

/** The authored real-archive corpus gallery slugs (directory names). */
const CORPUS_GALLERY_SLUGS = [
  "aegean",
  "alps",
  "autumn-china",
  "bavaria-konigssee",
  "cote-dazur",
  "france",
  "iceland",
  "kota-kinabalu",
  "lofoten-polar-night",
  "netherlands",
  "south-china-summer",
  "swiss-and-dolomites",
  "winter-europe",
] as const;

/** The authored real-archive place slugs (file stems under content/places/). */
const CORPUS_PLACE_SLUGS = [
  "aegean",
  "amsterdam",
  "athens",
  "brussels",
  "chamonix",
  "cologne",
  "dali",
  "den-haag",
  "dolomites",
  "dusseldorf",
  "giethoorn",
  "hong-kong",
  "interlaken",
  "jokulsarlon",
  "konigssee",
  "kota-kinabalu",
  "liuzhou",
  "lofoten",
  "london",
  "lungern",
  "marseille",
  "mont-blanc",
  "nanchang",
  "nanjing",
  "neuschwanstein",
  "nice",
  "nuremberg",
  "paris",
  "reims",
  "rhine-valley",
  "ruhr",
  "snaefellsnes",
  "south-coast",
  "springfield-mo",
  "thingvellir",
  "thun",
  "tromso",
  "varenna",
  "versailles",
  "vik",
  "wuppertal",
  "xian",
  "zaanse-schans",
  "zakynthos",
  "zermatt",
  "zhangjiajie",
] as const;

/** Recursive walk of src/ — directories and files, absolute paths. */
function walkDeep(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    out.push(p);
    if (name.isDirectory()) out.push(...walkDeep(p));
  }
  return out;
}

describe("WP-03 Content Layer wiring (glob loaders)", () => {
  test("(a) collection 'galleries' loads an entry from content/galleries/*/meta.yaml", async () => {
    const { entries } = await loadCollection("galleries");

    // Corpus enumeration: the loader sees EXACTLY the 13 authored real-archive
    // galleries — no fixture leftovers, no stragglers.
    expect(entries.length).toBe(CORPUS_GALLERY_SLUGS.length);
    expect([...entries.map((e) => e.id)].sort()).toEqual([...CORPUS_GALLERY_SLUGS]);

    const lofoten = entries.find(
      (e) => e.filePath === "content/galleries/lofoten-polar-night/meta.yaml",
    );
    expect(lofoten).toBeDefined();
    // Loaded from the real YAML file, parsed by the loader (not a fixture copy):
    expect(lofoten?.data).toMatchObject({
      id: "g_lofoten_polar_night",
      slug: "lofoten-polar-night",
      status: "published",
      title: "Lofoten, Polar Night",
      cover_photo_id: "p_lofoten_polar_night_010",
      next_gallery_id: "g_south_china_summer",
    });
    expect(lofoten?.data.photos).toHaveLength(11);

    // A second real gallery loads with its authored order intact.
    const netherlands = entries.find(
      (e) => e.filePath === "content/galleries/netherlands/meta.yaml",
    );
    expect(netherlands?.data).toMatchObject({
      id: "g_netherlands",
      slug: "netherlands",
      status: "published",
      title: "Netherlands",
    });
    expect(netherlands?.data.photos).toHaveLength(28);
  });

  test("(b) collection 'places' yields exactly one entry per content/places/*.yaml file", async () => {
    // Filesystem oracle: how many authored Place files exist right now.
    const placeFiles = readdirSync(PLACES_DIR).filter((f) => f.endsWith(".yaml"));
    expect(placeFiles.length).toBe(CORPUS_PLACE_SLUGS.length);

    const { entries } = await loadCollection("places");

    // THE cardinality proof: ONE Place object per file -> a bijection between
    // authored files and loaded entries (exactly one entry per file, no extras).
    const entriesByFile = new Map(entries.map((e) => [e.filePath, e] as const));
    expect(entriesByFile.size).toBe(placeFiles.length);
    for (const file of placeFiles) {
      expect(entriesByFile.has(`content/places/${file}`), `missing entry for ${file}`).toBe(true);
    }
    // And the loaded entry IDs are exactly the authored corpus places:
    expect([...entries.map((e) => e.id)].sort()).toEqual([...CORPUS_PLACE_SLUGS]);

    const lofoten = entries.find((e) => e.filePath === "content/places/lofoten.yaml");
    expect(lofoten).toBeDefined();
    // Singular Place shape (CONTENT_MODEL.md §6) — one Place object, not a list:
    expect(lofoten?.data).toMatchObject({
      id: "pl_lofoten",
      slug: "lofoten",
      name: "Lofoten",
    });
    expect(Array.isArray(lofoten?.data)).toBe(false);
  });

  test("(c) no file exists under src/content/ (prohibition: no src/content/ mirror)", () => {
    const forbiddenPrefix = join(SRC_DIR, "content");
    const offenders = walkDeep(SRC_DIR).filter(
      (p) => p === forbiddenPrefix || p.startsWith(forbiddenPrefix + "/"),
    );
    expect(offenders).toEqual([]);
  });

  test("(acceptance) legacy collection syntax is absent from WP-03 content sources", () => {
    for (const file of ["content.config.ts", "content-schemas.ts"]) {
      const src = readFileSync(join(SRC_DIR, file), "utf8");
      expect(src, `${file} must not use legacy type: 'content'`).not.toMatch(
        /type:\s*["']content["']/,
      );
      expect(src, `${file} must not use collections.folder`).not.toContain("collections.folder");
      expect(src, `${file} must not use getEntryData`).not.toContain("getEntryData");
    }
  });
});
