# Stage 3A — Visual Direction

Status: **recommended visual direction for Stage 3B specification**. This file translates frozen Stage 2B product and UX decisions into a visual identity. It does not change IA, behavior, or feature scope.

## Product visual identity

The product is a long-lived **Personal Photographic Archive / Online Photography Exhibition**. Its interface has two duties:

1. give each authored Gallery enough quiet space to be viewed as photography;
2. make the full body of work legible by photographed time and Place without turning the site into a database interface.

The governing attention order remains:

```text
Photo > Whitespace > Typography > Metadata > Controls
```

This order is not a literal size formula. It means that a control may be large enough to operate accessibly, but its color, placement, density, and motion must not compete with the image.

## Candidate directions

### Direction A — Museum Neutral

- **Typography tendency:** one restrained sans-serif family; institutional labels; compact, highly regular hierarchy.
- **Whitespace:** broad, symmetrical, and consistently measured.
- **Contrast:** white or very pale neutral canvas with near-black text and quiet gray metadata.
- **Card language:** orderly image records with repeated metadata alignment.
- **Gallery feeling:** calm white room; individual photographs appear isolated and formally catalogued.
- **Advantages:** durable, multilingual-friendly, easy to maintain, compatible with varied photography.
- **Risks:** can feel institutional and anonymous; discovery pages may resemble a collection database; the photographer's editorial voice becomes too weak.

### Direction B — Quiet Editorial Archive

- **Typography tendency:** restrained display serif for authored titles and major index headings; neutral sans-serif for navigation, metadata, captions, body, and position.
- **Whitespace:** generous in Gallery, more economical and rhythmic in discovery; asymmetry is allowed only when it reinforces reading order.
- **Contrast:** subtly warm neutral canvas, graphite text, measured secondary contrast, and no decorative brand color.
- **Card language:** image plus text block, not a bordered container; cover dominates, metadata stays below the image.
- **Gallery feeling:** a carefully edited photobook sequence translated into native vertical viewing, with the archive quietly present behind it.
- **Advantages:** photography remains primary while the interface gains a recognizable editorial voice; strong separation between discovery and viewing; durable without becoming bureaucratic.
- **Risks:** a poor serif or an overly dramatic scale could imitate a fashion magazine; mixed Latin/CJK typography requires disciplined fallback testing.

### Direction C — Cinematic Contemporary

- **Typography tendency:** large sans-serif display, sparse labels, stronger contrast between scale extremes.
- **Whitespace:** viewport-led compositions, frequent full-bleed media, and dramatic pauses.
- **Contrast:** deeper black/white polarity; possible dark surfaces and overlay controls.
- **Card language:** image-led panels with hover or transition effects.
- **Gallery feeling:** immersive, screen-like, and eventful.
- **Advantages:** distinctive first impression; strong emphasis on a single featured Gallery.
- **Risks:** makes the interface itself an attraction, tires quickly across long archives, performs poorly for mixed-orientation work, encourages crop/overlay/fullscreen patterns, and raises motion and theme maintenance cost.

## Decision criteria and matrix

Scoring: 1 = poor fit, 3 = workable with material risk, 5 = strong fit. Weights reflect this product, not a generic photography site.

| Criterion | Weight | A Museum Neutral | B Quiet Editorial Archive | C Cinematic Contemporary |
|---|---:|---:|---:|---:|
| Photography dominance | 20% | 5 | 5 | 3 |
| Long-term durability | 15% | 5 | 5 | 2 |
| Archive readability | 15% | 5 | 5 | 2 |
| Mobile continuity | 10% | 4 | 5 | 2 |
| Multilingual resilience | 10% | 5 | 4 | 3 |
| Low visual fatigue | 10% | 5 | 5 | 2 |
| Maintenance cost | 10% | 5 | 4 | 2 |
| Distinctiveness without gimmicks | 5% | 2 | 5 | 3 |
| Compatibility across photography styles | 5% | 5 | 5 | 2 |
| **Weighted score / 5** | **100%** | **4.70** | **4.80** | **2.35** |

The scores are design judgments, not user-research measurements. Direction B wins narrowly because it preserves the operational strengths of Museum Neutral while giving discovery and authored titles a controlled identity.

## Recommended direction

```text
Primary visual character: Quiet editorial archive
Secondary qualities: Gallery-like, contemporary, tactile through rhythm rather than effects
Avoid: Institutional cataloguing, magazine theatrics, commercial portfolio branding, cinematic control chrome
```

### Neutral versus expressive decision

Choose **Option 3: modest personality in discovery; extreme restraint in Gallery**.

- Home, Archive, Places, and About may use the serif/sans contrast, editorial scale, and denser typographic groupings to establish identity.
- Gallery sequence, Overview, captions, position, and continuation use the same system at lower contrast and lower density.
- Personality comes from proportion, rhythm, type roles, and image sequencing—not decorative color, shadows, unusual navigation, or motion.

This is similar to a financial report whose cover and section dividers establish authorship, while the tables remain disciplined: identity lives in the system, not in ornamental noise around every item.

## Why the other directions are rejected

### Museum Neutral

Rejected as the primary direction, not as a source of discipline. It is highly compatible with the archive, but a pure institutional register risks making Gallery cards look like accession records and Places look like a collection database. Stage 3A retains its neutrality, alignment, and durability, then adds a limited editorial type voice.

### Cinematic Contemporary

Rejected because it conflicts with the frozen native vertical sequence and no-destructive-crop requirement. Full-bleed scenes, overlay controls, dark surfaces, and transition-led immersion would work for a short showcase but impose high attention and maintenance costs across 15–300 Galleries and many photographic styles.

## Visual anti-goals

- No SaaS card shells, dashboard panels, data-table styling, chips, or badge clouds.
- No travel-interface cues: maps, pins, flags, itinerary lines, passport motifs, or country-color coding.
- No magazine homepage with competing story modules, masthead theatrics, or multiple hero headlines.
- No black-box slideshow, filmstrip control bar, swipe-first viewing, or fullscreen assumption.
- No decorative accent palette, gradient branding, glass navigation, parallax, scroll-jacking, or forced cinematic transitions.
- No faux-material styling such as paper textures, drop shadows, torn edges, contact-sheet perforations, or camera UI motifs.
- No logo project in MVP. The site name is a text mark.
- No final visual judgment based only on neutral placeholders.

## Visual identity test

A successful Stage 3B screen should pass three quick reads:

1. **At a glance:** “This is photography,” not “this is a portfolio template” or “this is a database.”
2. **After one scroll:** the visitor can distinguish authored viewing from archive discovery without learning a new control system.
3. **After ten minutes:** the typography and controls remain useful but stop being memorable before the photographs do.

