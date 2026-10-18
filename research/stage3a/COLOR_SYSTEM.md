# Stage 3A — Color System

Status: **role-level color direction with a prototype palette target**. Values below are calibration targets for Stage 3B, not an instruction to inherit prototype colors or implement tokens now.

## Direction

Use a **subtly warm, low-chroma neutral canvas** with graphite text. The warmth should feel like a viewing surface, not aged paper. It must not tint image edges strongly enough to alter perceived white balance.

Decisions:

- **Background:** subtle warm neutral, not pure white.
- **Primary text:** near-black graphite, not pure black.
- **Secondary text:** clearly quieter but still fully readable.
- **Borders:** rare and low contrast; structure is expressed by whitespace first.
- **Accent:** **Option B — accent only for focus/accessibility states**.
- **Dark mode:** **not in MVP**.

## Role palette target

| Role | Prototype target | Purpose |
|---|---|---|
| Canvas | `#F6F4EF` | Default page and Gallery viewing surface |
| Raised/overlay surface | `#EFECE5` | Menu/Overview distinction when needed; not a card fill |
| Primary text | `#1A1A18` | Titles, body, active navigation |
| Secondary text | `#5F5E59` | Metadata, captions, position, inactive utility |
| Hairline/separator | `#D4D0C7` | Rare divider or image-edge support when space is insufficient |
| Strong neutral state | `#34332F` | Hover/active neutral without brand color |
| Focus accent | `#0B57D0` | Keyboard focus perimeter and accessibility-only emphasis |
| Focus inner contrast | `#F6F4EF` | Separation when a two-color focus indicator crosses mixed surfaces |
| Error/status, if later required | Not frozen | Add only when a real product state requires it; do not prebuild unused ramps |

The current Stage 2 prototype values are not carried forward automatically. The targets above are a new direction and must be checked with the chosen fonts and real photographs.

## Contrast policy

- Normal text and captions: at least **4.5:1** against their rendered surface.
- Large text: at least **3:1**, while the preferred target remains 4.5:1 when it does not make the hierarchy harsh.
- Focus indicators and meaningful non-text boundaries: at least **3:1** against adjacent colors.
- Metadata may be quieter through size, spacing, and role; it may not be made “subtle” by dropping below the applicable contrast requirement.
- Text never relies on a photo overlay for contrast. Labels and captions sit on a stable neutral surface.

Stage 3A calibration measurements against `#F6F4EF`:

| Pair | Contrast ratio | Result |
|---|---:|---|
| Primary text `#1A1A18` on Canvas | 15.86:1 | Passes 4.5:1 normal-text target |
| Secondary text `#5F5E59` on Canvas | 5.91:1 | Passes 4.5:1 normal-text target |
| Focus `#0B57D0` on Canvas | 5.81:1 | Passes 3:1 non-text/focus target |

Ratios were calculated from the specified sRGB hex pairs using the WCAG relative-luminance formula. The same focus color measures 5.41:1 against the raised surface `#EFECE5`. Final font rendering, transparency, and any changed values must be measured again in Stage 3B/3C.

## Accent decision

There is no fixed decorative or brand accent in MVP.

- Ordinary links use graphite text plus underline/state change.
- Active navigation uses weight, underline, or position—not a colored tab.
- Gallery controls stay neutral.
- The focus accent is deliberately functional and may be a restrained blue because it remains distinguishable across the warm neutral system. It is not reused for static titles, Place identity, or card decoration.
- Selection/current state must include a shape, line, label, or weight change so focus blue is never the sole cue.

This avoids a common accounting-category error: one color should not mean both “brand personality” and “this element currently has keyboard focus.” The only colored semantic role in MVP has one job.

## Background and photographic perception

- Canvas chroma must remain low. If the surface appears beige beside a neutral white photograph, it is too warm.
- Do not change the page background based on individual image colors.
- Do not place automatic gradients, dominant-color washes, or blurred image backdrops behind photographs.
- Black-and-white images, high-key whites, and very dark frames must preserve visible edges without forced shadows. A subtle 1 px neutral outline may be enabled only when the image edge disappears into the canvas; it is an edge aid, not a card border.
- Loading placeholders use the raised neutral surface, preserve dimensions, and do not shimmer.

## Borders and containers

- Gallery cards have no container border and no separate card background.
- Use whitespace to group image and metadata.
- A hairline may separate major index years or the Overview header only when spacing alone fails in testing.
- Avoid rounded filled pills for metadata and navigation. Place, date, count, and “Recently added” remain text.
- No drop shadow around ordinary cards or Gallery photographs.

## Hover, active, selected, and focus

- **Hover:** primary text moves toward `#34332F` only if the base is secondary; underlines or a restrained image-edge change may appear. Do not recolor the photograph.
- **Active/pressed:** preserve text contrast; a small opacity or position response may supplement but not replace the state.
- **Current:** use outline/marker plus label where needed. Never use tint alone.
- **Focus:** visible 2 px minimum perimeter using the focus accent, optionally separated from the element by a canvas-colored gap so it remains legible against photographs and overlay surfaces.
- In forced-colors/high-contrast modes, retain the platform focus indicator rather than forcing the neutral palette.

## Dark mode decision

**No dark mode in MVP.**

Reasons:

1. A second theme changes perceived contrast, edge visibility, and color balance for every photograph; it is not a free system preference.
2. The archive must support many photographic styles, so theme-specific QA would roughly double the visual validation matrix.
3. Gallery already uses a controlled neutral surface; automatic theme switching could make the same sequence feel materially different between users.
4. There is no frozen product task that requires night viewing or theme choice.

Dark mode remains reversible later because roles are semantic. It should be added only after representative real-photo testing, not by inverting the light palette.

## Stage 3B color gate

Before freezing values:

- measure every text/surface and focus/surface pair;
- test high-key images whose edges approach canvas white;
- test very dark images without shadows;
- compare color-heavy photographs against the warm canvas for unwanted color cast;
- inspect the mobile Menu and Overview as full-screen neutral layers;
- test forced-colors and increased-contrast settings;
- adjust lightness first when a contrast pair fails; do not introduce a new hue for convenience.
