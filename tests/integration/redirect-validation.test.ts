// WP-12 integration tests — redirects.yaml loading + fail-closed validation +
// resolution over the REAL WP-08 fixture corpus (12 galleries / 8 places / 3
// historical aliases) and the REAL authored redirects.yaml.
//
// Requirements: frozen WP-12 brief — real corpus redirects.yaml validates green;
// each invalid fixture fails with its rule ID; resolution data contract for
// WP-52 (structured JSON mapping, no nginx syntax); §11.3 slug authority.
//
// Authority: research/production-architecture/CONTENT_MODEL.md §11/§12/§13.1
// #15/#16/§13.2, BUILD_AND_ROUTING.md §5, IC-02 verification
// (CANONICAL_REWRITE_TRACEABILITY.md RT-010 / IC-02), WP-03 contract
// (redirects.yaml is NOT a collection — src/content.config.ts).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";
import { describe, expect, test } from "vitest";
import {
  REDIRECTS_RELATIVE_PATH,
  entriesFromRedirectsFile,
  readRedirects,
  resolveRedirects,
  validateRedirects,
  type GalleryRedirectRef,
  type PlaceRedirectRef,
  type RedirectEntryInput,
} from "../../src/lib/content/redirects";
import { PROJECT_ROOT_URL, loadCollection } from "../support/content-layer";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/invalid", import.meta.url));

/** Loads a redirects-file fixture into RedirectEntryInputs (top-level shape pinned). */
function fixtureEntries(name: string): RedirectEntryInput[] {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf8");
  const doc = parseYaml(raw) as unknown;
  const parsed = entriesFromRedirectsFile(doc);
  expect(parsed.fileErrors, `fixture ${name} must have a valid top-level shape`).toEqual([]);
  return parsed.entries;
}

/** Real corpus registries via the REAL Content Layer loaders (WP-03 harness). */
async function corpusRefs(): Promise<{
  galleries: GalleryRedirectRef[];
  places: PlaceRedirectRef[];
}> {
  const [galleries, places] = await Promise.all([
    loadCollection("galleries"),
    loadCollection("places"),
  ]);
  return {
    galleries: galleries.entries.map((e) => e.data as unknown as GalleryRedirectRef),
    places: places.entries.map((e) => e.data as unknown as PlaceRedirectRef),
  };
}

function trace(label: string, value: unknown): void {
  // Resolution trace: the WP-52 data contract over the real corpus, logged.
  console.info(`[WP-12 trace] ${label}: ${JSON.stringify(value)}`);
}

describe("WP-12 integration: the REAL content/redirects.yaml validates green", () => {
  test("the authored file is the legal EMPTY set and validates in BOTH modes", async () => {
    const file = readRedirects(PROJECT_ROOT_URL);
    expect(file.filePath.endsWith(REDIRECTS_RELATIVE_PATH)).toBe(true);
    const parsed = entriesFromRedirectsFile(file.data);
    expect(parsed.fileErrors).toEqual([]);
    // Post-go-live (2026-09-12): no historical aliases exist yet — the legal
    // empty set. Validation must stay green over it in both modes.
    expect(parsed.entries).toEqual([]);

    const { galleries, places } = await corpusRefs();
    for (const mode of ["preview", "production"] as const) {
      const result = validateRedirects(parsed.entries, { mode, galleries, places });
      expect(result.errors, `${mode}`).toEqual([]);
      expect(result.warnings, `${mode}`).toEqual([]);
      expect(result.ok, `${mode}`).toBe(true);
    }
  });
});

describe("WP-12 integration: resolution — the WP-52 data contract over the REAL corpus", () => {
  test("each alias resolves old path → stable ID → current slug → canonical route", async () => {
    // The authored file is empty, so this exercises the resolution contract
    // with aliases authored in-test over REAL corpus entities.
    const aliases: RedirectEntryInput[] = [
      {
        oldPath: "/galleries/old-polar-night",
        data: { gallery_id: "g_lofoten_polar_night" },
        filePath: "content/redirects.yaml",
      },
      {
        oldPath: "/places/old-lofoten",
        data: { place_id: "pl_lofoten" },
        filePath: "content/redirects.yaml",
      },
    ];
    const { galleries, places } = await corpusRefs();

    // Production validation gate first (WP-52 consumes only validated output).
    const validation = validateRedirects(aliases, { mode: "production", galleries, places });
    expect(validation.ok).toBe(true);

    const resolution = resolveRedirects(aliases, { mode: "production", galleries, places });
    expect(resolution.warnings).toEqual([]);
    expect(resolution.redirects).toEqual([
      {
        oldPath: "/galleries/old-polar-night",
        targetType: "gallery",
        targetId: "g_lofoten_polar_night",
        slug: "lofoten-polar-night",
        destination: "/galleries/lofoten-polar-night",
      },
      {
        oldPath: "/places/old-lofoten",
        targetType: "place",
        targetId: "pl_lofoten",
        slug: "lofoten",
        destination: "/places/lofoten",
      },
    ]);
    trace("resolved redirect mapping (WP-52 data contract)", resolution.redirects);
  });

  test("the data contract is structured JSON — no nginx syntax anywhere (WP-52 owns format)", async () => {
    const file = readRedirects(PROJECT_ROOT_URL);
    const parsed = entriesFromRedirectsFile(file.data);
    const { galleries, places } = await corpusRefs();
    const resolution = resolveRedirects(parsed.entries, { mode: "production", galleries, places });

    const serialized = JSON.stringify(resolution.redirects);
    for (const banned of ["nginx", "return 301", "rewrite", "location", "meta refresh"]) {
      expect(serialized.toLowerCase()).not.toContain(banned);
    }
    // Every record carries exactly the contract keys.
    for (const record of resolution.redirects) {
      expect(Object.keys(record).sort()).toEqual([
        "destination",
        "oldPath",
        "slug",
        "targetId",
        "targetType",
      ]);
    }
  });

  test("resolution is deterministic across repeated runs (stable diff for nginx reload-only-when-changed)", async () => {
    const file = readRedirects(PROJECT_ROOT_URL);
    const parsed = entriesFromRedirectsFile(file.data);
    const { galleries, places } = await corpusRefs();
    const baseline = resolveRedirects(parsed.entries, { mode: "production", galleries, places });
    for (let i = 0; i < 5; i++) {
      expect(resolveRedirects(parsed.entries, { mode: "production", galleries, places })).toEqual(
        baseline,
      );
    }
  });
});

describe("WP-12 integration: each invalid fixture fails with its rule ID over REAL registries", () => {
  test("13.15-invalid-redirect (both target types) → 13.1#15", async () => {
    const { galleries, places } = await corpusRefs();
    const result = validateRedirects(fixtureEntries("13.15-invalid-redirect.yaml"), {
      mode: "production",
      galleries,
      places,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("13.1#15");
  });

  test("13.16-redirect-target-unresolved (g_bad_ghost) → 13.1#15 + production 13.1#16", async () => {
    const { galleries, places } = await corpusRefs();
    const result = validateRedirects(fixtureEntries("13.16-redirect-target-unresolved.yaml"), {
      mode: "production",
      galleries,
      places,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("13.1#15");
    expect(
      result.errors.some((e) => e.rule === "13.1#16" && e.message.includes("g_bad_ghost")),
    ).toBe(true);
  });

  test("redirect-old-path-canonical (/places/lofoten) → 13.1#15 + 13.1#16 route collision", async () => {
    const { galleries, places } = await corpusRefs();
    const result = validateRedirects(fixtureEntries("redirect-old-path-canonical.yaml"), {
      mode: "production",
      galleries,
      places,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("13.1#15");
    expect(
      result.errors.some((e) => e.rule === "13.1#16" && e.message.includes("/places/lofoten")),
    ).toBe(true);
  });

  test("redirect-draft-target (g_iso_draft): production ERROR 13.1#16, preview WARNING", async () => {
    // The real archive has no drafts, so the draft gallery reference is
    // synthesized in-registry (the fixture carries the stable draft ID).
    const { galleries, places } = await corpusRefs();
    const withDraft: GalleryRedirectRef[] = [
      ...galleries,
      { id: "g_iso_draft", slug: "iso-draft", status: "draft" },
    ];
    const production = validateRedirects(fixtureEntries("redirect-draft-target.yaml"), {
      mode: "production",
      galleries: withDraft,
      places,
    });
    expect(production.ok).toBe(false);
    expect(
      production.errors.some((e) => e.rule === "13.1#16" && e.message.includes("g_iso_draft")),
    ).toBe(true);

    const preview = validateRedirects(fixtureEntries("redirect-draft-target.yaml"), {
      mode: "preview",
      galleries: withDraft,
      places,
    });
    expect(preview.ok).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.warnings.map((w) => w.rule)).toContain("13.1#16-warn-draft-target");
  });
});

describe("WP-12 integration: fail-closed file loading (WP-03 contract: not a collection)", () => {
  test("duplicate YAML mapping keys are rejected at parse time (fail-closed)", () => {
    // A parsed YAML map can never carry duplicate old paths — js-yaml throws
    // "duplicated mapping key", and readRedirects propagates it (fail-closed).
    const dir = mkdtempSync(join(tmpdir(), "wp12-redirects-"));
    try {
      const dupFile = join(dir, "redirects-dup.yaml");
      writeFileSync(
        dupFile,
        [
          "# duplicate old paths — must fail closed",
          "/galleries/dup:",
          "  gallery_id: g_lofoten_light",
          "/galleries/dup:",
          "  gallery_id: g_tromso_city_nights",
          "",
        ].join("\n"),
        "utf8",
      );
      expect(() => readRedirects(dir, "redirects-dup.yaml")).toThrow(/duplicated mapping key/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing redirects.yaml throws (fail-closed)", () => {
    const dir = mkdtempSync(join(tmpdir(), "wp12-redirects-"));
    try {
      expect(() => readRedirects(dir, "does-not-exist.yaml")).toThrow(/content\/redirects\.yaml/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("redirects.yaml is NOT a Content Layer collection and lives at its fixed authored path", async () => {
    const { collections } = await import("../../src/content.config");
    expect(Object.keys(collections).sort()).toEqual(["galleries", "places"]);
    expect(REDIRECTS_RELATIVE_PATH).toBe("content/redirects.yaml");
  });
});
