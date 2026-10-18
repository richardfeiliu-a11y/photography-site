/**
 * Pure settlement predicate for one-shot entrance reveals (R4 F5): returns
 * null when every element finished (opacity 1 AND identity transform),
 * otherwise a diagnostic listing unsettled elements. Kept module-pure so the
 * two-direction contract is unit-testable without a browser.
 */
export interface RevealStyleSample {
  opacity: string;
  transform: string;
  describe: string;
}

export function revealSettlementError(
  styles: ReadonlyArray<RevealStyleSample>,
): string | null {
  const unsettled = styles.filter(
    (s) =>
      parseFloat(s.opacity) !== 1 ||
      !(s.transform === "none" || s.transform === "matrix(1, 0, 0, 1, 0, 0)"),
  );
  if (unsettled.length === 0) return null;
  return unsettled.map((s) => s.describe).join("; ");
}
