# Deployment Architecture — Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion to:** BUILD_AND_ROUTING.md, BACKUP_AND_RECOVERY.md, SOURCE_OF_TRUTH_MATRIX.md, IMAGE_PIPELINE.md, RISK_REGISTER.md
**Target platform:** GNU/Linux VPS with self-hosted Nginx. Deployment commands and filesystem operations in this document are scoped to the Linux VPS; no macOS portability is claimed for deploy-specific procedures.

---

## 1. Deployment model overview

The site is a fully static archive served by Nginx. There is no application server, no database, and no runtime build step on the VPS. All HTML, CSS, JavaScript, fonts, and image derivatives are produced by the build pipeline (BUILD_AND_ROUTING.md) and assembled into a complete release candidate before any deployment action begins.

Deployment uses immutable release directories on the VPS with an atomic symlink pointer (`current`) that Nginx resolves at request time. Content release switches do not require Nginx configuration reload; reload is required only when Nginx configuration itself changes. The generated redirect include is Nginx configuration: a release that changes redirect config requires `nginx -t` plus a reload coupled to candidate activation, while a content-only release with no config change requires no reload (section 3.3).

### 1.1 Architectural invariants

- The build pipeline produces a complete, verified release candidate before upload begins.
- Each deployment creates a new unique release directory on the VPS. Failed or interrupted uploads never become switchable candidates.
- The `current` symlink is updated atomically via `rename()` on the same filesystem.
- Rollback restores the exact previous symlink target captured before the switch, not a derived or second-newest directory.
- One deployment executes at a time (serialization lock).
- Post-switch smoke tests verify actual release content served through the public endpoint, not merely Nginx availability.

---

## 2. Release directory structure

PSEUDOCODE / CONTRACT EXAMPLE:

```text
/srv/archive/releases/
    release-20260828T143120Z/      # unique timestamped release directory
        index.html
        galleries/
            lofoten-light/
                index.html
        places/
            ...
        archive/
            index.html
        assets/                      # hashed immutable assets
            css/a1b2c3d4.css
            js/e5f6a7b8.js
            media/p_reine_001-1024w-a3f2c1.webp   # example derivative (format decided in P3)
            ...
        404.html                     # static error page
    release-20260827T092230Z/
    ...

/srv/archive/current -> release-20260828T143120Z/   # symlink
```

Exact base paths (`/srv/archive/`, etc.) are environment configuration. The architectural contract is: one base directory containing uniquely named release subdirectories plus a `current` symlink on the same filesystem.

### 2.1 Unique release naming

Each release directory name must be globally unique and sortable. A timestamp-based scheme (ISO 8601 basic format) is the baseline contract. Implementation may append a short hash or sequence number for collision avoidance if multiple releases per second are possible.

### 2.2 Release retention

Retain enough prior releases to support rollback and brief operational history. Exact retention count is an implementation/operations choice. Cleanup must honor old-page asset availability (section 6.2).

---

## 3. Canonical release flow

The following sequence is mandatory. No step may be skipped or reordered.

```text
1. Build complete release candidate locally or in CI
       (see BUILD_AND_ROUTING.md; DAG ends at assembled release candidate)
                    |
                    v
2. Upload to NEW unique release directory on VPS
                    |
                    v
3. Verify candidate filesystem contents (section 4)
                    |
                    v
4. Pre-switch candidate HTTP/file smoke (if practical)
                    |
                    v
5. Capture exact current symlink target
                    |
                    v
6. Atomically switch current -> candidate
                    |
                    v
7. Post-switch HTTP smoke (section 5)
                    |
                    v
8. If smoke fails: restore exact captured previous target
```

### 3.1 Step details

**Step 1 -- Build.** The build pipeline (BUILD_AND_ROUTING.md) produces a fully assembled release candidate including Astro output and all web derivatives. The integrity gate described in BUILD_AND_ROUTING.md must pass before upload begins.

**Step 2 -- Upload.** Transfer the complete release candidate into a new, uniquely named directory on the VPS. The upload target must be the final release directory, not a shared staging area. An incomplete or interrupted upload produces a directory that fails verification (step 3) and is never switched to.

Upload serialization: hold an exclusive lock (file lock, PID file, or equivalent) for the duration of the deployment. A concurrent deployment attempt must fail fast rather than produce interleaved state.

**Step 3 -- Verify candidate.** Run the candidate release integrity checks defined in section 4 against the uploaded directory on the VPS. If any check fails, abort the deployment and leave `current` unchanged. Clean up or mark the failed candidate directory so it cannot be accidentally promoted later.

**Step 4 -- Pre-switch smoke (optional but recommended).** If the VPS can serve the candidate without switching `current` (e.g., via a temporary Nginx location or direct file access), run a lightweight content check. This step catches gross errors before the public pointer moves. It is architecturally optional because not all environments support it easily, but it should be implemented when practical.

**Step 5 -- Capture previous target.** Read and record the exact target of the `current` symlink before any modification. This value is the rollback target. Do not derive it after switching. Do not assume it equals "the second-newest release directory." If `current` does not exist (first deployment), record that fact explicitly; there is no rollback target.

PSEUDOCODE / CONTRACT EXAMPLE:

```bash
# Capture exact previous target BEFORE any switch
PREVIOUS_TARGET=$(readlink "/srv/archive/current" 2>/dev/null || echo "")
```

**Step 6 -- Atomic switch.** Create a temporary symlink on the same filesystem as `current`, then atomically rename it over `current`. This guarantees that at every instant, `current` points to either the old release or the new release, never to a partially-written or missing target.

PSEUDOCODE / CONTRACT EXAMPLE:

```bash
# Create temporary symlink next to current, then rename atomically
ln -sfn "${RELEASE_PATH}" "/srv/archive/current.tmp.$$"
mv -Tf "/srv/archive/current.tmp.$$" "/srv/archive/current"
```

The `mv -Tf` operation is a single `rename(2)` system call on the same filesystem and is atomic on Linux. This is scoped to the GNU/Linux VPS.

**Optional previous symlink.** If a `previous` symlink is maintained, it must point to the exact target captured in step 5, set after the successful switch. An explicit `previous` symlink is optional; the rollback mechanism may instead use the directly recorded previous target string. Never create `previous` by pointing it to the new `current` after switching.

**Step 7 -- Post-switch smoke.** Verify the live public site serves correct content from the new release (section 5).

**Step 8 -- Rollback on failure.** If post-switch smoke fails, atomically restore the exact previous target captured in step 5 using the same atomic rename mechanism. Alert the operator. Do not attempt to auto-retry the failed release.

### 3.2 Nginx reload policy

A content release switch (symlink target change) does NOT require a Nginx configuration reload. Nginx resolves the symlink target at request time based on the filesystem state. Reload is required only when Nginx configuration files themselves change (e.g., cache policy, TLS certificate, server block modifications).

Verify this behavior during implementation phase P9. If Nginx `open_file_cache` or other caching directives affect symlink resolution, configure or disable them explicitly.

Nginx composes configuration with `include`, not an "import" directive.

### 3.3 Generated redirect configuration lifecycle

Redirects are delivered as HTTP 301 responses via a generated Nginx `include` file produced from validated `content/redirects.yaml` (BUILD_AND_ROUTING.md section 5). The redirect include is Nginx configuration; it does not become active through the content symlink switch alone.

Mandatory lifecycle:

1. **Validate.** Redirects are validated at build time: old paths are historical only, each entry carries exactly one target type (`gallery_id` XOR `place_id`), the target exists and resolves to a public/published canonical route, no loops, no route collisions.
2. **Generate.** The build generates the redirect include as part of the release candidate.
3. **Verify candidate config.** Candidate verification (section 4) checks that the generated redirect config matches the validated redirects.
4. **Test before activation.** The complete Nginx configuration including the candidate redirect include must pass `nginx -t` before activation. A failure blocks the deployment.
5. **Activate with the release.** The redirect include is activated in the same deployment transaction as the candidate release.
6. **Reload only when changed.** If the redirect config (or any Nginx configuration) changed, reload Nginx after activation. A content-only release with no config change requires no reload.
7. **Post-switch redirect smoke.** Post-switch smoke (section 5) verifies that representative historical paths return HTTP 301 to the current canonical routes.
8. **Coupled rollback.** On failure, rollback restores BOTH the exact captured previous release AND the exact previous redirect configuration, then reloads Nginx if the configuration was changed.

---

## 4. Candidate release integrity checks

Before switching `current`, the following checks must pass against the uploaded release directory on the VPS. Any failure aborts the deployment.

| Check | Contract |
|---|---|
| Index exists | `index.html` exists at the release root |
| Canonical route output exists | At least one `/galleries/{slug}/index.html` exists for a known published Gallery |
| Asset manifest closure | Every derivative URL referenced in the asset manifest resolves to an existing file within the release |
| Every referenced derivative exists | Cross-check HTML `src`/`srcset` references against actual files |
| No source masters in public root | No WEB INGEST MASTERS, CAMERA ORIGINALS, or camera filenames (RAW extensions, original JPEG names matching ingest-master patterns) appear anywhere under the release directory |
| No draft routes | No HTML output exists for draft-status Galleries |
| No GPS leakage | Sampled or automated inspection of derivative EXIF/metadata confirms no GPS coordinates, camera serial numbers, or other privacy-sensitive fields |
| Static 404 behavior present | A `404.html` or equivalent error page exists; Nginx configuration uses real static 404 (section 7) |
| Redirect config integrity | The generated redirect include shipped with the candidate matches the build-validated redirects (historical paths only; `gallery_id` XOR `place_id`; targets resolve to published canonical routes) |

These checks validate the release candidate as a self-contained, safe-to-serve artifact. They are distinct from the build-time integrity gate (BUILD_AND_ROUTING.md), which validates authored content and pipeline output before assembly.

---

## 5. Post-switch smoke tests

After the atomic switch, verify the live public site. Smoke tests must check actual release content, not merely Nginx availability.

| Check | Contract |
|---|---|
| Home page | HTTP 200; response body contains expected release-specific content marker |
| Representative Gallery page | HTTP 200; canonical route `/galleries/{slug}` returns valid HTML |
| Representative image | HTTP 200; a known derivative asset returns correct content type and non-zero bytes |
| 404 behavior | Request to a non-existent path returns HTTP 404 (not 200, not SPA fallback) |
| Redirect behavior | If this release changed redirect config, representative historical paths return HTTP 301 to the current canonical Gallery/Place routes |
| Health endpoint | `/health` returns 200 (proves Nginx availability only; not a content check) |

The `/health` endpoint is an unconditional Nginx response that proves the server process is running. It does not prove the release is correct. Content smoke tests are the authoritative deployment verification.

On any smoke test failure: execute rollback (section 3.1, step 8) immediately. Log the failure details and the release directory that was rolled back from.

---

## 6. Cache policy

Cache headers are set by Nginx configuration and must differentiate between content-addressed immutable assets and mutable HTML/error responses.

### 6.1 Hashed immutable assets

Assets whose filenames contain a content-derived digest (CSS, JS, fonts, image derivatives) receive long cache lifetime with the `immutable` directive. These files never change at the same URL; a content change produces a new filename.

Exact `max-age` values are an implementation/deployment choice. The architectural contract is: long-lived, immutable, public.

### 6.2 HTML and non-hashed resources

HTML pages, `sitemap.xml`, `robots.txt`, and any resource without a content-hash in its filename must NOT receive long-term immutable caching. Use short `max-age` with revalidation (`no-cache`, `must-revalidate`, or a short `max-age` plus `stale-while-revalidate`) appropriate for static content that changes with each release.

Never apply one-year immutable cache to HTML. Content updates must be visible to returning visitors promptly.

### 6.3 Redirect and error responses

HTTP 301 redirects and 404 responses must use appropriate non-immutable cache policy. Permanent redirects (301) may be cached but should allow eventual invalidation. 404 responses should not be cached aggressively.

### 6.4 Old-page asset availability

Release cleanup must not break older HTML that references older content-addressed assets. When a visitor has a cached HTML page from a previous release and lazily loads an image, that image's hashed URL must still resolve.

Contract-level strategies (choose one at implementation):

- **Carry-forward:** When assembling a new release, copy forward any content-addressed assets referenced by retained prior release HTML.
- **Shared content-addressed asset store:** Serve hashed assets from a shared location outside individual release directories, so all releases reference a common pool.

The chosen strategy must be documented in deployment implementation. Either approach satisfies the contract; the invariant is that old HTML must not produce broken image requests due to release cleanup.

---

## 7. Static 404 behavior

The site is a static archive, not a single-page application. Missing routes must return a real HTTP 404 response with a static error page.

Required Nginx directive:

PSEUDOCODE / CONTRACT EXAMPLE:

```nginx
# Real static 404 -- NOT SPA fallback
try_files $uri $uri/ =404;
```

Forbidden pattern:

```nginx
# FORBIDDEN -- SPA fallback, turns unknown routes into Home 200
# try_files $uri $uri/ /index.html;
```

A custom `error_page 404 /404.html;` directive may serve a styled error page. The critical contract is that the HTTP status code is 404, not 200.

---

## 8. Health endpoint

An unconditional `/health` endpoint proves Nginx availability:

PSEUDOCODE / CONTRACT EXAMPLE:

```nginx
location /health {
    access_log off;
    return 200 "ok\n";
    add_header Content-Type text/plain;
}
```

This endpoint does not validate release content, asset integrity, or correct routing. It is a server-process liveness signal for external monitoring. Content validation belongs to smoke tests (section 5).

---

## 9. Nginx configuration contract

Nginx serves the site with `root` pointing to the `current` symlink. Configuration is composed with `include` directives, not an "import" keyword.

Key contractual requirements:

- `root` points to the `current` symlink path.
- `try_files $uri $uri/ =404;` for real static 404 behavior.
- Cache policy differentiates hashed assets from HTML (section 6).
- Directory listing is disabled (`autoindex off`).
- Strict MIME types are served.
- Security headers are appropriate for a static site (X-Content-Type-Options, X-Frame-Options, etc.). Obsolete headers (e.g., X-XSS-Protection) should not be presented as meaningful modern controls.
- TLS configuration follows current best practices (TLSv1.2+, strong ciphers, HSTS after HTTPS is proven).
- Gzip compression covers text-based content types.

Exact Nginx configuration is an implementation artifact. This document defines the architectural contracts that configuration must satisfy.

---

## 10. Deployment serialization

Only one deployment may execute at a time. The deployment process must acquire an exclusive lock before modifying the VPS filesystem and hold it until the deployment completes (success or failure).

Lock mechanisms (implementation choice): file lock (`flock`), PID file with stale-detection, or systemd timer serialization. The contract is mutual exclusion, not a specific mechanism.

Failed or interrupted deployments must clean up their partial release directory or mark it as incomplete so it cannot be promoted by a subsequent deployment attempt.

---

## 11. Relationship to build pipeline

The build pipeline (BUILD_AND_ROUTING.md) ends at a fully assembled, integrity-gated release candidate. Deployment begins with that candidate. The deployment process does not modify, regenerate, or re-validate build output; it transfers, verifies transfer completeness, and switches the pointer.

If the build pipeline's integrity gate fails, no deployment occurs. Deployment verification (section 4) is a transfer-completeness check, not a substitute for build-time validation.

---

## 12. Secrets and credentials

Deployment requires SSH access to the VPS and potentially TLS certificate management. Credentials must follow secure escrow and reprovisioning procedures:

- Deploy SSH keys are scoped to a dedicated deploy user with minimal privileges.
- TLS certificates are managed through automated renewal (e.g., certbot/Let's Encrypt or equivalent).
- Secrets are stored in a secure credential store, not in repository files.
- Credential rotation and recovery procedures are documented at the implementation level.

Secrets loss is a recovery scenario covered in BACKUP_AND_RECOVERY.md.

---

## 13. What this document does not cover

- **Backup and disaster recovery:** See BACKUP_AND_RECOVERY.md.
- **Build pipeline and assembly:** See BUILD_AND_ROUTING.md.
- **Image derivation and manifest generation:** See IMAGE_PIPELINE.md.
- **Content validation and schema:** See CONTENT_MODEL.md.
- **Source-of-truth ownership:** See SOURCE_OF_TRUTH_MATRIX.md.
- **Risk catalog:** See RISK_REGISTER.md.
- **Specific backup provider/tool selection:** Recorded as open in OPEN_QUESTIONS.md.
- **Exact max-age values, retention counts, lock mechanism:** Implementation/deployment choices.

---

**END OF DEPLOYMENT ARCHITECTURE**
