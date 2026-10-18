# Photo Identity Registry — Corrected Model

## CRITICAL FIX: RT-001 Resolution

**Status**: CORRECTED (Pre-Implementation Plan)  
**Related Findings**: RT-001, H1  
**Adoption Date**: 2026-08-28

---

## Problem Statement (RT-001)

Previous architecture defined `generated/photo-identities.json` as **deletable generated data**. But Gallery YAML references `photo.id`, and if originals are renamed/moved/re-exported and `generated/` is deleted, the system **cannot reconstruct** the binding between `photo.id` and `source_file/location`.

This mapping is **persistent state**, not a pure build artifact.

## Solution: Authored Photo Identity Registry

### New File: `registry/photo-identity-manifest.yaml` (Git-Tracked)

This file becomes the **single source of truth** for `photo.id ↔ source_file/location` bindings.

#### Schema

```yaml
# FILE: registry/photo-identity-manifest.yaml
# Git-tracked authored registry, NOT in generated/

_version: "1.0"                              # Version for migration tracking
_last_updated: "2026-08-28T14:30:00Z"        # ISO timestamp (auto-populated by author tool)
_changelog:                                  # Human-readable entries per version
  - v1.0:
    date: "2026-08-28"
    notes: "Initial manifest for all published galleries"

_mappings:                                   # AUTHORED REGISTRY
  - photo_id: "photo-norway-lofoten-reine-dsc02762"
    source_file: "DSC02762.jpg"             # Original filename
    location: "media/originals/lofoten-light/DSC02762.jpg"  # Absolute path from repo root
    capture_datetime: "2025-02-05T08:23:00Z"  # Optional: EXIF extraction (read-only)
    orientation_class: landscape            # Deterministic: intrinsic_aspect < 1.0 ? portrait : landscape
    intrinsic_width: 2048                   # Optional: EXIF pixel dimensions
    intrinsic_height: 1365                  
    
  - photo_id: "photo-norway-lofoten-reine-dsc02763"
    source_file: "DSC02763.jpg"
    location: "media/originals/lofoten-light/DSC02763.jpg"
    ...

# VALIDATION RULES:
#   - Every location MUST exist on disk at build time (CI gate)
#   - Every photo_id referenced by any Gallery YAML must appear here
#   - Duplicate photo_id → FAIL BUILD
#   - Missing location file → WARN (can be skipped or fail based on env var)

# MIGRATION NOTE:
#   Existing fixtures can auto-generate initial entries via scripts/update-identities.js
#   Future additions require explicit author action (no silent generation)
```

### Key Properties

1. ✅ **Git-Tracked**: Lives outside `generated/`, authored and committed
2. ✅ **Deterministically Updatable**: Tooling (`scripts/update-identities.js`) helps author maintain it
3. ✅ **Build-Time Validated**: CI checks every `location` exists, no duplicate `photo_id`s
4. ✅ **Versioned Changelog**: Tracks major migrations
5. ✅ **Not Deleted**: Survives build/clean operations

---

## Corrected Master Handling Rule

**Decision Point**: When an original is renamed or replaced, should we preserve `photo.id` or create a new one?

### Two Paths

#### Option A: Preserve photo.id
**Use Case**: Minor corrections (lighting adjustment, color grading, crop within same composition).

**Behavior**:
- Keep existing `photo_id` in registry
- Update `location` reference to new file
- Preserve all caption/rhythm bindings

#### Option B: Create New Photo
**Use Case**: Significant artistic variation (re-edit represents distinct creative choice).

**Behavior**:
- Generate new `photo_id` (e.g., suffix `-v2` or UUID)
- Add new registry entry
- Decide: Replace old photo in Gallery YAML OR keep both as separate artworks

**Tooling Support**: `scripts/migrate-photo.sh` prompts author:
```bash
$ ./scripts/migrate-photo.sh DSC02762.jpg --replace

Prompt options:
  [A] Preserve existing photo ID (minor correction)
  [B] Create new photo ID (distinct artwork)
  [C] Skip (manual decision later)
```

---

## Migration Path

### For Existing Stage 3C Fixtures

During first post-red-team build:

1. **Auto-Generate Initial Manifest**: Script reads fixture metadata + filesystem scan
2. **Author Review**: Compare against actual Gallery YAML references
3. **Commit**: Explicit commit with changelog note

```bash
npm run regenerate-identity-manifest -- --dry-run  # Preview
npm run regenerate-identity-manifest -- --commit    # Generate + validate
```

### For New Galleries

Authors **must**:
1. Assign `photo_id` during ingest planning
2. Record in `registry/photo-identity-manifest.yaml` before committing
3. Reference same IDs in Gallery YAML `photos: []` arrays

**Editorial Control**: This forces intentional photo identity design up front.

---

## Interaction with Content Collections

Astro Content Collections still define schemas for validation, but **data comes exclusively from `content/galleries/`**:

```typescript
// src/content-schema.ts — schema only
export const photoIdentitySchema = z.object({
  mappings: z.array(z.object({
    photo_id: z.string(),
    source_file: z.string(),
    location: z.string().url(), // absolute paths resolved from repo root
    ...
  }))
});
```

The runtime loader **does not read from `generated/`**:
```javascript
// Load photo identities from authored registry
const registryPath = new URL('../../registry/photo-identity-manifest.yaml', import.meta.url);
const registryData = await readFile(registryPath, 'utf-8');
const manifest = parseYAML(registryData);
return manifest._mappings;  // Authored state
```

---

## Validation Flow

### Pre-Build Check

```bash
# CI script validates:
for each gallery_ref in content/galleries/*/meta.yaml:
  for each photo_id in gallery_ref.photos[]:
    ensure exists photo_identity_registry[photo_id]
    ensure exists photo_identity_registry[photo_id].location on disk

if duplicates found(photo_identity_registry.mappings):
  error "Duplicate photo_id detected"
```

### Post-Build Sanity

```bash
# After image pipeline runs:
for each generated_derivative in dist/assets/images/*:
  ensure photo_id extracted from filename exists in registry
```

---

## Why Not Alternatives?

### ❌ Pure Generation from Filename Patterns

**Problem**: Reordering photos requires updating `captions: { "id": "..." }`. If pattern-based reconstruction fails after deletion, system cannot recover.

### ❌ UUID Sidecar Files Only

**Problem**: Adds maintenance burden (one `.json` per photo), no authoring workflow integration, no global index for cross-gallery lookups.

### ❌ Git LFS for Originals Only

**Problem**: LFS stores blobs, doesn't solve `photo.id ↔ file` binding. Still need manifest for editorial workflows.

---

## Final Gate Verification

Before Implementation Plan acceptance:
- ✅ RT-001: Photo identity persists independently of builds
- ✅ H1 Hypothesis confirmed & fixed
- ✅ No reliance on generated data for core state
