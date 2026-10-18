// WP-33/WP-35 — the §3.1 media-frame layout context, ONE shared definition
// (selector binding + img sizes attribute cannot drift).
export const MEDIA_FRAME_SIZES_VALUE = "(min-width: 900px) min(90vw, 1440px), 90vw";

// WP-39 — the G6 Overview light-table layout context, ONE shared definition
// (mirrors the overview.css grid contracts: 3-col mobile, 5-col <=1100px,
// 6-col desktop). Templates supply it to the overview-purpose selectors;
// the selector never computes sizes (IMAGE_PIPELINE §10.4).
export const OVERVIEW_SIZES_VALUE =
  "(max-width: 899px) 33vw, (max-width: 1100px) 20vw, 16vw";
