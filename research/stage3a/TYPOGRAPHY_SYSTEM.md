# Stage 3A — Typography System

Status: **role and category specification**. It does not freeze a font brand or implementation stack.

## System decision

Choose **B — Display serif + utility sans**.

- The **display serif** marks authored material: Gallery titles, major index headings, Place titles, and selected card titles.
- The **utility sans** carries navigation, metadata, captions, About/body copy, controls, counts, and dates.
- No monospace family is required. Tabular numeral features in the sans family handle `n / total`, years, and date ranges without introducing a third voice.

Why this pairing:

- A single sans system is durable but moves too close to Museum Neutral and under-expresses the editorial Gallery boundary.
- A serif body system adds reading and CJK maintenance cost without a corresponding product need; body copy is sparse.
- A restrained title serif provides identity exactly where authored intent is strongest, while the sans family keeps mobile and mixed-script utility text quiet and robust.

The serif must not be high-fashion, hairline, calligraphic, or extremely high contrast. The sans must not look geometric, technological, or dashboard-like.

## Role hierarchy

Ranges are prototype/design-spec values. Stage 3B may choose a point inside each range after testing actual fonts and content, but may not invent additional roles without evidence.

| Role | Family | Desktop size | Mobile size | Weight | Case | Tracking | Line height | Intended visual role |
|---|---|---:|---:|---:|---|---|---|---|
| Display / Gallery title | Serif | 42–52 px | 32–38 px | 400–500 | Natural | −0.01em to 0 | 1.08–1.16 | Names the authored work; dominant text but still below the first photograph |
| Index / Place H1 | Serif | 36–44 px | 30–36 px | 400–500 | Natural | −0.01em to 0 | 1.12–1.2 | Opens Archive, Places, Place, About without behaving like a magazine headline |
| Index H2 / year group | Sans | 20–24 px | 18–22 px | 500–600 | Natural | 0 to +0.01em | 1.25–1.35 | Scan landmark; subordinate to page title and Gallery cover |
| Card title | Serif | 19–24 px | 18–22 px | 400–500 | Natural | 0 | 1.25–1.35 | Identifies the Gallery; first text after cover |
| Navigation | Sans | 14–15 px | 16–18 px in menu | 500 | Natural | 0 to +0.01em | 1.4 | Stable wayfinding with low visual mass |
| Metadata | Sans | 12–14 px | 13–14 px | 400–500 | Natural | +0.01em to +0.025em | 1.4–1.5 | Dates, Places, counts; compact and readable, never faint decoration |
| Caption | Sans | 14–16 px | 14–16 px | 400 | Natural | 0 | 1.5–1.6 | Readable editorial context attached to one Photo |
| Body / About | Sans | 17–19 px | 16–18 px | 400 | Natural | 0 | 1.55–1.65 | Occasional sustained reading at 60–70 characters per line |
| Utility / current position | Sans with tabular numerals | 12–13 px | 12–13 px | 500 | Natural | +0.02em | 1.3–1.4 | Orientation, not command chrome |

## Compact type scale

The working scale has seven semantic levels:

```text
Display: 42–52 desktop / 32–38 mobile
H1:      36–44 desktop / 30–36 mobile
H2:      20–24 desktop / 18–22 mobile
Card:    19–24 desktop / 18–22 mobile
Body:    17–19 desktop / 16–18 mobile
Meta:    12–14 desktop / 13–14 mobile
Utility: 12–13 desktop / 12–13 mobile
```

Caption reuses the Body/Meta boundary rather than becoming an eighth decorative size. Navigation reuses Meta on desktop and grows for the mobile menu because the menu is a touch destination, not because its hierarchy increases.

Stage 3B should choose the smallest number of exact sizes that keeps these semantic relationships. If H2 and Card resolve to the same pixel size, distinguish them through family, weight, and spacing rather than adding another step.

## Font category direction

### Preferred direction

- **Display:** moderate-contrast, text-capable serif with open counters, sturdy punctuation, useful regular/medium weights, and calm lowercase forms.
- **Utility:** neutral-to-humanist grotesk with excellent small-size numerals, clear `I/l/1` distinction, real 400/500/600 weights, and broad language coverage.
- Both should remain credible after many years and should not depend on novelty alternates.

### Candidate pair categories

These are candidates for Stage 3B testing, not frozen brands:

1. **Source-family route:** Source Serif–class display + Source Sans–class utility, paired with Source Han Serif/Sans for CJK. Strong maintenance and open-source direction.
2. **Noto-family route:** Noto Serif display + Noto Sans utility across Latin and CJK. Strongest script coverage and simplest fallback logic; visual personality is quieter.
3. **Editorial open-source route:** Newsreader-class text serif + a restrained open-source grotesk, with Noto/Source Han CJK fallbacks. More editorial character, but requires closer metric and mixed-script QA.

### Fallback

- Utility: system UI sans stack, ending in the platform's CJK sans.
- Display: platform serif stack, ending in `Songti SC`/equivalent CJK serif and a generic serif.
- If a stable serif/CJK pairing cannot be achieved without layout breakage, the reversible fallback is an all-sans system with weight/spacing differentiation—not an improvised collection of per-language fonts.

## Latin and CJK behavior

- Latin is the initial primary script; CJK support is a launch constraint, not an afterthought.
- A Chinese Gallery title must use a deliberate CJK serif fallback rather than receiving glyphs from an arbitrary system font.
- Mixed-script text uses the Latin font first and a matched CJK family second. Match apparent x-height/character size, stroke density, and baseline before matching brand names.
- CJK headings do not use negative tracking. Default to `0`; use very small positive spacing only after visual testing.
- CJK body and captions require more vertical room: target line-height 1.65–1.8, versus 1.5–1.65 for Latin.
- Avoid all-caps labels as a hierarchy device. They fail across scripts and create unnecessary letter-spacing rules.
- Place names remain in their intended public form; do not mechanically uppercase or Latinize them for style.
- Mixed Latin/CJK date and position strings use tabular numerals where available and must not cause baseline jumps.

## Title rules

- Titles use natural case and authored punctuation.
- Gallery title may wrap to two or three lines; it is never truncated in Gallery context.
- Card titles may wrap to two lines in ordinary discovery density. If a title needs more, the card grows; ellipsis is not the default because the title is the retrieval key.
- Display line length should normally stay below roughly 18–24 Latin characters per line at the largest scale or 10–16 CJK characters, adjusted by actual wording.
- No italics as the default editorial signal. Italics may appear only when semantically required by authored text and supported by the chosen family.

## Metadata rules

- Use sentence/natural case; no uppercase micro-label system.
- Keep photographed date/range, Place, and count in one or two quiet lines. Publication state such as “Recently added” may use the same role, not a badge.
- Use separators sparingly: a middle dot or spatial gap may separate peers; do not build breadcrumb-like metadata chains.
- Metadata below 14 px must remain weight 400 or heavier and meet measured contrast requirements.
- Years and `n / total` use tabular numerals to prevent position jitter.

## Caption rules

- Caption is visually attached to its Photo, aligned to the image's leading edge where practical.
- Maximum measure: approximately 48–60 characters for Latin; 24–32 full-width CJK characters.
- Two or three lines are normal. Do not reduce size or contrast to keep a caption to one line.
- Caption and alt/editorial description are separate: a caption may be interpretive, while alternative text describes the image's meaningful visual content.
- An uncaptioned Photo reserves no blank caption area.

## Body and About rules

- About/body measure: 60–70 Latin characters or approximately 28–36 CJK characters.
- Body starts at 16 px minimum on mobile; 17–19 px is preferred for the sparse About page.
- Paragraph spacing, not indentation, separates paragraphs.
- Links remain visibly identifiable through underline or another non-color cue.

## Stage 3B font evaluation gate

Test each candidate pair with:

- short and three-line Gallery titles;
- English, Simplified Chinese, and mixed-script titles;
- `2018–2024`, `72 / 72`, and long Place names;
- caption blocks at one and three lines;
- 200% text scaling and the mobile menu;
- real dark, bright, color-heavy, and black-and-white photographs to check whether type looks theatrical or disappears.

Do not freeze a font brand until the same candidate passes all cases.

