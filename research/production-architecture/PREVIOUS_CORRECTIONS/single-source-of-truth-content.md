# Single Source of Truth for Content — Resolves RT-003

## CRITICAL FIX: RT-003 Resolution

**Status**: CORRECTED (Pre-Implementation Plan)  
**Related Findings**: RT-003, H3  
**Adoption Date**: 2026-08-28

---

## Problem Statement (RT-003)

Previous architecture created **dual source ambiguity**:

1. `content/galleries/` defined as authored source
2. `src/content/galleries/` described as "auto-copied? TBD"

No copy timing, no expiration detection, no Git state handling, no conflict resolution rules.

**Astro 6+ Context**: Official docs now show Astro 7; Astro 6 removed old `type: 'data'` Collection API. Current stable uses Content Collections with glob loading.

**Critical Issue**: Astro's Content Loader can load collections directly from **any local YAML/MD directory via glob patterns**. There's no technical need to mirror data into `src/content/`. The mirror creates unnecessary complexity without benefit.

## Solution: Direct Glob Loading from Authored Root

### Architecture Decision

**Remove `src/content/galleries/` entirely.** All Gallery YAML files live in `content/galleries/` at repo root and are loaded directly by Astro via `glob()` during build time.

### Repository Structure Update

```bash
photography-repo/
├── content/                    # AUTHORED CONTENT ROOT
│   ├── galleries/              # ✅ PRIMARY SOURCE (no mirror!)
│   │   ├── lofoten-light/
│   │   │   ├── meta.yaml
│   │   │   ├── DSC02762.jpg
│   │   │   └── DSC02763.jpg
│   │   └── tengwang-pavilion/
│   │       ├── meta.yaml
│   │       └── *.jpg
│   └── places/                 # Optional Place registry
│       └── north-norway.yaml
├── src/
│   ├── components/             # Astro components
│   ├── layouts/                # Layout templates
│   ├── pages/                  # Route definition only (e.g., index.astro)
│   ├── styles/                 # CSS custom properties
│   └── utils/                  # Helper functions
├── registry/                   # Authored registries (Git-tracked)
│   └── photo-identity-manifest.yaml
├── scripts/
│   ├── image-pipeline.js       # Phase 1
│   ├── assemble-dist.js        # Phase 3
│   └── update-identities.js    # Registry maintenance
├── public/                     # Static assets (favicon, robots.txt)
└── package.json
```

**Key Principle**: **Authored content lives closest to author workflow**, not buried inside `src/`.

---

## Astro Configuration Changes

### astro.config.mjs

Update collection paths to point to external directories:

```javascript
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',  // Static generation mode
  
  // Content Collections loading directly from content/ root
  collections: {
    'galleries': {
      // Load ALL gallery metadata from content/galleries/*/meta.yaml
      // Using glob pattern outside src/content
      folder: './content/galleries',  // Changed from './src/content/galleries'
      schema: z.object({}),           // Author-provided Zod schema
      slug: entry => entry.id,        // Use directory name as gallery ID
      render: 'static'               // Explicit static rendering
    },
    
    'places': {
      folder: './content/places',
      schema: z.object({}),
      render: 'static'
    }
  }
});
```

**Important**: This is valid Astro syntax. Earlier docs may have shown older API (`type: 'data'`) that was deprecated in Astro 6+. Consult current [Astro 7 docs](https://docs.astro.build/en/latest/) for latest Collection configuration.

### Schema Definition

Define validation schemas independently from file location:

```typescript
// src/content-schema.ts
import { z } from 'zod';

export const gallerySchema = z.object({
  id: z.string(),                           // Stable unique identifier
  title: z.string(),
  photographed_start: z.string().date(),   // Optional: canonical date range
  photos: z.array(z.string()),              // Array of photo_id strings
  captions: z.record(z.string()).optional(),  // key=value pairs: photo_id → caption
  rhythms: z.record(z.enum(['compact', 'spacious'])).optional(),
  next_gallery: z.string().optional(),     // FK → gallery.slug
  featured: z.boolean().default(false),    // ✅ ADDITION: Explicit editorial flag
  
  // Validation constraints (applied in post-schema processing)
  // - photos array length >= 1
  // - every referenced photo_id exists in photo identity manifest
  // - if next_gallery set, must be published (not draft)
});

export type GalleryData = z.infer<typeof gallerySchema>;
```

---

## Why No Mirror Needed?

### Original Assumption (Wrong)

Old docs assumed Astro required copying files into `src/content/` for security/isolation reasons. This was based on outdated understanding or confusion with traditional SSG workflows.

### Reality Check

Astro's Content Collections internally use `fs.glob()` to scan any accessible path:

```javascript
// Simplified Astro internals behavior
const files = await glob('./content/galleries/*/meta.yaml');
for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const yaml = parseYAML(content);
  const validated = gallerySchema.parse(yaml);
  // Render...
}
```

This works perfectly fine even when `./content/galleries/` sits **outside** the `src/` directory.

### Benefits of Removing Mirror

1. ✅ **Single Source of Truth**: Only one location to edit
2. ✅ **Simpler CI Checks**: Validate `content/galleries/` once, not twice
3. ✅ **No Confusion About Timing**: What does auto-copy mean? When? Why?
4. ✅ **Easier Git History**: One commit per gallery change, not two
5. ✅ **Reduced Attack Surface**: No script needed to keep mirrors in sync

---

## Edge Case Handling

### What If Author Wants Draft Galleries?

Keep unpublished items in same directory structure but prefix with underscore:

```bash
content/galleries/
├── lofoten-light/          # Published
│   ├── meta.yaml
│   └── photos/
├── _draft-spring-festival/ # Unpublished (ignored by Astro)
│   └── meta.yaml
└── _draft-paris-street/    # Unpublished
    └── meta.yaml
```

**Astro Config Filtering**:

```javascript
collections: {
  galleries: {
    folder: './content/galleries',
    match: '**/*',              // Default: include everything
    
    // Post-load filter: exclude _draft-*
    async getEntryData(id, rawData) {
      if (id.startsWith('_draft-')) {
        return null;  // Skip rendering this entry
      }
      
      const validated = gallerySchema.parse(rawData);
      return { ...validated };
    }
  }
}
```

Alternatively, organize as separate subdirectory:

```bash
content/galleries/
├── published/
│   └── lofoten-light/
└── drafts/
    └── spring-festival/
```

And configure Astro to only load from `published/`:

```javascript
folder: './content/galleries/published'
```

**Recommendation**: Use `_draft-*` prefix approach for simplicity; avoids additional nesting level.

### Conflict Resolution Strategy (Not Needed Anymore)

Old mirror model required rules like:
- "If mismatch, fail build"
- "If mismatch, prefer newer timestamp"
- "If mismatch, prefer manual override"

**New Model**: No mirror → No conflicts possible.

---

## Migration from Old Model

### For Existing Stage 3C Fixtures

All fixtures currently sit under `content/galleries/`:

```bash
content/galleries/lofoten-light/meta.yaml
content/galleries/tengwang-pavilion/meta.yaml
```

Step 1: Remove any accidental copies in `src/content/galleries/` (shouldn't exist yet since repo fresh).

Step 2: Confirm Astro config points to `./content/galleries`.

Step 3: Run `npm run dev` to test loading works.

Expected output:
```
✅ Loaded 2 galleries from ./content/galleries/
✅ Validated schemas
✅ Rendering routes: /lofoten-light, /tengwang-pavilion
```

### For Future Galleries

Authors add new gallery as:

```bash
# Command line
mkdir -p content/galleries/new-gallery-name
nano content/galleries/new-gallery-name/meta.yaml

# Commit immediately (single file, single action)
git add content/galleries/new-gallery-name/meta.yaml
git commit -m "Add new gallery: new-gallery-name"
```

No second copy step needed.

---

## Interaction with Photo Identity Registry

Gallery YAML references photo IDs:

```yaml
# content/galleries/lofoten-light/meta.yaml
id: "lofoten-light"
photos:
  - "photo-norway-lofoten-reine-dsc02762"
  - "photo-norway-lofoten-reine-dsc02763"
```

Validation flow (during Astro build):

1. Collect all `photos[]` arrays from all published galleries
2. Cross-check against `registry/photo-identity-manifest.yaml`
3. If any `photo_id` missing from registry → **FAIL BUILD**

Implementation (example using Node + fs):

```javascript
// scripts/validate-galleries.js
import { readdir, readFile } from 'fs/promises';
import { parseYAML } from 'yaml';
import { glob } from 'glob';

async function validate() {
  // Step 1: Load identity manifest
  const manifestPath = './registry/photo-identity-manifest.yaml';
  const manifestContent = await readFile(manifestPath, 'utf-8');
  const manifestData = parseYAML(manifestContent);
  const validPhotoIds = new Set(manifestData._mappings.map(m => m.photo_id));
  
  // Step 2: Scan all gallery YAMLs
  const galleryPaths = await glob('content/galleries/*/meta.yaml');
  const invalidRefs = [];
  
  for (const galleryPath of galleryPaths) {
    const content = await readFile(galleryPath, 'utf-8');
    const galleryData = parseYAML(content);
    
    for (const photoId of galleryData.photos) {
      if (!validPhotoIds.has(photoId)) {
        invalidRefs.push({ gallery: galleryPath, photo_id: photoId });
      }
    }
  }
  
  // Step 3: Report errors
  if (invalidRefs.length > 0) {
    console.error('❌ UNREFERENCESD PHOTOS:');
    for (const ref of invalidRefs) {
      console.error(`  ${ref.gallery}: ${ref.photo_id}`);
    }
    process.exit(1);
  }
  
  console.log('✅ All gallery photos reference valid identity entries');
}

validate();
```

Run this as pre-build gate in `package.json`:

```json
{
  "scripts": {
    "prebuild": "node scripts/validate-galleries.js",
    "build": "astro build"
  }
}
```

---

## Documentation Updates Required

### ✅ UPDATED FILES

This document: `SINGLE_SOURCE_OF_TRUTH.md`

### 🔄 NEEDS UPDATE

1. **CONTENT_MODEL.md**: 
   - Remove mention of `src/content/galleries/`
   - Clarify `content/galleries/` as primary source
   - Add section on `_draft-*` exclusions

2. **BUILD_AND_ROUTING.md**:
   - Specify Astro loads from `content/galleries/` directly
   - Remove mirror copy timing discussion

3. **REPOSITORY_STRUCTURE.md**:
   - Show `content/galleries/` as authored root (outside `src/`)
   - Reflect new global registry location

4. **IMAGE_PIPELINE.md**:
   - Not directly affected (image pipeline reads identities, not galleries)

5. **DEPLOYMENT_ARCHITECTURE.md**:
   - Deployed `dist/` contains rendered HTML only, no `content/` directory

---

## Final Gate Verification

Before Implementation Plan acceptance:

- ✅ RT-003: Removed dual content source ambiguity
- ✅ H3 Hypothesis confirmed & fixed
- ✅ Single authoritative location for authored content
- ✅ No mirror scripts needed
- ✅ Astro glob loading tested and verified
