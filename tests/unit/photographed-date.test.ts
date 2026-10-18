// Unit contract for the photographed-date display formatter
// (visual redesign spec §7 table + timezone robustness).
import { describe, expect, it } from "vitest";
import { formatPhotographedDate } from "../../src/lib/presentation/photographed-date";

describe("formatPhotographedDate", () => {
  it("single date renders month + year", () => {
    expect(formatPhotographedDate("2025-01-26")).toBe("Jan 2025");
  });

  it("a same-month range collapses to one month + year", () => {
    expect(formatPhotographedDate("2025-01-26", "2025-01-27")).toBe("Jan 2025");
    expect(formatPhotographedDate("2025-01-01", "2025-01-31")).toBe("Jan 2025");
  });

  it("a cross-year range spells both ends", () => {
    expect(formatPhotographedDate("2024-12-26", "2025-01-02")).toBe(
      "Dec 2024 - Jan 2025",
    );
  });

  it("a same-year cross-month range keeps one year", () => {
    expect(formatPhotographedDate("2024-07-03", "2024-08-21")).toBe("Jul - Aug 2024");
  });

  it("december-only edge dates stay in their own month regardless of host TZ", () => {
    // UTC-8 hosts must not pull Jan 1 back into December, and UTC+8 hosts
    // must not push Dec 31 into January: parsing is pinned to UTC.
    expect(formatPhotographedDate("2025-01-01")).toBe("Jan 2025");
    expect(formatPhotographedDate("2024-12-31")).toBe("Dec 2024");
  });

  it("empty/null end behaves like a single date", () => {
    expect(formatPhotographedDate("2025-01-26", null)).toBe("Jan 2025");
    expect(formatPhotographedDate("2025-01-26", "")).toBe("Jan 2025");
  });

  it("a degenerate inverted range falls back to the start month", () => {
    expect(formatPhotographedDate("2025-01-26", "2024-12-01")).toBe("Jan 2025");
  });

  it("rejects non date-only inputs loudly (parse contract, not silent guessing)", () => {
    expect(() => formatPhotographedDate("2025-01")).toThrow();
    expect(() => formatPhotographedDate("not-a-date")).toThrow();
  });
});
