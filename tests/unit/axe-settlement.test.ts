// R4 F5: minimal two-direction verification for the reveal settlement
// predicate used by the a11y scan protocol. The inverted predecessor
// (waitForFunction returning the unsettled list) resolved the wait while
// elements were still fading and kept waiting when everything WAS settled —
// both directions must now behave correctly.
import { describe, expect, it } from "vitest";
import { revealSettlementError } from "../../tests/support/reveal-settlement";

describe("revealSettlementError", () => {
  it("returns null when every element is fully revealed (the must-pass direction)", () => {
    const settled = [
      { opacity: "1", transform: "none", describe: "a" },
      { opacity: "1", transform: "matrix(1, 0, 0, 1, 0, 0)", describe: "b" },
    ];
    expect(revealSettlementError(settled)).toBeNull();
    expect(revealSettlementError([])).toBeNull();
  });

  it("reports unsettled elements (the must-fail direction)", () => {
    const pending = [
      { opacity: "0", transform: "none", describe: "photo-0" },
      { opacity: "1", transform: "none", describe: "photo-1" },
    ];
    expect(revealSettlementError(pending)).toBe("photo-0");
    const midFade = [
      { opacity: "0.5", transform: "none", describe: "photo-0" },
      { opacity: "1", transform: "matrix(0.9, 0, 0, 1, 0, -4)", describe: "photo-1" },
    ];
    const err = revealSettlementError(midFade);
    expect(err).toContain("photo-0");
    expect(err).toContain("photo-1");
  });
});
