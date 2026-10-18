# Home State Persistence — Resolves RT-004

## CRITICAL FIX: RT-004 Resolution

**Status**: CORRECTED (Pre-Implementation Plan)  
**Related Findings**: RT-004, H1/H2 impact  
**Adoption Date**: 2026-08-28

---

## Problem Statement (RT-004)

Previous architecture had **no persistent definition** for:
- `featured` field in Gallery schema
- `published_at` timestamp (build-time auto-generated instead)

### Consequences

1. **Build-Time Non-Determinism**: Clean build rewrites "published_at = now" for all galleries
2. **Latest-First Instability**: Home's latest-first ordering randomizes based on directory traversal order
3. **Hero Selection Unpredictable**: Without editorial control, any old gallery could become homepage hero
4. **Product Logic Violation**: FreeBuff v1.0 spec requires explicit editorials ("Home Hero", "This Week")

**Critical Gap**: Authored content lacks explicit editorial controls; runtime behavior depends on ephemeral state.

## Solution: Add Persistent Editorial Fields to Schema

### Updated Gallery Schema

```typescript
// src/content-schema.ts
export const gallerySchema = z.object({
  id: z.string(),                       // Stable unique identifier (≠ slug)
  title: z.string(),
  slug: z.string().optional(),          // ← NEW: Explicit override for public URL
  
  photographed_start: z.string().date(),   // Photo shoot start date (not publish date)
  photographed_end: z.string().date().optional(),
  
  photos: z.array(z.string()).min(1),     // Array of photo_id strings
  captions: z.record(z.string()).optional(),  // key=value pairs: photo_id → caption
  rhythms: z.record(z.enum(['compact', 'spacious'])).optional(),
  
  // EDITORIAL FIELDS ← ADDITIONS FOR RT-004 FIX
  published_at: z.string().datetime(),    // ✅ ISO timestamp: when first published (NOT build time!)
  featured: z.boolean().default(false),   // ✅ Explicitly marks Home hero or special sections
  is_curated: z.boolean().default(false), // Optional: manual curation flag for editorial
  
  next_gallery: z.string().optional(),    // FK → gallery.slug (not ID)
  cover_photo_id: z.string().optional(),  // ← NEW: Override default first photo as cover
  
  // DERIVED/COMPUTED FIELDS (DO NOT STORE)
  // prev_gallery: auto-derived from next_gallery links
  // has_continuation: auto-derived from next_gallery presence
});
```

### Key Changes Summary

| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `published_at` | ISO datetime | ✅ **Authored** | First publication timestamp, never overwritten by builds |
| `featured` | Boolean | ✅ **Authored** | Explicitly marks Home hero / special placements |
| `slug` | String | ⚠️ **Optional Override** | Decouples URL from internal ID |
| `cover_photo_id` | String | ⚠️ **Optional Override** | Selects non-default album photo as cover |

---

## persisted_at Handling Strategy

### Authoring Workflow

When author creates new gallery:

```bash
mkdir -p content/galleries/new-japan-trip
nano content/galleries/new-japan-trip/meta.yaml
```

Content includes `published_at`:

```yaml
# content/galleries/new-japan-trip/meta.yaml
id: "new-japan-trip-2025-osaka-kyoto"
title: "Japan 2025: Osaka & Kyoto"
photographed_start: "2025-03-15"
photographed_end: "2025-03-28"

photos:
  - "photo-japan-osaka-dsc04512"
  - "photo-japan-kyoto-dsc04623"
  ...

captions:
  "photo-japan-osaka-dsc04512": "First ramen at Dotonbori."
  "photo-japan-kyoto-dsc04623": "Bamboo grove at Arashiyama."

rhythms:
  "photo-japan-kyoto-dsc04623": compact

# ✅ AUTHORED PUBLICATION DATE
published_at: "2025-04-01T10:00:00Z"

# ✅ FEATURED DECISION
featured: false  # Not this one — other gallery gets home hero

next_gallery: "hokkaido-nature-2026"
```

### Build Time: NEVER Overwrite published_at

**Important**: Astro build reads `published_at`, **never rewrites it**.

```javascript
// During build
for (const galleryPath of glob('content/galleries/*/meta.yaml')) {
  const rawYAML = fs.readFileSync(galleryPath, 'utf-8');
  const data = parseYAML(rawYAML);
  
  // Validate required field exists
  if (!data.published_at || !isValidISODate(data.published_at)) {
    throw new Error(`Missing or invalid published_at in ${galleryPath}`);
  }
  
  // Do NOT modify data.published_at!
  
  const validated = gallerySchema.parse(data);
  renderGalleryPage(validated);
}
```

### Migration Path

For existing Stage 3C fixtures without `published_at`:

**Option A: Auto-Generate Baseline (Once Only)**

During first post-red-team build:

```bash
npm run migrate-published-at -- --baseline

# Behavior:
# - Scans each gallery's photo capture dates (EXIF)
# - Derives earliest date as proxy for published_at
# - Generates initial YAML entries with comment: "# NOTE: Auto-derived; review manually"
# - Does NOT commit; requires author approval
```

Generated example:

```yaml
# NOTE: This published_at was auto-derived from EXIF metadata during migration.
# Please verify against actual publication history and update as needed.
published_at: "2025-02-15T09:00:00Z"  # Earliest photo capture date
featured: false
```

Author then reviews and commits only after verification.

**Option B: Require Manual Entry Upfront**

Fail migration until every gallery explicitly defines `published_at`. This enforces author responsibility but slows initial setup.

**Recommendation**: Use Option A with strict migration guardrails (requires `--commit` flag + changelog entry).

---

## featured Field Usage

### What Does `featured` Mean?

Per Product Spec v1.0:

**Home Page Features**:
1. **Current Hero**: One highly-prominent gallery (usually newest or artist choice)
2. **Secondary Feature**: Smaller grid section for another highlighted work
3. **"This Week" Rotation**: Weekly featured item (optional future enhancement)

`featured: true` maps to these slots.

### Home Layout Rules

#### Primary Slot (Hero)

```astro
---
// In src/pages/index.astro
const allGalleries = await getCollection('galleries');
const featured = allGalleries.find(g => g.data.featured && g.data.published_at <= now);
const heroGallery = featured ?? allGalleries.sortBy('published_at').pop();  // Fallback to latest
---

{heroGallery ? (
  <section class="hero">
    <h1>{heroGallery.data.title}</h1>
    <PhotoViewer gallery={heroGallery} />
  </section>
) : (
  <EmptyHeroState />
)}
```

**Priority Order**:
1. Any gallery with `featured: true` and past-due `published_at`
2. Else, most recently published gallery (`published_at DESC`)

#### Secondary Slot (Editorial Grid)

```astro
<section class="secondary-feature">
  {allGalleries
    .filter(g => g.data.photos.length >= 3)  // Enough content for compelling display
    .sort((a, b) => compareDescending(a.published_at, b.published_at))
    .slice(0, 3)  // Top 3 non-hero items
    .map(gallery => (
      <MiniCard gallery={gallery} />
    ))
  }
</section>
```

**No Hardcoded `featured: true` Required**: Can be dynamic fallback logic.

### Editor Workflow

**Promote Gallery to Hero**:

Edit `content/galleries/{slug}/meta.yaml`:

```yaml
# Before
featured: false

# After
featured: true
```

Commit and deploy. Next build refreshes Home hero slot accordingly.

**Rotate Out Hero**:

```yaml
# Depromote current hero
featured: false

# Promote new candidate
featured: true  # On different gallery
```

**Tip**: Limit to one `featured: true` at a time for sanity (enforce via validation):

```typescript
// scripts/validate-galleries.js (post-schema step)
let featuredCount = 0;
for (const gallery of allGalleries) {
  if (gallery.featured) {
    featuredCount++;
  }
}

if (featuredCount > 1) {
  console.error(`❌ TOO MANY FEATURED GALLERIES: ${featuredCount}`);
  process.exit(1);
}
```

---

## Slug Independence (Addressing RT-010)

### Why Separate `id` and `slug`?

Previous design forced `id === slug`. But consider cases where they differ:

**Scenario 1: Typo Correction**

```yaml
# Internal ID (never changes)
id: "lofoten-light-photography-2025"

# Public URL (fixable)
slug: "lofoten-landscape-2025"  # Changed from "lofoten-liight-2025"
```

**Scenario 2: Privacy/De-publication**

```yaml
# Still referenced internally
id: "private-family-vacation-2024"

# Anonymous URL
slug: "unlisted-abc123xyz"  # Not guessable by humans
```

**Scenario 3: Multilingual Support (Future)**

```yaml
# Same content
id: "paris-spring-2025"

# Different URLs per locale
slug_en: "paris-spring-2025"
slug_ja: "パリ春旅行-2025"
```

### Redirect Registry (RT-010 Partial Fix)

If `slug` ever changes, maintain redirect mapping:

```yaml
# registry/slug-redirects.yaml (Git-tracked)
_version: "1.0"
entries:
  - from: "/lofoten-liight-2025/"
    to: "/lofoten-landscape-2025/"
    created_at: "2026-08-28T10:00:00Z"
    reason: "Typo correction (liight → landscape)"
    
  - from: "/paris-2024/"
    to: "/paris-spring-2025/"
    created_at: "2026-07-15T14:30:00Z"
    reason: "Updated exhibition year/title"
```

Nginx config (deployed alongside site):

```nginx
# Serve 301 redirects for changed slugs
location = /lofoten-liight-2025/ {
  return 301 /lofoten-landscape-2025/;
}

location = /paris-2024/ {
  return 301 /paris-spring-2025/;
}
```

**Migration Rule**: Existing slugs must stay intact forever OR have redirect entry before changing.

### Validation Rule

```typescript
// scripts/validate-slugs.js
const allSlugs = allGalleries.map(g => g.slug || g.id);
const duplicates = allSlugs.filter((val, idx, arr) => arr.includes(val, idx + 1));

if (duplicates.length > 0) {
  console.error(`❌ DUPLICATE SLUGS FOUND: ${duplicates.join(', ')}`);
  process.exit(1);
}
```

---

## Cover Photo Selection

### Default Behavior (First Photo)

If no explicit `cover_photo_id`, assume first item in `photos[]` array:

```yaml
photos:
  - "photo-japan-osaka-dsc04512"    # ← Defaults to this one
  - "photo-japan-kyoto-dsc04623"
  ...
```

### Override with cover_photo_id

```yaml
photos:
  - "photo-japan-osaka-dsc04512"
  - "photo-japan-kyoto-dsc04623"    # ← Chosen cover
  - "photo-japan-tokyo-dsc04701"

cover_photo_id: "photo-japan-kyoto-dsc04623"
```

**Use Case**: 
- Album opens with less-iconic shot but leads to better photo
- Social share image prefers standout image over chronology

### Validation

```typescript
// Ensure cover_photo_id exists in photos array
if (gallery.cover_photo_id && !gallery.photos.includes(gallery.cover_photo_id)) {
  throw new Error(`cover_photo_id "${gallery.cover_photo_id}" not found in photos[] for ${gallery.id}`);
}
```

---

## Indexing and Caching Implications

### Nginx Cache Keys

Since `published_at` and `featured` are authored (not build-time), cache keys stable across rebuilds:

```nginx
# Cache based on URL path, not file modification time
location ~ \.(html|css|js|png|jpg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  
  # For HTML pages, vary by Accept headers
  try_files $uri $uri/ /index.html;
}
```

**No Special Handling Needed**: Static assets still use hashed filenames (once we implement semantic versioning pipeline).

### Sitemap Generation

Include `published_at` as `<lastmod>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://freebuff.app/lofoten-light-photography-2025/</loc>
    <lastmod>2025-02-15T09:00:00Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  ...
</urlset>
```

Astro integration generates this at build time from authored metadata.

---

## Migration Script Example

```javascript
// scripts/migrate-published-at.js
import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import { parseYAML, stringifyYAML } from 'yaml';
import { execSync } from 'child_process';

async function derivePublishedAtFromEXIF(photoPaths) {
  // Use exifr library to extract capture dates
  const dates = [];
  for (const path of photoPaths) {
    try {
      const exif = await exifr.parse(fs.readFileSync(path), ['dateTimeOriginal']);
      if (exif?.dateTimeOriginal) {
        dates.push(new Date(exif.dateTimeOriginal));
      }
    } catch (e) {
      console.warn(`Could not read EXIF from ${path}: ${e.message}`);
    }
  }
  
  if (dates.length === 0) {
    throw new Error('No valid EXIF dates found');
  }
  
  // Return earliest as conservative baseline
  return Math.min(...dates.map(d => d.getTime()));
}

async function migrate() {
  const galleryDirs = await glob('content/galleries/*/');
  const missingFields = [];
  
  for (const dir of galleryDirs) {
    const metaPath = join(dir, 'meta.yaml');
    const content = await readFile(metaPath, 'utf-8');
    const data = parseYAML(content);
    
    if (!data.published_at) {
      missingFields.push({ path: metaPath, dir });
    }
  }
  
  if (missingFields.length === 0) {
    console.log('✅ All galleries already have published_at');
    return;
  }
  
  console.log(`📝 Found ${missingFields.length} galleries needing migration...`);
  
  for (const { path, dir } of missingFields) {
    // Derive from EXIF
    const photoFiles = await glob(join(dir, '*.jpg'));
    const minTime = await derivePublishedAtFromEXIF(photoFiles);
    const derivedISO = new Date(minTime).toISOString();
    
    // Update YAML with migration note
    data.published_at = derivedISO;
    data.featured = false;  // Default to unfeatured
    
    // Add top-level comment explaining derivation
    const yamlWithNote = `# NOTE: Auto-derived from EXIF during migration.\n` +
                         `# Review and update manually if you have historical publication records.\n` +
                         stringifyYAML(data);
    
    await writeFile(path, yamlWithNote);
    console.log(`✅ Migrated ${dir}`);
  }
  
  console.log('⚠️  Migration complete. Commit changes only after manual review.');
}

migrate();
```

Run as part of P0 setup phase after red team corrections.

---

## Documentation Updates Required

### ✅ UPDATED FILES

This document: `HOME_STATE_PERSISTENCE.md`

### 🔄 NEEDS UPDATE

1. **CONTENT_MODEL.md**:
   - Add `published_at`, `featured`, `slug`, `cover_photo_id` fields
   - Clarify which fields are authored vs. computed
   
2. **ARCHITECTURE_DECISIONS.md**:
   - New ADR for persistent editorial state
   
3. **REPOSITORY_STRUCTURE.md**:
   - Reflect authored `published_at` presence in examples

---

## Final Gate Verification

Before Implementation Plan acceptance:

- ✅ RT-004: Home state persists independently of builds
- ✅ published_at is authored, not generated
- ✅ featured field provides explicit editorial control
- ✅ No randomization based on directory traversal
- ✅ Migration tooling defined for legacy galleries
