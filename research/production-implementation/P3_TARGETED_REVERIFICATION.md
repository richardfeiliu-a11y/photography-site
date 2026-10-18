# P3 Targeted Re-Verification

**Scope:** commit `44bf828` only (`569e172..44bf828`), limited to IMP-01, MIN-01, MIN-02, directly affected tests/docs/Gate evidence.  
**Verdict:** B — targeted correction still required.  
**Finding count:** 0 Critical · 2 Important · 1 Minor.

## Repository State

| Check | Result |
|---|---|
| Branch | `production-dev` — PASS |
| HEAD | `44bf8280099334dad8614843041e29adbb97c75c` — PASS |
| Parent | `569e1722bbfaa5e0010f25e57b220fc6937ca014` — PASS |
| Working tree before review | Clean — PASS |
| Patch scope | Scanner/pruning code, targeted tests, D9/D10 ledger, WP-21/WP-23/Gate evidence, and the previously untracked independent report — consistent with the authorized correction scope |
| P4/P5 | No implementation; both remain `PENDING` |
| Remote/side effects | `origin/production-dev` absent; branch 44 commits ahead of `origin/main`; no push, merge, deploy, release, or P4/P5 action performed |

## IMP-01 JPEG Verification

**Result: PASS.**

Independent probe used a current clean generated JPEG and the test-support `buildGpsExifPayload()` exactly once as the APP1 payload:

```text
clean JPEG
+ FF E1 <length> <Exif\0\0 + valid GPS TIFF>
after the existing EOI
```

Result: `ok=false`, findings include `exif`, `gps`, and `malformed`; the malformed finding reports 170 bytes after EOI. A one-byte trailing probe also fails closed. The clean generated JPEG remains `ok=true`. The same valid GPS payload inserted at the ordinary pre-EOI APP1 location continues to produce `exif + gps`, confirming existing marker/TIFF handling remains intact.

Code inspection confirms `scanJpeg` records EOI in both pre-SOS and entropy-walk paths, treats EOI as the accepted-stream terminator, rejects every trailing byte, and additionally classifies a recognizable trailing APPn/COM segment.

Test-quality note: the newly committed unit/integration “valid GPS” regression constructs `Exif\0\0` twice because `buildGpsExifPayload()` already includes that prefix. Those tests still prove trailing-byte/exif rejection, but not valid GPS TIFF classification. The independent probe above proves the implementation behavior; the test/evidence wording should be corrected (Minor R-03).

## IMP-01 AVIF Verification

**Result: FAIL.**

The intended cases work:

| Probe | Result |
|---|---|
| Clean generated AVIF | PASS (`ok=true`) |
| Adobe-XMP UUID with GPS + serial XMP | FAILS CLOSED (`malformed + xmp + gps + serial`) |
| Unknown UUID | FAILS CLOSED |
| `free` / `skip` / unknown top-level type | FAILS CLOSED |
| Duplicate `meta` | FAILS CLOSED |
| Malformed/truncated top-level length | FAILS CLOSED |
| Unclassified trailing byte | FAILS CLOSED |

The whitelist is grounded in current output: all **354/354** generated AVIF files independently inspected have the exact top-level sequence `ftyp,meta,mdat`.

However, the implementation enforces membership in `{ftyp, meta, mdat}`, not the reported exact structure/cardinality. Independent probes show:

| Direct correction-boundary probe | Actual result |
|---|---|
| Append a second `ftyp` carrying private GPS/serial text | `ok=true`, zero findings |
| Append a second `mdat` carrying private GPS/serial text | `ok=true`, zero findings |
| Remove `mdat`, leaving `ftyp + meta` | `ok=true`, zero findings |

Therefore arbitrary bytes can still be hidden in duplicate accepted top-level boxes, and the claimed narrow policy “`ftyp`, exactly one verified `meta`, `mdat`” is not implemented completely.

**Minimum correction:** enforce the exact current Sharp top-level sequence/cardinality (`ftyp` exactly once, verified `meta` exactly once, `mdat` exactly once, in that order), rejecting duplicate/missing/reordered accepted box types. Add duplicate-`ftyp`, duplicate-`mdat`, and missing-`mdat` adversarial tests containing identifiable private payloads.

## Supported-Format Exhaustiveness

> **EXHAUSTIVE-FOR-SUPPORTED-OUTPUTS: FAIL**

JPEG now satisfies the supported-output byte-boundary contract. AVIF does not: duplicate accepted `ftyp`/`mdat` boxes can carry unclassified bytes while the scan reports clean. Unsupported formats still fail closed as required.

## MIN-01 Verification

**Result: PASS.**

`DEFERRED_ENGINEERING_DECISIONS.md` now records:

- D9: CLOSED, value `assume`, record `docs/implementation/decisions/ICC-POLICY.md`.
- D10: CLOSED, value `no output ICC embedding`, same record.

The diff contains no change to `icc-policy.ts`, `color.ts`, `derive.ts`, naming/Manifest consumers, Astro configuration, or package scripts. Focused ICC tests pass 20/20. This is documentation synchronization only; runtime D9/D10 semantics are unchanged.

## MIN-02 Verification

**Result: FAIL.**

The original basename collision is fixed: `/media/kept.avif` preserves the referenced flat file while `nested/kept.avif` is removed; the emptied nested directory is removed and the output root remains.

Traversal-shaped `/media/../victim.avif` does not protect an arbitrary file. An out-of-base malformed URL causes pruning to no-op, which is conservative but should be explicit/fail-closed rather than represented as successful closure.

The path validation itself is unsafe for a legal Manifest-authoritative filename:

```text
public_url: /media/p..x-avif-w1-aaaaaaaaaaaaaaaa.avif
```

The current naming contract permits Photo IDs matching `[A-Za-z0-9._~-]+` and rejects only IDs exactly `.` or `..`; therefore `p..x` is legal. `pruneStaleDerivatives` uses `rel.includes("..")`, drops this valid reference from the protected set, and deletes the authoritative file. Independent result:

```text
pruned = [orphan.avif, p..x-avif-w1-aaaaaaaaaaaaaaaa.avif]
remaining = []
output root still exists
```

This violates the required invariant that no Manifest-authoritative file is deleted. Because the new correction can delete a valid generated authority and force the pipeline/coverage run to fail, R-02 is classified Important even though the original finding was Minor.

**Minimum correction:** validate path segments, not the substring `".."`. Reject only actual traversal/invalid segments (or, preferably, enforce the existing flat `/media/<single URL-safe filename>` contract through the shared URL-shape rule), while allowing legal consecutive dots inside a filename. Add an authoritative `p..x` survival test plus traversal, bad-prefix, nested-orphan, empty-directory, and output-root assertions.

## Regression Results

Fresh evidence from this re-verification:

| Check | Result |
|---|---|
| Privacy scanner unit tests | 37/37 PASS |
| Privacy integration tests | 12/12 PASS |
| Independent valid JPEG GPS APP1-after-EOI probe | PASS — fails closed with `exif + gps + malformed` |
| Independent Adobe-XMP UUID probe | PASS — fails closed with `xmp + gps + serial + malformed` |
| Independent AVIF exact-cardinality probes | **FAIL — duplicate `ftyp`/`mdat` and missing `mdat` pass** |
| Full media privacy scan | 657/657 PASS |
| Media coverage | 1008/1008; 51/51 complete |
| Full unit suite | 265/265 PASS |
| Full integration suite | 205/205 PASS; includes regeneration/determinism |
| Focused ICC tests | 20/20 PASS |
| Production build | exit 0; WP-13 0/0; Manifest coverage green |
| `npm run check` | exit 0; 0 errors, 0 warnings, 3 existing hints |
| Manifest/final-byte re-hash | 1008 records → 657 files; 0 hash/byte mismatch; 0 missing/orphan |
| Published source hashes | 0 mismatches |
| Frozen fixture checksums | exit 0 |

The scanner and privacy command are read-only. Manifest derivative hashes and source hashes still match after the scan; neither current derivatives nor masters were rewritten.

The correction diff does not modify WP-15 values, ICC/color processing, final-byte hashing/naming order, Manifest schema/consumer, Astro producer-before-consumer wiring, or package build orchestration.

## P3 Gate Matrix

| Criterion | Result |
|---|---|
| WP-15 benchmark decisions | PASS (carry-forward; no correction diff/regression) |
| regeneration/determinism | **FAIL — MIN-02 correction may delete a legal Manifest-authoritative filename** |
| Manifest closure | PASS for current corpus (1008/1008; 657 exact files; no current mismatch) |
| privacy/final metadata | **FAIL — AVIF exact top-level cardinality remains incomplete** |
| representative quality approval | PASS (carry-forward) |
| Astro Manifest consumption | PASS (carry-forward; production build re-verified) |

## Remaining Findings

### R-01 — IMPORTANT — AVIF accepted-box cardinality remains open

Duplicate `ftyp`/`mdat` and missing `mdat` pass. Implement exact current-output top-level sequence/cardinality and add the three direct probes.

### R-02 — IMPORTANT — MIN-02 correction deletes a legal consecutive-dot authority

Replace substring traversal detection with segment-aware/flat-path validation; prove valid consecutive-dot names survive and malformed paths cannot become authority.

### R-03 — MINOR — JPEG regression fixture/evidence duplicates the Exif prefix

Use `buildGpsExifPayload()` directly as the APP1 payload (do not prepend a second `Exif\0\0`) and assert the trailing attack produces a `gps` finding. Correct the Gate addendum’s “valid GPS” claim/transcript accordingly.

No Critical finding and no evidence of current-corpus privacy leakage were found.

## Final Gate

> **P3 IMPLEMENTATION VALID — Targeted correction still required before P4/P5.**

Critical: **0** · Important: **2** · Minor: **1**.

Only R-01/R-02 and the directly related test/evidence correction R-03 are authorized next. P4/P5 remain not authorized.
