// WP-09 unit tests — Gallery + Photo schemas and identity validation.
// Requirements: the frozen WP-09 brief (.superpowers/sdd/PRODUCTION_IMPLEMENTATION_PLAN/
// wp-09-brief.md) RED set; authority research/production-architecture/CONTENT_MODEL.md
// §3–§5, §8, §13.1/§13.2; SOURCE_OF_TRUTH_MATRIX.md §2/§6.
//
// Invalid inputs come from the WP-08 fixture library (tests/fixtures/invalid/),
// keyed by CONTENT_MODEL §13.1 rule numbers / §4.2 §4.3 §5.2 contracts. One case
// is synthesized in-test because no fixture exists for it (WP-08 handoff fact):
// a published Gallery missing cover_photo_id (13.08 encodes the foreign-photo
// sub-case of the same rule §13.1#8).
//
// These are module tests: src/content-schemas.ts and src/lib/validate/gallery.ts
// are exercised directly (no loader, no filesystem except an explicit tmp
// WEB INGEST MASTER root for the §13.1#1 test).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadAll } from "js-yaml";
import { describe, expect, test } from "vitest";
import { gallerySchema } from "../../src/content-schemas";
import {
  validateGalleries,
  type GalleryEntryInput,
  type GalleryValidationIssue,
} from "../../src/lib/validate/gallery";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));

/** Loads a (possibly multi-document) invalid fixture into raw YAML documents. */
function loadFixture(name: string): Record<string, unknown>[] {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf8");
  return loadAll(raw) as Record<string, unknown>[];
}

function entriesOf(docs: Record<string, unknown>[]): GalleryEntryInput[] {
  return docs.map((data, i) => ({ data, filePath: `fixture:doc${i + 1}` }));
}

function validateDocs(
  docs: Record<string, unknown>[],
  options: Partial<Parameters<typeof validateGalleries>[1]> = {},
) {
  return validateGalleries(entriesOf(docs), { mode: "production", ...options });
}

function rulesOf(issues: GalleryValidationIssue[]): string[] {
  return issues.map((i) => i.rule);
}

/** A complete, valid PUBLISHED gallery (CONTENT_MODEL §4.1 shape, 2 photos). */
function validPublished(): Record<string, unknown> {
  return {
    id: "g_valid_unit",
    slug: "valid-unit-gallery",
    status: "published",
    title: "Valid Unit Gallery",
    description: "Two frames used by unit tests.",
    photographed_start: "2025-02-01",
    photographed_end: "2025-02-07",
    published_at: "2026-08-29T00:00:00Z",
    places: ["pl_reine"],
    cover_photo_id: "p_valid_unit_001",
    photos: [
      {
        id: "p_valid_unit_001",
        source_ref: "unit-fixtures/one.jpg",
        caption: null,
        rhythm_after: "base",
        alt_text: null,
      },
      {
        id: "p_valid_unit_002",
        source_ref: "unit-fixtures/two.jpg",
        caption: "A caption.",
        rhythm_after: "compact",
        alt_text: null,
      },
    ],
  };
}

/** A valid DRAFT gallery: legally omits cover_photo_id and published_at (§8.3). */
function validDraft(): Record<string, unknown> {
  const draft = validPublished() as Record<string, unknown>;
  draft.id = "g_valid_draft";
  draft.slug = "valid-draft-gallery";
  draft.status = "draft";
  delete draft.cover_photo_id;
  delete draft.published_at;
  return draft;
}

/** Extracts the rule token prefix ("[13.1#8] ...") from a message. */
function ruleToken(message: string): string | null {
  const m = /^\[([^\]]+)\]/.exec(message);
  return m ? (m[1] as string) : null;
}

describe("WP-09 RED: duplicate identity rules (§13.1#2–#4)", () => {
  test("duplicate Gallery ID rejected (fixture 13.02, rule 13.1#2)", () => {
    const docs = loadFixture("13.02-duplicate-gallery-id.yaml");
    expect(docs).toHaveLength(2);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#2");
    const err = result.errors.find((e) => e.rule === "13.1#2");
    expect(err?.message).toContain("g_bad_13_02");
  });

  test("duplicate Gallery slug rejected (fixture 13.03, rule 13.1#3)", () => {
    const docs = loadFixture("13.03-duplicate-gallery-slug.yaml");
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#3");
    const err = result.errors.find((e) => e.rule === "13.1#3");
    expect(err?.message).toContain("invalid-dup-slug");
  });

  test("duplicate Photo ID across galleries rejected (fixture 13.04, rule 13.1#4)", () => {
    const docs = loadFixture("13.04-duplicate-photo-id.yaml");
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#4");
    const err = result.errors.find((e) => e.rule === "13.1#4");
    expect(err?.message).toContain("p_bad_13_04_shared");
    expect(err?.message).toContain("g_bad_13_04_a");
    expect(err?.message).toContain("g_bad_13_04_b");
  });

  test("duplicate Photo ID within one gallery rejected (synthesized, rule 13.1#4)", () => {
    const g = validPublished();
    (g.photos as Record<string, unknown>[])[1].id = "p_valid_unit_001";
    const result = validateDocs([g]);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#4");
  });
});

describe("WP-09 RED: photo item contracts (§13.1#7, §5.2, §4.2)", () => {
  test("empty source_ref rejected (fixture 13.07, rule 13.1#7)", () => {
    const docs = loadFixture("13.07-photo-source-ref-empty.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#7")).toBe(true);
    }
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#7");
    expect(err?.photo).toBe("p_bad_13_07_001");
  });

  test("missing source_ref key rejected the same way (synthesized, rule 13.1#7)", () => {
    const g = validPublished();
    delete (g.photos as Record<string, unknown>[])[0].source_ref;
    const parsed = gallerySchema.safeParse(g);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#7")).toBe(true);
    }
  });

  test("source_ref must be relative to media/ingest-masters/ (SOTM §1, §5.2)", () => {
    for (const bad of ["/abs/path/DSC00000.jpg", "C:\\win\\path.jpg", "../escape.jpg"]) {
      const g = validPublished();
      (g.photos as Record<string, unknown>[])[0].source_ref = bad;
      const parsed = gallerySchema.safeParse(g);
      expect(parsed.success, `source_ref ${bad} must fail`).toBe(false);
    }
  });

  test("invalid status rejected (fixture 13.13, rule 13.1#13)", () => {
    const docs = loadFixture("13.13-invalid-status.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#13")).toBe(true);
    }
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#13");
  });

  test("rhythm_after: spacious rejected (fixture 5.2, §5.2 enum)", () => {
    const docs = loadFixture("5.2-rhythm-after-spacious.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "5.2:rhythm-enum");
    expect(err).toBeDefined();
    expect(err?.photo).toBe("p_bad_rhythm_spacious_001");
    expect(err?.gallery).toBe("g_bad_rhythm_spacious");
  });

  test("rhythm_after omitted defaults to base (§5.2)", () => {
    const g = validPublished();
    delete (g.photos as Record<string, unknown>[])[0].rhythm_after;
    const parsed = gallerySchema.parse(g);
    const photos = parsed.photos as Array<Record<string, unknown>>;
    expect(photos[0].rhythm_after).toBe("base");
  });

  test("caption explicit-null / absent / empty-string are distinct and all valid (§5.2)", () => {
    const g = validPublished();
    const photos = g.photos as Array<Record<string, unknown>>;
    photos[0].caption = null; // explicit null = no caption
    delete photos[1].caption; // absent = no reserved caption space
    const parsed = gallerySchema.parse(g) as { photos: Array<Record<string, unknown>> };
    expect("caption" in parsed.photos[0]).toBe(true);
    expect(parsed.photos[0].caption).toBeNull();
    expect("caption" in parsed.photos[1]).toBe(false);

    const g2 = validPublished();
    (g2.photos as Array<Record<string, unknown>>)[0].caption = "";
    expect(gallerySchema.safeParse(g2).success).toBe(true); // empty string is a string
  });

  test("alt_text string and null both accepted (§5.2 schema support)", () => {
    const g = validPublished();
    (g.photos as Array<Record<string, unknown>>)[0].alt_text = "A described frame.";
    expect(gallerySchema.safeParse(g).success).toBe(true);
  });

  test("empty photos[] rejected (fixture 4.2-photos-empty, §4.2)", () => {
    const docs = loadFixture("4.2-photos-empty.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("4.2:photos-nonempty");
  });

  test("photographed_start > photographed_end rejected (fixture 4.2, §4.2 start <= end)", () => {
    const docs = loadFixture("4.2-photographed-start-after-end.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("4.2:photographed-range");
  });

  test("empty or missing title rejected; places[] must have at least one entry (§4.2)", () => {
    const noTitle = validPublished();
    noTitle.title = "";
    expect(gallerySchema.safeParse(noTitle).success).toBe(false);

    const noPlaces = validPublished();
    delete noPlaces.places;
    expect(gallerySchema.safeParse(noPlaces).success).toBe(false);

    const emptyPlaces = validPublished();
    emptyPlaces.places = [];
    expect(gallerySchema.safeParse(emptyPlaces).success).toBe(false);
  });
});

describe("WP-09 RED: forbidden fields (§4.3, strict object shape)", () => {
  const cases: Array<[fixture: string, field: string]> = [
    ["4.3-forbidden-prev-gallery.yaml", "prev_gallery_id"],
    ["4.3-forbidden-featured.yaml", "is_featured"],
    ["4.3-forbidden-title-cjk.yaml", "title_cjk"],
    ["4.3-forbidden-parallel-maps.yaml", "captions"],
    ["4.3-forbidden-has-continuation.yaml", "has_continuation"],
  ];

  for (const [fixture, field] of cases) {
    test(`forbidden field rejected: ${field} (fixture ${fixture})`, () => {
      const docs = loadFixture(fixture);
      const parsed = gallerySchema.safeParse(docs[0]);
      expect(parsed.success, `${field} must not parse`).toBe(false);
      const result = validateDocs(docs);
      expect(result.ok).toBe(false);
      const err = result.errors.find((e) => e.rule === "4.3:forbidden-field");
      expect(err, `expected a §4.3 finding for ${fixture}`).toBeDefined();
      expect(err?.message).toContain(field);
      // The parallel-maps fixture carries two banned keys (captions, rhythms);
      // the finding names them all, so assert containment rather than equality.
      expect(err?.field).toContain(field);
    });
  }

  test("remaining enumerated forbidden fields rejected (synthesized)", () => {
    for (const field of [
      "prev_gallery",
      "featured",
      "is_curated",
      "photographed_date_label",
      "rhythms",
    ]) {
      const g = validPublished();
      g[field] = "banned";
      const parsed = gallerySchema.safeParse(g);
      expect(parsed.success, `${field} must not parse`).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
        expect(issue, `expected a strict-shape issue for ${field}`).toBeDefined();
        expect(issue?.message).toContain(field);
        expect(ruleToken(issue?.message ?? "")).toBe("4.3:forbidden-field");
      }
    }
  });

  test("unknown/orphan keys rejected (strict shape, P2 scope)", () => {
    const g = validPublished();
    g.editor_notes = "not part of the canonical schema";
    const parsed = gallerySchema.safeParse(g);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
      expect(issue?.message).toContain("editor_notes");
      expect(ruleToken(issue?.message ?? "")).toBe("4.3:unknown-field");
    }
    // Photo items are strict too (derived/generated properties are never authored, §5.4).
    const g2 = validPublished();
    (g2.photos as Record<string, unknown>[])[0].dimensions = "1024x768";
    const parsed2 = gallerySchema.safeParse(g2);
    expect(parsed2.success).toBe(false);
  });
});

describe("WP-09 RED: published lifecycle (§13.1#8, §13.1#14)", () => {
  test("published Gallery missing published_at fails (fixture 13.14, rule 13.1#14)", () => {
    const docs = loadFixture("13.14-missing-published-at.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#14")).toBe(true);
    }
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#14");
    expect(result.errors.find((e) => e.rule === "13.1#14")?.gallery).toBe("g_bad_13_14");
  });

  test("published Gallery missing cover_photo_id fails (SYNTHESIZED — no fixture, rule 13.1#8)", () => {
    const g = validPublished();
    delete g.cover_photo_id;
    const parsed = gallerySchema.safeParse(g);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#8")).toBe(true);
    }
    // Fails in BOTH modes (published requirements are not mode-conditional).
    for (const mode of ["preview", "production"] as const) {
      const result = validateGalleries([{ data: g, filePath: "synthesized" }], { mode });
      expect(result.ok, `${mode}: published without cover must fail`).toBe(false);
      expect(rulesOf(result.errors)).toContain("13.1#8");
    }
  });

  test("cover_photo_id referencing a Photo outside the Gallery fails (fixture 13.08, rule 13.1#8)", () => {
    const docs = loadFixture("13.08-cover-invalid-for-published.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#8")).toBe(true);
    }
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#8");
  });

  test("invalid published_at format fails even when present (§4.2 ISO-8601)", () => {
    const g = validPublished();
    g.published_at = "August 29, 2026";
    expect(gallerySchema.safeParse(g).success).toBe(false);
  });
});

describe("WP-09 RED: navigation (§13.1#10–#12)", () => {
  test("dangling next_gallery_id rejected (fixture 13.10, rule 13.1#10)", () => {
    const docs = loadFixture("13.10-next-target-missing.yaml");
    for (const mode of ["preview", "production"] as const) {
      const result = validateDocs(docs, { mode });
      expect(result.ok, `${mode}: dangling next must fail`).toBe(false);
      expect(rulesOf(result.errors)).toContain("13.1#10");
    }
  });

  test("next_gallery_id self-loop rejected (fixture 13.11, rule 13.1#11)", () => {
    const docs = loadFixture("13.11-next-self-loop.yaml");
    const parsed = gallerySchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => ruleToken(i.message) === "13.1#11")).toBe(true);
    }
  });

  test("published → draft next target: production error, preview allowed (fixture 13.12, rule 13.1#12)", () => {
    const docs = loadFixture("13.12-next-targets-draft.yaml");
    const production = validateDocs(docs, { mode: "production" });
    expect(production.ok).toBe(false);
    expect(rulesOf(production.errors)).toContain("13.1#12");

    const preview = validateDocs(docs, { mode: "preview" });
    expect(preview.ok, "preview mode allows a published gallery to point at a draft").toBe(true);
    expect(rulesOf(preview.errors)).not.toContain("13.1#12");
  });

  test("next_gallery_id cycles remain legal (§9.3, no acyclicity test)", () => {
    // Published A→B→A pair, as in the authored corpus (red-lanterns ↔
    // tromso-city-nights): cycles are valid authored continuation structure.
    const a = validPublished();
    const b = validPublished();
    a.id = "g_cycle_a";
    a.slug = "cycle-a";
    b.id = "g_cycle_b";
    b.slug = "cycle-b";
    (a.photos as Array<Record<string, unknown>>).forEach((photo, i) => {
      photo.id = `p_cycle_a_${String(i + 1).padStart(3, "0")}`;
    });
    (b.photos as Array<Record<string, unknown>>).forEach((photo, i) => {
      photo.id = `p_cycle_b_${String(i + 1).padStart(3, "0")}`;
    });
    b.cover_photo_id = "p_cycle_b_001";
    a.cover_photo_id = "p_cycle_a_001";
    a.next_gallery_id = "g_cycle_b";
    b.next_gallery_id = "g_cycle_a";
    for (const mode of ["preview", "production"] as const) {
      const result = validateDocs([a, b], { mode });
      expect(result.errors, `${mode}: A→B→A cycle is valid`).toEqual([]);
      expect(result.ok, `${mode}: A→B→A cycle is valid`).toBe(true);
    }
  });

  test("§13.1#12 scope: any gallery pointing at a draft errors in production (§9.2 'any Gallery')", () => {
    // The literal §9.2/§13.1#12 condition is on the TARGET's status in a
    // production build, regardless of the source gallery's own status.
    const source = validDraft();
    const target = validDraft();
    source.id = "g_draft_next_src";
    source.slug = "draft-next-src";
    target.id = "g_draft_next_tgt";
    target.slug = "draft-next-tgt";
    (target.photos as Array<Record<string, unknown>>).forEach((photo, i) => {
      photo.id = `p_draft_next_${String(i + 1).padStart(3, "0")}`;
    });
    source.next_gallery_id = "g_draft_next_tgt";
    const production = validateDocs([source, target], { mode: "production" });
    expect(rulesOf(production.errors)).toContain("13.1#12");
    const preview = validateDocs([source, target], { mode: "preview" });
    expect(preview.ok).toBe(true);
  });
});

describe("WP-09 RED: cross-references (§13.1#9, §13.1#1)", () => {
  const CORPUS_PLACE_IDS = new Set([
    "pl_reine",
    "pl_nanchang",
    "pl_cologne",
    "pl_essen",
    "pl_thun",
    "pl_tromso",
    "pl_springfield_il",
    "pl_springfield_mo",
  ]);

  test("place reference missing rejected (fixture 13.09, rule 13.1#9)", () => {
    const docs = loadFixture("13.09-place-reference-missing.yaml");
    const result = validateDocs(docs, { knownPlaceIds: CORPUS_PLACE_IDS });
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#9");
    expect(err?.message).toContain("pl_bad_ghost");
    expect(err?.gallery).toBe("g_bad_13_09");
  });

  test("place check is skipped when no place IDs are supplied (composition contract)", () => {
    const docs = loadFixture("13.09-place-reference-missing.yaml");
    const result = validateDocs(docs);
    expect(result.ok).toBe(true);
  });

  test("missing WEB INGEST MASTER rejected (rule 13.1#1) against a real master root", () => {
    const root = mkdtempSync(join(tmpdir(), "wp09-masters-"));
    writeFileSync(join(root, "exists.jpg"), "jpg-bytes");

    const ok = validDraft();
    (ok.photos as Array<Record<string, unknown>>)[0].source_ref = "exists.jpg";
    (ok.photos as Array<Record<string, unknown>>).splice(1, 1);

    const missing = validDraft();
    missing.id = "g_missing_master";
    missing.slug = "missing-master";
    (missing.photos as Array<Record<string, unknown>>)[0].source_ref = "ghost/DSC00000.jpg";
    (missing.photos as Array<Record<string, unknown>>).splice(1, 1);

    const result = validateGalleries(
      [
        { data: ok, filePath: "synthesized-ok" },
        { data: missing, filePath: "synthesized-missing" },
      ],
      { mode: "production", ingestRoot: root },
    );
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#1");
    expect(err).toBeDefined();
    expect(err?.gallery).toBe("g_missing_master");
    expect(err?.message).toContain("ghost/DSC00000.jpg");
  });
});

describe("WP-09 RED: §13.2 warnings and the preview/production mode switch", () => {
  test("draft omitting cover and published_at passes preview with warnings; production passes without errors", () => {
    const draft = validDraft();
    const preview = validateGalleries([{ data: draft, filePath: "draft" }], { mode: "preview" });
    expect(preview.ok).toBe(true);
    expect(rulesOf(preview.warnings)).toContain("13.2#warn-missing-cover");
    expect(rulesOf(preview.warnings)).toContain("13.2#warn-missing-published-at");

    const production = validateGalleries([{ data: draft, filePath: "draft" }], {
      mode: "production",
    });
    expect(production.ok, "draft omission is never a production failure (§8.3)").toBe(true);
  });

  test("published Gallery missing cover/published_at fails production mode (mode switch)", () => {
    const noCover = validPublished();
    delete noCover.cover_photo_id;
    const noPublishedAt = validPublished();
    noPublishedAt.id = "g_no_published_at";
    noPublishedAt.slug = "no-published-at";
    delete noPublishedAt.published_at;

    const result = validateGalleries(
      [
        { data: noCover, filePath: "no-cover" },
        { data: noPublishedAt, filePath: "no-published-at" },
      ],
      { mode: "production" },
    );
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#8");
    expect(rulesOf(result.errors)).toContain("13.1#14");
  });

  test("§13.2 warning fixtures emit warnings in preview and never errors (fixtures 13.2-warn-*)", () => {
    const cases: Array<[fixture: string, rule: string]> = [
      ["13.2-warn-missing-cover-draft.yaml", "13.2#warn-missing-cover"],
      ["13.2-warn-missing-published-at-draft.yaml", "13.2#warn-missing-published-at"],
      ["13.2-warn-missing-description.yaml", "13.2#warn-missing-description"],
      ["13.2-warn-single-photo.yaml", "13.2#warn-single-photo"],
    ];
    for (const [fixture, rule] of cases) {
      const docs = loadFixture(fixture);
      const preview = validateDocs(docs, { mode: "preview" });
      expect(preview.ok, `${fixture} must stay VALID (warnings only)`).toBe(true);
      expect(rulesOf(preview.warnings), `${fixture} must warn in preview`).toContain(rule);

      const production = validateDocs(docs, { mode: "production" });
      expect(production.ok, `${fixture} must stay valid in production too`).toBe(true);
    }
  });

  test("warnings can never pass broken published content (§13.2 guard)", () => {
    // Published gallery with a §13.2 warning condition (missing description)
    // AND a real §13.1 violation (missing published_at): must fail production.
    const broken = validPublished();
    delete broken.description;
    delete broken.published_at;
    const production = validateGalleries([{ data: broken, filePath: "broken" }], {
      mode: "production",
    });
    expect(production.ok).toBe(false);
    expect(rulesOf(production.errors)).toContain("13.1#14");
  });
});

describe("WP-09 RED: wiring", () => {
  test("src/content.config.ts wires the real gallery schema (placeholder gone for galleries)", () => {
    const configSrc = readFileSync(
      fileURLToPath(new URL("../../src/content.config.ts", import.meta.url)),
      "utf8",
    );
    // The galleries collection block must no longer carry the WP-03 placeholder
    // note (the places block legitimately still does — WP-10 owns placeSchema).
    const galleriesBlock = /const galleries = defineCollection\(\{[\s\S]*?\}\);/.exec(configSrc);
    expect(galleriesBlock).toBeDefined();
    expect(galleriesBlock?.[0]).not.toContain("PLACEHOLDER");

    const schemasSrc = readFileSync(
      fileURLToPath(new URL("../../src/content-schemas.ts", import.meta.url)),
      "utf8",
    );
    const gallerySchemaBlock = /export const gallerySchema[\s\S]*?^export type Gallery/m.exec(
      schemasSrc,
    );
    expect(gallerySchemaBlock).toBeDefined();
    expect(gallerySchemaBlock?.[0]).not.toContain("PLACEHOLDER");
  });
});

// ---------------------------------------------------------------------------
// R3 photo-level place references (13.1#19)
// ---------------------------------------------------------------------------

describe("R3 photo-level place refs (13.1#19)", () => {
  test("photo place referencing an unknown Place ID is rejected", () => {
    const g = validPublished() as Record<string, unknown>;
    (g.photos as Array<Record<string, unknown>>)[0].place = "pl_bad_ghost";
    const result = validateDocs([g], {
      knownPlaceIds: new Set(["pl_amsterdam", "pl_reine"]),
    });
    expect(result.ok).toBe(false);
    
    const err = result.errors.find((e) => e.rule === "13.1#19");
    expect(err?.message).toContain("pl_bad_ghost");
    expect(err?.message).toContain("p_");
  });

  test("photo place referencing a known Place ID passes; absent stays valid", () => {
    const g = validPublished() as Record<string, unknown>;
    (g.photos as Array<Record<string, unknown>>)[0].place = "pl_amsterdam";
    (g.photos as Array<Record<string, unknown>>)[0].captured_at = "2024-07-13T09:04:26";
    const result = validateDocs([g], {
      knownPlaceIds: new Set(["pl_amsterdam", "pl_reine"]),
    });
    expect(result.ok).toBe(true);
  });

  test("captured_at must be a naive local timestamp (no timezone invention)", () => {
    const g = validPublished() as Record<string, unknown>;
    (g.photos as Array<Record<string, unknown>>)[0].captured_at = "2024-07-13T09:04:26Z";
    const result = validateDocs([g]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("captured-at-format"))).toBe(true);
  });
});
