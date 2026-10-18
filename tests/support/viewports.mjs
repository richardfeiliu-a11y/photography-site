// Frozen capture/e2e viewport presets (TESTING_AND_VISUAL_REGRESSION.md §8.1):
// desktop 1440x900 and mobile 390x844 logical pixels, deviceScaleFactor = 1.
// Single source of truth shared by Playwright projects (TS) and the capture
// runner (plain Node) — hence plain .mjs with JSDoc types.
/** @typedef {{width: number, height: number}} Viewport */

/** @type {Viewport} Desktop capture/test preset (logical pixels). */
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

/** @type {Viewport} Mobile portrait capture/test preset (logical pixels). */
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** @type {Viewport} Short-desktop review preset (cinematic homepage mock:
 * direction doc §6 asks for 1280x720 samples alongside the 1440x900 one). */
export const DESKTOP_1280_VIEWPORT = { width: 1280, height: 720 };

/** @type {Viewport} Narrow reflow preset (FINAL_DESIGN_SPECIFICATION §4.2: 320px scrollWidth ≤ 320). */
export const NARROW_VIEWPORT = { width: 320, height: 740 };

/** Frozen deviceScaleFactor for all captures and test contexts. */
export const CAPTURE_DEVICE_SCALE_FACTOR = 1;
