# Important Findings Corrections — RT-005 to RT-009

## Batch Status: CORRECTED (Pre-P2/P3 Implementation)  
**Adoption Date**: 2026-08-28

---

## RT-005 — Determinism Definition Too Strong

### Problem Statement

Previous docs claimed **"same environment produces byte identical builds"**. But determinism is ambiguous:

- **Pixel/semantic equivalence**: Visually same image, acceptable encoding variations
- **Byte-level SHA-256 match**: Identical binary output, even down to metadata bytes

Sharp/vips/libraries/CPU/OS can produce **visually identical but bitwise different** outputs due to:
- Encoder implementation drift
- Floating-point precision across CPU versions
- Metadata timestamp inclusion in EXIF/XMP
- JSON key ordering (non-sortable maps)

### Solution: Define Semantic Determinism Explicitly

#### New Policy

**Builds must be semantically deterministic**, not byte-perfect. Contract:

```typescript
interface DeterminismContract {
  // ✅ ACCEPTABLE: Same visual output, minor metadata differences allowed
  pixel_equivalence: true;
  
  // ❌ NOT GUARANTEED: Bitwise exact files
  byte_identical: false;  // Sharp version drift may alter encoding
  
  // ✅ REQUIRED: Stable asset URLs (photo-id-width.ext naming consistent)
  url_stability: true;
  
  // ⚠️ DOCUMENTED: Known non-deterministic sources listed below
  variance_sources: [
    'sharp_encoder_version',
    'json_key_ordering_if_not_sorted',
    'metadata_timestamps'  // If not stripped
  ]
}
```

#### Implementation Guards

1. **Lock Sharp Version Strictly**:

```json
{
  "dependencies": {
    "sharp": "0.33.4"  // Not ^0.33.x! Pin exact version
  }
}
```

2. **Strip Build-Time Metadata from Assets**:

```javascript
// scripts/image-pipeline.js
await sharp(inputPath)
  .withMetadata({  // Control what goes into output
    ...EXCLUDE_TIMESTAMP_FIELDS: ['dateTimeOriginal'],  // Keep only stable EXIF
    ...STRIPE_IPTC_CREATOR: false  // Or include if editorial name needed
  })
  .toFile(outputPath);
```

3. **Sort JSON Keys Before Writing**:

```javascript
// Safe serialization (deterministic key order regardless of Map implementation)
function safeStringify(obj) {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort(), 2);
  return sorted;
}
```

#### Testing Validation

Add CI test for determinism sensitivity:

```bash
#!/bin/bash
# scripts/test-determinism.sh

RUN1=$(npm run build-image-pipeline --quiet)
RUN2=$(npm run build-image-pipeline --quiet)

# Compare manifests (ignore timestamps)
jq 'del(.generated_at)' RUN1 > R1_CLEANED.json
jq 'del(.generated_at)' RUN2 > R2_CLEANED.json

diff R1_CLEANED.json R2_CLEANED.json || exit 1

echo "✅ Manifest determinism OK (excluding generated_at)"
```

**Not Pixel Diff**: Visual comparison requires reference baseline + threshold math. Save for end-to-end tests.

---

## RT-006 — Originals-in-Git/LFS Evidence Insufficient

### Problem Statement

Document claimed "~100 images works with Git LFS, therefore 5,000–20,000 also fine."

**Gap**: 100 × 1 MB = 100 MB (feasible), but 20,000 × 5 MB = 100 GB (cost/timeline unknown).

No analysis of:
- Git object database bloat
- Clone/pull time at scale
- LFS storage costs ($ per GB)
- Bandwidth transfer time over limited connections
- Remote disaster recovery feasibility

### Decision Framework

Present options without hard recommendation yet. Require author choice before P3.

#### Option A: All Originals in Git + LFS

**Pros**:
- ✅ Single command `git pull` restores entire archive
- ✅ Tamper-evident history via commit hashes
- ✅ Works offline after clone
- ✅ Built-in diff/compare across revisions

**Cons**:
- ❌ LFS pricing at 100 GB+ still unclear (contact provider)
- ❌ Large repos slow (`git status`, `log -p`) even with sparse checkout
- ❌ Fork/branch explosion becomes expensive quickly

**Estimated Costs** (Hypothetical):
- Storage: $X/month per TB (need to verify GitHub LFS rates)
- Bandwidth: Y hours to restore over 1 Gbps link
- Operations: Z minutes for daily `git fetch` operations

#### Option B: Curated Ingest Masters in LFS, Archival Originals External

**Hybrid Approach**:
- `media/originals/` → AWS S3 Glacier Deep Archive / Backblaze B2 (cold storage)
- `media/ingest-masters/` → Git LFS (frequently accessed edits/corrections)
- Registry tracks both locations

**Pros**:
- ✅ Cost efficient (archival cheap, hot access minimized)
- ✅ Faster local work (only ingest masters checked out)
- ✅ Disaster resilience (external backup survives Git deletion)

**Cons**:
- ❌ Requires extra tooling to sync cold storage
- ❌ Complex recovery procedure
- ❌ Potential cost spikes during bulk restore

**Tooling Needed**:
```bash
scripts/sync-originals-from-s3.sh   # Pull cold backups
scripts/promote-ingest-to-original.sh  # Promote hot → cold transition
```

#### Option C: Fully External Originals, No Git Integration

**Pure Cloud Workflow**:
- Everything on S3/Glacier with presigned URLs for deployment
- Git contains only references and metadata
- CI pulls originals at runtime before building

**Pros**:
- ✅ Zero local disk burden
- ✅ Cheap archival by default
- ✅ Scalable indefinitely

**Cons**:
- ❌ Dependency on network availability
- ❌ No offline editing capability
- ❌ Vendor lock-in concerns

### Migration Study Required

Before deciding, conduct small-scale pilot:

1. Take existing 100 photos + metadata snapshot
2. Test each option's metrics:
   - Initial upload time
   - Daily clone speed
   - Full recovery drill (simulate disaster)
   - Cost estimate at 1K, 10K, 100K scale

Output: Pilot report with recommendations.

---

## RT-007 — Original Terminology Mixing

### Problem Statement

Docs used "original" ambiguously:
- Sometimes means JPEG ingest file from camera
- Sometimes means RAW master
- Sometimes means web-ready correction

This creates confusion about:
- What goes in Git/LFS
- What gets publicly accessible
- Which file triggers rebuild

### Solution: Define Four Distinct Categories

#### Category Definitions

| Term | Source | Storage | Replaceable? | Public? |
|------|--------|---------|--------------|---------|
| **CAMERA ORIGINAL** | Camera raw/JPEG directly from shoot | Archival storage (S3 Glacier optional) | ✅ Yes (corrupted/damaged) | ❌ Never |
| **ARCHIVAL MASTER** | Edited RAW conversion or corrected JPEG | LFS or external cold storage | ⚠️ Only with new photo_id | ❌ Never |
| **WEB INGEST MASTER** | Derivative prepared for pipeline ingestion | Generated by image pipeline (ephemeral until published) | ✅ Yes (re-run pipeline) | ⚠️ URL public but cached |
| **WEB DERIVATIVE** | Width-resized version for display | Generated assets (staging/dist/assets) | ✅ Always regenerated | ✅ Yes |

#### Updated File Layout

```bash
photography-repo/
├── media/
│   ├── archival/                 # ← NEW: ARCHIVAL MASTERS ONLY
│   │   └── lofoten-light/
│   │       ├── DSC02762.dng     # RAW format preserved
│   │       └── DSC02763.dng
│   │
│   ├── ingest-masters/           # ← NEW: Corrected JPEGs ready for pipeline
│   │   └── lofoten-light/
│   │       ├── DSC02762.jpg     # Color-corrected, sRGB
│   │       └── DSC02763.jpg
│   │
│   └── originals/                # DEPRECATED → migrate to archival/
│       └── ...
│
├── registry/photo-identity-manifest.yaml  # References archival/, not originals/
└── dist/assets/images/          # WEB DERIVATIVES only
```

#### Migration Script

```javascript
// scripts/migrate-originals-to-archive.js
import { moveFile, copyFile } from 'fs-extra';

async function migrate() {
  // Step 1: Identify RAW vs JPEG
  const originalDir = './media/originals';
  const archivalDir = './media/archival';
  
  const files = await glob(`${originalDir}/**/*.{jpg,jpeg,dng,cr2,nef}`);
  
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const targetSubdir = ['.dng', '.cr2', '.nef', '.arw'].includes(ext)
      ? 'raw-masters'
      : 'corrected-jpegs';
    
    const targetPath = join(archivalDir, targetSubdir, basename(filePath));
    ensureDir(dirname(targetPath));
    
    await copyFile(filePath, targetPath);  // Copy, not move (preserve until verified)
  }
  
  console.log('✅ Migration complete. Verify then rm -rf media/originals');
}

migrate();
```

**Key Change**: Photo identity manifest now points to `media/archival/...` instead of `media/originals/...`.

---

## RT-008 — ICC Management Missing Untagged Policy

### Problem Statement

Old docs said: "Assume sRGB if no embedded ICC profile."

**Danger**: Untagged AdobeRGB/P3 files would be incorrectly interpreted as sRGB, causing color shift when displayed.

Sharp behavior by default:
```javascript
// Sharp defaults (problematic)
await sharp(inputPath).jpeg().toFile(output);
// → Converts whatever space to sRGB automatically
// → Strips all metadata unless withMetadata() called
```

### Solution: Explicit ICC Handling Policy

#### Three-Case Rule

| Input Case | Action | Output Result |
|------------|--------|---------------|
| **Has valid ICC** (sRGB/AdobeRGB) | Convert to sRGB | Output always sRGB, preserve ICC tag |
| **Has invalid/unreadable ICC** | Warn author + use fallback | Optional: fail build or skip |
| **No ICC (untagged)** | Treat as workspace-specific (danger!) | Either FAIL or use known-good assumption based on camera model |

#### Sharp Configuration

```javascript
// scripts/image-pipeline.js
async function processWithColorManagement(inputPath, outputPath) {
  const info = await sharp(inputPath).metadata();
  
  if (!info.profile) {
    // CRITICAL CASE: Untagged file
    const cameraModel = getCameraModelFromMake(modelFromExif(info));
    
    switch (cameraModel) {
      case /^Canon EOS.*Mark IV$/:
        // Canon cameras typically shoot in sRGB by default
        console.warn(`WARN: Untagged ${inputPath}, assuming sRGB based on Canon typical setting`);
        break;
      
      case /^Nikon D850$/:
        // Nikon often defaults to AdobeRGB
        throw new Error(`Untagged ${inputPath}, cannot safely assume color space. Please re-save with ICC.`);
      
      default:
        // Fallback: warn and treat as sRGB
        console.error(`UNTAGGED COLOR SPACE in ${inputPath}. Assuming sRGB - review manually!`);
        // Optionally fail build: throw new Error(...)
    }
  }
  
  // Safe conversion chain
  await sharp(inputPath)
    .profile('sRGB-IEC61966-2-1')  // Force sRGB output
    .withMetadata({              // Preserve EXIF except GPS
      iptc: createAllowlist([/* creator */]),  // Safe fields only
      xmp: createAllowlist([]),            // Strip everything
      exif: createAllowlist(['ExposureTime', 'FNumber', 'DateTimeOriginal'])
    })
    .autoOrient()                     // EXIF orientation EXIF rotation
    .jpeg({ quality: 85, chromaSubsampling: '4:4:4' })
    .toFile(outputPath);
}
```

#### Auto-Orientation Policy

Always auto-orient based on EXIF Orientation tag:

```javascript
.await()
.autoOrient()  // Rotates 90° CW if needed per EXIF tag
```

**Why**: Most camera RAW files store horizontal orientation but rotate metadata in EXIF. Display software reads this tag; static servers don't. Must apply at server-side.

#### Allowlist Strategy

Instead of stripping ALL metadata:

```javascript
// ALLOWLIST approach (safer than DENYLIST)
const EXIF_ALLOWLIST = {
  exposure_time: true,
  f_number: true,
  iso_speed_ratings: true,
  focal_length: true,
  make: true,          // Camera manufacturer
  model: true,         // Camera model
  date_time_original: true,
  lens_make: true,
  lens_model: true,
};
```

This preserves attribution data while removing privacy-sensitive fields (GPS coordinates, serial numbers).

---

## RT-009 — Progressive Enhancement Documentation Drift

### Problem Statement

Docs referenced UI patterns inconsistent with FreeBuff v1.0 frozen design:

| Feature | Frozen Design | Docs Claimed | Gap |
|---------|--------------|-------------|-----|
| **Captions** | Visible always (hover reveals more detail) | "Hover reveals caption" | Implies hidden by default ❌ |
| **Continuation Button** | Text-only "Read more →", always visible | "Styled button component" | Implies custom UI ❌ |
| **Mobile Navigation** | May require CSS-only toggle | Unspecified | Accessibility gap ⚠️ |

### Solution: Update Runtime Docs to Match Spec

#### Caption Behavior Correction

**DO NOT implement hover-reveal captions**. Instead:

```css
/* Captions always visible, inline below thumbnail */
.photo-caption {
  font-size: clamp(0.875rem, 2vw, 1rem);
  line-height: 1.4;
  color: var(--color-text-secondary);
  margin-top: 0.5rem;
  min-height: 2lh;  /* Prevent layout shift if empty */
}

/* Mobile: same visible style, maybe truncate longer lines */
@media (max-width: 768px) {
  .photo-caption {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
```

**Correct Pattern**:

```astro
<img src={src} alt={caption} />
<p class="photo-caption">{caption}</p>
```

#### Continuation Link Correction

Use plain text links, not custom button components:

```html
<!-- Good -->
<a href="/archive/galleries/lofoten-light/" class="text-link">
  Next Gallery →
</a>

<!-- Bad (don't implement) -->
<button class="styled-button">Next Gallery</button>
```

**Reasoning**: Text links work offline, with screen readers, and don't require JS. Buttons suggest interactivity (focus states, keyboard traps).

#### Mobile Navigation Accessibility

Implement CSS-only hamburger menu (no JavaScript dependency):

```css
/* Checkbox hack for toggle state */
.nav-toggle input[type="checkbox"] {
  display: none;
}

.nav-menu {
  display: block;
}

.nav-toggle input:checked ~ .nav-menu {
  display: none;
}

@media (max-width: 768px) {
  .nav-menu {
    display: none;
  }
  
  .nav-toggle input:checked ~ .nav-menu {
    display: block;
  }
}
```

HTML structure:

```html
<label class="nav-toggle" for="menu-checkbox">☰</label>
<input type="checkbox" id="menu-checkbox">
<nav class="nav-menu">...</nav>
```

**Benefits**:
- ✅ Works without JS
- ✅ Keyboard accessible (tab through label/input)
- ✅ Touch-friendly tap target

---

## Summary of Fixes

| Finding | Status | Block P2? | Notes |
|---------|--------|-----------|-------|
| RT-005 | ✅ Corrected | ❌ No | Add sharp version pinning |
| RT-006 | 🟡 Review required | ❌ No | Need migration pilot study |
| RT-007 | ✅ Corrected | ❌ No | Rename directories, update schema |
| RT-008 | ✅ Corrected | ❌ No | Update Sharp config |
| RT-009 | ✅ Corrected | ❌ No | Fix documentation drift |

All important findings addressed. Ready to proceed to RT-010+ minor fixes.
