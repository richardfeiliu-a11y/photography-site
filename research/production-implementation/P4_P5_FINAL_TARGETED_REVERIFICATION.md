# P4/P5 Final Independent Gate-A Re-verification

Verification date: 2026-09-04 (Europe/Berlin)

Candidate under review: `8ed254dee973c558c7e97cd2f1aef0a9c523e3ea`

Correction baseline: `81f6ad40473b4a850c6f95fd9875ca314b3620ef`

Functional correction commit: `11814da83724038e1775a4b2559dfd2882494fd8`

Mode: pure independent verification. No implementation fix, P6 work,
WP-39/WP-40/WP-41 work, G1-G7 redesign, visual-baseline update, push, merge to
`main`, or deployment was performed. This report is the only repository file
written by the review.

## 1. Executive result

The two Important blockers reported by the previous independent Gate-A review
are independently closed at the frozen candidate.

1. Production validation and Astro consumption now resolve one project root
   and one `generated/asset-manifest.json` through the shared
   `resolveAssetAuthority()` boundary. All tested production override and
   reverse-authority attacks fail closed before contaminated HTML can be
   generated.
2. Protocol-level lock tests now use a unique test namespace while real
   production-like capture/build paths retain the canonical
   `.serve-artifacts/.build-lock`. The change fixes test interference; it does
   not weaken production ownership, stale-owner, non-owner release, or manual
   recovery semantics.

The first fresh, normal full integration run passed 289/289. The complete
fresh regression battery, preview-preservation checks, capture/diff checks,
and final production restoration also passed.

**Gate A result: PASS.**

## 2. Repository identity and initial state

| Check | Independent observation | Result |
|---|---|---|
| Worktree | `<repo>/.worktrees/production-dev` | PASS |
| Branch | `production-dev` | PASS |
| Initial HEAD | `8ed254dee973c558c7e97cd2f1aef0a9c523e3ea` | PASS |
| Expected HEAD | exact match | PASS |
| Initial Git status | clean; branch 10 commits ahead of `origin/production-dev` | PASS |
| Initial `git diff --check` | clean | PASS |
| Initial canonical build lock | absent | PASS |
| Initial root `.build-lock` | absent | PASS |
| Canonical manifest SHA-256 | `3712ede60c65d0516a9745277cfe8ce24f8ac93b7fe6024798baa893412d1318` | PASS |
| Checkpoint orientation | live branch, SHA, and clean state matched `photography/checkpoints/codex-checkpoint-2026-09-04-t13-53-16-z-p4-p5-gate-b-two-blocker-correction` | PASS |

No push, merge, deployment, P6 start, or WP-39..WP-41 work was performed by
this verification.

## 3. Evidence and governing scope read

The following required evidence was read in full before adjudication:

- `research/production-implementation/P4_P5_CLOSURE_VERIFICATION.md`
- `research/production-implementation/P4_P5_TARGETED_REVERIFICATION.md`
- the previous contents of this independent report
- `docs/implementation/P4-P5-GATE-B-FINAL-MANIFEST-AUTHORITY.md`
- `docs/implementation/P4-P5-GATE-B-FINAL-TWO-BLOCKER-CORRECTION.md`

The review then read only the relevant canonical sections for the build DAG,
mode/root/manifest authority, WP-13, WP-24, Astro build-time consumption,
preview semantics, test isolation, build-lock ownership, P4/P5 gates, and the
P6 boundary. It did not restart a broad WP-25..WP-38 or G1-G7 design audit.

The frozen requirements applied here are:

- production Astro is a build-time consumer of the canonical generated
  manifest and must fail closed;
- the validator and consumer must not select different production roots or
  manifests;
- preview may intentionally use a separate merged manifest and draft content;
- capture/build operations that share `dist/` use the canonical build lock;
- P6 starts only after P4/P5 Gate A passes.

## 4. Important 1 — structural production authority

### 4.1 Actual production call graph

The review traced executable paths rather than accepting the correction report
or the function name as proof.

```text
npm run build
  -> ASTRO_PRODUCTION_VALIDATE=1 astro build
  -> astro.config.mjs
     -> WP-13 astroContentGate().astro:config:done
        -> resolveAssetAuthority({ env, config.root })
        -> runContentValidation(
             contentRoot = authority.projectRoot,
             assetManifest = authority.validatorManifestPath)
        -> scripts/validate/content.ts
     -> WP-24 assetManifestGate().astro:config:done
        -> resolveAssetAuthority({ env, config.root })
        -> runManifestGate(
             contentRoot = authority.projectRoot,
             assetManifest = authority.validatorManifestPath)
        -> scripts/validate/manifest-gate.ts
     -> Astro page/template imports
        -> getManifest()
        -> resolveAssetAuthority().consumerManifestPath
        -> readAssetManifest(exact resolved path)
```

`resolveAssetAuthority()` owns all three production facts:

- mode: `production` unless explicit valid preview;
- project root: the canonical Astro `config.root`/module-located root;
- manifest: exactly `join(projectRoot, "generated/asset-manifest.json")`.

For production it returns the same string as `manifestPath`,
`consumerManifestPath`, and `validatorManifestPath`. WP-13 and WP-24 receive
the same `config.root` from Astro, and the consumer resolves the same
module/cwd-backed project root. The clean real build confirms the three paths
agree in the bundled Astro execution context.

### 4.2 Production environment-variable behavior

| Variable/configuration | Production behavior | Result |
|---|---|---|
| `ASTRO_ASSET_MANIFEST` | any non-empty value rejected as preview-only | PASS |
| `ASTRO_VALIDATE_ASSET_MANIFEST` | any non-empty value rejected as preview-only | PASS |
| both manifest variables | rejected before either can become authority | PASS |
| divergent `ASTRO_VALIDATE_CONTENT_ROOT` | rejected as a root fork | PASS |
| content-root fork plus either/both manifest variables | rejected | PASS |
| `ASTRO_VALIDATE_CONTENT_ROOT` resolving to canonical root | accepted but cannot change authority | PASS |
| preview mode | retains intentional content-root and manifest overrides | PASS |

The gate child CLIs (`content.ts` and `manifest-gate.ts`) still support explicit
paths because they are reusable validation programs and fixture boundaries.
They do not independently select production authority in the real Astro path:
the WP-13/WP-24 plugins pass the already-resolved shared authority into them.

### 4.3 Repository-wide resolver search

The entire repository was searched for:

- `ASTRO_VALIDATE_CONTENT_ROOT`
- `ASTRO_ASSET_MANIFEST`
- `ASTRO_VALIDATE_ASSET_MANIFEST`
- `generated/asset-manifest.json`
- `contentRoot`, `projectRoot`, and manifest path resolvers

The only production Astro build authority owner is
`src/lib/assets/manifest-authority.mjs`. Relevant production callers are
`scripts/validate/astro-gate.mjs`, `scripts/validate/asset-gate.mjs`, and
`src/lib/assets/manifest.ts`. Other path parameters found belong to media
producer CLIs, reusable validator CLIs, preview generation, fixture tests, or
capture baseline manifests; none is a second hidden production Astro resolver.

**Structural single production authority: PASS.**

## 5. Important 1 — real production attack matrix

The matrix used controlled, real `npm run build` executions under the canonical
build lock. No resolver mock or source-string-only check was used.

For reverse-root cases, the alternate validation root contained a clean copy
of the canonical manifest while the canonical manifest was temporarily changed
to unique marker URLs. Canonical bytes were restored in a `finally` path.

| Case | Configuration | Real build | Marker-bearing production HTML | Result |
|---|---|---:|---:|---|
| A | production + `ASTRO_ASSET_MANIFEST` | exit 1 | 0 | PASS — failed closed |
| B | production + `ASTRO_VALIDATE_ASSET_MANIFEST` | exit 1 | 0 | PASS — failed closed |
| C | production + both manifest overrides | exit 1 | 0 | PASS — failed closed |
| D | production + divergent `ASTRO_VALIDATE_CONTENT_ROOT`; alternate clean, canonical marked | exit 1 | 0 | PASS — failed closed |
| E1 | content-root fork + consumer override | exit 1 | 0 | PASS — failed closed |
| E2 | content-root fork + validator override | exit 1 | 0 | PASS — failed closed |
| E3 | content-root fork + both manifest overrides | exit 1 | 0 | PASS — failed closed |
| F | clean canonical production build | exit 0 | 0 | PASS |

Each failed attack left no usable contaminated production artifact: the only
usable HTML present was the prior clean production output, and it contained
zero attack markers. Case F then rebuilt the canonical production artifact.

Post-matrix canonical manifest:

- byte-for-byte equal to the pre-attack file;
- SHA-256
  `3712ede60c65d0516a9745277cfe8ce24f8ac93b7fe6024798baa893412d1318`;
- 1008 records.

**Production attack matrix: PASS.**

## 6. Important 1 — authority test integrity

The corrected tests contain material production behavior coverage.

`tests/integration/manifest-authority.test.ts` now runs real production builds,
checks the process exit status, traverses final generated HTML, asserts zero
marker leakage on failed attacks, and checks canonical URL presence on a clean
build. Its content-root reverse attack saves and restores canonical bytes,
creates a clean alternate root, marks the canonical document, invokes the real
build, and inspects HTML.

This specifically covers the previously missing direction:

```text
validator production root != Astro consumer production root
```

It is not dependent only on the two manifest-specific environment variables.

The earlier missing/stale-manifest tests were not weakened. They now execute a
real isolated Astro project whose own `config.root` is the fixture's canonical
root, so they continue testing producer-before-consumer failures without
misusing a production root override.

Fresh targeted result:

- `manifest-authority.test.ts`
- `manifest-consumption.test.ts`
- `production-validation.test.ts`
- 3 files, 59/59 tests passed.

Count audit from correction baseline to candidate:

| File | Before | After | Explanation |
|---|---:|---:|---|
| `manifest-authority.test.ts` | 16 | 19 | three new authority regressions |
| `manifest-consumption.test.ts` | 14 | 14 | preserved count; fixture-path correction |
| `production-validation.test.ts` | 26 | 26 | preserved count |
| `build-concurrency.test.ts` | 11 | 11 | preserved assertions; isolated namespace |

The full integration count change from 286 to 289 is therefore exactly three
legitimate added authority tests, not deletion or replacement of prior tests.

**Authority test integrity: PASS.**

## 7. Important 2 — build-lock test isolation

### 7.1 Production semantics retained

`tests/support/artifact.mjs` retains the canonical default lock:

```text
<repository>/.serve-artifacts/.build-lock
```

Inspection confirmed that the correction did not weaken the protocol:

- acquisition writes PID plus a random ownership token;
- a valid live owner remains authoritative even if timestamps look stale;
- only a conclusively dead PID (`ESRCH`) is automatically reclaimed;
- `EPERM`, malformed metadata, missing metadata, and other uncertainty remain
  fail-closed;
- release requires the current process's held token to match `owner.json`;
- a non-owner cannot release the lock;
- explicit `breakBuildLock(reason)` remains the only deliberate manual break
  path and requires a non-empty reason;
- no blind retry, retry-until-green, force release, or production timeout
  inflation was added.

### 7.2 Test-only namespace

`build-concurrency.test.ts` sets a unique namespace of the form:

```text
.serve-artifacts/.protocol-lock-<pid>-<timestamp>/
```

through `PHOTOGRAPHY_TEST_BUILD_LOCK_DIR`. The support module uses this value
only when explicitly set. Repository search found the variable only in the
support module and the protocol test file. Normal production, E2E, accessibility,
capture, and build commands never set it.

The protocol tests therefore exercise the same ownership functions in an
isolated directory. The file's real two-build production probe explicitly
removes the test-only variable from child environments, so production-like
builds still contend on the canonical lock.

The correction diff contains no deleted lock test, assertion removal, global
serialization, timeout inflation, or production lock-path replacement.

**Determination: the shared-state test-isolation defect was fixed; production
lock semantics were not changed.**

**Build-lock test integrity: PASS.**

## 8. First fresh full integration run

The repository's normal command was run once from a fresh state:

```text
npm run test:integration
```

No custom Gate-only command, suite-wide serialization, reduced worker count,
or failed-test substitution was used. The normal Vitest configuration retained
its configured parallelism.

Observed first complete run:

- exit 0;
- 27/27 files passed;
- 289/289 tests passed;
- Vitest duration 446.18 seconds.

This is the first fresh full-run fact; no later rerun was used to overwrite it.

**First fresh full integration run: PASS.**

## 9. Fresh full regression

All results below were freshly reproduced at the candidate; correction-report
claims were not reused as evidence.

| Verification | Fresh observation | Result |
|---|---|---|
| Manifest/root targeted integration | 3 files; 59/59 | PASS |
| Unit | 21 files; 340/340 | PASS |
| Integration, first complete run | 27 files; 289/289 | PASS |
| E2E | 127/127 | PASS |
| Accessibility | 6/6; zero axe violations | PASS |
| `npm run check` | 0 errors; 0 warnings; 3 existing hints | PASS |
| Content validation | 0 errors; 0 warnings | PASS |
| Media coverage | 1008/1008; 51 complete / 0 incomplete photos | PASS |
| Production privacy | 657 files scanned | PASS |
| Preview privacy | 914 files scanned | PASS |
| Production build | exit 0 | PASS |
| Required preview build/check | exit 0; long-gallery checks below | PASS |
| Capture | 14/14 governed states | PASS |
| Capture diff | 14/14 identical | PASS |

No legitimate count difference was treated as a failure; the only changed
count, integration 286 to 289, was traced to the three added regressions in
Section 6.

**Full regression: PASS.**

## 10. Preview preservation

The production authority correction did not collapse legitimate preview
semantics.

Fresh preview evidence:

- production records: 1008;
- draft records: 1396;
- merged preview manifest: 2404 records;
- preview physical draft media: 914 files; privacy check passed;
- preview build: exit 0;
- `long-gallery-72` route present in preview;
- long-gallery cardinality: 72 figures / 72 pictures / 72 images;
- preview marker leakage: zero;
- production manifest remained byte-for-byte unchanged through preview and
  capture operations;
- capture completed 14/14 and capture diff was 14/14 identical.

The WP-24 validator can continue validating the 1008-record canonical
production closure while the explicit preview consumer renders the
2404-record merged preview manifest. That separation is intentional preview
behavior, not a production authority fork.

After capture/diff, the required final production rebuild removed the draft
long-gallery route from `dist/`.

**Preview preservation: PASS.**

## 11. Final production restoration

Because capture leaves preview output in `dist/`, a fresh canonical
`npm run build` was run after capture and capture-diff.

Final evidence:

| Check | Observation | Result |
|---|---|---|
| Production build exit | 0 | PASS |
| Final production HTML | exactly 20 files | PASS |
| `galleries/long-gallery-72` | absent | PASS |
| `qa-probe` | removed by gate; absent from final `dist/` | PASS |
| Attack/test markers | zero HTML matches | PASS |
| Image `src`/`srcset` references | 846 checked; 846 canonical `/media/`; 0 non-canonical | PASS |
| Canonical manifest SHA-256 | `3712ede60c65d0516a9745277cfe8ce24f8ac93b7fe6024798baa893412d1318` | PASS |
| Canonical manifest records | 1008 | PASS |
| `.serve-artifacts/.build-lock` | absent | PASS |

**Final production restoration: PASS.**

## 12. Scope containment

Exact correction range: `81f6ad4..8ed254d`.

- 10 files changed, 644 insertions, 134 deletions.
- `11814da` contains the functional authority/test-isolation correction.
- `8ed254d` adds the correction report.
- Changed files are limited to two validation gates, shared authority and
  manifest consumer, lock/test support, four relevant integration test files,
  and the correction report.
- No product page, component, stylesheet, route design, content, G1-G7 contract,
  media producer semantics, WP-38 governance, deployment file, or visual
  baseline file changed in the correction range.
- `git diff 81f6ad4..HEAD -- tests/baselines` is empty; governed baseline pixels
  and baseline metadata are unchanged.
- No WP-39, WP-40, WP-41, or P6 implementation file changed.
- No push, `main` merge, or deployment was performed by this review.
- No child agents were opened; zero required closing or archiving.

**Scope containment: PASS.**

## 13. Required classification

| Required category | Classification |
|---|---|
| Important 1 — Production root/manifest authority | PASS |
| Important 2 — Integration shared-lock isolation | PASS |
| Structural single production authority | PASS |
| Production attack matrix | PASS |
| Authority test integrity | PASS |
| Build-lock test integrity | PASS |
| First fresh full integration run | PASS |
| Full regression | PASS |
| Preview preservation | PASS |
| Final production restoration | PASS |
| Scope containment | PASS |

## 14. Finding counts

| Severity | Count |
|---|---:|
| Critical | 0 |
| Important | 0 |
| Minor | 0 |

No blocker remains within this bounded final re-verification.

## 15. Final repository state and report-only write

Before this report was updated, the implementation worktree was clean at the
required candidate. The verification did not create a commit because that
would change the frozen candidate HEAD. After the requested report update, the
only expected working-tree change is this report itself.

- branch: `production-dev`;
- implementation HEAD: `8ed254dee973c558c7e97cd2f1aef0a9c523e3ea`;
- implementation/candidate files: clean and unchanged;
- report-only working-tree modification:
  `research/production-implementation/P4_P5_FINAL_TARGETED_REVERIFICATION.md`;
- `git diff --check`: clean;
- build lock: absent;
- no push, merge, deploy, P6, or WP-39..WP-41 work.

The report-only dirty state is intentional and transparent: retaining both an
updated tracked report and the exact frozen HEAD makes a globally clean
working tree impossible without either discarding the report or creating a new
commit. Neither action is authorized by this verification.

## 16. Final Gate

**Gate A — PASS.**

P4/P5 IMPLEMENTATION VERIFICATION PASS — Ready for P6 Production Development.
