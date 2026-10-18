// ROUND-2 Minor — preview fast-path precision: the freshness decision is a
// pure function of exact record sets, physical file presence, and the
// production-manifest fingerprint (never photo-ID-only or record-count logs).
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  decidePreviewFreshness,
  mergePreviewManifests,
} from "../../scripts/media/preview-media.mjs";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function record(photo: string, url?: string) {
  return {
    photo_id: photo,
    purpose: "gallery_display",
    format: "jpeg",
    width: 100,
    height: 60,
    public_url: url ?? `/media/${photo}.jpg`,
    bytes: 1,
    source_hash: "s",
    derivative_hash: "d",
    provenance: {},
  };
}

function doc(records: Array<Record<string, unknown>>) {
  return {
    envelope: { generated_at: "2026-01-01T00:00:00.000Z" },
    manifest: { schema: "s", record: {}, toolchain: {}, records },
  };
}

const PROD_BYTES = "prod-manifest-bytes";
const DRAFT_BYTES = "draft-manifest-bytes";
const prodDoc = () => doc([record("p1"), record("p2")]);
const draftDoc = () => doc([record("d1"), record("d2")]);
const sidecarFor = (prodBytes = PROD_BYTES, draftBytes = DRAFT_BYTES) => ({
  prodSha256: sha(prodBytes),
  draftSha256: sha(draftBytes),
});
const allFiles = () => true;

function decide(overrides = {}) {
  return decidePreviewFreshness({
    prodBytes: PROD_BYTES,
    prodDoc: prodDoc(),
    draftBytes: DRAFT_BYTES,
    draftDoc: draftDoc(),
    mergedDoc: doc([...prodDoc().manifest.records, ...draftDoc().manifest.records]),
    sidecar: sidecarFor(),
    draftFileExists: allFiles,
    ...overrides,
  });
}

describe("preview fast-path freshness (exact records + fingerprint + files)", () => {
  test("exact sets, all files, matching fingerprint → skip", () => {
    const d = decide();
    expect(d.fresh).toBe(true);
    expect(d.action).toBe("skip");
    expect(d.stats).toMatchObject({ prodRecords: 2, draftRecords: 2, draftFilesPresent: 2 });
  });

  test("production bytes changed → remerge without re-derivation", () => {
    const d = decide({ prodBytes: "prod-manifest-bytes-CHANGED" });
    expect(d.fresh).toBe(false);
    expect(d.action).toBe("remerge");
  });

  test("draft records changed → rederive", () => {
    const changed = draftDoc();
    changed.manifest.records = changed.manifest.records.slice(0, 1);
    const d = decide({ draftDoc: changed, draftBytes: "draft-manifest-bytes-CHANGED" });
    expect(d.fresh).toBe(false);
    expect(d.action).toBe("rederive");
  });

  test("merged set tampered (record dropped) → remerge, never accepted", () => {
    const tampered = doc([...prodDoc().manifest.records, draftDoc().manifest.records[0]]);
    const d = decide({ mergedDoc: tampered });
    expect(d.fresh).toBe(false);
    expect(d.action).toBe("remerge");
  });

  test("a missing derivative file → rederive", () => {
    const d = decide({ draftFileExists: (name: string) => name !== "d1.jpg" });
    expect(d.fresh).toBe(false);
    expect(d.action).toBe("rederive");
    expect(d.reason).toMatch(/1 draft derivative file/);
  });

  test("missing sidecar with an exact merge → remerge (upgrade path), never a full re-derive", () => {
    const d = decide({ sidecar: null });
    expect(d.fresh).toBe(false);
    expect(d.action).toBe("remerge");
  });

  test("record counts and physical file counts stay distinct", () => {
    const shared = doc([record("d1", "/media/shared.jpg"), record("d2", "/media/shared.jpg")]);
    const d = decide({
      draftDoc: shared,
      draftBytes: "other-bytes",
      mergedDoc: doc([...prodDoc().manifest.records, ...shared.manifest.records]),
      sidecar: sidecarFor(PROD_BYTES, "other-bytes"),
    });
    expect(d.fresh).toBe(true);
    expect(d.stats).toMatchObject({ draftRecords: 2, draftFilesPresent: 1 });
  });

  test("draft photo IDs overlapping production IDs → merge refuses", () => {
    const overlapping = doc([record("p1")]);
    expect(() => mergePreviewManifests({ prodDoc: prodDoc(), draftDoc: overlapping })).toThrow(/overlap/);
  });
});
