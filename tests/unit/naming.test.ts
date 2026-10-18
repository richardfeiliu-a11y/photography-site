// WP-22 unit tests — fingerprint naming + asset manifest (IMAGE_PIPELINE.md
// §8.3, §9, §10; BENCHMARK-OQ01-OQ02 D8; BUILD_AND_ROUTING §10).
//
// Proven here:
//   1. (a) The D8 fingerprint is the FIRST-16-HEX of SHA-256 over the exact
//      final served bytes — pinned against known vectors ("" and "abc").
//   2. (b) Fingerprint/URL is a strict function of the final bytes + plan
//      facts: same bytes → same URL, ANY upstream change (source bytes, or a
//      test-mutated frozen quality in a synthetic record doc) → different
//      URL. Toolchain identifier: recorded per manifest record + core
//      (provenance semantics, §9.2) — bytes-only digests make any
//      encoder/toolchain change change the bytes and therefore the URL.
//   3. (c) Manifest determinism: the canonical core serializes byte-stably
//      across two builds; timestamps live ONLY in the envelope.
//   4. (d) Schema: every record carries the §10.2 fields + provenance; no
//      filename-width-regex parsing exists anywhere in src/ or scripts/.
//   5. (e) The stage refuses to run unless the WP-21 finalizeAndVerify
//      report is present, ok, and COVERS the derive results (fail closed,
//      rule token 9:requires-verified-final-bytes), and the stage plan is
//      the finalize plan + hash-output LAST (WP-18 guard).
//   6. Cross-purpose byte identity (WP-20.md): byte-identical derivatives
//      across purposes share ONE content-addressed file; the publish step
//      unlinks the redundant intermediates and the manifest records each
//      purpose against the shared URL.
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  deriveSource,
  loadDerivativeRecord,
  parseDerivativeRecord,
  type DerivativeResult,
  type DeriveSourceResult,
  type FrozenDerivativeRecord,
} from "../../scripts/media/derive";
import { finalizeAndVerify } from "../../scripts/media/privacy-check";
import {
  DIGEST_COLLISION_RULE,
  HASH_STAGE_PLAN,
  MISSING_INTERMEDIATE_RULE,
  NAMING_INPUT_RULE,
  NamingError,
  UNSAFE_ID_RULE,
  contentAddressedFileName,
  fingerprintHex,
  publishDerivatives,
  resolveDigestHexChars,
  sha256Hex,
  validateNamingStagePlan,
} from "../../scripts/media/naming";
import {
  buildDeterministicCore,
  buildManifestRecord,
  canonicalJson,
  getToolchain,
  manifestCoreSha256,
  toolchainId,
} from "../../scripts/media/manifest";
import { FINALIZE_STAGE_PLAN, type FinalizeReport } from "../../scripts/media/privacy-check";

const RECORD_DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "implementation",
  "decisions",
  "BENCHMARK-OQ01-OQ02.md",
);

/** Rebuild a decision-record doc whose machine JSON block is mutated. */
function mutatedDoc(record: FrozenDerivativeRecord, mutate: (raw: Record<string, unknown>) => void): string {
  const raw = structuredClone(record.raw);
  mutate(raw);
  return "```json\n" + JSON.stringify(raw, null, 2) + "\n```";
}

/** A record copy with only `digest_hex_characters` replaced (no JSON round-trip, so NaN survives). */
function withRawDigestChars(value: unknown): FrozenDerivativeRecord {
  return { ...frozen, raw: { ...frozen.raw, digest_hex_characters: value } };
}

/** The decision-record identity the manifest core must carry (never restated in code). */
function recordRef(): { id: string; frozen_at: string } {
  return { id: frozen.recordId, frozen_at: frozen.frozenAt };
}

/** Remove comments so static greps pin CODE, not the documentation of rules. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

let workDir: string;
let frozen: FrozenDerivativeRecord;
let tinyJpeg: Buffer;
let tinyJpegMutated: Buffer;
let baseResult: DeriveSourceResult;
let basePublished: Awaited<ReturnType<typeof publishDerivatives>>;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp22-unit-"));
  frozen = await loadDerivativeRecord(RECORD_DOC);
  tinyJpeg = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 120, g: 90, b: 60 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  // Same Photo ID, replaced master bytes (corrected-master scenario, unit scale).
  tinyJpegMutated = await sharp(tinyJpeg)
    .modulate({ brightness: 1.02 })
    .jpeg({ quality: 88 })
    .toBuffer();

  const outBase = join(workDir, "out-base");
  baseResult = await deriveSource(
    { photoId: "p_unit_001", source: tinyJpeg },
    { outDir: outBase, frozenRecord: frozen },
  );
  const report = await finalizeAndVerify([baseResult]);
  basePublished = await publishDerivatives([baseResult], {
    report,
    digestHexChars: resolveDigestHexChars(frozen),
  });
}, 120_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("D8 digest over final served bytes (IMAGE_PIPELINE §9, record D8)", () => {
  test("(a) known vector: fingerprintHex is the first-16-hex of SHA-256 over the exact bytes", () => {
    expect(fingerprintHex(Buffer.alloc(0), 16)).toBe("e3b0c44298fc1c14");
    expect(fingerprintHex(Buffer.from("abc", "utf8"), 16)).toBe("ba7816bf8f01cfea");
    // And the full digest is the plain SHA-256 (64 hex).
    expect(sha256Hex(Buffer.from("abc", "utf8"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("(a) digest length is read from the FROZEN record (D8 = 16), not hardcoded", async () => {
    expect(resolveDigestHexChars(frozen)).toBe(16);
    const mutated = parseDerivativeRecord(
      mutatedDoc(frozen, (raw) => {
        raw["digest_hex_characters"] = 12;
      }),
    );
    expect(resolveDigestHexChars(mutated)).toBe(12);
  });

  test("(a) digest length resolution fails closed on invalid record values", () => {
    // Too short (below the §9.1 collision-resistance floor).
    expect(() =>
      resolveDigestHexChars(withRawDigestChars(4)),
    ).toThrow(NamingError);
    // Type violations: string, NaN, null.
    expect(() =>
      resolveDigestHexChars(withRawDigestChars("16" as unknown as number)),
    ).toThrow(NamingError);
    expect(() => resolveDigestHexChars(withRawDigestChars(Number.NaN))).toThrow(NamingError);
    expect(() =>
      resolveDigestHexChars(withRawDigestChars(null as unknown as number)),
    ).toThrow(NamingError);
    // Too long (beyond the underlying SHA-256).
    expect(() => resolveDigestHexChars(withRawDigestChars(128))).toThrow(NamingError);
  });

  test("fingerprint changes when ANY byte of the input changes", () => {
    const a = Buffer.from([1, 2, 3]);
    const b = Buffer.from([1, 2, 4]);
    expect(fingerprintHex(a, 16)).not.toBe(fingerprintHex(b, 16));
    expect(fingerprintHex(a, 16)).toBe(fingerprintHex(Buffer.from([1, 2, 3]), 16));
  });
});

describe("content-addressed naming scheme", () => {
  test("name is {photoId}-{format}-w{width}-{digest16}.{ext}, fully determined by manifest fields", () => {
    expect(
      contentAddressedFileName({ photoId: "p_reine_001", format: "avif", width: 1600, digest: "a3f8c1d2e4b56078" }),
    ).toBe("p_reine_001-avif-w1600-a3f8c1d2e4b56078.avif");
    expect(
      contentAddressedFileName({ photoId: "p_reine_001", format: "jpeg", width: 480, digest: "0123456789abcdef" }),
    ).toBe("p_reine_001-jpeg-w480-0123456789abcdef.jpg");
  });

  test("refuses unsafe photoIds and malformed digests (fail closed)", () => {
    expect(() =>
      contentAddressedFileName({ photoId: "../escape", format: "avif", width: 1, digest: "a".repeat(16) }),
    ).toThrow(NamingError);
    expect(() =>
      contentAddressedFileName({ photoId: "p", format: "avif", width: 1, digest: "NOThex!!" }),
    ).toThrow(NamingError);
  });

  test("refuses path-safe but URL-UNSAFE photoIds (they would break public_urls)", () => {
    // Each of these is a legal filesystem filename yet percent-encoding /
    // fragment / query / non-ASCII hazards in the final public URL.
    for (const photoId of ["p 001", "p#1", "p?x", "p%20", "pé", "p+1", "p=1", "p&1"]) {
      expect(() =>
        contentAddressedFileName({ photoId, format: "avif", width: 1, digest: "a".repeat(16) }),
      ).toThrow(new RegExp(UNSAFE_ID_RULE.replace(":", "\\:")));
    }
    // The enforced pattern is the RFC 3986 unreserved set; "." and ".." stay refused.
    expect(() =>
      contentAddressedFileName({ photoId: "..", format: "avif", width: 1, digest: "a".repeat(16) }),
    ).toThrow(NamingError);
    expect(() =>
      contentAddressedFileName({ photoId: "p_reine-001.v2~x", format: "avif", width: 1, digest: "a".repeat(16) }),
    ).not.toThrow();
  });
});

describe("URL changes when any upstream stage changes (§9.2 hash-input semantics)", () => {
  test("mutated frozen quality in a test record changes the URL of that variant only", async () => {
    const mutated = parseDerivativeRecord(
      mutatedDoc(frozen, (raw) => {
        (raw["purposes"] as Record<string, { avif_quality: number }>)["gallery_display"]!.avif_quality = 66;
      }),
    );
    const outMutated = join(workDir, "out-mutated");
    const mutatedResult = await deriveSource(
      { photoId: "p_unit_001", source: tinyJpeg },
      { outDir: outMutated, frozenRecord: mutated },
    );
    const mutatedReport = await finalizeAndVerify([mutatedResult]);
    const mutatedPublished = await publishDerivatives([mutatedResult], {
      report: mutatedReport,
      digestHexChars: 16,
    });

    const urlOf = (pub: typeof basePublished, purpose: string, format: string): string => {
      const entry = pub.published.find((d) => d.purpose === purpose && d.format === format);
      expect(entry, `${purpose}/${format} must exist`).toBeDefined();
      return entry!.publicUrl;
    };

    // Gallery AVIF quality 65 → 66: gallery avif bytes change → URL changes.
    expect(urlOf(mutatedPublished, "gallery_display", "avif")).not.toBe(
      urlOf(basePublished, "gallery_display", "avif"),
    );
    // Overview (55) and fallback JPEG (75) are untouched by the mutation.
    expect(urlOf(mutatedPublished, "overview", "avif")).toBe(urlOf(basePublished, "overview", "avif"));
    expect(urlOf(mutatedPublished, "gallery_display", "jpeg")).toBe(
      urlOf(basePublished, "gallery_display", "jpeg"),
    );
  });

  test("replaced master bytes under the SAME Photo ID change every URL (corrected master, unit scale)", async () => {
    const outCorrected = join(workDir, "out-corrected");
    const corrected = await deriveSource(
      { photoId: "p_unit_001", source: tinyJpegMutated },
      { outDir: outCorrected, frozenRecord: frozen },
    );
    const correctedReport = await finalizeAndVerify([corrected]);
    const correctedPublished = await publishDerivatives([corrected], {
      report: correctedReport,
      digestHexChars: 16,
    });

    const baseUrls = basePublished.published.map((d) => d.publicUrl).sort();
    const correctedUrls = correctedPublished.published.map((d) => d.publicUrl).sort();
    expect(correctedUrls).toHaveLength(baseUrls.length);
    for (const url of correctedUrls) expect(baseUrls).not.toContain(url);
    expect(corrected.photoId).toBe(baseResult.photoId);
    expect(corrected.sourceSha256).not.toBe(baseResult.sourceSha256);
  });
});

describe("toolchain identifier (§9.2 provenance)", () => {
  test("records {node, sharp, libvips} programmatically and composes a stable id", () => {
    const toolchain = getToolchain();
    expect(toolchain.node).toBe(process.version);
    expect(toolchain.sharp).toMatch(/^\d+\.\d+\.\d+/);
    expect(toolchain.libvips).toMatch(/^\d+\.\d+\.\d+/);
    const id = toolchainId(toolchain);
    expect(id).toContain(toolchain.node);
    expect(id).toContain(toolchain.sharp);
    expect(id).toContain(toolchain.libvips);
    expect(toolchainId()).toBe(id); // deterministic composition
  });

  test("the toolchain id travels on every manifest record's provenance and the manifest core", () => {
    const id = toolchainId();
    const record = buildManifestRecord(basePublished.published[0]!, id);
    expect(record.provenance.toolchain_id).toBe(id);
    const core = buildDeterministicCore(basePublished.published, recordRef());
    expect(core.toolchain.id).toBe(id);
    expect(core.toolchain.node).toBe(process.version);
  });
});

describe("cross-purpose byte identity shares ONE final file (WP-20.md)", () => {
  test("identical bytes across purposes collapse to one file; manifest records both purposes", async () => {
    // The 64px unit source caps every purpose to ONE variant at width 64:
    // gallery/cover AVIF share q65 and all three JPEGs share q75-progressive,
    // so 6 intermediate files → fewer final files.
    expect(basePublished.published.length).toBe(6);
    expect(basePublished.finalFiles).toBeLessThan(6);
    const byUrl = new Map<string, string[]>();
    for (const entry of basePublished.published) {
      byUrl.set(entry.publicUrl, [...(byUrl.get(entry.publicUrl) ?? []), entry.purpose]);
    }
    const shared = [...byUrl.entries()].filter(([, purposes]) => purposes.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    // Every recorded purpose resolves to the SAME bytes: one file on disk.
    const outDir = join(workDir, "out-base");
    for (const [url] of byUrl) {
      const file = join(outDir, url.replace(/^\/media\//, ""));
      const bytes = await readFile(file);
      expect(sha256Hex(bytes)).toBe(
        basePublished.published.find((d) => d.publicUrl === url)!.derivativeHash,
      );
    }
    // The redundant duplicate intermediates were removed.
    const leftovers = (await readdir(outDir)).filter((name) => name.includes("-w64-"));
    expect(leftovers).toHaveLength(basePublished.finalFiles);
  });
});

describe("manifest schema and canonical serialization (IMAGE_PIPELINE §8.3, §10)", () => {
  test("(d) every record carries the §10.2 fields + provenance", () => {
    const core = buildDeterministicCore(basePublished.published, recordRef());
    const required = [
      "photo_id",
      "purpose",
      "format",
      "width",
      "height",
      "public_url",
      "bytes",
      "source_hash",
      "derivative_hash",
      "provenance",
    ] as const;
    expect(core.records).toHaveLength(basePublished.published.length);
    for (const record of core.records) {
      for (const field of required) expect(record, field).toHaveProperty(field);
      expect(record.source_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(record.derivative_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(record.bytes).toBeGreaterThan(0);
      expect(record.width).toBeGreaterThan(0);
      expect(record.height).toBeGreaterThan(0);
      expect(record.public_url).toMatch(/^\/media\/.+/);
      expect(record.provenance.requested_width).toBeGreaterThan(0);
      expect(record.provenance.capped).toBe(record.provenance.requested_width !== record.width);
      expect(typeof record.provenance.quality).toBe("number");
      expect(typeof record.provenance.progressive).toBe("boolean");
      expect(record.provenance.source_hash).toBe(record.source_hash);
      expect(typeof record.provenance.toolchain_id).toBe("string");
    }
  });

  test("(c) canonicalJson sorts keys recursively and serializes stably", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 4, y: 5 }] } })).toBe(
      JSON.stringify({ a: { c: [3, { y: 5, z: 4 }], d: 2 }, b: 1 }, null, 2) + "\n",
    );
  });

  test("(c) two identical runs produce a byte-identical core; timestamps excluded", async () => {
    // Re-run the identical derivation into a fresh dir (run 2).
    const outRun2 = join(workDir, "out-run2");
    const run2 = await deriveSource(
      { photoId: "p_unit_001", source: tinyJpeg },
      { outDir: outRun2, frozenRecord: frozen },
    );
    const report2 = await finalizeAndVerify([run2]);
    const published2 = await publishDerivatives([run2], { report: report2, digestHexChars: 16 });

    const core1 = buildDeterministicCore(basePublished.published, recordRef());
    const core2 = buildDeterministicCore(published2.published, recordRef());
    const body1 = canonicalJson(core1);
    const body2 = canonicalJson(core2);
    expect(body1).toBe(body2);
    expect(manifestCoreSha256(core1)).toBe(manifestCoreSha256(core2));
    // The core must not embed any timestamp: a re-parse shows no date fields.
    expect(body1).not.toMatch(/generated_at|timestamp/i);
  });

  test("record ordering is deterministic (photo, purpose, format, width)", () => {
    const core = buildDeterministicCore(basePublished.published, recordRef());
    const purposeRank: Record<string, number> = {
      gallery_display: 0,
      overview: 1,
      cover: 2,
    };
    const keys = core.records.map((r) => `${r.photo_id}|${r.purpose}|${r.format}|${r.width}`);
    const expected = [...keys].sort((a, b) => {
      const [pa, fa] = a.split("|");
      const [pb, fb] = b.split("|") as [string, string];
      if (pa !== pb) return (purposeRank[pa!] ?? 9) - (purposeRank[pb!] ?? 9);
      if (fa !== fb) return fa === "avif" ? -1 : 1;
      return a.localeCompare(b);
    });
    expect(keys).toEqual(expected);
    expect(core.schema).toBe("quiet-editorial-archive/asset-manifest@1");
  });
});

describe("stage entry refuses to run without a passing WP-21 verification (§9 after §6–7)", () => {
  test("(e) missing report → NamingError with rule token", async () => {
    const out = join(workDir, "out-refuse-missing");
    const result = await deriveSource(
      { photoId: "p_refuse", source: tinyJpeg },
      { outDir: out, frozenRecord: frozen },
    );
    // The type system requires a report; the runtime guard must still fail
    // closed when one is missing (wiring bugs must not fingerprint bytes).
    const noReport = { digestHexChars: 16 } as unknown as Parameters<typeof publishDerivatives>[1];
    await expect(publishDerivatives([result], noReport)).rejects.toThrow(NamingError);
    await expect(publishDerivatives([result], noReport)).rejects.toThrow(
      new RegExp(NAMING_INPUT_RULE),
    );
  });

  test("(e) a report with any failed file → refuse with rule token, nothing published", async () => {
    const out = join(workDir, "out-refuse-failed");
    const result = await deriveSource(
      { photoId: "p_refuse2", source: tinyJpeg },
      { outDir: out, frozenRecord: frozen },
    );
    // Corrupt ONE final derivative so verification fails (fail-closed scanner).
    const victim = result.derivatives[0]!;
    await writeFile(victim.file, Buffer.concat([await readFile(victim.file), Buffer.from([0xde, 0xad])]));
    const report = await finalizeAndVerify([result], { throwOnError: false });
    expect(report.ok).toBe(false);

    const outFinal = join(out, "final");
    await mkdir(outFinal);
    await expect(
      publishDerivatives([result], { report, digestHexChars: 16 }),
    ).rejects.toThrow(NamingError);
    // The stage must not have renamed anything: every intermediate still present.
    for (const d of result.derivatives) {
      await expect(stat(d.file)).resolves.toMatchObject({ isFile: expect.any(Function) });
    }
  });

  test("(e) a report that does not cover the derive results → refuse (fail closed)", async () => {
    const out = join(workDir, "out-refuse-coverage");
    const a = await deriveSource({ photoId: "p_cov_a", source: tinyJpeg }, { outDir: out, frozenRecord: frozen });
    const b = await deriveSource({ photoId: "p_cov_b", source: tinyJpeg }, { outDir: out, frozenRecord: frozen });
    const reportA = await finalizeAndVerify([a]);
    // The report covers only source A, not B.
    await expect(
      publishDerivatives([a, b], { report: reportA, digestHexChars: 16 }),
    ).rejects.toThrow(NamingError);
  });

  test("(e) a missing intermediate (one-shot re-publish) → rule-precise refusal, not raw ENOENT", async () => {
    const out = join(workDir, "out-refuse-missing-file");
    const result = await deriveSource(
      { photoId: "p_missing", source: tinyJpeg },
      { outDir: out, frozenRecord: frozen },
    );
    const report = await finalizeAndVerify([result]);
    // Simulate a re-run after a previous publish consumed the intermediates.
    await rm(result.derivatives[0]!.file);
    await expect(
      publishDerivatives([result], { report, digestHexChars: 16 }),
    ).rejects.toThrow(new RegExp(MISSING_INTERMEDIATE_RULE.replace(":", "\\:")));
  });
});

describe("genuine D8 digest collision (two intermediates, one content-addressed name, different bytes)", () => {
  test("9:digest-collision, fail closed, NOTHING renamed", async () => {
    // Find a real 32-bit-prefix (8-hex) birthday collision over distinct
    // buffers — ~2^16 SHA-256 computations, sub-second.
    const hashByPrefix = new Map<string, Buffer>();
    let colliding: [Buffer, Buffer] | null = null;
    for (let i = 0; colliding === null; i++) {
      const buf = Buffer.from(`collision-probe-${i}`);
      const prefix = sha256Hex(buf).slice(0, 8);
      const seen = hashByPrefix.get(prefix);
      if (seen !== undefined) colliding = [seen, buf];
      else hashByPrefix.set(prefix, buf);
    }
    const [bufA, bufB] = colliding;
    expect(bufA.equals(bufB)).toBe(false);
    expect(sha256Hex(bufA).slice(0, 8)).toBe(sha256Hex(bufB).slice(0, 8));

    // Hand-built derive results: SAME photoId, SAME format, SAME width,
    // two purposes pointing at DIFFERENT bytes → identical content-addressed
    // name, differing full hashes.
    const out = join(workDir, "out-collision");
    await mkdir(out, { recursive: true });
    const fileA = join(out, "inter-a.avif");
    const fileB = join(out, "inter-b.avif");
    await writeFile(fileA, bufA);
    await writeFile(fileB, bufB);
    const mkDerivative = (purpose: string, file: string, buf: Buffer): DerivativeResult => ({
      purpose: purpose as DerivativeResult["purpose"],
      format: "avif",
      requestedWidth: 480,
      width: 64,
      height: 48,
      quality: 65,
      progressive: false,
      bytes: buf.length,
      file,
    });
    const collisionResult: DeriveSourceResult = {
      photoId: "p_collision",
      sourceSha256: sha256Hex(Buffer.from("source")),
      displayWidth: 64,
      displayHeight: 48,
      derivatives: [mkDerivative("gallery_display", fileA, bufA), mkDerivative("overview", fileB, bufB)],
    };
    const report: FinalizeReport = {
      stagePlan: [],
      sources: [
        { photoId: "p_collision", masterChecked: false, derivativeFiles: 2, findings: [] },
      ],
      filesScanned: 2,
      bytesScanned: bufA.length + bufB.length,
      masterIssues: [],
      findings: [],
      ok: true,
    };

    await expect(
      publishDerivatives([collisionResult], { report, digestHexChars: 8 }),
    ).rejects.toThrow(new RegExp(DIGEST_COLLISION_RULE.replace(":", "\\:")));
    // Two-phase publish: the collision is detected BEFORE any rename, so
    // both intermediates are untouched and no content-addressed file exists.
    await expect(stat(fileA)).resolves.toBeTruthy();
    await expect(stat(fileB)).resolves.toBeTruthy();
    expect((await readdir(out)).filter((name) => name.endsWith(".avif") && name !== "inter-a.avif" && name !== "inter-b.avif")).toEqual([]);
  });
});

describe("stage plan (WP-18 guard): finalize plan + hash-output LAST", () => {
  test("HASH_STAGE_PLAN === FINALIZE_STAGE_PLAN + hash-output and validates", () => {
    expect(HASH_STAGE_PLAN).toEqual([...FINALIZE_STAGE_PLAN, "hash-output"]);
    expect(validateNamingStagePlan()).toEqual(HASH_STAGE_PLAN);
  });

  test("a mis-ordered plan fails closed with the guard's rule tokens", () => {
    expect(() => validateNamingStagePlan(["hash-output", "resize-encode"])).toThrow(/5:stage-order/);
    expect(() =>
      validateNamingStagePlan(["read-decode", "resize-encode", "hash-output"]),
    ).toThrow(/5:resize-requires-orientation/);
    expect(() =>
      validateNamingStagePlan(["read-decode", "normalize-orientation", "resize-encode", "strip-metadata"]),
    ).not.toThrow();
    // hash-output not last.
    expect(() =>
      validateNamingStagePlan(["read-decode", "hash-output", "strip-metadata"]),
    ).toThrow(/5:hash-last/);
  });
});

describe("(d) no filename-width-regex parsing anywhere in src/ or scripts/", () => {
  test("static grep: consumption code never extracts width from filenames", async () => {
    const roots = [
      join(import.meta.dirname, "..", "..", "src"),
      join(import.meta.dirname, "..", "..", "scripts"),
    ];
    const offenders: string[] = [];
    // Extraction-shaped patterns: a regex/literal that pulls the width out of
    // a `-wNNN` filename segment. Construction from recorded fields (the
    // intermediate-name builder) does NOT match any of these.
    const forbidden = [
      /\/-w\(\\d/, // regex literal /-w(\d+)/
      /match\s*\(\s*["'`]\/?-w/, // .match(/-w…/) or .match("-w…")
      /matchAll\s*\(\s*["'`]?\/?-w/, // .matchAll(/-w…/) or .matchAll("-w…")
      /split\s*\(\s*["'`]-w/, // .split("-w…")
      /replace\s*\(\s*\/-w/, // .replace(/-w…/, …)
      /exec\s*\(\s*\/-w/, // .exec(/-w…/)
      // parseInt-driven extraction: parseInt(...) fed from a -w match/split,
      // e.g. parseInt(name.match(/-w(\d+)/)[1], 10) or parseInt over parts
      // obtained by splitting a filename on "-w".
      /parseInt\s*\([^)\n]*(?:\/-w|["'`]-w)/, // parseInt(…match(/-w… / parseInt(…split("-w…
      /slice\s*\(\s*["'`]w/, // .slice("w…") string-slice tripwire
      // WP-24 extension (selector patterns): width must come from manifest
      // entries, never from slicing/parseInt-ing a public_url — forbid
      // parseInt fed from a .slice(...) expression or from a public_url
      // reference (e.g. parseInt(url.slice(7)) — parsing the /media/ prefix
      // or a -wNNN segment back out of the URL).
      /parseInt\s*\([^)\n]*\.slice\s*\(/,
      /parseInt\s*\([^)\n]*public_url/,
    ];
    for (const root of roots) {
      const files = await collectFiles(root);
      for (const file of files) {
        const code = stripComments(await readFile(file, "utf8"));
        if (forbidden.some((pattern) => pattern.test(code))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

async function collectFiles(dir: string): Promise<string[]> {
  const { readdirSync, statSync } = await import("node:fs");
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...(await collectFiles(full)));
    else if (/\.(ts|tsx|astro|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}
