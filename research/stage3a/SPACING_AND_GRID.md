# Stage 3A — Spacing and Grid

Status: **design-spec scale and layout philosophy**. Values are prototype-level targets; Stage 3B defines page-specific application without turning them into production breakpoint code.

## Spacing scale

Use six base steps:

| Token | Reference value | Primary use |
|---|---:|---|
| XS | 4 px | Optical correction, underline/label separation; never a primary layout gap |
| S | 8 px | Closely related metadata, title-to-subline details |
| M | 16 px | Image-to-caption, card image-to-text, mobile internal grouping |
| L | 24 px | Card text groups, nearby controls, small section boundaries |
| XL | 48 px | Card-row separation, local section transitions, mobile page sections |
| XXL | 96 px | Major page boundaries and base desktop Gallery image rhythm |

For the few places that need more than XXL, use an explicit composition of existing steps rather than creating a long token list: `XXL + XL = 144 px`. On mobile, a compact composite such as `XL + M = 64 px` is allowed for Gallery rhythm.

Principle: the gap between groups should be at least twice the gap inside a group. If card title-to-metadata is S, card-to-card or row separation begins at M/L, not S.

## Desktop layout grid

### Global content frame

- Preferred maximum discovery/header frame: approximately **1360–1440 px**.
- Viewport gutters: approximately **32–64 px**, growing with the viewport.
- The canvas may extend full viewport width; text and controls stay on the content frame.
- Alignment uses a small number of persistent leading edges: site name, page title, grid, and body text. Isolated decorative offsets are not allowed.

### Discovery grid philosophy

- Home recent Galleries: 2–3 columns depending on available image scale.
- Archive and Place pages: 3 columns at the reference desktop size; a fourth column is allowed only on genuinely wide canvases when titles and metadata remain readable.
- Intermediate widths collapse to 2 columns when a three-column card can no longer support its image and untruncated metadata.
- Column count follows content fit, not device labels or fixed industry breakpoints.
- Grid order remains ordinary reading order. Do not use masonry if it makes photographed chronology or authored list order ambiguous.
- Year headings span the active grid and align with card edges. They scroll normally; they are not sticky.

### Gallery frame

Gallery is not forced into the discovery grid.

- Header/caption text follows a narrower reading column.
- Each photograph is centered inside a broader media frame and may use a different intrinsic width according to orientation.
- Landscape and portrait rules are based on both viewport width and viewport height; equal boxes are not a goal.
- A quiet outer margin remains around desktop Gallery images. No default viewport full-bleed.

### Reading widths

- About/body: roughly **60–70 Latin characters** or **28–36 CJK characters**.
- Caption: roughly **48–60 Latin characters** or **24–32 CJK characters**.
- Metadata follows the image/card width but should not become a full-width paragraph.

## Mobile layout

- Default side margin for text, header, navigation controls, captions, and cards: approximately **16–20 px**.
- Discovery cards use one column and keep cover, title, date/range, Place, and count in normal flow.
- Menu and Overview backgrounds may fill the viewport; their text and controls remain inside side margins and safe areas.
- Captions remain inset even when a Gallery image uses a controlled edge-to-edge exception.
- No page-level horizontal scrolling.
- Mobile spacing should preserve hierarchy while reducing traversal fatigue; it is not a proportional miniaturization of desktop.

## Section rhythm

| Relationship | Desktop target | Mobile target | Rule |
|---|---:|---:|---|
| Header to page title/first content | XL–XXL | XL | First content should not appear attached to global nav |
| Page title to index grid | XL | L–XL | Enough separation for hierarchy, not an empty hero |
| Year heading to first card row | L | M–L | Heading acts as landmark, not a separate page |
| Card media to title | M | M | Cover and title read as one object |
| Card title to metadata | S | S | Tightest meaningful content group |
| Discovery grid row | XL–XXL depending on image scale | XL | Dense enough to scan, never feed-like |
| Major page section | XXL | XL–XXL | Home sections remain finite and distinct |
| Last content to page end | XXL | XXL | Avoid accidental dead-end feeling |

## Gallery image sequence rhythm

Three named states are allowed. They express editorial relationships, not automatic orientation rules.

| Rhythm | Desktop | Mobile | Use |
|---|---:|---:|---|
| Compact | about 64–72 px | about 40–48 px | Deliberately paired or closely related images; used sparingly |
| Base | about 96 px | about 64 px | Default transition between most Photos |
| Breathing | about 144 px | about 96 px | Chapter shift, major tonal break, or clear pause before/after a pivotal Photo |

Rules:

- The default is **Base**. Compact and Breathing require an editorial reason in Stage 3B or content authoring; they are not selected by aspect ratio.
- Caption gap is M or slightly less after the image. Sequence spacing begins after the caption; uncaptioned Photos do not reserve a blank caption region.
- A portrait followed by landscape does not automatically receive extra spacing.
- In a 72-Photo Gallery, mobile Base rhythm remains restrained enough to avoid excessive blank-scroll fatigue. Breathing is rare.
- The first Photo receives more separation from the Gallery header than an ordinary caption gap, but not a full decorative hero section.
- The last Photo/caption receives a clear end pause before continuation; see `GALLERY_VISUAL_SYSTEM.md`.

## Full-bleed boundaries

- **Home hero:** no viewport full-bleed in MVP. It may use the widest content frame and dominate the first view without touching every viewport edge.
- **Desktop Gallery:** no full-bleed. A stable neutral margin supports contemplation and protects mixed orientations.
- **Mobile Gallery:** controlled edge-to-edge is permitted for media only when it materially improves landscape viewing. The complete image remains visible, no crop is introduced, and caption/controls stay inset. This is an exception, not the default card language.
- **Overview/Menu:** background layers may fill the viewport; content observes safe-area and text margins.

## Responsive continuity

Desktop and mobile share the same hierarchy and spacing names. They differ in magnitude and composition:

- discovery becomes one column rather than a compressed multi-column grid;
- Gallery remains native vertical and orientation-preserving;
- title, caption, and metadata roles do not swap families or order;
- controls do not become image overlays merely to save space;
- layout collapses when content stops fitting, not at a preselected device name.

Stage 3B must test the smallest and largest supported widths, 200% text zoom, long bilingual strings, and safe-area devices before choosing production breakpoints.

