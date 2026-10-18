// Preview-mode Playwright config for draft-route regressions (P6-IMP-01).
//
// The default config serves the QA artifact where draft routes 404 by frozen
// ADR-020. This config targets a separately-started PREVIEW artifact (see
// tests/support/preview-e2e.mjs + npm run test:e2e:preview) and defines NO
// webServer of its own: the runner owns the explicit fresh preview build +
// isolated assembly + pinned-port serving, mirroring tests/capture/capture.mjs.
// Port rendezvous: E2E_PREVIEW_PORT (default 4182) / E2E_PREVIEW_BASE.
// Both default below; the runner exports the same values.
import { defineConfig } from '@playwright/test';
import { DESKTOP_VIEWPORT, CAPTURE_DEVICE_SCALE_FACTOR } from './tests/support/viewports.mjs';

const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4182);
const PREVIEW_BASE = process.env.E2E_PREVIEW_BASE ?? 'http://127.0.0.1:' + PREVIEW_PORT;

export default defineConfig({
  testDir: 'tests/e2e-preview',
  testMatch: /.*\.spec\.ts/,
  // 72-photo pages are heavy: cap parallelism so renderer memory stays sane.
  workers: 2,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: PREVIEW_BASE,
    viewport: DESKTOP_VIEWPORT,
    deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
  },
});
