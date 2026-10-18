# GATE G2 — Canvas warmth + focus color — DECISION

Status: **FROZEN** (Stage 3C Phase 8, per `research/stage3b/STAGE_3C_VISUAL_GATES.md` §G2)

## Question
Do the palette targets survive real photography, and at what exact values?

## Starting state tested
Canvas `#F6F4EF`, Primary `#1A1A18`, Secondary `#5F5E59`, Raised `#EFECE5`,
Hairline `#D4D0C7`, Strong neutral `#34332F`, Focus `#0B57D0`.

## Fixtures exercised
- F01 high-key edge disappearance (`DSC02071`, `DSC02066` — swiss-winter-quiet).
- F02 dark (`DSC01889` red-lanterns cover/final, `DSC02327` neutral dark).
- F09 **substitution** (no true B&W in archive; nearest-neutral `DSC02066` S28.0,
  `DSC02055` S27.4, `DSC02327` S49.1 — recorded in REAL_PHOTO_FIXTURE_MANIFEST.md).
- F04 saturated cast check (`DSC02560` S245.9 aurora-nights cover, `DSC01832` red lanterns).
- Mixed cover grids (Home recent, Archive), Overview + Menu as full neutral surfaces,
  focus perimeters over canvas/raised/beside images, forced-colors.

## Captures
`g01-bright-{desktop,mobile}`, `g02-dark-{desktop,mobile}`, `g09-l01-{desktop,mobile}`,
`o04-{bright,dark}-{desktop,mobile}`, `o02-mobile`, `o01-desktop`, `x03-rm-menu-mobile`,
`x04-forced-home-desktop`, `x04-forced-gallery-mobile`, `a01-mixed-year-{desktop,mobile}`,
`x05-kbd-{skip-desktop,menu-mobile,overview-desktop}`,
`screenshots/a11y/contrast-pairs.json` (measured pairs).

## Observations against pass criteria
- **Canvas not beige beside neutral-white photos**: high-key snow frames sit on `#F6F4EF`
  with legible separation; no edge aid required (g01, g09-l01).
- **No visible cast on color-heavy work**: saturated aurora and lantern frames show no
  tinting interaction with canvas or raised surfaces (g02, o04-dark).
- **High-key edges legible**: image boundaries readable against canvas without the
  optional 1px aid; the aid was never activated and is removed from the prototype.
- **Neutral beside B&W substitutes**: palette reads achromatic beside the near-neutral
  frames; substitution consequence recorded in the manifest.
- **Contrast policy met** (measured): primary/canvas 15.86:1; secondary/canvas 5.91:1;
  secondary/raised 5.51:1; focus/canvas 5.81:1 — all ≥ 4.5:1 (3:1 large-text roles exceed).
- **Forced colors**: layout intact, links/system colors take over without breakage (x04).

## Decision rule applied
Keep starting values unless a capture fails. No capture failed → no lightness adjustment.

## Frozen result (exact hex, measurements recorded above)
Canvas `#F6F4EF` · Primary `#1A1A18` · Secondary `#5F5E59` · Raised `#EFECE5` ·
Hairline `#D4D0C7` · Strong `#34332F` · Focus `#0B57D0`.
Role structure, no decorative accent, no dark mode, “adjust lightness first, never add a
hue” — retained.
