/*
 * src/lib/presentation/photographed-date.ts — the ONE photographed-date
 * display formatter (visual redesign spec §7). Presentation only: original
 * ISO date-only values are never rewritten, and full precision stays in
 * <time datetime> at the consuming component.
 *
 * Parsing contract: date-only ISO strings (YYYY-MM-DD) are parsed as UTC
 * (T00:00:00Z) — never via the local timezone, so a TZ=America/Los_Angeles
 * host cannot turn Jan 1 into Dec.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Parse a validated ISO date-only string as UTC. Returns the UTC month index and year. */
function parseUtcDateOnly(value: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`photographed-date: expected ISO date-only, got "${value}"`);
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`photographed-date: month out of range in "${value}"`);
  }
  return { year, month: monthIndex };
}

/**
 * Format a photographed date range (spec §7):
 *   2025-01-26                → "Jan 2025"
 *   2025-01-26 … 2025-01-27   → "Jan 2025"      (same month collapses)
 *   2024-12-26 … 2025-01-02   → "Dec 2024 - Jan 2025"
 *   2024-07-01 … 2024-08-30   → "Jul - Aug 2024"
 */
export function formatPhotographedDate(start: string, end?: string | null): string {
  const from = parseUtcDateOnly(start);

  if (end === undefined || end === null || end === "") {
    return `${MONTHS[from.month]} ${from.year}`;
  }

  const to = parseUtcDateOnly(end);
  const endIsBeforeStart =
    to.year < from.year ||
    (to.year === from.year && to.month < from.month);
  if (endIsBeforeStart) {
    // Degenerate range: fall back to the start value rather than inventing
    // an inverted range.
    return `${MONTHS[from.month]} ${from.year}`;
  }

  if (from.year === to.year && from.month === to.month) {
    return `${MONTHS[from.month]} ${from.year}`;
  }

  if (from.year === to.year) {
    return `${MONTHS[from.month]} - ${MONTHS[to.month]} ${from.year}`;
  }

  return `${MONTHS[from.month]} ${from.year} - ${MONTHS[to.month]} ${to.year}`;
}

/**
 * The long-month variant of the same contract (immersive direction: the
 * index surfaces — home cover, home strip, archive rows — spell the month in
 * full, "January 2025"). Same UTC parse, same collapse/degenerate rules as
 * formatPhotographedDate; only the month spelling differs.
 *
 *   2025-01-26                → "January 2025"
 *   2024-12-26 … 2025-01-02   → "December 2024 - January 2025"
 *   2024-07-01 … 2024-08-30   → "July - August 2024"
 */
export function formatPhotographedDateLong(start: string, end?: string | null): string {
  const from = parseUtcDateOnly(start);

  if (end === undefined || end === null || end === "") {
    return `${MONTHS_LONG[from.month]} ${from.year}`;
  }

  const to = parseUtcDateOnly(end);
  const endIsBeforeStart =
    to.year < from.year ||
    (to.year === from.year && to.month < from.month);
  if (endIsBeforeStart) {
    return `${MONTHS_LONG[from.month]} ${from.year}`;
  }

  if (from.year === to.year && from.month === to.month) {
    return `${MONTHS_LONG[from.month]} ${from.year}`;
  }

  if (from.year === to.year) {
    return `${MONTHS_LONG[from.month]} - ${MONTHS_LONG[to.month]} ${from.year}`;
  }

  return `${MONTHS_LONG[from.month]} ${from.year} - ${MONTHS_LONG[to.month]} ${to.year}`;
}
