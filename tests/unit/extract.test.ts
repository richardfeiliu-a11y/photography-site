// WP-18 — pure unit tests for the orientation dimension helper inside the
// metadata extractor (IMAGE_PIPELINE.md §5 stage 2: the raw EXIF orientation
// tag swaps intrinsic width/height for tags 5–8; sharp only applies it when
// .rotate() is called, so the extractor must compute display dims itself).
import { describe, expect, test } from "vitest";
import { orientedDimensions } from "../../scripts/media/extract";

describe("WP-18 orientedDimensions (EXIF orientation 1–8 semantics)", () => {
  test("tags 1–4 keep stored dimensions", () => {
    for (const orientation of [1, 2, 3, 4] as const) {
      expect(orientedDimensions(1365, 2048, orientation)).toEqual({
        width: 1365,
        height: 2048,
      });
    }
  });

  test("tags 5–8 swap stored dimensions (90°/270° rotations + transpositions)", () => {
    for (const orientation of [5, 6, 7, 8] as const) {
      expect(orientedDimensions(1365, 2048, orientation)).toEqual({
        width: 2048,
        height: 1365,
      });
    }
  });

  test("square sources are unchanged under any tag", () => {
    expect(orientedDimensions(512, 512, 6)).toEqual({ width: 512, height: 512 });
  });
});
