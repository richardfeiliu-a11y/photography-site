// @ts-check
// ESLint 10 flat config (WP-02).
// Scope: JS build tooling (astro.config.mjs, scripts/, tests/, this file).
// .astro component lint rules (eslint-plugin-astro) may be added by later WPs;
// TypeScript type safety is enforced by `astro check` via `npm run check`.
export default [
  {
    ignores: [
      "dist/**",
      "dist-qa/**",
      ".serve-artifacts/**",
      "bench-output/**",
      // Deployment artifacts (built release trees + generated nginx rules);
      // both are gitignored and never lint targets, like dist itself.
      "releases/**",
      "www/**",
      "generated/**",
      "node_modules/**",
      ".venv/**",
      ".astro/**",
      "media/**",
      "research/**",
      // docs/ holds archival research/report/evidence scripts (several point at
      // removed worktrees); lint scope is build tooling, not archives.
      "docs/**",
      ".superpowers/**",
      // Local agent scratch. Git ignores it, but ESLint still scans untracked files.
      ".ua/**",
    ],
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-constant-condition": "error",
      eqeqeq: "error",
    },
  },
  {
    // Test-support scripts may contain Playwright evaluate() callbacks that
    // run in the BROWSER — those need DOM globals even though the file is Node.
    files: ["tests/**/*.mjs"],
    languageOptions: {
      globals: {
        fetch: "readonly",
        document: "readonly",
        window: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
      },
    },
  },
  {
    // WP-45: the perf harness embeds page.evaluate() callbacks that run in
    // the BROWSER (PerformanceObserver/performance) though the file is Node.
    files: ["scripts/perf/*.mjs"],
    languageOptions: {
      globals: {
        PerformanceObserver: "readonly",
        performance: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        requestAnimationFrame: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Element: "readonly",
      },
    },
  },
];
