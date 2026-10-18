// WP-06 unit + integration test runner configuration (Vitest, exact-pinned).
// Conventions (PRODUCTION_IMPLEMENTATION_PLAN.md section 3.2 / WP-06):
//   tests/unit/          — fast, isolated module tests (no filesystem site state)
//   tests/integration/   — cross-module/content tests (fixtures under tests/fixtures/)
//   tests/bench/         — WP-07 benchmark-harness tests (read-only fixture
//                          corpus; encode output to gitignored bench-output/ or tmpdir)
//   tests/fixtures/      — read-only test fixtures
// e2e/a11y/capture live under Playwright (playwright.config.ts), not here.
//
// WP-03: the virtual `astro:content` module is aliased to astro's own
// implementation (astro/dist/content/config.js, the module the astro:content
// virtual module serves) so integration tests can import the REAL
// src/content.config.ts and run its real glob() loaders (see
// tests/support/content-layer.ts).
//
// WP-27: getViteConfig() (astro's own test-support API) loads Astro's full
// Vite plugin pipeline into Vitest so unit tests can import and render .astro
// components through experimental_AstroContainer (GalleryCard). The
// astro:content alias below stays as the virtual-module anchor for
// integration tests; getViteConfig serves the real virtual modules too.
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";
import { defineConfig, mergeConfig } from "vitest/config";
import { getViteConfig } from "astro/config";

// astro's ViteConfigFn declares one parameter; the runtime accepts a second
// (Vite config env). Casts keep the runtime call shape while satisfying
// astro check's view of the resolved user config.
const astroViteConfig = (await (
  getViteConfig({}, { root: fileURLToPath(new URL(".", import.meta.url)) }) as (
    config: unknown,
    env?: { command: "serve" | "build"; mode: string },
  ) => Promise<Record<string, unknown>>
)({ root: fileURLToPath(new URL(".", import.meta.url)), configFile: false }, {
  command: "serve",
  mode: "test",
})) as unknown as UserConfig;

export default mergeConfig(
  defineConfig({
    resolve: {
      alias: [
        {
          find: "astro:content",
          replacement: fileURLToPath(
            new URL("./node_modules/astro/dist/content/config.js", import.meta.url),
          ),
        },
      ],
    },
    test: {
      environment: "node",
      // IMP-05 correction: the integration suites spawn heavy media-derivation
      // subprocesses (sharp encodes, full pipeline runs, astro builds). With
      // unbounded file parallelism the host saturates and subprocess-based
      // tests become nondeterministic (hook timeouts, build failures). A
      // bounded worker count keeps the full battery reproducible.
      maxWorkers: 3,
      include: [
        "tests/unit/**/*.test.{ts,mts}",
        "tests/integration/**/*.test.{ts,mts}",
        "tests/bench/**/*.test.{ts,mts}",
        "tests/deploy/**/*.test.{ts,mts}",
      ],
    },
  }),
  astroViteConfig,
);
