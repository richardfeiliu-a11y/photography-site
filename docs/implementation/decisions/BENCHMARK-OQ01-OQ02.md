# BENCHMARK-OQ01-OQ02 — WP-15 Image Benchmark Decision Record (FROZEN)

**Status:** APPROVED (user review completed 2026-08-29) · **Phase:** P3 · **Branch:** `production-dev`
**Resolves:** OQ-01 (responsive width steps), OQ-02 (format/encoder/quality), plus the IMAGE_PIPELINE §12 deferrals D1–D8 · **Decisions owner:** WP-15
**Companion record (downstream):** `ICC-POLICY.md` (D9/D10, WP-16).

This record freezes the production image pipeline parameters below. They were
measured in the WP-15 campaign (1700 rows × 2 runs over the 17-photo core
stress set, reproducibility 1241/1241 byte-identical), extended by the
high-DPR/portrait addendum (80 rows: 72 encoded / 8 honest CAPs over real
full-resolution sources; browser DPR rendering comparison at frozen Gallery
geometry), reviewed by a human against 100 % crop composites, and the final
values were APPROVED by the user on 2026-08-29.

## Evidence chain

1. **Main campaign:** `docs/implementation/wp15-review/REVIEW-PACKET.md` —
   full matrix (JPEG 65/75/85, WebP 60/70/80, AVIF 45/55/65 × 11
   purpose-widths × 17 fixtures), DPR 1×/2× consumption model, Pareto marks,
   progressive-JPEG probe (−3.1 % bytes, +19.2 % encode time, SSIM unchanged),
   D8 annex. Machine-readable raw output (gitignored, regenerable):
   `bench-output/wp15/{results-run1,results-run2,summary.json}` via
   `npm run bench:wp15`.
2. **Human crop review (first WP-15 review round):** 114 committed 100 %
   composites under `docs/implementation/wp15-review/crops/`. Conclusions
   accepted by the reviewer: AVIF q45 visually rejected as a Gallery/Cover
   production default; AVIF-primary + JPEG-fallback provisional; per-purpose
   qualities provisional (Gallery/Cover q65, Overview q55, JPEG q75);
   progressive JPEG = yes (provisional).
3. **High-DPR + portrait addendum:**
   `docs/implementation/wp15-review/ADDENDUM-HIGH-DPR-PORTRAIT.md` + 18
   browser-rendering strips under `docs/implementation/wp15-review/addendum-crops/`.
   Measured width verdicts at the frozen frame `min(90vw, 1440px)`: DPR1 —
   1600 sufficient; DPR2 (2880 device px) — 1600 visibly soft, 2048 clearly
   visible gain, 2560 subtle-but-real gain, 2880 ≈ 2560 (no meaningful
   gain, +32 % bytes). Portrait display in frozen geometry never consumes
   above the 1600 rung (height-led 80svh → ≈1387 device px at DPR2);
   2048-long-edge corpus masters cap honestly (no-upscale rule upheld).
4. **Final user approval** of D1–D8 on 2026-08-29 (this record).

## Frozen decisions

| # | Decision | Frozen value |
|---|---|---|
| D1 | Responsive Gallery (gallery_display) width steps | **[480, 800, 1024, 1280, 1600, 2048, 2560]** (1024 kept; 2880 rejected) |
| D2 | Production formats + fallback | **AVIF primary, JPEG fallback**; no WebP; standards-compliant `<picture>`/manifest consumption per frozen architecture |
| D3 | Encoder + per-purpose quality | **Sharp/libvips** (the measured toolchain); Gallery AVIF **q65**; Cover AVIF **q65**; Overview AVIF **q55**; JPEG fallback **q75** |
| D4 | Overview thumbnail max dimension | **480 px** |
| D5 | Cover derivative widths | **[1280, 1600, 2048, 2560]**; natural source caps mandatory; no enlargement |
| D6 | High-DPR strategy | **Width-descriptor `srcset` over the D1 ladder**; no fixed @2x pairs; no dedicated 3x derivatives |
| D7 | Progressive JPEG | **YES** — all JPEG fallback derivatives use progressive encoding |
| D8 | Content-addressed digest length | **16 hexadecimal characters** (first-16-hex of SHA-256 over final served bytes) |

### Machine-readable contract (consumed by WP-20 assertions; do not restate values elsewhere)

```json
{
  "record": "BENCHMARK-OQ01-OQ02",
  "frozen_at": "2026-08-29",
  "purposes": {
    "gallery_display": { "widths": [480, 800, 1024, 1280, 1600, 2048, 2560], "avif_quality": 65 },
    "overview": { "widths": [480], "avif_quality": 55 },
    "cover": { "widths": [1280, 1600, 2048, 2560], "avif_quality": 65 }
  },
  "formats": { "primary": "avif", "fallback": "jpeg" },
  "jpeg_fallback_quality": 75,
  "jpeg_progressive": true,
  "webp": "not-generated",
  "max_derivative_width": 2560,
  "digest_hex_characters": 16,
  "rules": {
    "aspect_preserving": true,
    "no_crop": true,
    "no_enlargement": true,
    "source_capped_variants_valid": true,
    "no_fixed_2x_or_3x_artifacts": true
  }
}
```

Notes binding the JSON to the prose:

- Overview is a **single-width** purpose at the 480px ceiling (D4): the
  ladder collapses to `[480]`; smaller overview candidates (240/320) were
  benchmark steps, not production widths.
- Widths above a source's intrinsic (orientation-normalized) width are
  simply not generated — source-capped variant sets are valid and expected
  (e.g. portrait sources cap per D5/D6 evidence; a 1365px master's largest
  gallery variant is 800×1200 at gallery purpose).

  > **Erratum (2026-08-29, WP-20 review):** the example in the sentence above
  > is internally inconsistent with this record's own rules and is corrected
  > here — **prose erratum only; no frozen VALUE changed; the machine-readable
  > JSON block below remains the sole contract.** Under the no-enlargement
  > rule (D5/§15 of IMAGE_PIPELINE) and the addendum's CAP tables, a
  > 1365px-wide master's largest honest gallery variant is the
  > **source-capped 1365×2048** (serving the requested 1600 rung, deduplicated
  > across the 1600/2048/2560 rungs), with the 1024 and 1280 rungs real and
  > uncapped — not "800×1200". The frozen JSON values (widths, qualities,
  > formats) are untouched by this correction.
- D6 acceptance: at the extreme 1440 CSS px / DPR2 consumption the browser
  may display the 2560 derivative at ≈1.125×; the addendum measured no
  meaningful visual benefit from a native 2880 derivative that would justify
  its payload. Do not add 2880.
- D8 digest input: the **final served derivative bytes** (post-WP-21), with
  source hash / rendering config / toolchain ID recorded alongside in the
  manifest for provenance (IMAGE_PIPELINE §9.2 semantics, realized in WP-22).

## Accepted residuals and limitations

1. Single-host, single-toolchain measurements (macOS arm64, Node 22, sharp
   0.35.4/libvips, AVIF via libheif). Quality numbers are encoder-scale;
   changing the pinned encoder invalidates bytes and is a recorded
   toolchain-identifier change (WP-22 provenance).
2. Grayscale SSIM under-reports chroma artifacts; the human crop review is
   the deciding quality evidence (done; AVIF q45 rejected visually).
3. The 1440-CSS/DPR2 corner accepts the ≈1.125× display of the 2560
   derivative (D6 residual, user-approved).
4. Large-HiDPI desktops (≥1920 CSS logical) display 480px overview
   thumbnails at up to ≈1.31× in the full-viewport modal — accepted for
   thumbnails (frozen geometry does not require more).
5. Addendum sources were real archive exports outside the core-17 corpus
   (core-17 full-resolution originals not locally available); six sources
   across five stress roles answered width saturation, not codec ranking.

## Downstream obligations (checked at P3 gate)

- WP-17..WP-24 implement exactly these values; the WP-20 test suite asserts
  its variant plan against the machine-readable JSON above.
- WP-21 applies the WP-16 output-ICC decision (see `ICC-POLICY.md`) —
  embedding happens there, not at encode time.
- WP-22 fingerprints only final served bytes at 16-hex; no filename parsing
  downstream.
- Any change to any value in this record requires re-opening WP-15 with new
  measurement evidence — not a silent edit.
