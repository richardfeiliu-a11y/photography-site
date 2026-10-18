// WP-10 unit tests — singular Place schema and cross-file identity validation.
// Requirements: the frozen WP-10 brief (.superpowers/sdd/PRODUCTION_IMPLEMENTATION_PLAN/
// wp-10-brief.md) RED set; authority research/production-architecture/CONTENT_MODEL.md
// §6 (§6.1 ONE PLACE = ONE YAML FILE, §6.2 field contracts, §6.3 constraints),
// §13.1 #5/#6; IC-01 verification (TECHNICAL_API_VERIFICATION.md §1).
//
// Invalid inputs come from the WP-08 fixture library (tests/fixtures/invalid/),
// keyed by CONTENT_MODEL §13.1 rule numbers / §6 contracts. Forbidden-concept and
// required-field sub-cases not covered by a fixture are synthesized in-test.
//
// These are module tests: src/content-schemas.ts and src/lib/validate/place.ts
// are exercised directly (no loader, no filesystem).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadAll } from "js-yaml";
import { describe, expect, test } from "vitest";
import { placeSchema } from "../../src/content-schemas";
import {
  validatePlaces,
  type PlaceEntryInput,
  type PlaceValidationIssue,
} from "../../src/lib/validate/place";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));

/** Loads a (possibly multi-document) invalid fixture into raw YAML documents. */
function loadFixture(name: string): Record<string, unknown>[] {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf8");
  return loadAll(raw) as Record<string, unknown>[];
}

function entriesOf(docs: Record<string, unknown>[]): PlaceEntryInput[] {
  return docs.map((data, i) => ({ data, filePath: `fixture:doc${i + 1}` }));
}

function validateDocs(
  docs: Record<string, unknown>[],
  options: Partial<Parameters<typeof validatePlaces>[1]> = {},
) {
  return validatePlaces(entriesOf(docs), { mode: "production", ...options });
}

function rulesOf(issues: PlaceValidationIssue[]): string[] {
  return issues.map((i) => i.rule);
}

/** Extracts the rule token prefix ("[13.1#5] ...") from a message. */
function ruleToken(message: string): string | null {
  const m = /^\[([^\]]+)\]/.exec(message);
  return m ? (m[1] as string) : null;
}

/** A complete, valid Place (CONTENT_MODEL §6.1 shape, region + country present). */
function validPlace(): Record<string, unknown> {
  return {
    id: "pl_valid_unit",
    slug: "valid-unit-place",
    name: "Valid Unit Place",
    region: "Nowhere",
    country: "Test",
  };
}

describe("WP-10 RED: cross-file identity rules (§13.1#5, §13.1#6)", () => {
  test("duplicate Place ID rejected (fixture 13.05, rule 13.1#5)", () => {
    const docs = loadFixture("13.05-duplicate-place-id.yaml");
    expect(docs).toHaveLength(2);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#5");
    const err = result.errors.find((e) => e.rule === "13.1#5");
    expect(err?.message).toContain("pl_bad_13_05");
    expect(err?.place).toBe("pl_bad_13_05");
    expect(err?.field).toBe("id");
  });

  test("duplicate Place slug rejected (fixture 13.06, rule 13.1#6)", () => {
    const docs = loadFixture("13.06-duplicate-place-slug.yaml");
    expect(docs).toHaveLength(2);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#6");
    const err = result.errors.find((e) => e.rule === "13.1#6");
    expect(err?.message).toContain("invalid-dup-place-slug");
    expect(err?.message).toContain("/places/");
  });

  test("distinct slugs with one shared ID fail, and vice versa, in BOTH modes (rule isolation)", () => {
    // The fixtures isolate #5 from #6 by construction; assert that isolation.
    const dupId = validateDocs(loadFixture("13.05-duplicate-place-id.yaml"));
    expect(rulesOf(dupId.errors)).toContain("13.1#5");
    expect(rulesOf(dupId.errors)).not.toContain("13.1#6");

    const dupSlug = validateDocs(loadFixture("13.06-duplicate-place-slug.yaml"));
    expect(rulesOf(dupSlug.errors)).toContain("13.1#6");
    expect(rulesOf(dupSlug.errors)).not.toContain("13.1#5");

    // No draft concept exists for Places (§6) — the rules are mode-invariant.
    for (const mode of ["preview", "production"] as const) {
      const result = validateDocs(loadFixture("13.05-duplicate-place-id.yaml"), { mode });
      expect(result.ok, `${mode}: duplicate Place ID must fail`).toBe(false);
      expect(rulesOf(result.errors)).toContain("13.1#5");
    }
  });
});

describe("WP-10 RED: singular cardinality (§6.1 / IC-01, fixture 6.1-place-array)", () => {
  test("a YAML file containing an ARRAY of Places is rejected (singular object only)", () => {
    const docs = loadFixture("6.1-place-array.yaml");
    expect(docs).toHaveLength(1);
    const doc = docs[0];
    expect(Array.isArray(doc)).toBe(true);
    const parsed = placeSchema.safeParse(doc);
    expect(parsed.success, "an aggregate array must not parse as one Place").toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      expect(ruleToken(issue.message)).toBe("6.1:one-place-one-file");
      expect(issue.message).toContain("array");
    }
    // The pure validator reports the same cardinality failure, not a crash.
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("6.1:one-place-one-file");
  });

  test("non-object scalars rejected as singular-shape violations (synthesized)", () => {
    for (const bad of [null, "pl_reine", 42, true]) {
      const parsed = placeSchema.safeParse(bad);
      expect(parsed.success, `input ${JSON.stringify(bad)} must not parse`).toBe(false);
      if (!parsed.success) {
        expect(ruleToken(parsed.error.issues[0].message)).toBe("6.1:singular-place");
      }
    }
  });
});

describe("WP-10 RED: required fields (§6.2)", () => {
  test("missing id / slug / name each rejected with their own rule token (synthesized)", () => {
    for (const field of ["id", "slug", "name"] as const) {
      const place = validPlace();
      delete place[field];
      const parsed = placeSchema.safeParse(place);
      expect(parsed.success, `missing ${field} must fail`).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) => ruleToken(i.message) === `6.2:${field}`),
          `expected a [6.2:${field}] issue for missing ${field}`,
        ).toBe(true);
      }
    }
  });

  test("empty id / slug / name rejected (synthesized)", () => {
    for (const field of ["id", "slug", "name"] as const) {
      const place = validPlace();
      place[field] = "";
      expect(placeSchema.safeParse(place).success, `empty ${field} must fail`).toBe(false);
      const whitespace = validPlace();
      whitespace[field] = "   ";
      expect(
        placeSchema.safeParse(whitespace).success,
        `whitespace-only ${field} must fail`,
      ).toBe(false);
    }
  });

  test("slug must be a URL-safe segment (§6.2, route /places/{slug})", () => {
    for (const bad of ["Springfield IL", "springfield_il", "-leading", "trailing-", "a/b", "a.b"]) {
      const place = validPlace();
      place.slug = bad;
      const parsed = placeSchema.safeParse(place);
      expect(parsed.success, `slug '${bad}' must fail`).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) => ruleToken(i.message) === "6.2:slug-urlsafe"),
          `expected a [6.2:slug-urlsafe] issue for slug '${bad}'`,
        ).toBe(true);
      }
    }
  });

  test("region and country are optional (§6.2) — a minimal Place parses", () => {
    const minimal: Record<string, unknown> = {
      id: "pl_minimal",
      slug: "minimal-place",
      name: "Minimal Place",
    };
    const parsed = placeSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ id: "pl_minimal", slug: "minimal-place", name: "Minimal Place" });
    }
  });

  test("valid Place with region + country parses (§6.1 canonical shape)", () => {
    const parsed = placeSchema.safeParse(validPlace());
    expect(parsed.success).toBe(true);
  });
});

describe("WP-10 RED: forbidden concepts (§6.3, fixture 6.3-place-forbidden-concepts)", () => {
  test("coordinates, counts and Visit/Trip fields rejected (fixture 6.3)", () => {
    const docs = loadFixture("6.3-place-forbidden-concepts.yaml");
    const parsed = placeSchema.safeParse(docs[0]);
    expect(parsed.success).toBe(false);
    const result = validateDocs(docs);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "6.3:forbidden-concept");
    expect(err, "expected a §6.3 forbidden-concept finding").toBeDefined();
    // The fixture carries coordinates, gallery_count, visits and trip — the
    // finding must name them all via unknown-key rejection.
    for (const field of ["coordinates", "gallery_count", "visits", "trip"]) {
      expect(err?.message).toContain(field);
      expect(err?.field).toContain(field);
    }
    expect(err?.place).toBe("pl_bad_concepts");
  });

  test("each forbidden concept family rejected individually (synthesized)", () => {
    const cases: Array<[field: string, value: unknown]> = [
      ["coordinates", { lat: 0.0, lng: 0.0 }],
      ["latitude", 0.0],
      ["longitude", 0.0],
      ["gallery_count", 3],
      ["photo_count", 12],
      ["count", 1],
      ["visit", { year: 2024 }],
      ["visits", [{ year: 2024 }]],
      ["trip", "Summer trip 2024"],
      ["trips", ["Summer trip 2024"]],
    ];
    for (const [field, value] of cases) {
      const place = validPlace();
      place[field] = value;
      const parsed = placeSchema.safeParse(place);
      expect(parsed.success, `${field} must not parse (§6.3)`).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
        expect(issue, `expected a strict-shape issue for ${field}`).toBeDefined();
        expect(issue?.message).toContain(field);
        expect(ruleToken(issue?.message ?? "")).toBe("6.3:forbidden-concept");
      }
    }
  });

  test("any other unknown/orphan key rejected with the §6.1 unknown-field label", () => {
    const place = validPlace();
    place.editor_notes = "not part of the canonical schema";
    const parsed = placeSchema.safeParse(place);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
      expect(issue?.message).toContain("editor_notes");
      expect(ruleToken(issue?.message ?? "")).toBe("6.1:unknown-field");
    }
  });
});

describe("WP-10 RED: validator composition contract", () => {
  test("the real 8-place corpus shape validates green in both modes (module level)", () => {
    const corpus: Record<string, unknown>[] = [
      { id: "pl_reine", slug: "reine", name: "Reine", region: "Lofoten, Norway", country: "Norway" },
      { id: "pl_tromso", slug: "tromso", name: "Tromsø", region: "Troms, Norway", country: "Norway" },
      { id: "pl_nanchang", slug: "nanchang", name: "南昌 Nanchang" },
    ];
    for (const mode of ["preview", "production"] as const) {
      const result = validateDocs(corpus, { mode });
      expect(result.errors, `${mode}: corpus places must validate clean`).toEqual([]);
      expect(result.warnings, `${mode}: places have no §13.2 warning concept`).toEqual([]);
      expect(result.ok, `${mode}`).toBe(true);
    }
  });

  test("schema errors carry the place context (raw id or file path)", () => {
    const broken = validPlace();
    delete broken.name;
    const result = validateDocs([broken]);
    expect(result.ok).toBe(false);
    const err = result.errors[0];
    expect(err?.place).toBe("pl_valid_unit");
    expect(err?.file).toBe("fixture:doc1");
    expect(err?.message).toContain("pl_valid_unit");
  });
});

describe("WP-10 RED: wiring", () => {
  test("src/content.config.ts wires the real place schema (placeholder gone for places)", () => {
    const configSrc = readFileSync(
      fileURLToPath(new URL("../../src/content.config.ts", import.meta.url)),
      "utf8",
    );
    const placesBlock = /const places = defineCollection\(\{[\s\S]*?\}\);/.exec(configSrc);
    expect(placesBlock).toBeDefined();
    expect(placesBlock?.[0]).not.toContain("PLACEHOLDER");

    const schemasSrc = readFileSync(
      fileURLToPath(new URL("../../src/content-schemas.ts", import.meta.url)),
      "utf8",
    );
    const placeSchemaBlock = /export const placeSchema[\s\S]*?(?:^export type Place\b|\z)/m.exec(
      schemasSrc,
    );
    expect(placeSchemaBlock).toBeDefined();
    expect(placeSchemaBlock?.[0]).not.toContain("PLACEHOLDER");
    expect(placeSchemaBlock?.[0]).not.toContain("looseObject");
  });
});
