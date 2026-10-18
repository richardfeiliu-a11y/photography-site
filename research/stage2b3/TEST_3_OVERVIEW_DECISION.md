# T3 — Gallery Overview Gate Decision

## Decision

**PASS OVERVIEW — Overview enters MVP.**

Decision type: **Prototype-based product decision**, not user-validated.

Isolation: **PASS**.

## Prototype evidence

- The long fixture presents 72 authored Photos in the same sequence in A/B.
- [Desktop Overview](../../prototype/shots/t3-a-long-desktop-overview-l47.png) exposes full Gallery extent and marks the current area.
- `overview-restore.webm` key frames show L47→Overview→L47; browser reproduction confirms exact scroll restoration.
- `overview-jump.webm` and browser reproduction show thumbnail selection aligning L68 near sequence top.
- History length remains unchanged across open/close/jump.
- [Mobile Overview](../../prototype/shots/t3-a-long-mobile-overview-mid.png) supports 3-column scanning and a persistent Close action.
- Variant B has the same sequence/captions with no Overview control/layer.

## Strength of evidence

**Medium.** Interaction mechanics and structural utility are directly verified. Sequence completion, bypass behavior, and user recall benefit are not empirically validated.

## What is directly observed

- Overview makes `72 photos` and authored order immediately legible.
- It provides deterministic return-to-position and direct target navigation.
- It remains secondary: Gallery entry is the vertical sequence, not the grid.
- Desktop density supports whole-Gallery orientation.
- Mobile density is usable but visually tight; current indication is weaker than desktop.

## What is inferred

- For long Galleries, the orientation/jump value justifies the additional interaction surface.
- Because Overview is explicitly invoked and does not replace sequence entry, it need not make grid the “real product.”
- Short Galleries may derive little value, but a consistent optional control is acceptable if visually restrained.

## What is not validated

- Whether participants complete less of the authored sequence after discovering Overview.
- Whether real photographs improve or worsen thumbnail recall compared with abstract placeholders.
- Whether users understand the current marker and return behavior without instruction.
- Long-session fatigue or repeated Overview use.

## Product rationale

The archive may contain 50–100+ Photo Galleries. Overview solves a real navigation/orientation problem while preserving sequence-first entry and canonical Gallery identity.

## Trade-offs

- Adds a second viewing surface, focus/restore complexity, and risk of thumbnail-first scanning.
- Mobile thumbnails reduce image detail and can encourage position-by-number rather than content recognition.
- Current marker and density require Stage 3 visual refinement.

## Prototype defects, if any

No blocking mechanic defect. Mobile current-position differentiation is low contrast. A live browser-control compositor intermittently showed the fixed layer inconsistently, but stored deterministic screenshots, DOM/CSS, extracted video frames, and reproduced restore/jump mechanics agree that the implemented layer works.

## Final rule entering MVP

Overview enters MVP as a secondary, explicitly invoked light table:

- sequence-first Gallery entry remains mandatory;
- authored order is preserved;
- current Photo is visibly marked;
- close restores exact position;
- thumbnail selection returns to the selected Photo;
- Overview creates no route/history entry;
- captions remain in sequence, not grid.

Stage 3 must improve mobile current-marker contrast and keep the control visually subordinate. Lightweight participant validation is recommended to test sequence bypass, but it is not blocking.

