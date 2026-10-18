// Light Field Stage 2 — atmosphere sidecar data-layer unit tests.
//
// Pins the three contracts that do NOT need real photo pixels:
//   1. isValidAtmosphereSidecar — the reader's degradation line: a well-formed
//      document is accepted; anything structurally off (version, entries
//      container, a missing/incomplete OKLCH triple) is rejected.
//   2. ambientFor — hit/miss over the sidecar map, plus the no-sidecar case.
//   3. The clamp band (the prototype authority's safety envelope,
//      experiments/design-lab/server.mjs L27–39): dark L always inside
//      0.105–0.175, chroma never above 0.04 (dark) / 0.03 (light), light L
//      pinned at 0.945 — asserted on hand-built channel means, so sharp never
//      runs. Two reference triples (black/red) pin the port verbatim.
//   4. loadAtmosphere degrades to null for a missing, unparsable, or invalid
//      document — and returns the document when it is valid. Each case needs
//      a fresh module instance, so the reader is re-imported per case
//      (module-level cache, exactly like src/lib/exif/read.ts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  ATMOSPHERE_SIDECAR_SCHEMA,
  isValidAtmosphereSidecar,
  type AtmosphereSidecar,
} from "../../src/lib/theme/atmosphere-contract";
import { ambientFor, loadAtmosphere } from "../../src/lib/theme/read";
import {
  DEFAULT_ATMOSPHERE_ENTRY,
  ambientFromChannelMeans,
  srgbToOklch,
} from "../../scripts/media/atmosphere";

const GALLERY_ID = "g_aegean";

const validSidecar: AtmosphereSidecar = {
  version: ATMOSPHERE_SIDECAR_SCHEMA,
  entries: {
    [GALLERY_ID]: {
      light: { l: 0.945, c: 0.022, h: 168.525 },
      dark: { l: 0.139, c: 0.015, h: 168.525 },
    },
  },
};

describe("isValidAtmosphereSidecar", () => {
  it("accepts a well-formed document (an empty entries map included)", () => {
    expect(isValidAtmosphereSidecar(validSidecar)).toBe(true);
    expect(isValidAtmosphereSidecar({ version: ATMOSPHERE_SIDECAR_SCHEMA, entries: {} })).toBe(true);
  });

  it("rejects non-objects and unknown versions", () => {
    expect(isValidAtmosphereSidecar(null)).toBe(false);
    expect(isValidAtmosphereSidecar(undefined)).toBe(false);
    expect(isValidAtmosphereSidecar("{}")).toBe(false);
    expect(isValidAtmosphereSidecar([])).toBe(false);
    expect(isValidAtmosphereSidecar({ entries: {} })).toBe(false);
    expect(
      isValidAtmosphereSidecar({ version: "quiet-editorial-archive/atmosphere@2", entries: {} }),
    ).toBe(false);
  });

  it("rejects a missing or non-map entries container", () => {
    expect(isValidAtmosphereSidecar({ version: ATMOSPHERE_SIDECAR_SCHEMA })).toBe(false);
    expect(isValidAtmosphereSidecar({ version: ATMOSPHERE_SIDECAR_SCHEMA, entries: null })).toBe(false);
    expect(isValidAtmosphereSidecar({ version: ATMOSPHERE_SIDECAR_SCHEMA, entries: [] })).toBe(false);
    expect(isValidAtmosphereSidecar({ version: ATMOSPHERE_SIDECAR_SCHEMA, entries: "g" })).toBe(false);
  });

  it("rejects an entry without both complete, finite OKLCH triples", () => {
    const withEntry = (entry: unknown): unknown => ({
      version: ATMOSPHERE_SIDECAR_SCHEMA,
      entries: { [GALLERY_ID]: entry },
    });
    const { light, dark } = validSidecar.entries[GALLERY_ID];
    expect(isValidAtmosphereSidecar(withEntry(null))).toBe(false);
    expect(isValidAtmosphereSidecar(withEntry({ light }))).toBe(false); // dark missing
    expect(isValidAtmosphereSidecar(withEntry({ light, dark: null }))).toBe(false);
    expect(isValidAtmosphereSidecar(withEntry({ light: { l: 0.945, c: 0.022 }, dark }))).toBe(false); // h missing
    expect(isValidAtmosphereSidecar(withEntry({ light: { l: "0.945", c: 0.022, h: 168 }, dark }))).toBe(false);
    expect(
      isValidAtmosphereSidecar(withEntry({ light, dark: { l: 0.1, c: 0.01, h: Number.NaN } })),
    ).toBe(false);
    expect(
      isValidAtmosphereSidecar(withEntry({ light, dark: { l: 0.1, c: 0.01, h: Number.POSITIVE_INFINITY } })),
    ).toBe(false);
  });
});

describe("ambientFor", () => {
  it("returns the gallery's pair on a hit, null on a miss or without a sidecar", () => {
    expect(ambientFor(validSidecar, GALLERY_ID)).toBe(validSidecar.entries[GALLERY_ID]);
    expect(ambientFor(validSidecar, "g_nowhere")).toBeNull();
    expect(ambientFor(null, GALLERY_ID)).toBeNull();
    expect(ambientFor({ version: ATMOSPHERE_SIDECAR_SCHEMA, entries: {} }, GALLERY_ID)).toBeNull();
  });
});

describe("ambient clamp band (prototype authority: server.mjs L27–39)", () => {
  it("pins the documented fallback pair", () => {
    expect(DEFAULT_ATMOSPHERE_ENTRY).toEqual({
      dark: { l: 0.135, c: 0.01, h: 265 },
      light: { l: 0.945, c: 0.008, h: 265 },
    });
  });

  it("floors dark L at 0.105 (black) and pins light L at 0.945", () => {
    expect(ambientFromChannelMeans(0, 0, 0)).toEqual({
      dark: { l: 0.105, c: 0, h: 0 },
      light: { l: 0.945, c: 0, h: 0 },
    });
  });

  it("ceilings dark L at 0.175 (white)", () => {
    const white = ambientFromChannelMeans(255, 255, 255);
    expect(white.dark.l).toBe(0.175);
    expect(white.dark.c).toBe(0);
    expect(white.light.l).toBe(0.945);
  });

  it("caps chroma at 0.04 dark / 0.03 light and shares one hue (saturated red)", () => {
    expect(ambientFromChannelMeans(255, 0, 0)).toEqual({
      dark: { l: 0.175, c: 0.04, h: 29.234 },
      light: { l: 0.945, c: 0.03, h: 29.234 },
    });
  });

  it("keeps every hand-built sample inside the band, hue wrapped into 0–360", () => {
    for (let v = 0; v <= 255; v += 17) {
      const pair = ambientFromChannelMeans(v, 255 - v, (v * 7) % 256);
      expect(pair.dark.l).toBeGreaterThanOrEqual(0.105);
      expect(pair.dark.l).toBeLessThanOrEqual(0.175);
      expect(pair.dark.c).toBeLessThanOrEqual(0.04);
      expect(pair.light.c).toBeLessThanOrEqual(0.03);
      expect(pair.light.l).toBe(0.945);
      expect(pair.dark.h).toBe(pair.light.h);
      const raw = srgbToOklch(v, 255 - v, (v * 7) % 256);
      expect(raw.H).toBeGreaterThanOrEqual(0);
      expect(raw.H).toBeLessThan(360);
      expect(raw.L).toBeGreaterThanOrEqual(0);
      expect(raw.L).toBeLessThanOrEqual(1);
    }
  });
});

describe("loadAtmosphere degradation (no gate — missing/invalid → null)", () => {
  const workDir = mkdtempSync(join(tmpdir(), "wp-atmosphere-unit-"));
  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  async function loadFresh(root: string): Promise<AtmosphereSidecar | null> {
    vi.resetModules();
    const reader = await import("../../src/lib/theme/read");
    return reader.loadAtmosphere(root);
  }

  it("returns null for missing / unparsable / invalid documents, the document when valid", async () => {
    const path = join(workDir, "generated", "atmosphere.json");

    expect(await loadFresh(workDir)).toBeNull(); // no file at all

    mkdirSync(join(workDir, "generated"), { recursive: true });
    writeFileSync(path, "{ this is not json", "utf8");
    expect(await loadFresh(workDir)).toBeNull(); // JSON.parse throws

    writeFileSync(path, JSON.stringify({ version: "quiet-editorial-archive/atmosphere@2", entries: {} }), "utf8");
    expect(await loadFresh(workDir)).toBeNull(); // valid JSON, wrong version

    writeFileSync(path, JSON.stringify({ version: ATMOSPHERE_SIDECAR_SCHEMA, entries: { g: { light: {} } } }), "utf8");
    expect(await loadFresh(workDir)).toBeNull(); // valid version, incomplete entry

    writeFileSync(path, JSON.stringify(validSidecar), "utf8");
    expect(await loadFresh(workDir)).toEqual(validSidecar);

    // The statically imported reader keeps a module-level cache: the first
    // call parses the (now valid) document, the second returns that instance.
    const first = loadAtmosphere(workDir);
    expect(first).toEqual(validSidecar);
    expect(loadAtmosphere(workDir)).toBe(first);
  });
});
