// WP-13 — Node module-resolution hook for running the TypeScript CLI
// (scripts/validate/content.ts) directly under `node --experimental-strip-types`.
//
// Why: Node's type stripping runs TS files natively but keeps the ESM rule
// that import specifiers must be exact — the src/ modules use extensionless
// relative specifiers ("../../content-schemas"), which Vitest/Astro resolve
// but bare Node does not. This hook retries failed relative resolutions with
// a ".ts" extension. Registered via scripts/validate/register-ts-resolve.mjs
// (`--import`), it changes nothing about how modules execute.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const canExtend =
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.[cm]?[jt]s$/.test(specifier);
    if (canExtend) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}
