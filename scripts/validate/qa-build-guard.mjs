// IMP-06 — canonical production builds fail closed against QA-mode leakage.
//
// The QA canary route (/qa-probe) is a TEST-ONLY surface. A canonical
// production build that ran with QA_PROBE=1 would exit 0 while retaining an
// unauthorized route — a production contract violation masquerading as a
// successful validation. The npm `build` script chains this guard BEFORE
// astro build: if QA_PROBE is set, the canonical invocation refuses
// explicitly (nonzero exit, nothing written). The test harness uses
// `npm run build:qa` — a separate test-only invocation with a separate
// output directory (dist-qa/) — never the canonical script.
if (process.env.QA_PROBE === "1") {
  console.error(
    "[qa-build-guard] REFUSED: QA_PROBE=1 is incompatible with the canonical " +
      "production build (npm run build). The QA canary route is a test-only " +
      "surface and must never be produced by — or alongside — a canonical " +
      "production validation. Use `npm run build:qa` for the isolated " +
      "test-only QA harness build (dist-qa/).",
  );
  process.exit(1);
}
