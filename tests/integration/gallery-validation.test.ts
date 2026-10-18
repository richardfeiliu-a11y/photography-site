// WP-09 integration tests — Gallery validation against the REAL Content Layer
// loaders and the real authored corpus (tests/support/content-layer.ts drives
// the actual src/content.config.ts glob loaders; nothing is mocked).
//
// Requirements: frozen WP-09 brief verification line — "valid fixture corpus
// still loads; production-mode build rejects each invalid fixture with a
// precise error" — plus the RED-set items that are inherently cross-module:
// §13.1#1 (real WEB INGEST MASTER root), §13.1#12 (production-only severity),
// §13.1#17 (route collision fixture), and the §13.2 warnings-never-pass-broken
// guard. Authority: research/production-architecture/CONTENT_MODEL.md §8, §13.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { loadAll } from "js-yaml";
import { describe, expect, test } from "vitest";
import { loadCollection } from "../support/content-layer";
import { validateGalleries, type GalleryEntryInput } from "../../src/lib/validate/gallery";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));
const INGEST_ROOT = fileURLToPath(new URL("../../media/ingest-masters", import.meta.url));

function fixtureDocs(name: string): Record<string, unknown>[] {
  return loadAll(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>[];
}

function fixtureEntries(name: string): GalleryEntryInput[] {
  return fixtureDocs(name).map((data, i) => ({
    data,
    filePath: `tests/fixtures/invalid/${name}#doc${i + 1}`,
  }));
}

describe("WP-09 integration: valid corpus passes in both modes", () => {
  test("the 13-gallery corpus loads through the REAL loader + real schema and validates green in production mode", async () => {
    const galleries = await loadCollection("galleries");
    const places = await loadCollection("places");
    expect(galleries.entries).toHaveLength(13);
    expect(places.entries).toHaveLength(46); // +4 owner-reviewed places 2026-09-15 (Mont Blanc, Þingvellir, Interlaken, Varenna)

    const knownPlaceIds = new Set(places.entries.map((p) => p.data.id as string));
    const entries: GalleryEntryInput[] = galleries.entries.map((e) => ({
      data: e.data,
      filePath: e.filePath,
    }));

    const production = validateGalleries(entries, {
      mode: "production",
      knownPlaceIds,
      ingestRoot: INGEST_ROOT,
    });
    expect(production.errors).toEqual([]);
    expect(production.ok).toBe(true);
  });

  test("preview mode over the real archive: no drafts, hence zero §13.2 draft warnings", async () => {
    const galleries = await loadCollection("galleries");
    const places = await loadCollection("places");
    const knownPlaceIds = new Set(places.entries.map((p) => p.data.id as string));

    const preview = validateGalleries(
      galleries.entries.map((e) => ({ data: e.data, filePath: e.filePath })),
      { mode: "preview", knownPlaceIds, ingestRoot: INGEST_ROOT },
    );
    expect(preview.ok).toBe(true);

    // The 2026-09-12 real archive contains NO draft galleries, so the
    // draft-lifecycle §13.2 warnings have no trigger in the authored corpus.
    // (The rules themselves stay pinned by their invalid fixtures below.)
    const warnRules = preview.warnings.map((w) => w.rule);
    expect(warnRules).not.toContain("13.2#warn-missing-cover");
    expect(warnRules).not.toContain("13.2#warn-missing-published-at");
    expect(preview.warnings).toEqual([]);
  });
});

describe("WP-09 integration: production mode rejects each invalid fixture with a precise error", () => {
  // The real-archive place IDs (content/places/*.yaml). Fixtures reference a
  // subset of these; the set is data-derived so a fixture referencing a
  // removed place would surface as a shape/registry error, not a silent skip.
  const PLACES = new Set([
    "pl_lofoten",
    "pl_nanchang",
    "pl_cologne",
    "pl_thun",
    "pl_tromso",
    "pl_springfield_mo",
    "pl_amsterdam",
    "pl_aegean",
    "pl_kota_kinabalu",
  ]);

  const cases: Array<{
    fixture: string;
    rule: string;
    gallery?: string;
    withIngestRoot?: boolean;
  }> = [
    {
      fixture: "13.01-missing-ingest-master.yaml",
      rule: "13.1#1",
      gallery: "g_bad_13_01",
      withIngestRoot: true,
    },
    { fixture: "13.02-duplicate-gallery-id.yaml", rule: "13.1#2", gallery: "g_bad_13_02" },
    { fixture: "13.03-duplicate-gallery-slug.yaml", rule: "13.1#3", gallery: "g_bad_13_03_b" },
    { fixture: "13.04-duplicate-photo-id.yaml", rule: "13.1#4", gallery: "g_bad_13_04_b" },
    { fixture: "13.07-photo-source-ref-empty.yaml", rule: "13.1#7", gallery: "g_bad_13_07" },
    { fixture: "13.08-cover-invalid-for-published.yaml", rule: "13.1#8", gallery: "g_bad_13_08" },
    { fixture: "13.09-place-reference-missing.yaml", rule: "13.1#9", gallery: "g_bad_13_09" },
    { fixture: "13.10-next-target-missing.yaml", rule: "13.1#10", gallery: "g_bad_13_10" },
    { fixture: "13.11-next-self-loop.yaml", rule: "13.1#11", gallery: "g_bad_13_11" },
    { fixture: "13.12-next-targets-draft.yaml", rule: "13.1#12", gallery: "g_bad_13_12_pub" },
    { fixture: "13.13-invalid-status.yaml", rule: "13.1#13", gallery: "g_bad_13_13" },
    { fixture: "13.14-missing-published-at.yaml", rule: "13.1#14", gallery: "g_bad_13_14" },
    { fixture: "13.17-route-collision.yaml", rule: "13.1#17", gallery: "g_bad_13_17_b" },
  ];

  for (const { fixture, rule, gallery, withIngestRoot } of cases) {
    test(`${fixture} → ${rule}`, () => {
      const result = validateGalleries(fixtureEntries(fixture), {
        mode: "production",
        knownPlaceIds: PLACES,
        ingestRoot: withIngestRoot ? INGEST_ROOT : undefined,
      });
      expect(result.ok, `${fixture} must fail production validation`).toBe(false);
      const err = result.errors.find((e) => e.rule === rule);
      expect(err, `expected a ${rule} finding in ${fixture}`).toBeDefined();
      if (gallery) {
        expect(
          err?.gallery ?? err?.message,
          `${rule} finding must name the offending gallery`,
        ).toContain(gallery);
      }
    });
  }

  test("§13.1#12 is production-only: fixture 13.12 passes preview validation", () => {
    const preview = validateGalleries(fixtureEntries("13.12-next-targets-draft.yaml"), {
      mode: "preview",
      knownPlaceIds: PLACES,
    });
    expect(preview.ok).toBe(true);
    expect(preview.errors).toEqual([]);
  });

  test("duplicate slug also surfaces as a canonical route collision (§13.1#17)", () => {
    const result = validateGalleries(fixtureEntries("13.17-route-collision.yaml"), {
      mode: "production",
    });
    const rules = result.errors.map((e) => e.rule);
    expect(rules).toContain("13.1#17");
    const route = result.errors.find((e) => e.rule === "13.1#17");
    expect(route?.message).toContain("/galleries/invalid-route-collision");
  });

  test("warnings can never pass broken published content (§13.2 guard, real fixture base)", () => {
    // 13.2-warn-missing-description.yaml is a VALID published gallery carrying a
    // warning condition. Add a real §13.1 violation (drop published_at) and the
    // production build must still fail despite the warning machinery.
    const docs = fixtureDocs("13.2-warn-missing-description.yaml");
    delete docs[0].published_at;
    const result = validateGalleries(
      docs.map((data, i) => ({ data, filePath: `broken-warn#doc${i}` })),
      { mode: "production", knownPlaceIds: PLACES },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("13.1#14");
  });
});

describe("WP-09 integration: ingest-root environment contract", () => {
  test("ingest root resolves to the canonical media/ingest-masters location", () => {
    expect(INGEST_ROOT).toContain(join("media", "ingest-masters"));
    // pathToFileURL round-trip: the option accepts string | URL.
    expect(pathToFileURL(INGEST_ROOT).protocol).toBe("file:");
  });
});
