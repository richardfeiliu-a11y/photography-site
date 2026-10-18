// WP-10 integration tests — Place validation against the REAL Content Layer
// loader and the real authored corpus (tests/support/content-layer.ts drives
// the actual src/content.config.ts glob loader; nothing is mocked).
//
// Requirements: frozen WP-10 brief — "glob-loader cardinality assertion: one
// entry per file (collection entry count equals file count)" and "valid corpus
// validates green in production mode" (real archive: 42 places after the R4 sweep added 6 evidence-backed entities). The bijection proof from
// WP-03 (tests/integration/content-layer.test.ts test (b)) is strengthened
// here: the harness parseData now applies the REAL strict placeSchema during
// load, so any corpus file that is not exactly one valid Place object fails
// the load itself, and the entry-count-equals-file-count assertion runs with
// the real schema in the loop (IC-01: one Place = one file = one entry).
//
// Authority: research/production-architecture/CONTENT_MODEL.md §6, §13.1 #5/#6;
// IC-01 (TECHNICAL_API_VERIFICATION.md §1).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "js-yaml";
import { describe, expect, test } from "vitest";
import { loadCollection } from "../support/content-layer";
import { validatePlaces, type PlaceEntryInput } from "../../src/lib/validate/place";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));
const PLACES_DIR = fileURLToPath(new URL("../../content/places", import.meta.url));

/** The authored real-archive place IDs (46 files under content/places/ after the 2026-09-15 owner review added Mont Blanc, Þingvellir, Interlaken and Varenna). */
const CORPUS_PLACE_IDS = [
  "pl_aegean",
  "pl_amsterdam",
  "pl_athens",
  "pl_brussels",
  "pl_chamonix",
  "pl_cologne",
  "pl_dali",
  "pl_den_haag",
  "pl_dolomites",
  "pl_dusseldorf",
  "pl_giethoorn",
  "pl_hong_kong",
  "pl_interlaken",
  "pl_jokulsarlon",
  "pl_konigssee",
  "pl_kota_kinabalu",
  "pl_liuzhou",
  "pl_lofoten",
  "pl_london",
  "pl_lungern",
  "pl_marseille",
  "pl_mont_blanc",
  "pl_nanchang",
  "pl_nanjing",
  "pl_neuschwanstein",
  "pl_nice",
  "pl_nuremberg",
  "pl_paris",
  "pl_reims",
  "pl_rhine_valley",
  "pl_ruhr",
  "pl_snaefellsnes",
  "pl_south_coast",
  "pl_springfield_mo",
  "pl_thingvellir",
  "pl_thun",
  "pl_tromso",
  "pl_varenna",
  "pl_versailles",
  "pl_vik",
  "pl_wuppertal",
  "pl_xian",
  "pl_zaanseschans",
  "pl_zakynthos",
  "pl_zermatt",
  "pl_zhangjiajie",
] as const;

function fixtureDocs(name: string): Record<string, unknown>[] {
  return loadAll(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>[];
}

function fixtureEntries(name: string): PlaceEntryInput[] {
  return fixtureDocs(name).map((data, i) => ({
    data,
    filePath: `tests/fixtures/invalid/${name}#doc${i + 1}`,
  }));
}

describe("WP-10 integration: loader cardinality + real corpus (IC-01)", () => {
  test("collection 'places' entry count equals file count, through the REAL loader + REAL schema", async () => {
    // Filesystem oracle: how many authored Place files exist right now.
    const placeFiles = readdirSync(PLACES_DIR).filter((f) => f.endsWith(".yaml"));

    // The real glob loader runs; parseData applies the real strict placeSchema
    // to every file, so the load below THROWS if any file is not exactly one
    // valid Place object (e.g. an aggregate array or an unknown-keyed object).
    const { entries } = await loadCollection("places");

    // THE cardinality proof (§6.1 / IC-01): exactly one entry per file.
    expect(entries.length).toBe(placeFiles.length);
    const entriesByFile = new Map(entries.map((e) => [e.filePath, e] as const));
    expect(entriesByFile.size).toBe(placeFiles.length);
    for (const file of placeFiles) {
      expect(entriesByFile.has(`content/places/${file}`), `missing entry for ${file}`).toBe(true);
    }
    // Every loaded entry is a singular Place object, never an array (§6.1):
    for (const entry of entries) {
      expect(Array.isArray(entry.data), `${entry.filePath} must not be an array`).toBe(false);
    }
    // And the loaded entry data ids are exactly the authored corpus places:
    expect([...entries.map((e) => e.data.id as string)].sort()).toEqual([...CORPUS_PLACE_IDS]);
  });

  test("the 36-place corpus validates green in BOTH modes with zero findings", async () => {
    const { entries } = await loadCollection("places");
    const placeEntries: PlaceEntryInput[] = entries.map((e) => ({
      data: e.data,
      filePath: e.filePath,
    }));
    for (const mode of ["preview", "production"] as const) {
      const result = validatePlaces(placeEntries, { mode });
      expect(result.ok, `${mode}: authored corpus must validate clean`).toBe(true);
      expect(result.errors, `${mode}`).toEqual([]);
      expect(result.warnings, `${mode}: places have no §13.2 warning concept`).toEqual([]);
    }
  });
});

describe("WP-10 integration: invalid fixtures fail with precise rules", () => {
  test("duplicate Place ID (fixture 13.05) rejected with rule 13.1#5", () => {
    const result = validatePlaces(fixtureEntries("13.05-duplicate-place-id.yaml"), {
      mode: "production",
    });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#5");
    expect(err).toBeDefined();
    expect(err?.message).toContain("pl_bad_13_05");
    // The finding names both owner files (the fixture isolates the ID collision
    // by using different slugs, mirroring the gallery §13.1#2 message shape).
    expect(err?.message).toContain("13.05-duplicate-place-id.yaml#doc1");
    expect(err?.message).toContain("13.05-duplicate-place-id.yaml#doc2");
  });

  test("duplicate Place slug (fixture 13.06) rejected with rule 13.1#6", () => {
    const result = validatePlaces(fixtureEntries("13.06-duplicate-place-slug.yaml"), {
      mode: "production",
    });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#6");
    expect(err).toBeDefined();
    expect(err?.message).toContain("invalid-dup-place-slug");
  });

  test("Place array (fixture 6.1) rejected as a §6.1 cardinality violation", () => {
    const result = validatePlaces(fixtureEntries("6.1-place-array.yaml"), { mode: "production" });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "6.1:one-place-one-file");
    expect(err).toBeDefined();
    expect(err?.message).toContain("array");
  });

  test("forbidden concepts (fixture 6.3) rejected via §6.3 unknown-key rejection", () => {
    const result = validatePlaces(fixtureEntries("6.3-place-forbidden-concepts.yaml"), {
      mode: "production",
    });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "6.3:forbidden-concept");
    expect(err).toBeDefined();
    for (const field of ["coordinates", "gallery_count", "visits", "trip"]) {
      expect(err?.message).toContain(field);
    }
  });
});
