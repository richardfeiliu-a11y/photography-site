// WP-12 unit tests — redirects.yaml schema and fail-closed validation.
// Requirements: the frozen WP-12 brief (.superpowers/sdd/PRODUCTION_IMPLEMENTATION_PLAN/
// wp-12-brief.md) RED set; authority research/production-architecture/CONTENT_MODEL.md
// §11 (redirect map schema: old path → { gallery_id } XOR { place_id }; historical
// aliases only; §11.3 slug authority), §12 (canonical routes), §13.1 #15/#16,
// §13.2; BUILD_AND_ROUTING.md §5 (redirect validation rules, lifecycle); IC-02
// verification (CANONICAL_REWRITE_TRACEABILITY.md RT-010/IC-02).
//
// Invalid inputs come from the WP-08 fixture library (13.15, 13.16) and the
// WP-12 redirect-* fixtures; sub-cases that cannot exist in a parsed YAML map
// (duplicate old paths) or that need bespoke graph shapes are synthesized
// in-test. Graph fixtures reference unit-synthesized registries (the IDs they
// name exist nowhere in the corpus, by design).
//
// These are module tests: src/content-schemas.ts and src/lib/content/redirects.ts
// are exercised directly (no loader, no filesystem).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "js-yaml";
import { describe, expect, test } from "vitest";
import { redirectEntrySchema, redirectOldPathSchema } from "../../src/content-schemas";
import {
  canonicalRoutes,
  detectRedirectLoops,
  entriesFromRedirectsFile,
  findCanonicalRouteCollisions,
  findDuplicateOldPaths,
  findRedirectToRedirect,
  resolveRedirects,
  validateRedirects,
  type GalleryRedirectRef,
  type PlaceRedirectRef,
  type RedirectEntryInput,
  type RedirectValidationIssue,
  type RedirectValidationResult,
} from "../../src/lib/content/redirects";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));

// ---------------------------------------------------------------------------
// Unit-synthesized registries (§11.3: slugs come FROM the gallery/place
// registries — the only slug authorities; nothing here is a second registry).
// ---------------------------------------------------------------------------
const UNIT_GALLERIES: GalleryRedirectRef[] = [
  { id: "g_alpha_unit", slug: "alpha", status: "published" },
  { id: "g_beta_unit", slug: "beta", status: "published" },
  { id: "g_gamma_unit", slug: "gamma", status: "published" },
  { id: "g_loop_a", slug: "loop-a", status: "published" },
  { id: "g_loop_b", slug: "loop-b", status: "published" },
  { id: "g_cycle_1", slug: "cycle-1", status: "published" },
  { id: "g_cycle_2", slug: "cycle-2", status: "published" },
  { id: "g_cycle_3", slug: "cycle-3", status: "published" },
  { id: "g_aurora_unit", slug: "aurora-unit", status: "published" },
  { id: "g_old_x", slug: "old-x", status: "published" },
  { id: "g_y_unit", slug: "y", status: "published" },
  { id: "g_draft_unit", slug: "draft-unit", status: "draft" },
  // The fixture draft ID, so redirect-draft-target.yaml runs against a
  // registry carrying that draft (the real archive is published-only).
  { id: "g_iso_draft", slug: "iso-draft", status: "draft" },
];

const UNIT_PLACES: PlaceRedirectRef[] = [
  { id: "pl_lofoten", slug: "lofoten" },
  { id: "pl_alpha_unit", slug: "place-alpha" },
];

/** Loads a redirects-file fixture into validated-shape RedirectEntryInputs. */
function fixtureEntries(name: string): RedirectEntryInput[] {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf8");
  const doc = loadAll(raw)[0];
  const parsed = entriesFromRedirectsFile(doc);
  expect(parsed.fileErrors, `fixture ${name} must have a valid top-level shape`).toEqual([]);
  return parsed.entries;
}

function entry(oldPath: string, data: unknown): RedirectEntryInput {
  return { oldPath, data, filePath: `synthetic:${oldPath}` };
}

function validate(
  entries: ReadonlyArray<RedirectEntryInput>,
  options: Partial<Parameters<typeof validateRedirects>[1]> = {},
): RedirectValidationResult {
  return validateRedirects(entries, {
    mode: "production",
    galleries: UNIT_GALLERIES,
    places: UNIT_PLACES,
    ...options,
  });
}

function rulesOf(issues: RedirectValidationIssue[]): string[] {
  return issues.map((i) => i.rule);
}

/** Extracts the rule token prefix ("[13.1#15] ...") from a message. */
function ruleToken(message: string): string | null {
  const m = /^\[([^\]]+)\]/.exec(message);
  return m ? (m[1] as string) : null;
}

describe("WP-12 RED: XOR target type (§11.1 / §13.1#15)", () => {
  test("entry with BOTH gallery_id and place_id rejected (fixture 13.15)", () => {
    const entries = fixtureEntries("13.15-invalid-redirect.yaml");
    expect(entries).toHaveLength(1);
    const result = validate(entries);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#15");
    const err = result.errors.find((e) => e.rule === "13.1#15");
    expect(err?.message).toContain("g_lofoten_polar_night");
    expect(err?.message).toContain("pl_lofoten");
    expect(err?.message).toContain("XOR");
    expect(err?.oldPath).toBe("/galleries/invalid-two-targets");
    // Rule 15 has no production qualifier — it fails in preview too.
    const preview = validate(entries, { mode: "preview" });
    expect(preview.ok).toBe(false);
    expect(rulesOf(preview.errors)).toContain("13.1#15");
  });

  test("entry with NEITHER target rejected (fixture redirect-neither-target)", () => {
    const entries = fixtureEntries("redirect-neither-target.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#15");
    expect(err?.message).toContain("NEITHER");
    expect(err?.oldPath).toBe("/galleries/invalid-no-target");
  });

  test("schema level: both / neither / unknown keys / non-object each rejected", () => {
    const both = redirectEntrySchema.safeParse({ gallery_id: "g_a", place_id: "pl_a" });
    expect(both.success).toBe(false);
    if (!both.success) expect(ruleToken(both.error.issues[0]!.message)).toBe("13.1#15");

    const neither = redirectEntrySchema.safeParse({});
    expect(neither.success).toBe(false);
    if (!neither.success) expect(ruleToken(neither.error.issues[0]!.message)).toBe("13.1#15");

    const unknown = redirectEntrySchema.safeParse({ gallery_id: "g_a", slug: "steal-my-slug" });
    expect(unknown.success).toBe(false);
    if (!unknown.success) {
      expect(ruleToken(unknown.error.issues[0]!.message)).toBe("13.1#15");
      expect(unknown.error.issues[0]!.message).toContain("slug");
    }

    for (const bad of ["g_a", 42, null, []]) {
      const parsed = redirectEntrySchema.safeParse(bad);
      expect(parsed.success, `non-object entry ${JSON.stringify(bad)} must not parse`).toBe(false);
      if (!parsed.success) expect(ruleToken(parsed.error.issues[0]!.message)).toBe("13.1#15");
    }

    // Exactly one target parses.
    expect(redirectEntrySchema.safeParse({ gallery_id: "g_a" }).success).toBe(true);
    expect(redirectEntrySchema.safeParse({ place_id: "pl_a" }).success).toBe(true);
  });

  test("empty-string target IDs rejected (synthesized)", () => {
    for (const bad of [{ gallery_id: "" }, { place_id: "" }]) {
      const parsed = redirectEntrySchema.safeParse(bad);
      expect(parsed.success, `${JSON.stringify(bad)} must not parse`).toBe(false);
      if (!parsed.success) expect(ruleToken(parsed.error.issues[0]!.message)).toBe("13.1#15");
    }
  });
});

describe("WP-12 RED: historical-only old paths (§11.2 / §13.1#15 + #16 route collision)", () => {
  test("old path equal to a current canonical route rejected (fixture redirect-old-path-canonical)", () => {
    const entries = fixtureEntries("redirect-old-path-canonical.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    // Entry-level gate: rule 15 states "old path equals a current canonical route".
    expect(rulesOf(result.errors)).toContain("13.1#15");
    // Graph-level gate: rule 16 / BUILD_AND_ROUTING §5 route-collision bullet.
    expect(rulesOf(result.errors)).toContain("13.1#16");
    const collision = result.errors.find((e) => e.rule === "13.1#16");
    expect(collision?.message).toContain("/places/lofoten");
    expect(collision?.message).toContain("canonical");
  });

  test("every static canonical route rejected as an old path (§12, synthesized)", () => {
    for (const route of ["/", "/archive", "/places", "/about"]) {
      const result = validate([entry(route, { gallery_id: "g_alpha_unit" })]);
      expect(result.ok, `old path ${route} must be rejected`).toBe(false);
      expect(rulesOf(result.errors)).toContain("13.1#15");
    }
  });

  test("corpus-derived canonical routes rejected as old paths (synthesized)", () => {
    // Current slugs of the registries — the ONLY slug authorities (§11.3).
    for (const route of ["/galleries/alpha", "/places/lofoten", "/places/place-alpha"]) {
      const result = validate([entry(route, { gallery_id: "g_beta_unit" })]);
      expect(result.ok, `old path ${route} must be rejected`).toBe(false);
      expect(rulesOf(result.errors)).toContain("13.1#15");
    }
  });

  test("malformed old paths rejected (§13.1#15 'malformed path', synthesized)", () => {
    for (const bad of ["galleries/x", "/galleries/x/", "/Galleries/x", "", "/galleries//x"]) {
      const parsed = redirectOldPathSchema.safeParse(bad);
      expect(parsed.success, `old path '${bad}' must not parse`).toBe(false);
      if (!parsed.success) expect(ruleToken(parsed.error.issues[0]!.message)).toBe("13.1#15");
      const result = validate([entry(bad, { gallery_id: "g_alpha_unit" })]);
      expect(result.ok, `old path '${bad}' must fail validation`).toBe(false);
    }
    // Well-formed historical paths parse.
    for (const good of ["/galleries/old-lofoten", "/places/old-reine", "/about-old"]) {
      expect(redirectOldPathSchema.safeParse(good).success, good).toBe(true);
    }
  });

  test("pure helper: findCanonicalRouteCollisions reports colliding paths only", () => {
    const canonical = new Set(canonicalRoutes({ galleries: UNIT_GALLERIES, places: UNIT_PLACES }));
    const collisions = findCanonicalRouteCollisions(
      ["/galleries/legacy-x", "/galleries/alpha", "/about", "/places/nowhere-old"],
      canonical,
    );
    expect(collisions).toEqual(["/about", "/galleries/alpha"]);
  });

  test("canonicalRoutes derives from the registries (§11.3 single slug authority)", () => {
    const routes = canonicalRoutes({ galleries: UNIT_GALLERIES, places: UNIT_PLACES });
    expect(routes).toContain("/");
    expect(routes).toContain("/archive");
    expect(routes).toContain("/places");
    expect(routes).toContain("/about");
    expect(routes).toContain("/galleries/alpha");
    expect(routes).toContain("/places/lofoten");
    // §12 defines no /galleries index route.
    expect(routes).not.toContain("/galleries");
  });
});

describe("WP-12 RED: target existence and publication (§13.1#15 / §13.1#16)", () => {
  test("target Gallery missing rejected (fixture 13.16, g_bad_ghost)", () => {
    const entries = fixtureEntries("13.16-redirect-target-unresolved.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#15");
    const err = result.errors.find((e) => e.rule === "13.1#15");
    expect(err?.message).toContain("g_bad_ghost");
    // §13.1#16: the target does not resolve to a public/published canonical
    // route in production — fires in production mode alongside rule 15.
    expect(rulesOf(result.errors)).toContain("13.1#16");
    const unresolved = result.errors.find(
      (e) => e.rule === "13.1#16" && e.message.includes("g_bad_ghost"),
    );
    expect(unresolved?.message).toContain("resolve");
  });

  test("target Place missing rejected (synthesized)", () => {
    const result = validate([entry("/places/ghost-alias", { place_id: "pl_bad_ghost" })]);
    expect(result.ok).toBe(false);
    expect(rulesOf(result.errors)).toContain("13.1#15");
    expect(result.errors.find((e) => e.rule === "13.1#15")?.message).toContain("pl_bad_ghost");
  });

  test("target DRAFT Gallery rejected in production (fixture redirect-draft-target, §13.1#16)", () => {
    const entries = fixtureEntries("redirect-draft-target.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.rule === "13.1#16");
    expect(err?.message).toContain("g_iso_draft");
    expect(err?.message).toContain("draft");
    expect(err?.severity).toBe("error");
  });

  test("target DRAFT Gallery WARNS in preview, never errors (mode semantics, §13.1#16/§13.2)", () => {
    const entries = fixtureEntries("redirect-draft-target.yaml");
    const preview = validate(entries, { mode: "preview" });
    // In preview the draft route EXISTS (ADR-020: preview may include draft
    // content), so the §13.1#16 production rejection does not fire; a warning
    // is emitted instead (see docs/implementation/WP-12.md mode reading).
    expect(preview.errors).toEqual([]);
    expect(preview.ok).toBe(true);
    expect(preview.warnings.map((w) => w.rule)).toContain("13.1#16-warn-draft-target");
    const warn = preview.warnings.find((w) => w.rule === "13.1#16-warn-draft-target");
    expect(warn?.message).toContain("g_iso_draft");
  });
});

describe("WP-12 RED: redirect loops (§13.1#16, BUILD_AND_ROUTING §5)", () => {
  test("A -> B -> A loop rejected (fixture redirect-loop)", () => {
    const entries = fixtureEntries("redirect-loop.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    const loop = result.errors.find(
      (e) => e.rule === "13.1#16" && e.message.startsWith("[13.1#16] Redirect loop"),
    );
    expect(loop, "expected a Redirect loop finding").toBeDefined();
    expect(loop?.message).toContain("/galleries/loop-a");
    expect(loop?.message).toContain("/galleries/loop-b");
  });

  test("longer chain A -> B -> C -> A rejected (fixture redirect-long-loop)", () => {
    const entries = fixtureEntries("redirect-long-loop.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    const loop = result.errors.find(
      (e) => e.rule === "13.1#16" && e.message.startsWith("[13.1#16] Redirect loop"),
    );
    expect(loop, "expected a Redirect loop finding").toBeDefined();
    for (const segment of ["cycle-1", "cycle-2", "cycle-3"]) {
      expect(loop?.message).toContain(segment);
    }
  });

  test("self-loop (old path resolving to itself) rejected (synthesized)", () => {
    // g_alpha_unit's current slug route IS /galleries/alpha — the old path
    // maps onto its own destination.
    const result = validate([entry("/galleries/alpha", { gallery_id: "g_alpha_unit" })]);
    expect(result.ok).toBe(false);
    const loop = result.errors.find(
      (e) => e.rule === "13.1#16" && e.message.startsWith("[13.1#16] Redirect loop"),
    );
    expect(loop, "expected a Redirect loop finding").toBeDefined();
    expect(loop?.message).toContain("/galleries/alpha");
  });

  test("pure helper: detectRedirectLoops finds 2-cycles, 3-cycles and self-loops", () => {
    const edges = new Map<string, string>([
      ["/a", "/b"],
      ["/b", "/a"],
      ["/c", "/d"],
      ["/d", "/e"],
      ["/e", "/c"],
      ["/self", "/self"],
      ["/plain", "/terminal"],
    ]);
    const cycles = detectRedirectLoops(edges).map((cycle) => [...cycle].sort());
    expect(cycles).toHaveLength(3);
    expect(cycles).toContainEqual(["/a", "/b"]);
    expect(cycles).toContainEqual(["/c", "/d", "/e"]);
    expect(cycles).toContainEqual(["/self"]);

    expect(detectRedirectLoops(new Map([["/a", "/terminal"]]))).toEqual([]);
  });

  test("loops are structural: rejected in preview mode too", () => {
    const entries = fixtureEntries("redirect-loop.yaml");
    const preview = validate(entries, { mode: "preview" });
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.message.startsWith("[13.1#16] Redirect loop"))).toBe(true);
  });
});

describe("WP-12 RED: duplicate old paths (§13.1#16 route-collision family)", () => {
  test("duplicate old paths rejected (synthesized list — a parsed YAML map cannot carry them)", () => {
    const result = validate([
      entry("/galleries/dup", { gallery_id: "g_alpha_unit" }),
      entry("/galleries/dup", { gallery_id: "g_beta_unit" }),
    ]);
    expect(result.ok).toBe(false);
    const dup = result.errors.find((e) => e.rule === "13.1#16" && e.message.includes("duplicate"));
    expect(dup, "expected a duplicate old path finding").toBeDefined();
    expect(dup?.message).toContain("/galleries/dup");
    // Structural: fails in preview too.
    const preview = validate(
      [
        entry("/galleries/dup", { gallery_id: "g_alpha_unit" }),
        entry("/galleries/dup", { gallery_id: "g_beta_unit" }),
      ],
      { mode: "preview" },
    );
    expect(preview.ok).toBe(false);
  });

  test("pure helper: findDuplicateOldPaths reports duplicated paths deterministically", () => {
    expect(findDuplicateOldPaths(["/b", "/a", "/b", "/c", "/a", "/b"])).toEqual(["/a", "/b"]);
    expect(findDuplicateOldPaths(["/x", "/y"])).toEqual([]);
  });
});

describe("WP-12 RED: redirect-to-redirect (§13.1#16 / §11.2)", () => {
  test("redirect target that is itself a redirect source rejected (fixture redirect-target-is-redirect-source)", () => {
    const entries = fixtureEntries("redirect-target-is-redirect-source.yaml");
    const result = validate(entries);
    expect(result.ok).toBe(false);
    const r2r = result.errors.find(
      (e) => e.rule === "13.1#16" && e.message.includes("redirect source"),
    );
    expect(r2r, "expected a redirect-to-redirect finding").toBeDefined();
    expect(r2r?.message).toContain("/galleries/legacy-aurora");
    expect(r2r?.message).toContain("/galleries/aurora-unit");
    // NOT a loop: the chain terminates on a canonical route.
    expect(
      result.errors.some((e) => e.message.startsWith("[13.1#16] Redirect loop")),
      "a redirect-to-redirect chain must not be reported as a loop",
    ).toBe(false);
  });

  test("pure helper: findRedirectToRedirect reports sources whose destination is an old path", () => {
    const edges = new Map<string, string>([
      ["/a", "/b"],
      ["/b", "/terminal"],
      ["/c", "/c"],
    ]);
    const chains = findRedirectToRedirect(edges);
    expect(chains).toContainEqual({ oldPath: "/a", destination: "/b" });
    expect(chains).toContainEqual({ oldPath: "/c", destination: "/c" }); // self-destination
    expect(chains.find((c) => c.oldPath === "/b")).toBeUndefined();
  });

  test("redirect-to-redirect is structural: rejected in preview mode too", () => {
    const entries = fixtureEntries("redirect-target-is-redirect-source.yaml");
    const preview = validate(entries, { mode: "preview" });
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.message.includes("redirect source"))).toBe(true);
  });
});

describe("WP-12 RED: valid historical aliases pass", () => {
  test("historical aliases resolving to published targets validate green (both modes)", () => {
    const entries = [
      entry("/galleries/old-lofoten", { gallery_id: "g_alpha_unit" }),
      entry("/galleries/reine-winter-2024", { gallery_id: "g_beta_unit" }),
      entry("/places/old-reine", { place_id: "pl_alpha_unit" }),
    ];
    for (const mode of ["preview", "production"] as const) {
      const result = validate(entries, { mode });
      expect(result.errors, `${mode}`).toEqual([]);
      expect(result.warnings, `${mode}`).toEqual([]);
      expect(result.ok, `${mode}`).toBe(true);
    }
  });

  test("the real 3-alias corpus shape validates green at module level (both modes)", () => {
    const entries: RedirectEntryInput[] = [
      { oldPath: "/galleries/old-polar-night", data: { gallery_id: "g_lofoten_polar_night" } },
      { oldPath: "/galleries/nights-archive", data: { gallery_id: "g_tromso_city_nights" } },
      { oldPath: "/places/old-lofoten", data: { place_id: "pl_lofoten" } },
    ];
    const galleries: GalleryRedirectRef[] = [
      { id: "g_lofoten_polar_night", slug: "lofoten-polar-night", status: "published" },
      { id: "g_tromso_city_nights", slug: "tromso-city-nights", status: "published" },
    ];
    const places: PlaceRedirectRef[] = [{ id: "pl_lofoten", slug: "lofoten" }];
    for (const mode of ["preview", "production"] as const) {
      const result = validateRedirects(entries, { mode, galleries, places });
      expect(result.ok, `${mode}`).toBe(true);
      expect(result.errors, `${mode}`).toEqual([]);
    }
  });
});

describe("WP-12 RED: resolution — old path → target ID → current slug → canonical route", () => {
  test("resolves through the single slug registries into the WP-52 data contract", () => {
    const entries = [
      entry("/galleries/nights-archive", { gallery_id: "g_beta_unit" }),
      entry("/places/old-reine", { place_id: "pl_alpha_unit" }),
      entry("/galleries/reine-winter-2024", { gallery_id: "g_alpha_unit" }),
    ];
    const result = resolveRedirects(entries, {
      mode: "production",
      galleries: UNIT_GALLERIES,
      places: UNIT_PLACES,
    });
    // Deterministic order: sorted by old path (stable input for WP-52's diff).
    expect(result.redirects.map((r) => r.oldPath)).toEqual([
      "/galleries/nights-archive",
      "/galleries/reine-winter-2024",
      "/places/old-reine",
    ]);
    expect(result.redirects[0]).toEqual({
      oldPath: "/galleries/nights-archive",
      targetType: "gallery",
      targetId: "g_beta_unit",
      slug: "beta",
      destination: "/galleries/beta",
    });
    expect(result.redirects[1]).toEqual({
      oldPath: "/galleries/reine-winter-2024",
      targetType: "gallery",
      targetId: "g_alpha_unit",
      slug: "alpha",
      destination: "/galleries/alpha",
    });
    expect(result.redirects[2]).toEqual({
      oldPath: "/places/old-reine",
      targetType: "place",
      targetId: "pl_alpha_unit",
      slug: "place-alpha",
      destination: "/places/place-alpha",
    });
    expect(result.warnings).toEqual([]);
  });

  test("unresolvable entries are omitted from the resolution output", () => {
    const entries = [
      entry("/galleries/good", { gallery_id: "g_alpha_unit" }),
      entry("/galleries/ghost", { gallery_id: "g_bad_ghost" }),
      entry("/galleries/bad-shape", { slug: "not-a-target" }),
    ];
    const result = resolveRedirects(entries, {
      mode: "production",
      galleries: UNIT_GALLERIES,
      places: UNIT_PLACES,
    });
    expect(result.redirects.map((r) => r.oldPath)).toEqual(["/galleries/good"]);
  });

  test("preview mode: draft-target redirect still resolves, with a warning carried", () => {
    const result = resolveRedirects(
      [entry("/galleries/draft-alias", { gallery_id: "g_draft_unit" })],
      {
        mode: "preview",
        galleries: UNIT_GALLERIES,
        places: UNIT_PLACES,
      },
    );
    expect(result.redirects).toHaveLength(1);
    expect(result.redirects[0]?.destination).toBe("/galleries/draft-unit");
    expect(result.warnings.map((w) => w.rule)).toContain("13.1#16-warn-draft-target");
  });
});

describe("WP-12 RED: redirects file shape (loader contract, §11.1)", () => {
  test("a mapping file yields one entry per old path, insertion order preserved", () => {
    const parsed = entriesFromRedirectsFile({
      "/galleries/a-old": { gallery_id: "g_alpha_unit" },
      "/places/b-old": { place_id: "pl_alpha_unit" },
    });
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.entries.map((e) => e.oldPath)).toEqual(["/galleries/a-old", "/places/b-old"]);
    expect(parsed.entries[0]?.data).toEqual({ gallery_id: "g_alpha_unit" });
  });

  test("arrays, null and scalars rejected as file-shape violations (§11.1)", () => {
    for (const bad of [[{ gallery_id: "g" }], null, "redirects", 42]) {
      const parsed = entriesFromRedirectsFile(bad);
      expect(parsed.entries, JSON.stringify(bad)).toEqual([]);
      expect(parsed.fileErrors).toHaveLength(1);
      expect(parsed.fileErrors[0]?.rule).toBe("11.1:file-shape");
      expect(parsed.fileErrors[0]?.severity).toBe("error");
    }
  });
});
