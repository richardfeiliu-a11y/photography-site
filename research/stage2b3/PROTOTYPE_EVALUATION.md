# Stage 2B3 Prototype Evaluation

## Prototype integrity

Overall integrity is **PARTIAL PASS**: the artifact is valid enough for T1–T3 decisions, but not for T4.

Independent checks confirmed:

- `shots/` = 69 PNG and `shots2/` = 69 PNG; 69/69 filename-matched SHA-256 hashes are identical.
- Asset manifest contains 109 local assets; no network-image route is required.
- G01 short fixture has 16 Photos; G03 long fixture has 72 Photos.
- Browser routes, feature on/off, Paris 3/8/20, Overview open/close/jump, keyboard focus, mobile controls, and Back/origin behavior can be reproduced against the running local prototype.
- The four WebM recordings were independently inspected through locally extracted key frames, and the core interactions were also reproduced in the browser.

The implementation report's `20/20 PASS` establishes automated conformance for its assertions; it does **not** establish user behavior or catch every semantic isolation failure. Independent source/DOM inspection found one untested T4 contamination.

## Specification fidelity

| Area | Result | Independent finding |
|---|---|---|
| B1 routes/navigation/dates | PASS | Canonical routes and photographed/published separation are preserved. |
| Home featured/fallback | PASS | Feature on→G01; off→G02 with visible photographed Feb 2019. |
| Place fixtures | PASS | A/B/C and 3/8/20 states render as specified. |
| Overview mechanics | PASS with visual caveat | 72 count, restore Δ=0, L68 jump, history stability and focus behavior are reproducible. Mobile current marker is visually weak. |
| T4 fixed conditions | **FAIL** | Swipe-first B renders the continuation block directly after the one-photo stage at every index; vertical A reaches it only after 72 Photos. |
| Excluded features | PASS | No Search, Map, Tags, Visit, Photo detail, Fullscreen, auth, or analytics in tested routes. |

No `B1 issue discovered` classification is warranted. The blocking finding is a prototype implementation defect, not an IA/content-model failure.

## Variant isolation

| Test | Isolation | Basis |
|---|---|---|
| **T1 Home** | **PASS** | The intended hierarchy changes; shared navigation, Gallery content, cards, feature/fallback algorithm, and destinations remain. Archive preview necessarily duplicates the same cards as the hierarchy variable. |
| **T2 Place** | **PASS** | Machine result and independent rendering show card data/order/components unchanged; only year-heading presence changes. |
| **T3 Overview** | **PASS** | A/B contain the same 72-photo sequence and captions; only Overview availability differs. |
| **T4 Mobile** | **FAIL** | Direction changes as intended, but continuation timing/placement also changes. In B, continuation exists after the active single-photo stage from L01 onward; in A it follows the complete 72-photo sequence. |

Because T4 isolation fails, its product result cannot be adopted.

## Screenshot quality

- Exact required viewports and evaluator labels make comparisons reproducible.
- Top/mid/end coverage is strong; mobile and desktop states are available for all Tests.
- Screenshots are byte-identical across two passes.
- Neutral placeholders isolate layout but are visually homogeneous; they underrepresent real-photograph salience, emotional rhythm, and natural recall difficulty.
- Some live-browser captures can show images before decode or fixed-layer compositor inconsistencies; stored deterministic captures and DOM/source evidence were used for final judgments.

Screenshot evidence is strong for hierarchy, density, spacing consequence, image prominence, control placement, and responsive structure. It is not user-behavior evidence.

## Interaction evidence

Interaction evidence was independently reviewed using local key-frame extraction plus live browser reproduction. Continuous timing/audio were not evaluated.

| Evidence | Directly supported |
|---|---|
| `overview-restore.webm` | L47 sequence position → Overview with L47 marked → return to L47. Browser reproduction confirms scroll restore. |
| `overview-jump.webm` | Overview selection → L68 aligned near sequence top. Browser reproduction confirms target top alignment. |
| `mobile-progression.webm` | Swipe B advances through early Photos and supports Previous. It does not prove long-run fatigue or fair end-state comparison. |
| `back-origin.webm` | Home→Gallery→Back restores Home context/position. |

The interaction recordings prove mechanics, not participant comprehension, sequence completion, or preference.

## Evaluation limitations

- No real participant sessions were supplied.
- Placeholder images are deliberately abstract and similar; Overview scanning/recall behavior may differ with real photographs.
- T3's mobile current marker has low visual contrast; this is a Stage 3 visual-design issue unless users cannot recover position.
- G02's 2019 photographed date is visible, but Home does not explain “recently added” beyond placement; wording/label treatment remains Stage 3 work.
- T4 is contaminated and cannot answer Vertical vs Swipe-first until retested.
- Automated verification measured mechanics and invariants, not fatigue, authored-sequence perception, or behavioral discoverability.

## Whether prototype is valid enough for decisions

| Test | Valid enough? | Decision status |
|---|---|---|
| T1 | Yes | Prototype-based KEEP A |
| T2 | Yes | Prototype-based KEEP progressive concept; trigger remains editorial/behavioral |
| T3 | Yes | Prototype-based PASS OVERVIEW; participant validation recommended, not blocking |
| T4 | No | RETEST required after continuation isolation fix |

**Overall:** valid enough to freeze T1–T3, not valid enough to complete Stage 2B or proceed to Stage 3.

