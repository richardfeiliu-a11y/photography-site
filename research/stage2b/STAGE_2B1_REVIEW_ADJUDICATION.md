# Stage 2B1 Review Adjudication

Review source: [`STAGE_2B1_RED_TEAM_QWEN.md`](./STAGE_2B1_RED_TEAM_QWEN.md). Evidence boundary: [`STAGE_2_EVIDENCE_SYNTHESIS.md`](../STAGE_2_EVIDENCE_SYNTHESIS.md) and [`STAGE_2_EVIDENCE_LEDGER.md`](../STAGE_2_EVIDENCE_LEDGER.md). No new Web research was performed.

## Critical review decisions

| Review item | Decision | Reason | Evidence boundary | Files affected |
|---|---|---|---|---|
| **C1 — Overview state conflict** | **Accept** | An ability cannot be both confirmed MVP and removable by its prototype. The single canonical status is now **Recommended MVP default, prototype-gated by Test 3**. | Stage 2A supports dual-mode feasibility at Medium–High, not superiority or universal necessity. | `PRODUCT_DIRECTION.md`, `INFORMATION_ARCHITECTURE.md`, `MVP_SCOPE.md`, `PROTOTYPE_TEST_PLAN.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **C2 — Home latest/selected ambiguity** | **Accept** | Home now has a deterministic rule: one optional manually featured published Gallery overrides; otherwise latest by `date added/published` descending. Feature state is Home presentation only and never changes historical placement. | Stage 2A supports separating photographed/published dates but cannot select Homepage behavior; this is an explicit reversible product decision. | `PRODUCT_DIRECTION.md`, `INFORMATION_ARCHITECTURE.md`, `CONTENT_MODEL.md`, `PROTOTYPE_TEST_PLAN.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **C3 — Premature Multi-Gallery Photo reuse** | **Accept** | Stable Photo identity is retained, but MVP assumes one Gallery membership per Photo. Reuse moves to Later and requires a concrete editorial case; the underlying asset must not be duplicated. | Stage 2A establishes feasibility of later reuse, not an MVP requirement. No B1 scenario or capability depends on it. | `CONTENT_MODEL.md`, `MVP_SCOPE.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |

## Important review decisions

| Review item | Decision | Reason | Evidence boundary | Files affected |
|---|---|---|---|---|
| **I1 — Visit wording** | **Accept** | Canonical language is “Visit is not modeled in MVP,” not “completely remove.” No entity/field/URL/grouping is added; capture date/time and available ingestion/provenance context are preserved. | Evidence is High against a required user-visible Visit; internal metadata necessity was not established. YAGNI justifies not modeling, not destroying raw context. | `PRODUCT_DIRECTION.md`, `CONTENT_MODEL.md`, `MVP_SCOPE.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **I2 — Search/pagination numeric thresholds** | **Accept** | Known-Gallery retrieval failure and materially poor scanning/performance are the only formal triggers. 80/300 are review checkpoints, never automatic triggers. | Stage 2A explicitly rejects hard thresholds inferred without user tests. | `INFORMATION_ARCHITECTURE.md`, `MVP_SCOPE.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **I3 — Progressive Place grouping** | **Accept** | Low-volume Place pages default to a flat reverse-chronological card list; year headings appear when repeated years/volume/scanning clarity justify them. Test 2 validates the behavior without a fixed count. | Exact `Place → Galleries by year` precedent is Low; the project choice is allowed but should not impose unearned structure. | `INFORMATION_ARCHITECTURE.md`, `PROTOTYPE_TEST_PLAN.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **I4 — Test 4 variable confounding** | **Accept** | Test 4 now compares vertical vs swipe direction only. Captions, Overview state, and continuation are fixed across variants; Overview inherits Test 3. | Mobile behavior evidence is Low, so the prototype must isolate the decision it is meant to validate. | `PROTOTYPE_TEST_PLAN.md` |
| **I5 — Realistic Gallery length** | **Accept** | Tests 3/4 require short and representative long mixed-orientation fixtures of roughly 50–100 Photos with realistic weights. The range is explicitly a test fixture, not a Gallery-size rule. | Stage 2A rejects fixed Gallery-size rules but identifies fatigue, restoration, memory, and loading as unresolved mobile risks. | `PROTOTYPE_TEST_PLAN.md` |

## Minor review decisions

| Review item | Decision | Reason | Evidence boundary | Files affected |
|---|---|---|---|---|
| **M1 — Photo count visibility** | **Accept** | Count remains required on Archive/Place discovery cards but becomes contextual inside Gallery, normally through an admitted Overview. | Repeated evidence supports counts for scannable indexes, not as a viewing-layer requirement. | `MVP_SCOPE.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **M2 — Optional `/archive/{year}` at Small scale** | **Reject** | The route was already explicitly optional and no B1 requirement says it must be built at Small scale. Additional revision would add no new constraint. | Chronology is supported; a separate year route is a later semantic convenience, not an MVP requirement. | None |
| **M3 — Gallery editorial self-check** | **Accept** | Three questions—why together, why this order, where it ends—make “editorial intent” operational without adding approval workflow or a count rule. | Gallery as editorial unit is High evidence; quantity thresholds are strongly opposed. | `CONTENT_MODEL.md`, `UX_PRINCIPLES.md` |
| **M4 — Canonical URL decision record** | **Accept** | `/galleries/{gallery-slug}` was already chosen and is expensive to reverse; D14 now records rationale and reversibility without designing routing. | One object through multiple discovery paths has High feasibility evidence. | `DECISION_LOG.md` |
| **M5 — Pagination inconsistency** | **Accept** | Resolved with I2: pagination is behavior-triggered and counts are checkpoints only. | Stage 2A rejects automatic numeric thresholds. | `INFORMATION_ARCHITECTURE.md`, `MVP_SCOPE.md`, `DECISION_LOG.md`, `STAGE_2B1_SUMMARY.md` |
| **M6 — Visit wording mismatch** | **Accept** | Resolved with I1; every canonical file now uses “not modeled in MVP” and preserves recoverable context. | Public Visit is unnecessary; internal destruction is not evidence-supported. | Same files as I1 |
| **M7 — Places index decoration** | **Partially Accept** | MVP now requires only Place name and contextual disambiguation. Cover/count/year span remain optional B2 presentation candidates rather than mandatory fields; no fifth prototype is added. | Place navigation applicability is Medium; screenshots do not establish decoration superiority. | `INFORMATION_ARCHITECTURE.md`, `STAGE_2B1_SUMMARY.md` |

## Rejected suggestions

- **M2 — Additional restriction on `/archive/{year}`:** rejected because the existing “optional semantic year view” already prevents Small-scale implementation from being required. No canonical product decision changed.

## Resulting canonical states

| Topic | Revised frozen state |
|---|---|
| Overview | Recommended MVP default; inclusion gated by Test 3 |
| Homepage | One optional featured override; otherwise latest by `date added/published` descending |
| Photo reuse | Stable identity in MVP; one Gallery membership assumed; Multi-Gallery reuse Later |
| Visit | Not modeled in MVP; no entity/field/navigation/URL/grouping; capture/provenance context preserved |
| Search/pagination | Behavior-triggered; 80/300 are review checkpoints only |
| Place grouping | Progressive: flat at low volume, year headings when they improve scanning |
| Photo count | Required on discovery cards; contextual inside Gallery |
| Canonical URL | One `/galleries/{gallery-slug}` identity across all discovery paths |

