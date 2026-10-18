// WP-06 e2e canary helper.
// The WP-02 placeholder page sets window.__qaCanary via an inline script.
// With JS enabled the global is set; with a javaScriptEnabled:false context
// page scripts never run — the canary stays unset (or evaluate itself is
// refused when the JS engine is disabled). Either observation proves that
// scripts are actually blocked.
import type { Page } from "@playwright/test";

export interface CanaryResult {
  /** true when page.evaluate executed at all */
  evaluated: boolean;
  value?: unknown;
  /** set when evaluate itself failed (JS engine disabled) */
  error?: string;
}

export async function readPageCanary(page: Page): Promise<CanaryResult> {
  try {
    const value = await page.evaluate(() => (window as { __qaCanary?: string }).__qaCanary);
    return { evaluated: true, value };
  } catch (error) {
    return { evaluated: false, error: String(error) };
  }
}
