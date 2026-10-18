# Backup and Recovery — Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion to:** DEPLOYMENT_ARCHITECTURE.md, SOURCE_OF_TRUTH_MATRIX.md, RISK_REGISTER.md
**User decisions adopted:** UD-005 (media ownership), UD-006 (RPO/RTO)

---

## 1. Recovery targets

| Target | Value | Scope |
|---|---|---|
| **RPO** (Recovery Point Objective) | <= 24 hours | Maximum acceptable data loss measured in time. All non-regenerable state must be backed up at least daily. |
| **RTO** (Recovery Time Objective) | <= 24 hours | Maximum acceptable time from failure declaration to a functional public site. Includes provisioning, restoration, rebuild, verification, and deployment. |

These targets apply to the personal archive as a whole. Individual recovery scenarios may resolve faster (e.g., bad-deployment rollback is near-instant), but no scenario may exceed 24 hours end-to-end.

---

## 2. Must-have principle

The VPS is never the only copy of authored metadata or WEB INGEST MASTERS. Every non-regenerable asset has at least one independent off-site copy. Loss of the VPS alone must not cause permanent data loss.

---

## 3. Asset classification

### 3.1 Non-regenerable assets (must be backed up off-site)

These assets cannot be recreated from other sources. Their loss is permanent without backup.

| Asset | Location | Git-tracked? | Off-site backup required? | Notes |
|---|---|---:|---:|---|
| Git repository + remote | Hosted Git remote | N/A (is the remote) | Yes (remote itself) | Source code, authored YAML metadata, site settings, redirects, tests, architecture docs. The remote is the primary off-site copy. |
| Authored Gallery YAML | `content/galleries/{gallery}/meta.yaml` | Yes | Yes (via Git remote) | Gallery ID, slug, status, title, description, dates, places, cover, next_gallery, photo sequence, captions, rhythms, alt_text |
| Place YAML | `content/places/*.yaml` | Yes | Yes (via Git remote) | Place ID, slug, name, region, country |
| Home settings | `content/site/home.yaml` | Yes | Yes (via Git remote) | featured_gallery_id |
| Redirects | `content/redirects.yaml` | Yes | Yes (via Git remote) | Historical URL aliases |
| WEB INGEST MASTERS | `media/ingest-masters/{gallery}/` | No (not required) | **Yes -- required** | Non-regenerable pipeline input. VPS must never be the only copy. |
| CAMERA ORIGINALS / ARCHIVAL MASTERS | External archival storage | No | **Yes -- separate archival** | Preserved per photographer workflow. Independent of website operations. |

### 3.2 Regenerable assets (no durable backup needed)

These assets are derived from non-regenerable state through deterministic processes. They can be fully reconstructed by running the build pipeline.

| Asset | Location | Recovery method |
|---|---|---|
| Generated asset manifest | `generated/asset-manifest.json` | Rebuild from authored YAML + ingest masters |
| Web derivatives (production formats decided by P3 benchmark) | `generated/media/`, release directories | Rebuild via image pipeline |
| Astro build output (`dist/`) | `dist/` | Full Astro build |
| HTML pages and routes | Release directories | Full build + assembly |
| Caches (build, derivation) | Various | Regenerated on demand |
| Extracted metadata (dimensions, orientation, EXIF, ICC, source hash) | `generated/` | Re-extracted from ingest masters |
| Photo index (if any) | `generated/` | Derived view; rebuilt from Gallery YAML |
| Reverse relationships (prev_gallery) | Build output | Derived from next_gallery_id at build time |

### 3.3 Atomic releases are rollback, not backup

Release directories on the VPS provide operational rollback for bad deployments. They are not a backup mechanism. Releases contain only regenerable content (HTML, derivatives). They do not contain WEB INGEST MASTERS or authored YAML independently of Git. Do not rely on release history for disaster recovery.

---

## 4. Off-site backup architecture

### 4.1 Requirements

- Encrypted at rest before leaving the source environment.
- Stored on infrastructure independent of the VPS (different physical host, different provider, or both).
- Accessible for restore within the RTO window.
- Integrity-verifiable without full restore (checksums, manifests).

### 4.2 Acceptable architectures

- Encrypted off-site object storage (S3-compatible or equivalent).
- Encrypted backup to an independent host via rsync/rclone or similar.
- Encrypted archive snapshots stored on separate physical media with off-site custody.

### 4.3 Provider and tool selection

Specific backup provider, tool, and encryption implementation remain deployment choices recorded in OPEN_QUESTIONS.md. This document defines the architectural contract (encrypted, off-site, verifiable, within RTO), not the vendor.

### 4.4 What gets backed up

| Component | Backup target | Frequency | Encryption |
|---|---|---|---|
| Git repository | Remote hosting service (push) | On every commit/push | Transport TLS; remote-side encryption per provider |
| WEB INGEST MASTERS | Off-site encrypted storage | At least daily; on ingest | Client-side encryption before transfer |
| CAMERA ORIGINALS / ARCHIVAL MASTERS | Separate archival storage | Per photographer workflow | Per archival policy |
| Secrets/certificates | Secure credential store | On change | Store-native encryption |

### 4.5 What does NOT get backed up

- Release directories (rollback cache, not backup).
- `generated/` contents (regenerable).
- `dist/` contents (regenerable).
- Build caches (regenerable).

---

## 5. Media ownership context (UD-005)

Git tracks source code, authored YAML metadata, site settings, redirects, tests, and architecture documentation. Git is the version-controlled authoritative record for all textual/editorial state.

Media filesystem/storage tracks WEB INGEST MASTERS (`media/ingest-masters/`). These are not required to live in Git or Git LFS. They may reside on the VPS filesystem, a mounted network volume, or an external storage service, provided they are accessible to the build pipeline and independently backed up off-site.

External archival storage preserves CAMERA ORIGINALS and ARCHIVAL MASTERS separately. This is the photographer's long-term preservation domain, outside the website production pipeline.

Git LFS is at most an optional later transport choice for WEB INGEST MASTERS. It is never the canonical backup architecture. Git LFS stores versions within a Git remote; it does not satisfy the independent-off-site-copy requirement by itself unless the remote is independently backed up and the LFS objects are verified recoverable.

---

## 6. Restore sequence

The following is the high-level restore procedure for a total VPS loss. Individual scenarios (section 7) may use subsets of this sequence.

```text
1. Provision replacement VPS (OS, base packages, SSH access)
       |
       v
2. Restore secrets and credentials (SSH keys, TLS certificates, deploy keys)
   from secure escrow
       |
       v
3. Clone Git repository from remote
       |
       v
4. Restore WEB INGEST MASTERS from off-site encrypted backup
       |
       v
5. Install dependencies (Node.js, toolchain, pinned versions)
       |
       v
6. Run full build pipeline (validation, image derivation, Astro build, assembly)
       |
       v
7. Verify build output integrity
       |
       v
8. Deploy to VPS (canonical release flow, DEPLOYMENT_ARCHITECTURE.md)
       |
       v
9. Configure Nginx, TLS, DNS
       |
       v
10. Post-deployment smoke tests
       |
       v
11. Verify all canonical routes, representative images, 404 behavior
```

Steps 1-2 are the critical path for RTO. Steps 3-4 require off-site copies to be available. Steps 5-11 are mechanical given valid inputs.

---

## 7. Recovery scenarios

Each scenario describes what is lost, what restores it, and which mechanism applies. No production commands are specified here; these are architectural contracts.

### 7.1 VPS disk failure

**What is lost:** Everything on the VPS -- release directories, Nginx configuration, TLS certificates, local copies of WEB INGEST MASTERS, any uncommitted work.

**What restores it:** Full restore sequence (section 6). Git remote provides code/YAML/settings. Off-site backup provides WEB INGEST MASTERS. Secure escrow provides credentials. Build pipeline regenerates all derived state.

**Mechanism:** Disaster recovery from off-site backups.

**RTO consideration:** Provisioning + restore + rebuild + deploy. Must complete within 24 hours. Pre-documented provisioning steps and tested restore procedures are essential.

### 7.2 Accidental ingest-master deletion

**What is lost:** One or more WEB INGEST MASTER files on the VPS. Without these, the image pipeline cannot regenerate derivatives for affected Photos.

**What restores it:** Restore affected files from off-site encrypted backup. If the deletion is partial and recent, a targeted restore of specific files is sufficient.

**Mechanism:** Off-site backup restore (file-level).

**RTO consideration:** File-level restore is typically fast. Rebuild derivatives after restore. Validate that the restored masters match their source hashes.

### 7.3 Corrupted authored YAML

**What is lost:** Validity of one or more Gallery, Place, Home settings, or redirect YAML files. Build validation fails.

**What restores it:** Git history. Revert the corrupted file(s) to the last known-good committed version. If the corruption was committed, use Git history to identify and undo the bad commit.

**Mechanism:** Git version history + protected branch policy.

**RTO consideration:** Near-instant if uncommitted; minutes if committed and identified quickly. Push corrected state to remote after fix.

### 7.4 Bad deployment

**What is lost:** The public site serves incorrect, incomplete, or broken content from a newly deployed release.

**What restores it:** Atomic rollback to the exact previous release target captured before the switch (DEPLOYMENT_ARCHITECTURE.md section 3.1, step 5). This is a symlink rename operation, not a rebuild.

**Mechanism:** Deployment rollback (atomic symlink restore).

**RTO consideration:** Seconds. Rollback is the fastest recovery mechanism. Investigate root cause after rollback.

### 7.5 Derivative corruption

**What is lost:** One or more web derivative files are corrupt, missing, or incorrectly generated (wrong color space, privacy leakage, incorrect dimensions).

**What restores it:** Delete affected derivatives and re-run the image pipeline. If the corruption affects all derivatives, delete `generated/` entirely and rebuild. WEB INGEST MASTERS are unaffected.

**Mechanism:** Pipeline regeneration.

**RTO consideration:** Proportional to the number of affected derivatives. A single derivative regenerates in seconds; a full pipeline rebuild depends on archive size.

### 7.6 Generated directory deletion

**What is lost:** `generated/` contents including asset manifest, extracted metadata, and staged derivatives.

**What restores it:** Full build pipeline re-execution. All `generated/` state is derived from authored YAML + WEB INGEST MASTERS.

**Mechanism:** Clean rebuild.

**RTO consideration:** Full build time. No data loss occurs because `generated/` is entirely regenerable.

### 7.7 Dist / release directory deletion

**What is lost:** Built HTML, assembled release output. Current serving state may be affected if the active release directory is deleted.

**What restores it:** If the current release is intact, no action needed. If the active release is lost, rebuild and redeploy. If prior releases remain, a manual rollback to a surviving release provides interim service while rebuilding.

**Mechanism:** Rebuild + redeploy, or rollback to surviving release.

**RTO consideration:** Rebuild time plus deployment time. Rollback to a surviving release is near-instant.

---

## 8. Backup verification

Backups are not trustworthy until verified. The following verification activities are required.

### 8.1 Integrity checks

- Every backup run produces a checksum/manifest of backed-up content.
- Periodic integrity scans compare stored checksums against actual backup contents.
- Git remote integrity is verified by periodic clone/fetch operations that confirm all objects and LFS pointers (if used) are retrievable.

### 8.2 Periodic restore tests

At least quarterly, perform a partial or full restore test:

- **Partial test:** Restore a random subset of WEB INGEST MASTERS to a temporary location; verify files decode correctly and match source hashes.
- **Full test:** Execute the complete restore sequence (section 6) on a clean test environment; verify the rebuilt site passes deployment smoke tests.

Document each restore test with date, scope, duration, and result. Failed restore tests are treated as incidents requiring immediate remediation.

### 8.3 Backup monitoring

Backup failures (missed schedule, incomplete transfer, encryption error) must trigger alerts. Silent backup failure violates the must-have principle.

---

## 9. Restore drill expectation

A documented restore drill must prove the RTO target is achievable. The drill exercises the full restore sequence on a clean host with no prior site state.

Drill requirements:

- Conducted at least once before initial production launch.
- Repeated after any significant infrastructure change (new VPS provider, new backup tool, new credential store).
- Timed end-to-end from failure declaration to verified public site.
- Result recorded: pass/fail, elapsed time, issues encountered, corrective actions.

If a drill exceeds the 24-hour RTO, the backup architecture or restore procedure must be revised until the target is met.

---

## 10. Secrets and credential recovery

SSH keys, TLS certificates, deploy credentials, and backup encryption keys are non-regenerable operational state. Their loss prevents VPS access, HTTPS service, deployment, and backup restoration.

Contract requirements:

- Credentials are stored in a secure escrow mechanism (password manager, secrets vault, or equivalent) independent of the VPS.
- Reprovisioning procedures are documented: how to generate new SSH keys, request new TLS certificates, rotate deploy credentials.
- Backup encryption keys are escrowed separately from the backup storage itself. Losing both the key and the backup simultaneously must not be possible through a single failure.

Secrets recovery is part of the full restore sequence (section 6, step 2).

---

## 11. Relationship to other documents

| Document | Relationship |
|---|---|
| DEPLOYMENT_ARCHITECTURE.md | Defines atomic release switching and rollback; this document defines what happens when rollback is insufficient |
| SOURCE_OF_TRUTH_MATRIX.md | Authoritative list of what is Git-tracked, backed up, and regenerable |
| IMAGE_PIPELINE.md | Defines the derivation process that makes assets regenerable |
| BUILD_AND_ROUTING.md | Defines the build pipeline invoked during restore |
| RISK_REGISTER.md | Catalogs risks mitigated by backup/recovery controls |
| OPEN_QUESTIONS.md | Records open backup provider/tool selection |

---

**END OF BACKUP AND RECOVERY**
