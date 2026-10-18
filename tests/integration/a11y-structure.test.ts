// WP-43 — structural accessibility audit over final production HTML.
//
// Authority: PRODUCTION_IMPLEMENTATION_PLAN WP-43 (systematic WCAG 2.2 AA
// verification; exactly one h1 per page, no skipped levels, landmarks,
// skip link to #main). Image alt semantics are EXCLUDED here — they belong
// to the WP-42 policy verdict (D11, sign-off pending); this suite asserts
// only structure. Reads dist/ (fresh production build required).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { collectSitemapPaths } from "../../src/lib/seo/sitemap";
import { composeArchiveValidation } from "../../src/lib/validate/production";
import { loadArchive } from "../../scripts/validate/content";
import { loadCollection } from "../support/content-layer";
import { entriesFromRedirectsFile, readRedirects } from "../../src/lib/content/redirects";
import { PROJECT_ROOT_URL } from "../support/content-layer";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

async function publishedPaths(): Promise<string[]> {
  const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
    mode: "production",
    ingestRoot: join(REPO_ROOT, "media/ingest-masters"),
  });
  expect(validation.ok).toBe(true);
  const { entries } = await loadCollection("galleries");
  const published = entries
    .map((e) => e.data as unknown as { slug: string; status: string })
    .filter((g) => g.status === "published");
  const redirectsFile = readRedirects(PROJECT_ROOT_URL);
  const redirectOldPaths = entriesFromRedirectsFile(redirectsFile.data).entries.map(
    (e) => e.oldPath,
  );
  return collectSitemapPaths({
    galleries: published.map((g) => ({ slug: g.slug, status: "published" })),
    places: validation.publishedDataSet.places.map((p) => ({ slug: p.slug })),
    redirectOldPaths,
  });
}

function distHtml(routePath: string): string {
  const file =
    routePath === "/"
      ? join(REPO_ROOT, "dist", "index.html")
      : join(REPO_ROOT, "dist", routePath.slice(1), "index.html");
  expect(existsSync(file), "fresh production build required: " + file).toBe(true);
  return readFileSync(file, "utf8");
}

function headings(html: string): Array<{ level: number; text: string }> {
  const out: Array<{ level: number; text: string }> = [];
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out.push({ level: Number(match[1]), text: (match[2] ?? "").replace(/<[^>]+>/g, "").trim() });
  }
  return out;
}

function bodyOf(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  return match ? (match[1] as string) : "";
}

describe("WP-43 document structure (all published pages)", () => {
  test("html lang is set", async () => {
    for (const routePath of await publishedPaths()) {
      const html = distHtml(routePath);
      expect(html, routePath).toMatch(/<html[^>]*lang="[a-z-]+"/);
    }
  });

  test("exactly one h1 per page, no skipped heading levels", async () => {
    for (const routePath of await publishedPaths()) {
      const found = headings(distHtml(routePath));
      expect(
        found.filter((h) => h.level === 1),
        routePath + " h1 count",
      ).toHaveLength(1);
      let prev = 0;
      for (const heading of found) {
        if (prev === 0) {
          expect(heading.level, routePath + " first heading").toBe(1);
        } else {
          expect(heading.level, routePath + " level skip").toBeLessThanOrEqual(prev + 1);
        }
        prev = heading.level;
      }
    }
  });

  test("landmarks header/nav/main/footer present with skip link first", async () => {
    for (const routePath of await publishedPaths()) {
      const body = bodyOf(distHtml(routePath));
      expect(body, routePath + " header").toContain("<header");
      expect(body, routePath + " nav").toContain("<nav");
      expect(body, routePath + " main").toContain("<main");
      expect(body, routePath + " footer").toContain("<footer");
      const firstFocusable = body.match(/<(a|button)[^>]*?(href|type)[^>]*?>/);
      expect(firstFocusable, routePath + " first focusable").not.toBeNull();
      expect(firstFocusable?.[0], routePath + " skip link first").toContain("#main");
    }
  });
});
