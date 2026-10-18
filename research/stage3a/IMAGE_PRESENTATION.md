# Stage 3A — Image Presentation

Status: **cross-page image rules**. Gallery-specific sequence behavior is defined in `GALLERY_VISUAL_SYSTEM.md`.

## Governing principle

Images are the content, not decoration. Layout adapts to the Photo; the Photo is not destructively cropped to fit a reusable UI box.

The product supports landscape, portrait, square, panoramic, bright, dark, low-contrast, black-and-white, and color-heavy work without changing its visual identity.

## No-destructive-crop policy

- Gallery sequence always presents the complete Photo with contain behavior.
- Overview thumbnails preserve the complete Photo. Empty space within a thumbnail cell is acceptable.
- Discovery covers preserve the authored image frame. The publisher chooses the cover Photo, but the interface does not create a hidden center crop.
- Aspect-ratio differences are an expected property of the archive, not an error to normalize.
- If a future editorial crop is ever introduced, it must be a separately authored derivative with a visible preview and must not replace the canonical Photo. That is outside MVP.

## Cover treatment

### Philosophy

A Gallery representation is **image + text block**, not a card shell. The cover is the dominant element; title and metadata follow underneath on the page canvas.

### Rules

- Use the intrinsic cover ratio.
- Align cover and text to the same leading edge.
- No metadata overlay on the image.
- No automatic darkening, gradient, blur, color wash, or text-safety treatment over the image.
- No image border by default. A subtle neutral 1 px edge aid may appear only when a high-key image disappears into the canvas.
- No rounded card container, separate card background, or drop shadow.
- Card rows may have unequal media heights. Preserve reading order through the grid, not masonry reordering.
- Authors should test a Gallery cover at discovery scale. A Photo that only works at full Gallery scale may be a poor cover even if it is a strong sequence image.

## Desktop Gallery scale

### Landscape

- Width is the primary constraint: use up to the broad Gallery media frame while retaining a calm outer margin.
- Reference ceiling: approximately `min(88–92vw, 1360–1440 px)` for ordinary landscape frames.
- Very panoramic images may approach the width ceiling but must not be enlarged beyond a visibly useful source resolution.
- Height remains natural. A landscape does not need to fit entirely in one viewport if doing so would make it too small, but ordinary frames should be viewable without awkward micro-scrolling.

### Portrait

- Height is the primary constraint: target a maximum image height around **78–84svh** at desktop reference sizes.
- Width follows intrinsic ratio; do not enlarge a portrait merely to match the width of neighboring landscapes.
- Maintain enough normal scroll path to reach the caption and next image without fixed overlays covering the frame.
- A narrow portrait may appear substantially smaller in area than a landscape. That is truthful presentation, not a layout defect.

### Square and near-square

- Use the portrait-height constraint and the landscape-width ceiling together.
- Do not assign square images a special component or decorative frame.

## Mobile Gallery scale

- Default media width uses the available content width with no destructive crop.
- Landscape may use the controlled edge-to-edge media exception when the added width materially improves viewing; captions and controls remain inset.
- Portrait image area should normally remain at or below approximately **82svh**, preserving a clear path to caption and continuation.
- A tall panoramic/stitched image may exceed that target only if the complete image would otherwise become unusably small. It still uses native vertical scroll, not an internal image scroller.
- Do not letterbox an ordinary mobile Gallery image inside an artificial fixed-height stage.
- Consecutive orientation changes must not trigger horizontal overflow, a swipe mode, or a different control layout.
- The image never touches OS gesture areas with an overlapping custom gesture target; Gallery progression remains native scroll.

## Mixed-orientation sequences

- Center images in the shared media frame while keeping captions aligned to each image's own leading edge where practical.
- Preserve one continuous vertical reading axis. Do not alternate left/right placement merely because orientations differ.
- Do not equalize image heights or widths.
- Do not automatically add more whitespace at an orientation change. Rhythm reflects editorial relationship, not geometry.
- Test portrait→landscape, landscape→portrait, panorama→portrait, and captioned→uncaptioned transitions.

## Full-bleed decision

| Context | Decision | Reason |
|---|---|---|
| Home hero desktop | No viewport full-bleed | A wide framed cover can dominate without turning Home into a campaign page |
| Gallery desktop | No | Neutral margins support sequence and mixed orientation |
| Mobile Gallery | Conditional media-only exception | Extra landscape width may help; text and controls remain inset and the full frame remains visible |
| Discovery cards | No | Cards need a stable image-plus-text relationship and scan rhythm |
| Overview background | Full viewport layer allowed | The layer is a navigation mode; thumbnails themselves remain contained |

## Image background

- Page canvas is the default background for images.
- Transparent images are not a core photography use case; if present, render on the canvas and review deliberately.
- No per-image background color extraction.
- No black mat automatically added around dark images and no white mat automatically added around light images.
- A global neutral edge aid may solve disappearing edges; it must be subtle enough not to read as a framed print effect.

## Loading and failure presentation

- Reserve the exact intrinsic aspect ratio before the asset loads to prevent layout shift.
- Loading state is a static low-contrast neutral field. No shimmer, pulse, blurred preview animation, or generic spinner inside every image.
- A low-quality image placeholder may be evaluated later only if it does not alter perceived color before the final Photo appears.
- Failed images keep the same dimensions and show a visible, text-accessible failure state. They do not silently fetch an unrelated network fallback.
- Lazy loading must never reorder the sequence or make the current-position indicator jump.

## Resolution and enlargement constraints

- Do not enlarge an asset past the point where softness becomes the dominant visual impression.
- Stage 3B should specify source-resolution guidance per media slot after real assets are known; Stage 3A does not choose an image pipeline.
- High-density displays must be considered when deciding whether a cover can support a multi-column desktop card.

## Visual edge cases

- White border already baked into a Photo: preserve it; do not add a second visible frame.
- Diptych/triptych baked into one file: treat as one Photo.
- Very narrow panorama: allow broader width and natural shallow height; do not crop to a standard banner.
- Very tall image: prioritize legible scale and native scrolling over one-screen containment.
- Photo with embedded text: do not use alt text or caption to repeat every visible word unless the text is essential to meaning.
- Animated image/video: outside MVP unless later specified; do not derive motion rules from still-image behavior.

## Real-photography validation gate

Stage 3B/3C must validate the system using, at minimum:

- dark and bright photographs;
- low-contrast and high-contrast photographs;
- portrait, landscape, square, and panoramic frames;
- dense scene and minimal scene;
- black-and-white and color-heavy work;
- subtle near-canvas borders and deep black edges;
- mixed-orientation sequences and both captioned/uncaptioned Photos.

Neutral placeholders cannot validate color perception, edge visibility, scale, cover salience, or sequence rhythm.

