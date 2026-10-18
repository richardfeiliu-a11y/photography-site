// WP-06 Playwright configuration (e2e + a11y projects).
//
// Server strategy (decided per WP-06 brief): tests run against the PRODUCTION
// BUILD served by `astro preview` — not the dev server — via Playwright's
// webServer: `npm run build && astro preview` guarantees dist/ is fresh and
// exercises the same output that ships.
// Port: deterministic default 4179 on 127.0.0.1 (chosen to avoid the
// Astro default 4321 colliding with interactive dev servers). P4/P5 parallel
// lanes override via E2E_PORT (e.g. 4180) so concurrent preview servers in
// separate worktrees never collide and never reuse each other's dist/.
//
// Projects:
//   e2e — npm run test:e2e  → playwright test --project=e2e  (tests/e2e/)
//   a11y — npm run test:a11y → playwright test --project=a11y (tests/a11y/)
//
// Viewport presets match the §8.1 capture invariants (see
// tests/support/viewports.ts): 1440x900 desktop default, 390x844 mobile via
// test.use(), deviceScaleFactor 1 everywhere.
import { defineConfig } from "@playwright/test";
import { CAPTURE_DEVICE_SCALE_FACTOR, DESKTOP_VIEWPORT } from "./tests/support/viewports.mjs";

const PREVIEW_PORT = Number(process.env.E2E_PORT ?? 4179);
const PREVIEW_HOST = "127.0.0.1";

export default defineConfig({
  testDir: "tests",
  projects: [
    {
      name: "e2e",
      testDir: "./tests/e2e",
      testMatch: /.*\.spec\.ts/,
    },
    {
      name: "a11y",
      testDir: "./tests/a11y",
      testMatch: /.*\.spec\.ts/,
    },
  ],
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://${PREVIEW_HOST}:${PREVIEW_PORT}`,
    viewport: DESKTOP_VIEWPORT,
    deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
  },
  webServer: {
    // IMP-01: tests run against the assembled browser-facing artifact
    // (Astro output + generated/media derivatives — the test-side realization
    // of the final-release assembly concept), NOT bare astro preview of
    // dist/ (which never contains /media/). The build is fresh on every run
    // and reuseExistingServer is off: shared mutable server/dist state must
    // never leak between suites (IMP-05/IMP-06 order-independence contract).
    command: `node tests/support/serve-artifact.mjs --mode qa --port ${PREVIEW_PORT}`,
    url: `http://${PREVIEW_HOST}:${PREVIEW_PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
