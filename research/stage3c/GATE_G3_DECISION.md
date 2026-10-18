# GATE G3 — Home hero scale + Featured/Recently added cue — DECISION

Status: **FROZEN** (Stage 3C Phase 8, per `research/stage3b/STAGE_3C_VISUAL_GATES.md` §G3)

## Question
What exact hero proportion works with real covers, and does the plain-text cue read
clearly without disturbing date hierarchy?

## Starting state tested
Hero cover at content-frame width (≤ ≈1400px) with ≈72–78svh desktop soft ceiling;
mobile full-width landscape capped ≈60svh, portrait ≤ ≈70svh; cue as metadata-role plain
text first line above the photographed date.

## Fixtures exercised
F01 bright cover (`DSC02071`), F02 dark cover (`DSC01889`), F06 portrait cover
(`portrait-studies`), panorama cover (`lofoten-fjord-lines`), long English title,
Chinese title (`aurora-nights`), backfilled older work (“Recently added” —
swiss-winter-quiet, Photographed Feb 2019).

## Captures
`h01-bright-hero-{desktop,mobile}`, `h02-dark-hero-{desktop,mobile}`,
`h03-long-title-hero-{desktop,mobile}`, `h04-chinese-title-hero-{desktop,mobile}`,
`h05-cue-desktop`, `h06-recent-{desktop,mobile}`,
`g3-portrait-hero-{desktop,mobile}`.

## Observations against pass criteria
- **Cover dominates**: desktop landscape hero measures ≈676px of 900px viewport
  (≈75svh, inside the 72–78 band); panorama is width-bound (≈62svh) and still dominant.
- **Title/metadata reachable within one short scroll**: title visible in the first
  viewport for every cover class at 1440 and 390 (portrait included).
- **Cue reads as publication state**: “Recently added” plain-text line sits above
  “Photographed Feb 2019 · Thun”; no badge/chip/pill; date remains the prominent
  historical line (h01-mobile, h05).
- **No cover cropped or overlaid**: portrait hero renders complete frame at ≤70svh on
  mobile and within the desktop ceiling; no overlay text anywhere.

## Decision rule applied
Keep starting proportions unless a capture fails. No capture failed → no adjacent
proportion test required.

## Frozen result
- Desktop hero soft ceiling: **75svh** (within the 72–78svh band), frame-width bound.
- Mobile landscape cap **60svh**; mobile portrait cap **70svh**.
- Cue: plain metadata text, first line above photographed date; hierarchy
  Photo > title > metadata retained; no full-bleed, no overlay text.
