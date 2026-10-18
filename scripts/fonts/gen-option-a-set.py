#!/usr/bin/env python3
"""WP-05 Option A — broad static CJK subset definition (pinned, deterministic).

PERFORMANCE_BUDGET.md §7.4 Option A: "Select a broad character set covering
expected usage (e.g., GB2312-level common characters plus known place-name
glyphs). Pin the subset definition in version control."

This generator is stdlib-only and fully deterministic; its output is committed
alongside it (option-a-sc-unicodes.txt) so the served subset definition is
pinned in version control and diffable:

    python3 scripts/fonts/gen-option-a-set.py > scripts/fonts/option-a-sc-unicodes.txt

Composition:
  1. U+0020-007E   Basic Latin (fallback range parity with the Latin faces)
  2. U+2013-2014   en/em dash, U+2018-2019 quotes, U+201C-201D quotes,
                   U+2026 ellipsis, U+00B7 middle dot  (mixed-title punctuation)
  3. U+3000-303F   CJK Symbols and Punctuation (、。〈〉《》「」etc.)
  4. U+FF01-FF60   Fullwidth forms (，！？：；（）etc.)
  5. GB2312 level 1 (0xB0A1-0xD7F9, 3755 hanzi, pinyin order) + level 2
     (0xD8A1-0xF7FE, 3008 hanzi) = 6763 common characters, generated from the
     Python stdlib 'gb2312' codec (no data file, no network).

Deliberately NOT included (proof of honesty for the §7.5 fallback rule):
GBK-only and CJK Extension glyphs such as 喆 (U+5586) — these must fall back
to the platform CJK stack.
"""

RANGES = [
    (0x0020, 0x007E),
    (0x2013, 0x2014),
    (0x2018, 0x2019),
    (0x201C, 0x201D),
    (0x2026, 0x2026),
    (0x00B7, 0x00B7),
    (0x3000, 0x303F),
    (0xFF01, 0xFF60),
]


def gb2312_hanzi():
    chars = []
    for hi in range(0xB0, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.append(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                continue
    return chars


def main():
    points = set()
    for lo, hi in RANGES:
        points.update(range(lo, hi + 1))
    for ch in gb2312_hanzi():
        points.add(ord(ch))
    for cp in sorted(points):
        print(f"{cp:04X}")


if __name__ == "__main__":
    main()
