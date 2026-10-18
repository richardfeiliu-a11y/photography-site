# Research Gaps & Next-Session Plan

## Status of this session (2026-08-26 final)

- 30 verified cases, 6 top-level docs
- 45 screenshot files (43 PNG + 1 PDF + 1 README), 38 valid renders across 17 sites
- All 9 High-relevance cases have at least 1 desktop screenshot
- 7 of 9 High cases also have a mobile capture

## Re-try results (batch 7)

| Site | Original | Retry outcome |
|------|----------|---------------|
| 010 James Maher | blank | SUCCESS - search/projects/prints/PDF all captured |
| 021 Stephen Shore | Unable to verify | CONFIRMED DEAD - both stephenshore.com and .net are parked; MoMA behind Cloudflare. Case file rewritten with this finding. |
| 025 Mick Rock | blank | CONFIRMED JS-RENDERED - retry blank; case file updated. |
| 015 Joel Sternfeld | blank | 4 ATTEMPTS BLANK - Vue SPA hydration unreachable by headless Chrome within time budget. Likely needs Puppeteer + manual click. |

## Remaining open gaps

1. Joel Sternfeld (015) - Vue SPA, no visual capture. 4 attempts. Lower priority - case 015 already has rich text evidence.
2. Chinese / Korean / Indian personal archives - 8 direct attempts failed; CN web is community-platform-dominated, not personal-archive-dominated. This is itself a documented finding (cases 029, 030).
3. Map-first personal archives - none found.
4. >2000-photo personal archives - only LOC and James Maher found, both institutional-leaning.
5. Lightbox / slideshow click states - not captured.
6. Mobile behavior of 4 blank SPA sites (015, 025, 022, 004) - not captured.

## Recommended next-session order
1. If a real browser controller is available, retry 015 Sternfeld with Puppeteer + wait-for-network-idle + click-into-first-image.
2. Search Chinese / Korean / Indian personal archive sites via local-language search engines (Baidu, Naver).
3. Search "photographer website interactive map" for any cases.

