#!/usr/bin/env python3
"""WP-05 coverage report — verify unicode-range honesty (PERFORMANCE_BUDGET §7.5).

Reads a compiled font (woff2/otf/ttf), dumps its ACTUAL cmap coverage as a
compact unicode-range string (the exact format used by CSS unicode-range),
plus glyph/codepoint counts. The ranges printed here are pasted into
src/styles/fonts.css so a declared range can never exceed what the served
file really contains, and any drift shows up in review.

    .venv/bin/python scripts/fonts/coverage-report.py public/fonts/... .woff2
"""

import sys

from fontTools.ttLib import TTFont


def codepoints(path):
    font = TTFont(path)
    cmap = font.getBestCmap()
    return sorted(cmap.keys()), font


def as_ranges(points):
    ranges = []
    for cp in points:
        if ranges and cp == ranges[-1][1] + 1:
            ranges[-1][1] = cp
        else:
            ranges.append([cp, cp])
    parts = []
    for lo, hi in ranges:
        parts.append(f"U+{lo:04X}" if lo == hi else f"U+{lo:04X}-{hi:04X}")
    return ", ".join(parts)


def main():
    for path in sys.argv[1:]:
        points, font = codepoints(path)
        flavor = font.flavor or "sfnt"
        print(f"# {path}")
        print(f"#   flavor={flavor} codepoints={len(points)} glyphs={font['maxp'].numGlyphs}")
        print(f"unicode-range: {as_ranges(points)};")
        print()


if __name__ == "__main__":
    main()
