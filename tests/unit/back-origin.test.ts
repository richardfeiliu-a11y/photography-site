// IMP-04 — Back-to-origin allowlist resolution (unit).
//
// Contract (final targeted correction): valid Gallery discovery origins are
// ONLY Home (/), Journeys (/archive), and a REAL canonical Place route
// (/places/{published-place-slug}). Everything else — arbitrary /places/*
// segments, other same-origin routes, external URLs, malformed input, no
// referrer — resolves to the frozen safe fallback (/archive,
// "Back to Journeys"). The allowlist is data-derived (the place slugs that
// actually produce /places/{slug} routes in the current build mode), never
// hardcoded fixture data and never a regex on /places/*.
//
// The browser script (backOriginScript) embeds the SAME core rules as the
// unit-tested resolver — the core is a single ES5 source string evaluated
// in both contexts, so script and resolver cannot diverge.
import { describe, expect, test } from "vitest";
import { resolveBackOrigin, backOriginScript, BACK_ORIGIN_FALLBACK } from "../../src/lib/back-origin";

const ORIGIN = "https://archive.example";
const PLACE_SLUGS = ["reine", "tromso", "jiezi-ancient-town"];

describe("IMP-04 back-origin resolution — accepted discovery origins", () => {
  test("Home (/) resolves to Back to Home", () => {
    expect(resolveBackOrigin(`${ORIGIN}/`, ORIGIN, PLACE_SLUGS)).toEqual({
      href: "/",
      label: "Back to Home",
    });
  });

  test("Journeys (/archive and /archive subpaths) resolves to Back to Journeys", () => {
    expect(resolveBackOrigin(`${ORIGIN}/archive`, ORIGIN, PLACE_SLUGS)).toEqual({
      href: "/archive",
      label: "Back to Journeys",
    });
    expect(resolveBackOrigin(`${ORIGIN}/archive/`, ORIGIN, PLACE_SLUGS)).toEqual({
      href: "/archive",
      label: "Back to Journeys",
    });
  });

  test("a REAL canonical Place route resolves to Back to Place with its own href", () => {
    expect(resolveBackOrigin(`${ORIGIN}/places/reine`, ORIGIN, PLACE_SLUGS)).toEqual({
      href: "/places/reine",
      label: "Back to Place",
    });
  });
});

describe("IMP-04 back-origin resolution — everything else falls back to /archive", () => {
  const fallback = { href: "/archive", label: "Back to Journeys" };

  test.each([
    ["no referrer", "", ORIGIN],
    ["malformed referrer", "not-a-url", ORIGIN],
    ["external URL", "https://elsewhere.example/page", ORIGIN],
    ["fake Place route", `${ORIGIN}/places/not-real`, ORIGIN],
    ["other Gallery route", `${ORIGIN}/galleries/lofoten-light`, ORIGIN],
    ["same-origin arbitrary route", `${ORIGIN}/about`, ORIGIN],
    ["QA probe route", `${ORIGIN}/qa-probe`, ORIGIN],
    ["place root without slug", `${ORIGIN}/places/`, ORIGIN],
    ["place path with traversal segments", `${ORIGIN}/places/../galleries/x`, ORIGIN],
  ])("%s falls back to /archive", (_name, referrer, origin) => {
    expect(resolveBackOrigin(referrer, origin, PLACE_SLUGS)).toEqual(fallback);
  });

  test("the fallback constant itself is the frozen safe target", () => {
    expect(BACK_ORIGIN_FALLBACK).toEqual({ href: "/archive", label: "Back to Journeys" });
  });

  test("an allowlist entry that is NOT a real place must not be accepted (data-derived, not hardcoded)", () => {
    expect(resolveBackOrigin(`${ORIGIN}/places/not-real`, ORIGIN, PLACE_SLUGS)).toEqual(fallback);
  });
});

describe("IMP-04 shared browser script embeds the same core", () => {
  test("backOriginScript embeds the data-derived allowlist and updates BOTH links", () => {
    const script = backOriginScript(PLACE_SLUGS);
    expect(script).toContain(JSON.stringify(PLACE_SLUGS));
    // One shared driver: header + ending links are refined by the same
    // resolved origin.
    expect(script).toContain(".gallery-header .back-to-origin");
    expect(script).toContain(".gallery-ending a.origin-link");
    expect(script).toContain("textContent");
    // The Browse Archive link is never rewritten.
    expect(script).toContain("data-browse-archive");
  });
});
