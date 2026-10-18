# Open Questions -- Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Revision date:** 2026-08-28
**Companion documents:** ARCHITECTURE_DECISIONS.md, SOURCE_OF_TRUTH_MATRIX.md, IMPLEMENTATION_PHASES.md

---

## Closed by User Decision (UD-001 through UD-011)

The following questions were previously open and are now resolved by explicit user decisions. They are recorded here for traceability and must not be reopened during implementation.

| Question | Resolution | UD Reference | Canonical Owner Document |
|---|---|---|---|
| Photo identity representation | Photo identity and source binding live persistently in Gallery authored YAML (`photos[].id` + `photos[].source_ref`). Generated state is never the only identity authority. | UD-001 | CONTENT_MODEL.md, ADR-017, SOURCE_OF_TRUTH_MATRIX.md |
| Corrected-master identity semantics | Photo identity is editorial identity. Corrected/re-exported masters retain the same Photo ID. New Photo ID only for distinct authored photographs. SHA-256 is integrity metadata, not identity. | UD-002 | CONTENT_MODEL.md, ADR-028 |
| Publication-time migration policy | Never derive published_at from EXIF, photographed date, mtime, Git timestamp, or folder name. Use author-supplied historical time or honest archive-import timestamp. Unknown remains unknown. | UD-003 | CONTENT_MODEL.md, ADR-027 |
| Featured state storage | Single Home editorial settings file `content/site/home.yaml` with `featured_gallery_id`. No per-Gallery featured field. No weekly rotation or curated states. | UD-004 | CONTENT_MODEL.md, ADR-019 |
| Media ownership baseline | WEB INGEST MASTERS outside Git baseline at `media/ingest-masters/`. Git tracks code/YAML/settings/redirects/tests/docs. Off-site encrypted backup for ingest masters. Git LFS optional later transport only. | UD-005 | SOURCE_OF_TRUTH_MATRIX.md, ADR-018, BACKUP_AND_RECOVERY.md |
| RPO/RTO backup target | RPO <= 24 hours, RTO <= 24 hours. Back up non-regenerable state (authored content, ingest masters). Regenerable state (dist, derivatives, manifest) not backed up. Encrypted off-site. | UD-006 | BACKUP_AND_RECOVERY.md, ADR-025 |
| next_gallery cycle policy | Cycles allowed. Validation: target exists, published, not self. No acyclicity requirement. | UD-007 | CONTENT_MODEL.md, ADR-023 |
| Slug authority and redirects | Gallery YAML is sole current slug authority. Historical aliases in `content/redirects.yaml` only. No second slug registry. | UD-008 | CONTENT_MODEL.md, ADR-022, BUILD_AND_ROUTING.md |
| Draft authority model | Exactly one mechanism: `status: draft` or `status: published` in Gallery YAML. No directory partition or prefix conventions. | UD-009 | CONTENT_MODEL.md, ADR-020 |
| Cover policy for published Galleries | Explicit `cover_photo_id` required for published status. Must reference a Photo in the same Gallery. No silent first-Photo default. | UD-010 | CONTENT_MODEL.md, ADR-021 |
| prev_gallery authoring | Not authored. Derive reverse relationships at build time if needed. Frozen product does not require Previous Gallery at continuation. | UD-011 | CONTENT_MODEL.md, ADR-024 |

---

## Remaining Open Questions

These questions remain open because they require engineering benchmarks, implementation evidence, or deferred policy decisions. Each records why it remains open, which phase it blocks, and which phase owns its resolution.

### OQ-01: Exact Responsive Image Widths

- **Why still open:** Optimal width breakpoints depend on real fixture measurements across viewport sizes and DPR ranges. Default assumptions exist but are unverified.
- **Blocking phase:** P3 (image pipeline derivative contract requires finalized widths)
- **Owner phase:** P3 (benchmark harness initialized in P1/P2; measurements executed and values frozen in P3)

### OQ-02: Encoder, Format, and Quality Choice

- **Why still open:** JPEG, WebP, and AVIF are benchmark candidates. Format selection and quality parameters require visual quality vs byte-size benchmarking with real photography fixtures. No universal defaults apply, and no format is preselected before P3.
- **Decision scope:** P3 must decide production format(s), fallback policy, encoder, and quality before downstream implementation freezes the derivative-consumption contract.
- **Blocking phase:** P3 (derivative generation contract)
- **Owner phase:** P3 (benchmark harness with F01-F10 fixtures)

### OQ-03: ICC No-Profile Enforcement Policy

- **Why still open:** MVP documents assume sRGB for untagged sources (ADR-011). Whether to fail ingestion, warn with explicit override, or silently assume sRGB for production is a policy decision. The schema supports either path.
- **Blocking phase:** None for MVP (assume-sRGB documented); enforcement decision before accessibility/color-fidelity hardening
- **Owner phase:** P3 (benchmark) or P7 (policy finalization)

### OQ-04: Alt Text Publication Enforcement Policy

- **Why still open:** Schema support exists (`alt_text?` per Photo item, ADR-016). Whether published Galleries require alt text, warn on missing, or accept decorative-empty is an editorial/accessibility policy decision. Filename fallback is rejected. Caption is not automatically equated with alt.
- **Blocking phase:** P7 (accessibility hardening)
- **Owner phase:** Decision before P7; schema already in place from P2

### OQ-05: Exact CJK Subsetting Implementation

- **Why still open:** Broad static subset vs build-derived subset is a trade-off between operational simplicity and glyph coverage assurance. Both approaches are architecturally valid. The frozen font families (Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC) are not in question.
- **Blocking phase:** P1 (font strategy proof of concept) / P4 (discovery pages render CJK titles)
- **Owner phase:** P1 (proof of concept with both approaches); decision before P4 content rendering

### OQ-06: Backup Provider and Tool Selection

- **Why still open:** Architecture defines RPO/RTO targets and what must be backed up (ADR-025, BACKUP_AND_RECOVERY.md). Specific provider (object storage, independent host) and tool (restic, borg, rclone, etc.) are deployment choices.
- **Blocking phase:** P9 (deployment and recovery verification)
- **Owner phase:** P9 (selection and restore drill)

### OQ-07: Analytics

- **Why still open:** Default is none until a genuine measurement question exists. Privacy-first direction is established. Adding analytics is an explicit privacy/data-flow decision that requires product justification.
- **Blocking phase:** None (default none ships with MVP)
- **Owner phase:** Post-launch if a measurement need arises

---

## Summary

| Category | Count | Status |
|---|---:|---|
| Closed by UD decisions | 11 | Resolved; not reopenable |
| Remaining open (engineering benchmarks) | 5 | Deferred to named phases |
| Remaining open (policy decisions) | 2 | Deferred; default behavior defined |
| Total | 18 | All accounted for |

---

## Process for Resolving Open Questions

1. Identify the owning phase from the table above.
2. Execute the required benchmark or policy review within that phase.
3. Record the decision as a new ADR or an update to an existing ADR.
4. Update this document to move the resolved question to the Closed section.
5. Proceed with dependent implementation.

---

**END OF OPEN QUESTIONS**
