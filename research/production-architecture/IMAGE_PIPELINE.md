# Image Pipeline -- Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion documents:** SOURCE_OF_TRUTH_MATRIX.md, BUILD_AND_ROUTING.md, CONTENT_MODEL.md, TECHNICAL_API_VERIFICATION.md, OPEN_QUESTIONS.md

---

## 1. Purpose and scope

The image pipeline is a deterministic build subsystem that reads WEB INGEST MASTERS and produces WEB DERIVATIVES plus a generated asset manifest. It operates independently from Astro page rendering. The manifest is consumed by Astro at build time, never at browser runtime.

The pipeline never mutates WEB INGEST MASTERS. Source files are read-only inputs.

---

## 2. Media terminology (canonical)

These four classes are used precisely throughout this document and all companion architecture documents. Do not collapse them.

| Class | Definition | Regenerable? | Backed up off-site? |
|---|---|---:|---:|
| CAMERA ORIGINAL | RAW/JPEG exactly as captured by the camera. May live outside the website repository/storage. Not necessarily directly ingestible by the web pipeline. | No | Yes (archival) |
| ARCHIVAL MASTER | Long-term preservation master; equals camera original or edited master per photographer workflow. Outside public site output. | No | Yes (archival) |
| WEB INGEST MASTER | The non-regenerable image input consumed by the website image pipeline (e.g. a high-quality JPEG exported from the archival workflow). Production pipeline source. **Never describe as generated or ephemeral.** | No | **Yes (required)** |
| WEB DERIVATIVE | Regenerable responsive output (JPEG/WebP/etc). Never a source of truth. Never manually edited. | Yes | No |

Cross-reference: SOURCE_OF_TRUTH_MATRIX.md section 1.

---

## 3. Single media root and source_ref contract

### 3.1 Canonical WEB INGEST MASTER root

All WEB INGEST MASTERS reside under one architectural root:

```
media/ingest-masters/{gallery}/...
```

This path is used consistently across all canonical documents. The following paths are **not** used as alternate ingest roots: `media/originals/`, `media/archival/`, `content/galleries/photos/`, `media/ingest/`, `assets-staging/`.

### 3.2 source_ref is relative

`source_ref` in Gallery YAML is relative to the WEB INGEST MASTER root. Example:

```yaml
photos:
  - id: p_reine_001
    source_ref: lofoten-light/DSC02762.jpg
```

The absolute server path (e.g. `/Volumes/...`, `/srv/media/...`) belongs to environment configuration, never to authored content. Production hosts may mount or symlink external storage at the `media/ingest-masters/` path.

### 3.3 Media ownership

Git tracks source code, authored YAML metadata, site settings, redirects, tests, and architecture docs. Git/Git-LFS is **not** the photographic archive. WEB INGEST MASTERS live on the media filesystem and require independent off-site backup. Git LFS may be discussed only as an optional later transport choice, never the canonical baseline.

Cross-reference: SOURCE_OF_TRUTH_MATRIX.md sections 2-3, BACKUP_AND_RECOVERY.md.

---

## 4. Photo identity and corrected-master semantics

Photo identity is editorial identity, not file-byte identity. This distinction governs how the pipeline treats source changes.

### 4.1 Same Photo ID retained

A corrected or re-exported master retains the same Photo ID when it is still the same authored photograph. Operations that preserve identity include:

- Filename change
- Path move
- JPEG re-export (higher quality, different compression)
- ICC correction
- Metadata cleanup
- Technical color/exposure correction
- Dust cleanup

When a master is replaced under the same Photo ID, the source hash changes but the Photo ID does not. The pipeline regenerates derivatives with new content-addressed URLs automatically.

### 4.2 New Photo ID required

A new Photo ID is created when the result is a distinct authored photograph:

- Different capture/frame
- Materially different editorial crop intended as a separate work
- Composite
- Substantial content alteration
- Both versions intentionally coexist as separate Photos

### 4.3 SHA-256 role

SHA-256 (or equivalent digest) is integrity and revision metadata. It detects source changes and drives content-addressed derivative filenames. It is **not** Photo identity.

Cross-reference: CONTENT_MODEL.md, UD-002.

---

## 5. Canonical pipeline stage order

The pipeline executes stages in this fixed conceptual order. Each stage has a rationale grounded in correctness dependencies.

```
1. READ / DECODE
   Decode source bytes from WEB INGEST MASTER.
   Rationale: all subsequent stages require decoded pixel data.

2. READ ORIENTATION + ICC + REQUIRED METADATA
   Extract EXIF orientation tag, ICC profile, intrinsic dimensions,
   and any metadata needed for color conversion or internal use.
   Rationale: orientation and ICC must be read BEFORE either is
   consumed or stripped. Stripping metadata before color conversion
   can destroy the ICC profile needed for correct transform.

3. NORMALIZE ORIENTATION
   Apply EXIF orientation to pixel data so that the image is upright
   in its decoded form. Reset or remove the orientation tag.
   Rationale: resize and derivative generation assume upright pixels.
   Orientation normalization must happen before resize.

4. COLOR TRANSFORM TO TARGET WEB COLOR SPACE
   If valid source ICC exists: convert from source color space to sRGB.
   If no ICC profile: apply documented no-profile policy (see section 6).
   Rationale: color conversion requires both source ICC and pixel data.
   Must occur after decode and ICC read, before encoding.

5. RESIZE / ENCODE DERIVATIVES
   For each required purpose (Gallery display, Overview thumbnail, cover),
   resize without crop or upscale, preserving aspect ratio. Encode to
   target format(s) with benchmark-determined quality settings.
   Rationale: encoding is the final pixel-affecting step.

6. REMOVE PRIVACY-SENSITIVE METADATA FROM PUBLIC FILES
   Strip GPS, camera/device serial identifiers, and unnecessary private
   metadata from public derivative files. Do not retain camera/lens/date
   metadata in public derivatives without a product requirement.
   Rationale: privacy stripping occurs AFTER color conversion so that
   ICC-related metadata is available during conversion. Public derivatives
   carry no EXIF by default.

7. OPTIONALLY EMBED APPROVED STANDARD OUTPUT ICC
   If benchmark selects it, embed an sRGB ICC profile in public derivatives.
   Rationale: output ICC embedding is a post-conversion decision that
   depends on benchmark evidence.

8. HASH / OUTPUT
   Compute content-addressed digest for each derivative. Write derivative
   files to generated/media/. Write or update generated/asset-manifest.json.
   Rationale: hashing is the final step because it must reflect all
   prior transforms.
```

### Stage ordering invariants

- Metadata needed for color conversion (ICC profile) must not be stripped before conversion.
- Orientation must be normalized before resize.
- Privacy stripping must occur after color conversion.
- Hashing must occur after all pixel and metadata transforms.

---

## 6. ICC policy

### 6.1 Valid source ICC

If the WEB INGEST MASTER contains a valid ICC profile, the pipeline respects it and converts to sRGB. This is the primary path.

### 6.2 No ICC profile

If no ICC profile exists, this is treated as an explicit policy limitation, not as proven truth about the image's color space. The default no-profile policy for MVP may assume sRGB, but this assumption must be clearly documented. No camera-model guessing is performed.

Future implementation may support an explicit override or fail policy for untagged sources.

### 6.3 Verified Sharp APIs for ICC and color management

The following method names are verified against current Sharp documentation (see TECHNICAL_API_VERIFICATION.md):

- `keepIccProfile()` -- retain source ICC in output
- `withIccProfile(icc, [options])` -- attach a specific ICC profile
- `toColourspace('srgb')` / `toColorspace('srgb')` -- convert to sRGB
- `pipelineColourspace(...)` -- set working color space

The following do **not** exist and must not appear except as rejected history:

- `profile()` method
- Sharp CLI

CONTRACT EXAMPLE (method names verified; exact chaining is implementation benchmark):

```js
// PSEUDOCODE / CONTRACT EXAMPLE
sharp(inputPath)
  .rotate()                    // normalize EXIF orientation into pixels
  .toColourspace('srgb')       // transform to target web color space
  .resize({ width, withoutEnlargement: true })
  .jpeg({ quality })           // or .webp(...) per encoder benchmark
  // Default: no keepExif()/keepMetadata(); public derivatives carry no EXIF
  .toFile(derivativePath);
```

### 6.4 Output ICC embedding

Whether to embed an sRGB ICC profile in public derivatives is deferred to engineering benchmark (see section 12). The architecture supports either outcome.

---

## 7. Privacy contract

### 7.1 Mandatory removal from public derivatives

Public WEB DERIVATIVES must not expose:

- GPS coordinates
- Camera/device serial identifiers
- Unnecessary private metadata

### 7.2 Default policy: no EXIF in public output

Sharp output drops metadata by default. The pipeline does not call `keepExif()`, `keepMetadata()`, or equivalent unless there is an explicit product requirement to retain specific fields. There is currently no such requirement.

Do not retain camera, lens, or date metadata in public derivatives without a product requirement. Internal extracted metadata may exist only when necessary for pipeline operation (e.g. orientation for normalization, ICC for color conversion).

### 7.3 Source masters remain untouched

The pipeline never modifies WEB INGEST MASTERS. All privacy filtering applies only to generated derivatives.

### 7.4 Verified Sharp APIs for metadata control

Verified method names (see TECHNICAL_API_VERIFICATION.md):

- `keepExif()` -- retain all EXIF (NOT used for public output by default)
- `withExif(exif)` -- set specific EXIF data
- `keepMetadata()` -- retain most metadata (NOT used for public output by default)
- `withMetadata([options])` -- set metadata; options include `orientation` and `density`

Selective retention requires deliberate, documented use of these methods. The default is full strip.

---

## 8. Determinism semantics

The architecture defines two levels of determinism. They must not be conflated.

### 8.1 Semantic determinism (REQUIRED)

Given identical:

- Source bytes (same WEB INGEST MASTER content)
- Authored metadata (same Gallery YAML photo entry)
- Toolchain versions (same Sharp/libvips/codec versions)
- Pipeline configuration (same widths, qualities, encoder settings, ICC policy)

The pipeline must produce the same logical derivative set and manifest references. Every published Photo resolves to the same set of purposes, formats, dimensions, and public URLs.

This guarantee is required for build reliability, cache correctness, and visual regression testing.

### 8.2 Byte-for-byte determinism (conditional)

Byte-identical output is claimed only within a pinned toolchain environment (same OS/CPU architecture, same Node version, same Sharp/libvips/codec package versions, same encoder options, same JSON serialization order).

Do **not** state that SHA-256-identical output is guaranteed across arbitrary Sharp/libvips versions or machine environments. Cross-machine byte identity requires a pinned build image or container and evidence from repeat-build tests.

Pin toolchain versions during implementation (P1/P3). Record the pinned versions in the project lockfile and build configuration.

### 8.3 Manifest determinism

The asset manifest must be serialized in a canonical, reproducible order (sorted keys, stable JSON formatting). Timestamps such as `generated_at` are excluded from the deterministic core or placed in a separate metadata envelope so that content hashing of the manifest body is stable across rebuilds with identical inputs.

---

## 9. Asset hashing and fingerprint contract

### 9.1 Strategy

Derivatives use a robust content-addressed fingerprint strategy. The filename digest must be derived from a sufficiently collision-resistant truncated cryptographic digest or full build-managed asset fingerprint.

Do **not** freeze a six-hex-character digest. The exact digest length and algorithm are deferred to implementation benchmark, but must be sufficient to avoid collisions at the expected derivative count (thousands to tens of thousands of files).

### 9.2 Hash inputs

The digest input must include:

- Source bytes (WEB INGEST MASTER content)
- All rendering-affecting configuration (width, format, quality, encoder settings)
- Toolchain version identifier (so encoder upgrades change URLs)

This ensures that corrected masters, encoder changes, and configuration changes all produce new URLs. A corrected master under the same Photo ID correctly invalidates cached derivatives.

### 9.3 No undefined naming examples

Do not define example filenames using placeholder variables such as `finalName` or `finalFilename` without a complete specification. Filenames are fully determined by the manifest; the manifest's `public_url` field is authoritative.

### 9.4 Relationship to caching

Content-addressed derivative filenames enable long-lived immutable cache headers for hashed assets. HTML uses short/no-cache/revalidate policy appropriate for static content updates. See DEPLOYMENT_ARCHITECTURE.md for cache policy details.

---

## 10. Asset manifest contract

### 10.1 Location and timing

The asset manifest is generated data at:

```
generated/asset-manifest.json
```

It is produced **before** Astro build. Astro consumes it at build time via module import. The browser does not consume the manifest at runtime.

Manifest paths are already final public paths. No further path transformation occurs after manifest generation.

### 10.2 Per-derivative record fields

Each derivative entry contains, as appropriate:

| Field | Type | Description |
|---|---|---|
| `photo_id` | string | Stable Photo ID from Gallery YAML |
| `purpose` | string | Derivative purpose (see section 10.3) |
| `format` | string | Output format (`jpeg`, `webp`, `avif`, etc. — production formats decided by P3 benchmark) |
| `width` | number | Pixel width of derivative |
| `height` | number | Pixel height of derivative |
| `public_url` | string | Final public URL path (already resolved) |
| `bytes` | number | File size in bytes |
| `source_hash` | string | Digest of source WEB INGEST MASTER |
| `derivative_hash` | string | Digest of the derivative file itself |

### 10.3 Derivative purposes

The pipeline generates derivatives for these purposes:

| Purpose | Usage | Constraints |
|---|---|---|
| `gallery_display` | Responsive images in Gallery sequence | Uncropped, aspect-ratio preserving, no upscale |
| `overview` | Overview modal thumbnails | Contained, uncropped, aspect-ratio preserving |
| `cover` | Home hero, Archive cards, Place cards | Uncropped, aspect-ratio preserving, no upscale |

Exact widths, qualities, and format choices (JPEG / WebP / AVIF benchmark candidates) are deferred to engineering benchmark (see section 12).

### 10.4 Gallery display data requirements

For Gallery display, the manifest provides enough data for templates to construct:

- `src` attribute (default/fallback image URL)
- `srcset` attribute (list of candidate URLs with width descriptors)
- `sizes` logic (viewport-dependent selection)
- Intrinsic dimensions (for layout stability / CLS prevention)
- Overview derivative reference
- Cover derivative reference

**Invariant:** `srcset` is never computed by regex-replacing digits in filenames. The manifest provides explicit per-derivative URLs. Templates read structured data, not parsed filenames.

### 10.5 Example manifest shape

CONTRACT EXAMPLE (field names and structure are normative; values are illustrative):

```jsonc
// PSEUDOCODE / CONTRACT EXAMPLE
{
  "galleries": {
    "g_lofoten_light": {
      "gallery_id": "g_lofoten_light",
      "photos": {
        "p_reine_001": {
          "derivatives": [
            {
              "purpose": "gallery_display",
              "format": "webp",
              "width": 1024,
              "height": 683,
              "public_url": "/media/derivatives/g_lofoten_light/p_reine_001-a3f8c1-1024w.webp",
              "bytes": 98304,
              "source_hash": "sha256:e3b0c44298fc...",
              "derivative_hash": "sha256:7d793037a076..."
            },
            {
              "purpose": "overview",
              "format": "webp",
              "width": 400,
              "height": 267,
              "public_url": "/media/derivatives/g_lofoten_light/p_reine_001-b2e7d0-overview.webp",
              "bytes": 15360,
              "source_hash": "sha256:e3b0c44298fc...",
              "derivative_hash": "sha256:4a1c8e2f9b03..."
            },
            {
              "purpose": "cover",
              "format": "webp",
              "width": 768,
              "height": 512,
              "public_url": "/media/derivatives/g_lofoten_light/p_reine_001-c1d6ef-cover.webp",
              "bytes": 45056,
              "source_hash": "sha256:e3b0c44298fc...",
              "derivative_hash": "sha256:8f2b4a6c1d9e..."
            }
          ]
        }
      }
    }
  }
}
```

The exact top-level structure (flat vs nested, envelope fields) is an implementation detail. The contract requires that every published Photo's required purposes are present with complete fields.

The `format` values above (`webp`) are illustrative BENCHMARK HYPOTHESIS values only, not canonical production policy. Production format(s) are decided by the P3 benchmark (see section 12). The manifest schema itself is format-agnostic: `format`, `width`, `height`, `purpose`, `public_url`, `bytes`, `source_hash`, `derivative_hash`.

---

## 11. Failure semantics

The pipeline follows a fail-closed policy for production builds. Errors are categorized as follows:

### 11.1 Build-blocking failures (fail closed)

The production build **must fail** for any of the following:

- **Decode error:** WEB INGEST MASTER cannot be decoded or is corrupt.
- **Missing source for published content:** A published Gallery references a `source_ref` that does not resolve to an existing WEB INGEST MASTER.
- **Missing published derivative:** A published Gallery's required derivative set is incomplete (any purpose missing for any published Photo).
- **Privacy-verification failure:** A generated derivative is found to contain GPS, serial, or other prohibited metadata after the privacy stripping stage.
- **Color-policy failure:** An ICC-related error that violates the configured color policy (e.g. untagged source under a fail-on-untagged policy, if adopted).
- **Derivative coverage incomplete:** Any published Gallery lacks complete derivative coverage for all its Photos.

### 11.2 Warnings (non-blocking)

- **Duplicate content fingerprints:** Two distinct source files produce identical content digests. This may indicate accidental duplication. Log as warning; do not block build.

### 11.3 Draft content

Draft Galleries may have relaxed validation in local preview mode. Production builds exclude draft content entirely. Missing derivatives for draft content do not block production builds.

---

## 12. Deferred to engineering benchmark

The following parameters are intentionally not frozen in this architecture document. They are resolved through measurement against real photography fixtures (F01-F10 categories) during implementation phase P3.

| Parameter | Notes |
|---|---|
| Responsive width steps | Exact breakpoints for gallery_display derivatives |
| Overview thumbnail max dimension | Pixel ceiling for overview purpose |
| Cover derivative dimensions | Width/dimension for cover purpose |
| Encoder selection | Sharp vs alternatives; speed/quality tradeoff |
| Format selection | JPEG / WebP / AVIF are benchmark candidates; production format(s), fallback policy, and per-purpose decisions are made in P3 |
| Quality values | Per-format, per-purpose quality settings |
| Output ICC embedding | Whether to embed sRGB ICC in public derivatives |
| Exact digest length | Truncation length for content-addressed filenames |
| High-DPR strategy | Whether to generate additional 2x/3x derivatives |
| Progressive JPEG | Whether to use progressive encoding for JPEG derivatives |

These items are tracked in OPEN_QUESTIONS.md (Q01, Q02) and resolved before P3 implementation completes. Benchmark results are recorded in PERFORMANCE_BUDGET.md.

---

## 13. Output locations and build DAG integration

### 13.1 Derivative staging

All derivative files are written to:

```
generated/media/
```

This directory is owned by the image pipeline. It is **never** `dist/` or any directory that Astro may clear during its build.

### 13.2 Manifest location

```
generated/asset-manifest.json
```

### 13.3 Build DAG position

The image pipeline runs in this position within the overall build DAG:

```
AUTHORED PERSISTENT STATE
  Gallery YAML, Place YAML, Home settings, redirects, WEB INGEST MASTERS
        |
        v
REFERENCE + SOURCE VALIDATION
        |
        v
IMAGE PIPELINE (this subsystem)
  produces: generated/media/ + generated/asset-manifest.json
        |
        v
ASTRO BUILD
  consumes generated/asset-manifest.json at build time
  renders HTML with final public derivative URLs
        |
        v
ISOLATED FINAL RELEASE ASSEMBLY
  Astro output + staged derivatives assembled into release candidate
        |
        v
INTEGRITY GATE -> DEPLOYMENT
```

Architectural invariant: Astro never needs a manifest that does not yet exist. Image derivation does not depend on mutating Astro's build directory before Astro build. Final assembly is isolated and complete before deployment.

Cross-reference: BUILD_AND_ROUTING.md for the complete build DAG.

---

## 14. Supported ingest formats

WEB INGEST MASTERS are defined separately from camera-original archival storage.

| Format | Supported for web ingest? | Archival storage? | Notes |
|---|---|---|---|
| JPEG | Yes (primary) | Yes | Recommended web ingest format |
| PNG | Limited | Yes | Rarely used in photography workflows |
| RAW (NEF, CR2, ARW, etc.) | No (unless benchmarked) | Yes | Keep as archival; export to JPEG for web ingest |
| TIFF | Limited | Yes | Large files; export to JPEG for web ingest |
| HEIC/HEIF | No | Not recommended | License complexity, limited toolchain support |

Policy: archival storage retains all camera originals indefinitely. Web ingest supports JPEG initially. Expanding ingest format support requires workflow testing and benchmarking.

---

## 15. Frozen design compliance

The pipeline preserves these frozen design invariants:

- **Uncropped presentation:** All derivatives preserve source aspect ratio. No destructive crop, no `object-fit: cover` cropping, no square crop for any purpose.
- **No upscale:** Derivatives are never larger than the source WEB INGEST MASTER. Resize uses `withoutEnlargement: true` or equivalent.
- **Overview contained:** Overview thumbnails are contained within their bounding box, uncropped, aspect-ratio preserving.
- **Cover uncropped:** Cover derivatives for Home hero, Archive cards, and Place cards preserve aspect ratio.

Cross-reference: FINAL_DESIGN_SPECIFICATION.md sections 3.1, 3.2, 3.3.

---

## 16. Implementation notes

### 16.1 Parallel processing

Image derivation is I/O and CPU intensive. Implementation should use parallel processing with configurable concurrency. The exact worker count depends on build host resources.

### 16.2 Incremental builds (optional future optimization)

Baseline assumes full rebuilds. Incremental derivation (skip unchanged sources based on content hash comparison) may be added later as an optimization. It is not a baseline dependency.

### 16.3 Toolchain pinning

Implementation must pin exact versions of:

- Node.js
- Sharp (and its bundled libvips)
- Any codec packages
- Pipeline configuration format version

Pinned versions are recorded in the project lockfile and build configuration. This enables the byte-for-byte determinism guarantee within a controlled environment.

---

**END OF IMAGE_PIPELINE.md**
