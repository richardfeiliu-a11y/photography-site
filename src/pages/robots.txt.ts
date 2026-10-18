// src/pages/robots.txt.ts - robots endpoint (WP-44). Minimal valid robots
// with an absolute sitemap reference from the single site origin authority.
import type { APIRoute } from "astro";
import { buildSiteOrigin } from "../lib/seo/site";
import { renderRobots } from "../lib/seo/sitemap";

export const GET: APIRoute = () => {
  return new Response(renderRobots(buildSiteOrigin()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
