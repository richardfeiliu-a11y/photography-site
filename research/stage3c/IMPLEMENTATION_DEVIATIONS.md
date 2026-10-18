# IMPLEMENTATION DEVIATIONS — Stage 3C

Every departure from the Stage 3B specs as implemented, with rationale. No deviation
reopens Stage 2B behavior or Stage 3A structure; none adds a product feature.

## 1. Accessibility-driven adjustments (required; accessibility failure cannot be
overridden by visual preference)
- `<main id="main" tabindex="-1">` + `main:focus { outline: none; }` — skip-link target
  must receive programmatic focus; ring suppressed for programmatic focus only.
- `.menu-links a { padding: 12px 0; }` — raises Menu link hit height to 53px (≥44px).
- `.close-btn { padding: 13px 20px; margin: 0 -20px; }` — ≥44px hit area without moving
  the visible text position.
All three verified in `ACCESSIBILITY_VERIFICATION.md` (18/18).

## 2. Fixture substitution (documented, not improvised)
- F09 Black & white: archive contains no true B&W photograph; nearest-neutral frames
  (`DSC02066`, `DSC02055`, `DSC02327`) substitute per matrix rule. Consequence recorded in
  `REAL_PHOTO_FIXTURE_MANIFEST.md`; G2 evaluated “beside the most neutral real frames”.

## 3. A04 scale check outcome
- Temporary 80-card synthetic scale page built as a check artifact; no scan failure
  revealed → **no conflict recorded, no feature added** (ARCHIVE_DESIGN_SPEC §117).
  Page removed from the site in Phase 8; captures retained as evidence (`a04-*`).

## 4. 200% zoom verification method
- Browser-level 200% zoom is layout-equivalent to a halved CSS viewport (1440×900 →
  720×450) in this headless harness (no CDP zoom API available). Equivalence method used
  and recorded; results identical to the a11y requirement (no horizontal overflow).

## 5. Gate comparison variants removed after freeze (gate discipline)
- Removed from the shipped prototype: `?pos=inline` (G5 inline form), `?mbase=56` (G4),
  `?ovcols=2` (G6), `?pause=144|192`, `?mpause=96|128`, `?next=card|h1` (G7),
  `?edgeaid=1` (G2 aid never needed). Rejected forms are removed, not kept as options.
- Retained: `?hero=<slug>` fixture-selection harness param (capture tooling only;
  default = canonical featured gallery).

## 6. Test anchors (non-visual)
- `id="card-{slug}"` and `id="y{year}"` anchors added to Archive/Place cards and year
  blocks to make matrix scroll targets deterministic. No visual effect.

## 7. Subject-consistency correction (Phase 4)
- Caption/subject mismatches between authored captions and real photo content were
  corrected in the content model so captions describe the actual frame (recorded in the
  Phase 4 work log; no spec value changed).

## Not-deviations
- All frozen Stage 3B values (palette, spacing system, rhythm states, Overview system,
  position annotation format, continuation structure, type roles) implemented as spec’d.
