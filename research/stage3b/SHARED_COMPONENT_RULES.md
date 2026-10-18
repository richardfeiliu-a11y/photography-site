# Stage 3B — Shared Component Rules

Status: **binding rules for every shared discovery/state component**. Page specs reference this file; they may not override it.

## Shared Gallery card anatomy

One card, three contexts (Home recent, Archive, Place). Frozen content order:

```text
Cover          — intrinsic ratio, complete frame, dominant
Title          — display serif, semantic link
Date/range     — photographed date or range (primary metadata)
Place          — when known, underlined link (secondary metadata)
Count          — photo count, lowest metadata weight
```

Context-controlled variables (allowed to differ): cover scale, column count, metadata line grouping (one or two lines).

Never changes across contexts: typography roles, content ordering, metadata order, interaction affordance, no-border/no-shadow/no-overlay treatment.

### Starting metrics

| Metric | Desktop starting | Mobile starting | Status |
|---|---|---|---|
| Cover → title | 16 px (M) | 16 px | Recommended |
| Title → metadata | 8 px (S) | 8 px | Recommended |
| Card title size | 20–22 px serif | 18–20 px serif | Recommended within role range |
| Metadata size | 13–14 px sans | 13–14 px | Recommended within role range |
| Column gap | 32 px | n/a (one column) | Recommended |
| Row/card gap | 48–64 px | 48 px | Recommended |
| Title wrap | 2–3 lines, never truncated | 2–3 lines | Frozen behavior |

Rows may be unequal height; grid order, not visual equalization, governs.

## Card states

Frozen constraints: **no border container, no shadow, no image overlay, no hover zoom.** Hover must rely on text/underline/subtle contrast/cursor affordance, never animation.

| State | Treatment | Status |
|---|---|---|
| Default | Stable cover + graphite title + secondary metadata; no container | Frozen |
| Hover | Title underline + strong-neutral shift (`#34332F`) when base is secondary; optional subtle image-edge outline or slight opacity clarification; hit region perceivable | Frozen language; intensity is visual implementation detail |
| Focus | 2 px focus perimeter enclosing or clearly connecting cover and text block; canvas-gap separation where needed | Frozen |
| Active/pressed | Small opacity or ≤1 px positional response; no scale effect | Frozen |
| Visited | No distinct visual state (archive context); browser default visited recoloring is suppressed to keep palette neutral — if testing shows retrieval confusion, revisit as a recorded conflict, not a silent change | Recommended |

Rules:

- The title remains the semantic link; the extended block affordance never removes it.
- Hover styling applies only on hover-capable devices; touch shows no stuck hover.
- Adjacent cards never share hit space.
- Metadata is fully visible at rest; no hover-reveal of anything.
- Covers may use empty alt when the linked title already names the destination; otherwise concise alt.

## Shared page header

Applies to Archive, Places Index, Place, About. Gallery uses its photographic header; Home uses the hero composition.

```text
[96 px desktop / 48 px mobile from global navigation]
H1 — serif Index role 36–44 desktop / 30–36 mobile, leading edge
[optional: one context line, secondary sans, ≤ 1 sentence, gap S]
[48 px desktop / 24–48 px mobile to first content]
```

Frozen behavior: one H1 per page; leading-edge alignment with the content frame; no centered hero header; no per-page invented header structure; no divider art; optional context stays one line.

Starting values are Recommended; the structure itself is Frozen by application.

## Shared footer

Quiet, metadata-role text on the content frame: site name, `Archive · Places · About`, copyright line. Spacing XXL from last content. Standard link states. No social strip, no newsletter, no logo. Status: Recommended starting composition; content frozen to these elements.

## Cross-component prohibitions

No component may introduce: badges, chips, pills, filled buttons, container borders on cards, shadows, overlays, gradients, accent color, icons replacing text labels, marquee/carousel behavior, hover zoom, sticky behavior (except the permitted Overview header row detail), or new metadata fields.

If a page appears unable to work under these rules, record a conflict in `STAGE_3B_DECISION_LOG.md` — do not invent a new component.
