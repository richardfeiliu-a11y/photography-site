# Stage 3B — Home Design Spec

## Role

Home is the exhibition entrance. It presents the featured or latest Gallery as photography, then offers quiet paths into Archive and Places. It is not a magazine front page and not a feed.

## Frozen product behavior

- Latest-first with featured override: if one published Gallery is featured, show it; otherwise show the latest by date added/published.
- Photography/Gallery is the first hierarchy; Archive and Places are direct secondary actions.
- Photographed date controls historical place in the recent set.
- A subtle “Featured” / “Recently added” cue is allowed; the algorithm and hierarchy are frozen.
- The recent set is finite and visibly ends; it never replaces Archive.

## Visual objective

First read: “this is photography.” One dominant Gallery cover inside the content frame; authored title and context below it; nothing competing. Modest editorial personality is allowed here (serif title scale, proportion), but no campaign theatrics.

## Content order

```text
Global header (site name + Archive / Places / About)
Hero Gallery:
  cue line (“Featured” or “Recently added”, when applicable)
  hero cover
  Gallery title
  photographed date/range · Place(s)
  View Gallery (primary action)
Secondary destinations: Browse Archive · Browse Places
Recent Galleries section (shared cards, finite set)
Footer (quiet: site name, Archive / Places / About, copyright)
```

Placement decision: cue above the cover is allowed; Stage 3B recommends the cue on the metadata group near the title (see Metadata placement). The cover leads the first viewport.

## Desktop composition

- Header: static compact row on the content frame (max 1400 px); site name leading, destinations trailing.
- First viewport: hero cover dominates. Media uses the widest content frame, horizontally centered within the frame's leading-edge system; no viewport full-bleed (Frozen).
- Hero media scale (Recommended starting specification, Gate G3):
  - width: content frame width, up to about 1400 px;
  - max-height philosophy: width-led with a soft ceiling around 72–78svh so title and metadata remain reachable by one short scroll on a 1440×900-class viewport; the image is never enlarged past useful source resolution;
  - alignment: cover and text block share the same leading edge (left-aligned within the frame), not centered text over image;
  - text/media relationship: all text sits below the image on canvas — title, cue, metadata, action. No overlay.
- Below the hero block: Browse Archive and Browse Places as two quiet underlined text destinations on one line or two short lines; they are links, not equal hero buttons.
- Recent Galleries: section with a quiet serif or sans section label (“Recent Galleries”), then 2–3 columns of shared cards (3 only when cover resolution supports it). Recommended starting set: up to 6 items excluding the hero. The section visibly ends; XXL gap before footer.
- Section transitions: XXL between hero block, destinations, recent section, footer. No dividers unless whitespace fails in testing.
- Footer: metadata-role text, same frame, quiet.

## Mobile composition

- First viewport: global header (site name + Menu), then hero cover at full content width (20 px side margins).
- Hero height (Recommended starting specification, Gate G3): natural landscape height from full width, capped around 60svh for landscape covers; portrait hero stays height-led at or below about 70svh so title appears without deep scroll. The controlled media edge-to-edge exception may apply to the hero cover only if it materially improves landscape viewing; text remains inset (Frozen exception rules).
- Media width: content width minus side margins; no crop.
- Title wrapping: 32–38 px serif, wraps freely to 2–3 lines; never truncated.
- Metadata: one or two quiet lines below title; cue inline within the metadata group.
- Primary action: “View Gallery” as a full-width-underlined text link with generous hit area; not a filled button.
- Archive/Places discoverability: immediately below the hero block as two clear text links; they must be reachable without opening Menu.
- Recent Gallery cards: single column; cover → title → metadata; XL gaps between cards.
- Long-title handling: wrap; increase block height; do not shrink below role size, do not ellipsize.

## Typography roles

- Hero Gallery title: Display serif role (42–52 desktop / 32–38 mobile).
- Section label: H2 sans role or card-title serif role; subordinate to hero title.
- Card titles: card serif role. Metadata everywhere: metadata sans role. Cue: metadata role, plain text.
- Footer: metadata/utility sans.

## Image rules

- Hero cover: complete authored frame, no crop, no overlay treatment, no automatic edge darkening. Optional 1 px neutral edge aid only if a high-key cover disappears into canvas.
- Loading reserves intrinsic aspect; static raised-neutral placeholder, no shimmer.
- Recent covers follow the shared card image rules.

## Spacing/rhythm

- Header → hero cover: XL–XXL (48–96 desktop / 24–48 mobile).
- Cover → title: L–XL (24–48). Title → cue/metadata: S–M. Metadata → View Gallery: L.
- Hero block → Browse line: XXL (96 / 48–64 mobile). Browse line → Recent section: XXL.
- Recent section label → grid: XL. Card row gaps: XL–XXL desktop / XL mobile.
- Last recent card → footer: XXL.

## Metadata placement

- Cue (“Featured” / “Recently added”) (Recommended starting specification, Gate G3):
  - placement: first line of the hero metadata group, immediately above the photographed date, same leading edge;
  - typography role: metadata sans, secondary color, same size as metadata (12–14 px desktop, 13–14 mobile);
  - contrast: secondary text (passes 4.5:1) — quieter than title, never louder than date;
  - relation to date: cue never replaces or reorders the photographed date; for backfilled older work, the photographed date remains the prominent line and the cue honestly describes addition, so 2019 work cannot read as shot in 2026;
  - form: plain text, no badge/chip/pill, no background, no border.
- Card metadata order and grouping: shared card rules.

## Interaction states

- Hero cover + title form one perceivable link region; title is the semantic link (“View Gallery” is the explicit second affordance to the same destination). Hover: underline on title/link and optional subtle image-edge clarification; no zoom.
- Browse links: standard inline link states.
- Cards: shared card states (default/hover/focus/active) per `SHARED_COMPONENT_RULES.md`.
- Footer links: standard quiet link states.

## Accessibility constraints

- Skip link first. One H1 (the hero Gallery title; site name is not an H1 here).
- Hero cover alt: since the adjacent linked title names the destination, the cover may use empty alt to avoid double announcement (Stage 3A policy); the Gallery's own description lives in the Gallery.
- Focus perimeter encloses or clearly connects cover and text block.
- 200% zoom and 320 px reflow: title, metadata, action all wrap without clipping.
- Cue is real text, announced by assistive tech, not decorative.

## Edge cases

- No featured Gallery and only one published Gallery: latest fallback; no cue needed; recent section may contain only that Gallery — section label still honest, no filler cards.
- Very long title (70 chars) or Chinese title: wraps; hierarchy intact; CJK serif fallback applies.
- Portrait hero cover on desktop: height-led within ~72–78svh; width follows ratio; text block still leading-edge aligned, block may center optically within frame.
- Panorama cover: width-led, shallow height; never cropped to a banner.
- Multi-place hero Gallery: Places wrap within metadata group.

## Real-photo stress cases

- Bright/high-key hero cover (edge aid decision); dark hero cover; low-contrast hero.
- Long English title; Chinese title; mixed-script title.
- Mobile hero with bright landscape and dark portrait covers.
- “Recently added” backfill case (older photographed date prominent).

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Hero media width | content frame, up to ≈1400 px | Recommended; G3 |
| Hero desktop max-height | ≈72–78svh soft ceiling | Recommended; G3 |
| Hero mobile landscape height | full width, capped ≈60svh | Recommended; G3 |
| Cover → title gap | 24–48 px desktop / 24 mobile | Recommended |
| Recent set size | up to 6 cards | Recommended |
| Recent desktop columns | 3 (2 if covers/titles suffer) | Recommended |
| Cue placement | metadata group, above date | Recommended; G3 |

## Prototype-gated values

- G3: exact hero scale (width/height proportion) and whether the cue reads clearly beside real covers; compare starting state against a slightly taller/shorter hero only if first-viewport balance fails with real photos.

## Must not introduce

- Viewport full-bleed hero; overlay title or metadata on the cover; CTA button fills; carousel of multiple Galleries; second hero; tag/category row; search; sticky header; hero hover zoom; motion entrances; “Recommended for you” logic in the recent set; pagination or infinite scroll of recent Galleries.
