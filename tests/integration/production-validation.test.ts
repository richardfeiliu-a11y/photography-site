// WP-13 integration tests — the COMPOSED production validation gate over the
// whole archive (src/lib/validate/production.ts), the standalone CLI
// (scripts/validate/content.ts) and the astro build gate
// (scripts/validate/astro-gate.mjs).
//
// RED set (frozen WP-13 brief): aggregate scenarios across entities —
// route collisions, next_gallery_id graph rules (with cycles LEGAL),
// unresolved source_ref, draft exclusion at every output point of the
// composed production data set, one-Photo-one-Gallery, orphan metadata
// keys, the FULL §13.1 rule 1–18 matrix demonstrated through the COMPOSED
// validator, preview-mode §13.2 warnings without failure, deterministic
// error ordering, the closed fail-open guard (production without
// context = error), CLI exit codes, and the env-driven build-gate mode
// selection (BUILD_AND_ROUTING §6).
//
// Authority: research/production-architecture/CONTENT_MODEL.md §13
// (rules 1–18), BUILD_AND_ROUTING.md §6–7, UD-003/007/009/010,
// docs/implementation/WP-09.md + WP-10.md + WP-11.md + WP-12.md
// (composition contracts).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadAll as parseYamlAll, load as parseYaml } from "js-yaml";
import { describe, expect, test } from "vitest";
import {
  composeArchiveValidation,
  formatArchiveIssues,
  type ArchiveValidationResult,
  type ComposeArchiveInputs,
  type ComposeArchiveOptions,
  type HomeInput,
} from "../../src/lib/validate/production";
import type { GalleryEntryInput } from "../../src/lib/validate/gallery";
import type { PlaceEntryInput } from "../../src/lib/validate/place";
import {
  entriesFromRedirectsFile,
  readRedirects,
  type RedirectEntryInput,
} from "../../src/lib/content/redirects";
import { readHomeSettings } from "../../src/lib/content/home";
import { PROJECT_ROOT_URL, loadCollection } from "../support/content-layer";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));
const INGEST_ROOT = fileURLToPath(new URL("../../media/ingest-masters", import.meta.url));
const REPO_ROOT = fileURLToPath(PROJECT_ROOT_URL);

// ---------------------------------------------------------------------------
// Helpers — the REAL corpus via the REAL Content Layer loaders (WP-03 harness),
// plus invalid-fixture injection helpers.
// ---------------------------------------------------------------------------

interface Corpus {
  galleries: GalleryEntryInput[];
  places: PlaceEntryInput[];
  home: HomeInput;
  redirects: RedirectEntryInput[];
}

async function loadCorpus(): Promise<Corpus> {
  const [galleries, places] = await Promise.all([
    loadCollection("galleries"),
    loadCollection("places"),
  ]);
  const home = readHomeSettings(PROJECT_ROOT_URL);
  const redirectsFile = readRedirects(PROJECT_ROOT_URL);
  const parsed = entriesFromRedirectsFile(redirectsFile.data);
  expect(parsed.fileErrors).toEqual([]);
  return {
    galleries: galleries.entries.map((e) => ({ data: e.data, filePath: e.filePath })),
    places: places.entries.map((e) => ({ data: e.data, filePath: e.filePath })),
    home: { data: home.data, filePath: home.filePath },
    redirects: parsed.entries,
  };
}

function galleryFixture(name: string): GalleryEntryInput[] {
  const docs = parseYamlAll(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<
    string,
    unknown
  >[];
  return docs.map((data, i) => ({ data, filePath: `tests/fixtures/invalid/${name}#doc${i + 1}` }));
}

function placeFixture(name: string): PlaceEntryInput[] {
  const docs = parseYamlAll(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<
    string,
    unknown
  >[];
  return docs.map((data, i) => ({ data, filePath: `tests/fixtures/invalid/${name}#doc${i + 1}` }));
}

/** Loads a redirects-file fixture (a mapping of old path → target entry). */
function redirectFixture(name: string): RedirectEntryInput[] {
  const doc = parseYaml(readFileSync(join(FIXTURES_DIR, name), "utf8")) as unknown;
  const parsed = entriesFromRedirectsFile(doc);
  return parsed.entries.map((e) => ({
    ...e,
    filePath: `tests/fixtures/invalid/${name}`,
  }));
}

/**
 * Composes the REAL corpus with optional overrides. Input keys
 * (galleries/places/home/redirects) replace the corpus inputs; every other
 * key is a compose option. Only overrides that are explicitly provided win —
 * `undefined` values are applied verbatim so tests can exercise the guard
 * paths (e.g. ingestRoot: undefined).
 */
function compose(
  corpus: Corpus,
  overrides: Partial<ComposeArchiveInputs & ComposeArchiveOptions> = {},
): ArchiveValidationResult {
  const inputs: Record<string, unknown> = {
    galleries: corpus.galleries,
    places: corpus.places,
    home: corpus.home,
    redirects: corpus.redirects,
  };
  const options: Record<string, unknown> = { mode: "production", ingestRoot: INGEST_ROOT };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in inputs) inputs[key] = value;
    else options[key] = value;
  }
  return composeArchiveValidation(
    inputs as unknown as ComposeArchiveInputs,
    options as unknown as ComposeArchiveOptions,
  );
}

const RULES = (
  result: ArchiveValidationResult,
  severity: "error" | "warning" = "error",
): string[] => (severity === "error" ? result.errors : result.warnings).map((i) => i.rule);

/**
 * A published synthesized gallery with no collision against any corpus ID/slug/photo.
 * Photos carry authored alt (WP-58): a published synthetic without alt would trip
 * the live WP-42 gate and pollute every composing assertion.
 */
function syntheticGallery(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "g_wp13_synth",
    slug: "wp13-synth",
    status: "published",
    title: "WP-13 synthesized gallery",
    photographed_start: "2025-06-01",
    photographed_end: "2025-06-02",
    published_at: "2026-08-29T00:00:00Z",
    places: ["pl_lofoten"],
    cover_photo_id: "p_wp13_synth_001",
    photos: [
      {
        id: "p_wp13_synth_001",
        source_ref: "lofoten-polar-night/DSC02252.jpg",
        caption: null,
        rhythm_after: "base",
        alt_text: "WP-13 synthesized photo",
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Composed clean corpus + draft exclusion at every output point
// ---------------------------------------------------------------------------

describe("WP-13 composed gate: clean corpus", () => {
  test("production mode over the REAL corpus passes with the full published data set", async () => {
    const result = compose(await loadCorpus());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    // 13 galleries, all published; sorted by slug (route order).
    expect(result.publishedDataSet.galleries.map((g) => g.slug)).toEqual([
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
    ]);
    // Public places: ≥1 published gallery OR ≥1 photo-level place reference
    // (R3 place-aggregation contract). Cologne has no gallery but two
    // confirmed photos (p_netherlands_026/027); springfield-mo and tromso
    // still have neither, so they have no public route in production.
    expect(result.publishedDataSet.places.map((p) => p.id)).toEqual([
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
      "pl_thingvellir",
      "pl_thun",
      "pl_varenna",
      "pl_versailles",
      "pl_vik",
      "pl_wuppertal",
      "pl_xian",
      "pl_zaanseschans",
      "pl_zakynthos",
      "pl_zermatt",
      "pl_zhangjiajie",
    ]);
    // Home resolution (§10.2/§10.4) over published-only galleries.
    expect(result.publishedDataSet.home.featuredGalleryId).toBe("g_lofoten_polar_night");
    expect(result.publishedDataSet.home.recentGalleryIds).toHaveLength(13);
    expect(new Set(result.publishedDataSet.home.recentGalleryIds).size).toBe(13);
    // content/redirects.yaml is empty post-go-live: no historical aliases.
    expect(result.publishedDataSet.redirects).toEqual([]);
    // next-gallery navigation map over published galleries only.
    expect(Object.keys(result.publishedDataSet.nextGalleryMap)).toHaveLength(13);
  });

  test("drafts are provably absent from EVERY output point of the production data set", async () => {
    const result = compose(await loadCorpus());
    const drafts = ["g_essen_industrial_light", "g_long_gallery_72"];
    const draftSlugs = ["essen-industrial-light", "long-gallery-72"];

    // Routes / sitemap input set: the published-only gallery list.
    for (const g of result.publishedDataSet.galleries) {
      expect(drafts, `route set must not contain draft ${g.id}`).not.toContain(g.id);
      expect(draftSlugs, `route set must not contain draft slug ${g.slug}`).not.toContain(g.slug);
    }
    expect(result.publishedDataSet.draftGalleryIds).toEqual([]);

    // Places data set: no place backed exclusively by drafts.
    expect(result.publishedDataSet.places.map((p) => p.id)).not.toContain("pl_essen");

    // Home data set: featured + Recent never resolve to a draft.
    expect(drafts).not.toContain(result.publishedDataSet.home.featuredGalleryId);
    for (const id of result.publishedDataSet.home.recentGalleryIds) {
      expect(drafts, `Recent must not contain draft ${id}`).not.toContain(id);
    }

    // Redirect resolution: no destination resolves into a draft route.
    for (const r of result.publishedDataSet.redirects) {
      expect(r.targetId, r.oldPath).not.toBe("g_long_gallery_72");
      expect(r.targetId, r.oldPath).not.toBe("g_essen_industrial_light");
    }

    // next-gallery navigation map: no draft keys, no draft targets.
    for (const [id, next] of Object.entries(result.publishedDataSet.nextGalleryMap)) {
      expect(drafts, `nextGalleryMap key ${id}`).not.toContain(id);
      if (next !== null) expect(drafts, `nextGalleryMap target ${next}`).not.toContain(next);
    }
  });

  test("preview mode over the REAL corpus: §13.2 warnings WITHOUT failing, drafts present for preview routes", async () => {
    const result = compose(await loadCorpus(), { mode: "preview" });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    // The real archive has NO drafts, so no §13.2 draft warnings fire; every
    // emitted warning is still confined to the documented warning vocabulary.
    const warnRules = RULES(result, "warning");
    expect(warnRules).not.toContain("13.2#warn-missing-cover");
    expect(warnRules).not.toContain("13.2#warn-missing-published-at");
    for (const w of result.warnings) {
      expect(w.rule.startsWith("13.2#") || w.rule.startsWith("13.1#16-warn") || w.rule.startsWith("WP-42:"), w.rule).toBe(true);
    }

    // Preview data set is draft-INCLUSIVE by contract (ADR-020): with no
    // authored drafts it equals the production scope (13 galleries, 0 drafts).
    expect(result.publishedDataSet.galleries).toHaveLength(13);
    expect(result.publishedDataSet.draftGalleryIds).toEqual([
    ]);
    // …but the §10.2/§10.4 Home resolution is mode-agnostic and stays published-only.
    expect(result.publishedDataSet.home.recentGalleryIds).toHaveLength(13);
  });
});

// ---------------------------------------------------------------------------
// §13.1 matrix — every rule 1–18 fires through the COMPOSED validator
// ---------------------------------------------------------------------------

describe("WP-13 §13.1 matrix: each rule fires through the composed validator", () => {
  test("13.1#1 — published Photo with unresolved source_ref (missing master file) rejected", async () => {
    const corpus = await loadCorpus();
    const result = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.01-missing-ingest-master.yaml")],
    });
    expect(RULES(result)).toContain("13.1#1");
    expect(result.ok).toBe(false);
  });

  test("13.1#2 / 13.1#3 / 13.1#4 / 13.1#17 — identity + route-space collisions rejected", async () => {
    const corpus = await loadCorpus();
    for (const [fixture, rule] of [
      ["13.02-duplicate-gallery-id.yaml", "13.1#2"],
      ["13.03-duplicate-gallery-slug.yaml", "13.1#3"],
      ["13.04-duplicate-photo-id.yaml", "13.1#4"],
    ] as const) {
      const result = compose(corpus, {
        galleries: [...corpus.galleries, ...galleryFixture(fixture)],
      });
      expect(RULES(result), fixture).toContain(rule);
      expect(result.ok, fixture).toBe(false);
    }
    // Route collision between two Gallery slugs (§13.1#17) — the RED-set item.
    const collision = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.17-route-collision.yaml")],
    });
    expect(RULES(collision)).toContain("13.1#17");
    expect(RULES(collision)).toContain("13.1#3"); // the data-level statement co-fires
    expect(collision.ok).toBe(false);
  });

  test("13.1#5 / 13.1#6 — duplicate Place ID / slug rejected", async () => {
    const corpus = await loadCorpus();
    for (const [fixture, rule] of [
      ["13.05-duplicate-place-id.yaml", "13.1#5"],
      ["13.06-duplicate-place-slug.yaml", "13.1#6"],
    ] as const) {
      const result = compose(corpus, {
        places: [...corpus.places, ...placeFixture(fixture)],
      });
      expect(RULES(result), fixture).toContain(rule);
      expect(result.ok, fixture).toBe(false);
    }
  });

  test("13.1#7 / 13.1#8 / 13.1#13 / 13.1#14 — schema-level published-content rules via composed run", async () => {
    const corpus = await loadCorpus();
    for (const [fixture, rule] of [
      ["13.07-photo-source-ref-empty.yaml", "13.1#7"],
      ["13.08-cover-invalid-for-published.yaml", "13.1#8"],
      ["13.13-invalid-status.yaml", "13.1#13"],
      ["13.14-missing-published-at.yaml", "13.1#14"],
    ] as const) {
      const result = compose(corpus, {
        galleries: [...corpus.galleries, ...galleryFixture(fixture)],
      });
      expect(RULES(result), fixture).toContain(rule);
      expect(result.ok, fixture).toBe(false);
    }
  });

  test("13.1#9 — Gallery place reference to a nonexistent Place rejected (context ALWAYS supplied)", async () => {
    const corpus = await loadCorpus();
    const result = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.09-place-reference-missing.yaml")],
    });
    expect(RULES(result)).toContain("13.1#9");
    expect(result.ok).toBe(false);
  });

  test("13.1#10 / #11 / #12 — next_gallery_id: missing target, self-loop, draft target in production", async () => {
    const corpus = await loadCorpus();
    const missing = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.10-next-target-missing.yaml")],
    });
    expect(RULES(missing)).toContain("13.1#10");

    const selfLoop = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.11-next-self-loop.yaml")],
    });
    expect(RULES(selfLoop)).toContain("13.1#11");

    // Draft target: ERROR in production …
    const draftTarget = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.12-next-targets-draft.yaml")],
    });
    expect(RULES(draftTarget)).toContain("13.1#12");
    expect(draftTarget.ok).toBe(false);
    // … but legal in preview (draft routes exist there, ADR-020).
    const draftTargetPreview = compose(corpus, {
      mode: "preview",
      galleries: [...corpus.galleries, ...galleryFixture("13.12-next-targets-draft.yaml")],
    });
    expect(RULES(draftTargetPreview)).not.toContain("13.1#12");
    expect(draftTargetPreview.ok).toBe(true);
  });

  test("allowed cycles pass production validation — A→B→C→A synthesized, corpus A→B→A + 5-cycle already green", async () => {
    const corpus = await loadCorpus();
    const a = syntheticGallery({
      id: "g_wp13_cycle_a",
      slug: "wp13-cycle-a",
      next_gallery_id: "g_wp13_cycle_b",
      cover_photo_id: "p_wp13_cycle_a1",
      photos: [
        {
          id: "p_wp13_cycle_a1",
          source_ref: "lofoten-polar-night/DSC02252.jpg",
          caption: null,
          rhythm_after: "base",
          alt_text: "WP-13 synthesized cycle photo A",
        },
      ],
    });
    const b = syntheticGallery({
      id: "g_wp13_cycle_b",
      slug: "wp13-cycle-b",
      next_gallery_id: "g_wp13_cycle_c",
      cover_photo_id: "p_wp13_cycle_b1",
      photos: [
        {
          id: "p_wp13_cycle_b1",
          source_ref: "lofoten-polar-night/DSC02262.jpg",
          caption: null,
          rhythm_after: "base",
          alt_text: "WP-13 synthesized cycle photo B",
        },
      ],
    });
    const c = syntheticGallery({
      id: "g_wp13_cycle_c",
      slug: "wp13-cycle-c",
      next_gallery_id: "g_wp13_cycle_a",
      cover_photo_id: "p_wp13_cycle_c1",
      photos: [
        {
          id: "p_wp13_cycle_c1",
          source_ref: "lofoten-polar-night/DSC02271.jpg",
          caption: null,
          rhythm_after: "base",
          alt_text: "WP-13 synthesized cycle photo C",
        },
      ],
    });
    const result = compose(corpus, {
      galleries: [
        ...corpus.galleries,
        ...[a, b, c].map((data) => ({ data, filePath: "synthetic-cycle" })),
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    // The composed navigation map carries the cycle untouched (cycles are legal, §9.3).
    expect(result.publishedDataSet.nextGalleryMap["g_wp13_cycle_a"]).toBe("g_wp13_cycle_b");
    expect(result.publishedDataSet.nextGalleryMap["g_wp13_cycle_b"]).toBe("g_wp13_cycle_c");
    expect(result.publishedDataSet.nextGalleryMap["g_wp13_cycle_c"]).toBe("g_wp13_cycle_a");
  });

  test("13.1#15 / 13.1#16 — invalid redirect entries and unresolved targets through the composed pass", async () => {
    const corpus = await loadCorpus();
    const invalid = compose(corpus, { redirects: redirectFixture("13.15-invalid-redirect.yaml") });
    expect(RULES(invalid)).toContain("13.1#15");

    // Ghost target: #15 (does not exist) in both modes + #16 (unresolved in production).
    const ghost = compose(corpus, {
      redirects: redirectFixture("13.16-redirect-target-unresolved.yaml"),
    });
    expect(RULES(ghost)).toContain("13.1#15");
    expect(RULES(ghost)).toContain("13.1#16");

    // Draft target: production error. The real archive has no drafts, so the
    // draft gallery is synthesized and the redirect points at it (the rule
    // under test is the redirect × draft interaction, not corpus membership).
    const draftGallery = syntheticGallery({
      id: "g_wp13_draft_target",
      slug: "wp13-draft-target",
      status: "draft",
      published_at: null,
    });
    const draftTargetRedirects: RedirectEntryInput[] = [
      {
        oldPath: "/galleries/draft-alias",
        data: { gallery_id: "g_wp13_draft_target" },
        filePath: "tests/fixtures/invalid/redirect-draft-target.yaml",
      },
    ];
    const draftTarget = compose(corpus, {
      galleries: [...corpus.galleries, { data: draftGallery, filePath: "synthetic-draft" }],
      redirects: draftTargetRedirects,
    });
    expect(RULES(draftTarget)).toContain("13.1#16");
    expect(draftTarget.ok).toBe(false);
    // … preview warning only (documented extrapolation token), never a failure.
    const draftTargetPreview = compose(corpus, {
      mode: "preview",
      galleries: [...corpus.galleries, { data: draftGallery, filePath: "synthetic-draft" }],
      redirects: draftTargetRedirects,
    });
    expect(RULES(draftTargetPreview)).not.toContain("13.1#16");
    expect(RULES(draftTargetPreview, "warning")).toContain("13.1#16-warn-draft-target");
    expect(draftTargetPreview.ok).toBe(true);
  });

  test("13.1#16 (composed place side) — redirect into a non-public Place fails production, passes preview", async () => {
    const corpus = await loadCorpus();
    // pl_tromso exists in content/places/ but NO published gallery references
    // it and NO photo-level place ref names it (R3 contract): no public
    // /places/{slug} route exists in production (§6/§8.3), so a redirect into
    // it is unresolved there (§13.1#16) — a rule only the COMPOSED gate can
    // see (WP-12's PlaceRedirectRef carries no publication state).
    // (pl_cologne became public via its two confirmed photo refs; tromso is
    // the corpus's remaining never-referenced place.)
    const tromsoAlias: RedirectEntryInput[] = [
      {
        oldPath: "/places/tromso-alias",
        data: { place_id: "pl_tromso" },
        filePath: "content/redirects.yaml",
      },
    ];
    const production = compose(corpus, { redirects: tromsoAlias });
    expect(RULES(production)).toContain("13.1#16");
    expect(production.ok).toBe(false);
    // Output contract: the finding names the SOURCE redirect file + field.
    const finding = production.errors.find((e) => e.rule === "13.1#16");
    expect(finding?.file).toBe("content/redirects.yaml");
    expect(finding?.field).toBe("place_id");
    expect(finding?.message).toContain("pl_tromso");

    // Preview: place routes exist for all places (ADR-020) — passes cleanly.
    const preview = compose(corpus, { mode: "preview", redirects: tromsoAlias });
    expect(RULES(preview)).not.toContain("13.1#16");
    expect(preview.ok).toBe(true);
    // The preview redirect resolution carries the route (draft-friendly).
    expect(preview.publishedDataSet.redirects.map((r) => r.destination)).toContain(
      "/places/tromso",
    );
  });

  test("gallery slug vs place slug: /galleries/ and /places/ namespaces are independent (§12) — NOT a collision", async () => {
    const corpus = await loadCorpus();
    // "lofoten" is a real Place slug and NOT a gallery slug: the same name in
    // both namespaces must not collide (§12).
    const result = compose(corpus, {
      galleries: [
        ...corpus.galleries,
        { data: syntheticGallery({ slug: "lofoten" }), filePath: "synthetic-namespace" },
      ],
    });
    expect(RULES(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("orphan metadata keys (§4.3 forbidden fields / unknown keys) rejected through the composed pass", async () => {
    const corpus = await loadCorpus();
    const result = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("4.3-forbidden-featured.yaml")],
    });
    expect(RULES(result)).toContain("4.3:forbidden-field");
    expect(result.ok).toBe(false);
  });

  test("13.1#18 — derivative coverage enforced against the supplied asset manifest", async () => {
    const corpus = await loadCorpus();
    // Complete manifest: every published Photo carries every §10.3 purpose → green.
    const purposes = ["gallery_display", "overview", "cover"];
    const completeRows = compose(corpus).publishedDataSet.galleries.flatMap((g) =>
      g.photos.flatMap((p) => purposes.map((purpose) => ({ photo_id: p.id, purpose }))),
    );
    const green = compose(corpus, { assetManifest: { rows: completeRows } });
    expect(RULES(green)).not.toContain("13.1#18");
    expect(green.ok).toBe(true);

    // Incomplete manifest: one published Photo misses the 'overview' purpose → #18.
    const brokenRows = completeRows.filter(
      (r) => !(r.photo_id === "p_lofoten_polar_night_001" && r.purpose === "overview"),
    );
    const broken = compose(corpus, { assetManifest: { rows: brokenRows } });
    expect(RULES(broken)).toContain("13.1#18");
    const finding = broken.errors.find((e) => e.rule === "13.1#18");
    expect(finding?.message).toContain("overview");
    expect(broken.ok).toBe(false);
  });

  test("asset manifest absent: production gate warns (context:asset-manifest-absent) — the P3 wiring point", async () => {
    const result = compose(await loadCorpus(), { assetManifest: undefined });
    expect(result.ok).toBe(true);
    expect(RULES(result, "warning")).toContain("context:asset-manifest-absent");
  });
});

// ---------------------------------------------------------------------------
// The closed fail-open guard + deterministic ordering + output contract
// ---------------------------------------------------------------------------

describe("WP-13 guard and determinism", () => {
  test("FAIL-OPEN GUARD: production mode without ingestRoot is an ERROR, never a silent skip", async () => {
    const result = compose(await loadCorpus(), { ingestRoot: undefined });
    expect(RULES(result)).toContain("context:ingest-root-required");
    expect(result.ok).toBe(false);
  });

  test("preview mode without ingestRoot stays draft-friendly (no guard error)", async () => {
    const result = compose(await loadCorpus(), { mode: "preview", ingestRoot: undefined });
    expect(RULES(result)).not.toContain("context:ingest-root-required");
    expect(result.ok).toBe(true);
  });

  test("deterministic total order: (file, rule, field, message) — input permutation does not change findings", async () => {
    const corpus = await loadCorpus();
    // Two ORDER-INDEPENDENT violations (each attributed to its own gallery —
    // duplicate-style rules attribute to the second occurrence by design, so
    // they are not permutation-invariant; real loaders feed sorted input).
    const danglingNext = galleryFixture("13.10-next-target-missing.yaml");
    const missingPublishedAt = galleryFixture("13.14-missing-published-at.yaml");
    const normal = compose(corpus, {
      galleries: [...corpus.galleries, ...danglingNext, ...missingPublishedAt],
    });
    const reversed = compose(corpus, {
      galleries: [
        ...[...corpus.galleries].reverse(),
        ...[...missingPublishedAt].reverse(),
        ...[...danglingNext].reverse(),
      ],
      places: [...corpus.places].reverse(),
      redirects: [...corpus.redirects].reverse(),
    });
    expect(normal.errors).toEqual(reversed.errors);
    expect(normal.warnings).toEqual(reversed.warnings);
    // Documented total order.
    const keys = (r: ArchiveValidationResult) =>
      r.errors.map((e) => `${e.file ?? ""}|${e.rule}|${e.field ?? ""}|${e.message}`);
    expect(keys(normal)).toEqual([...keys(normal)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  test("error output contract: every finding carries rule + file + field where applicable", async () => {
    const corpus = await loadCorpus();
    const result = compose(corpus, {
      galleries: [...corpus.galleries, ...galleryFixture("13.17-route-collision.yaml")],
    });
    for (const issue of result.errors) {
      expect(issue.rule).toMatch(/^(13\.1#\d+|13\.2#|4\.3:|context:|10\.|WP-42:)/);
      expect(typeof issue.message).toBe("string");
    }
    const lines = formatArchiveIssues(result.errors);
    expect(lines.length).toBe(result.errors.length);
    expect(lines[0]).toMatch(/ERROR \[/);
  });
});

// ---------------------------------------------------------------------------
// Standalone CLI — scripts/validate/content.ts
// ---------------------------------------------------------------------------

describe("WP-13 CLI (npm run validate:content)", () => {
  const CLI = fileURLToPath(new URL("../../scripts/validate/content.ts", import.meta.url));
  const REGISTER = fileURLToPath(
    new URL("../../scripts/validate/register-ts-resolve.mjs", import.meta.url),
  );

  function runCli(args: string[], cwd = REPO_ROOT): { status: number; stdout: string } {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--import", REGISTER, CLI, ...args],
      { cwd, encoding: "utf8", timeout: 120_000 },
    );
    return { status: result.status ?? -1, stdout: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  }

  test(
    "production mode over the REAL corpus exits 0 and reports zero errors",
    { timeout: 120_000 },
    () => {
      const run = runCli(["--mode", "production", "--content-root", REPO_ROOT]);
      expect(run.status, run.stdout).toBe(0);
      expect(run.stdout).toContain("0 errors");
    },
  );

  test("preview mode over the real corpus exits 0 (no drafts => no §13.2 warnings)", { timeout: 120_000 }, () => {
    const run = runCli(["--mode", "preview", "--content-root", REPO_ROOT]);
    expect(run.status, run.stdout).toBe(0);
    expect(run.stdout).not.toContain("13.2#warn-missing-published-at");
  });

  test(
    "a synthesized archive with an invalid fixture exits 1 with the precise rule ID",
    { timeout: 120_000 },
    () => {
      const root = join(tmpdir(), `wp13-cli-${Date.now()}-${process.pid}`);
      mkdirSync(join(root, "content/galleries/tmp-a"), { recursive: true });
      mkdirSync(join(root, "content/galleries/tmp-b"), { recursive: true });
      mkdirSync(join(root, "content/places"), { recursive: true });
      mkdirSync(join(root, "content/site"), { recursive: true });
      mkdirSync(join(root, "media/ingest-masters/tmp-a"), { recursive: true });
      writeFileSync(join(root, "media/ingest-masters/tmp-a/master.jpg"), "bytes");
      writeFileSync(
        join(root, "content/galleries/tmp-a/meta.yaml"),
        [
          "id: g_tmp_a",
          "slug: tmp-a",
          "status: published",
          'title: "Tmp A"',
          'photographed_start: "2025-01-01"',
          'photographed_end: "2025-01-02"',
          'published_at: "2026-08-29T00:00:00Z"',
          "places:",
          "  - pl_tmp",
          "cover_photo_id: p_tmp_a1",
          "photos:",
          "  - id: p_tmp_a1",
          "    source_ref: tmp-a/master.jpg",
          "    caption: null",
          "    rhythm_after: base",
          '    alt_text: "WP-13 CLI fixture photo A"',
        ].join("\n"),
      );
      // Gallery B: next_gallery_id dangles → §13.1#10.
      writeFileSync(
        join(root, "content/galleries/tmp-b/meta.yaml"),
        [
          "id: g_tmp_b",
          "slug: tmp-b",
          "status: published",
          'title: "Tmp B"',
          'photographed_start: "2025-01-01"',
          'photographed_end: "2025-01-02"',
          'published_at: "2026-08-29T00:00:00Z"',
          "places:",
          "  - pl_tmp",
          "cover_photo_id: p_tmp_b1",
          "next_gallery_id: g_ghost",
          "photos:",
          "  - id: p_tmp_b1",
          "    source_ref: tmp-a/master.jpg",
          "    caption: null",
          "    rhythm_after: base",
          '    alt_text: "WP-13 CLI fixture photo B"',
        ].join("\n"),
      );
      writeFileSync(
        join(root, "content/places/tmp-place.yaml"),
        ["id: pl_tmp", "slug: tmp-place", 'name: "Tmp Place"'].join("\n"),
      );
      writeFileSync(join(root, "content/site/home.yaml"), "featured_gallery_id: null\n");
      writeFileSync(join(root, "content/redirects.yaml"), "{}\n");

      try {
        const run = runCli([
          "--mode",
          "production",
          "--content-root",
          root,
          "--ingest-root",
          join(root, "media/ingest-masters"),
        ]);
        expect(run.status, run.stdout).toBe(1);
        expect(run.stdout).toContain("[13.1#10]");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});

// ---------------------------------------------------------------------------
// astro build gate — scripts/validate/astro-gate.mjs (env-driven mode, §6)
// ---------------------------------------------------------------------------

describe("WP-13 astro build gate", () => {
  const GATE = fileURLToPath(new URL("../../scripts/validate/astro-gate.mjs", import.meta.url));

  async function loadGate(): Promise<{
    contentValidationGate: () => {
      name: string;
      hooks: Record<string, (ctx?: unknown) => void>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveGatePlan: (env: Record<string, string | undefined>) => any;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await import(GATE)) as any;
  }

  function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
    const saved = { ...process.env };
    try {
      for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      fn();
    } finally {
      process.env = saved;
    }
  }

  test("mode selection is environment configuration, NEVER content inspection (§6)", async () => {
    const gate = await loadGate();
    expect(gate.resolveGatePlan({}).mode).toBe("production"); // fail-closed default
    expect(gate.resolveGatePlan({ ASTRO_PRODUCTION_VALIDATE: "1" }).mode).toBe("production");
    expect(gate.resolveGatePlan({ ASTRO_PREVIEW_MODE: "1" }).mode).toBe("preview");
    expect(
      gate.resolveGatePlan({ ASTRO_PRODUCTION_VALIDATE: "1", ASTRO_PREVIEW_MODE: "1" }).error,
    ).toBeTruthy();
  });

  test("unrecognized truthy env values never silently change the mode — explicit warning", async () => {
    const gate = await loadGate();
    // A near-miss like =true is treated as UNSET (fail-closed default holds),
    // and the near-miss is reported, never swallowed.
    const plan = gate.resolveGatePlan({ ASTRO_PREVIEW_MODE: "true" });
    expect(plan.mode).toBe("production");
    expect(plan.error).toBeNull();
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("ASTRO_PREVIEW_MODE='true' is not recognized");
    // "0" is the explicit-off spelling — no warning.
    expect(gate.resolveGatePlan({ ASTRO_PREVIEW_MODE: "0" }).warnings).toEqual([]);
    expect(gate.resolveGatePlan({ ASTRO_PRODUCTION_VALIDATE: "1" }).warnings).toEqual([]);
  });

  test(
  "gate hook passes on the clean corpus and aborts on a broken archive",
  { timeout: 120_000 },
  async () => {
    const brokenRoot = join(tmpdir(), `wp13-gate-${Date.now()}-${process.pid}`);
    // A content root whose redirects.yaml target is a draft gallery → production error.
    mkdirSync(join(brokenRoot, "content/galleries/draft-one"), { recursive: true });
    mkdirSync(join(brokenRoot, "content/places"), { recursive: true });
    mkdirSync(join(brokenRoot, "content/site"), { recursive: true });
    mkdirSync(join(brokenRoot, "media/ingest-masters/draft-one"), { recursive: true });
    writeFileSync(join(brokenRoot, "media/ingest-masters/draft-one/m.jpg"), "bytes");
    writeFileSync(
      join(brokenRoot, "content/galleries/draft-one/meta.yaml"),
      [
        "id: g_draft_one",
        "slug: draft-one",
        "status: draft",
        'title: "Draft One"',
        'photographed_start: "2025-01-01"',
        'photographed_end: "2025-01-02"',
        "places:",
        "  - pl_tmp",
        "photos:",
        "  - id: p_draft_one",
        "    source_ref: draft-one/m.jpg",
        "    caption: null",
        "    rhythm_after: base",
        "    alt_text: null",
      ].join("\n"),
    );
    writeFileSync(
      join(brokenRoot, "content/places/tmp-place.yaml"),
      ["id: pl_tmp", "slug: tmp-place", 'name: "Tmp Place"'].join("\n"),
    );
    writeFileSync(join(brokenRoot, "content/site/home.yaml"), "featured_gallery_id: null\n");
    writeFileSync(
      join(brokenRoot, "content/redirects.yaml"),
      "/galleries/draft-alias:\n  gallery_id: g_draft_one\n",
    );

    try {
      const g = (await loadGate()).contentValidationGate();
      withEnv(
        { ASTRO_VALIDATE_ASSET_MANIFEST: undefined, ASTRO_VALIDATE_CONTENT_ROOT: undefined },
        () => {
          g.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
          expect(() => g.hooks["astro:build:start"]()).not.toThrow();
        },
      );
      withEnv(
        { ASTRO_VALIDATE_ASSET_MANIFEST: undefined, ASTRO_VALIDATE_CONTENT_ROOT: undefined },
        () => {
          // Isolated fixture: the temporary root IS this test instance's canonical root.
          g.hooks["astro:config:done"]({ config: { root: pathToFileURL(brokenRoot) } });
          expect(() => g.hooks["astro:build:start"]()).toThrow(/13\.1#16/);
        },
      );
    } finally {
      rmSync(brokenRoot, { recursive: true, force: true });
    }
    },
  );
});
