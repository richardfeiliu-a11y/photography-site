#!/usr/bin/env node
// scripts/fonts/coverage-check.mjs — build-time CJK coverage CLI (WP-46).
// Scans parsed YAML string values under --content, compares against the
// unicode-range declarations in --css (generated from actual cmaps), and
// fails closed in --mode production on uncovered characters outside the
// --allowlist (reviewed fallback acceptances). Preview mode warns only.
// Exit codes: 0 pass (or preview warnings), 1 uncovered in production,
// 2 usage/IO error.
import { loadAll as parseAllYaml } from "js-yaml";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { collectCodepoints, hexOf, parseCssFaces } from "./coverage.mjs";

function usage() {
  return "usage: coverage-check.mjs --content <dir> --css <file> --allowlist <file> --mode production|preview";
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key || !key.startsWith("--") || value === undefined) throw new Error(usage());
    args[key.slice(2)] = value;
  }
  if (
    !args.content ||
    !args.css ||
    !args.allowlist ||
    (args.mode !== "production" && args.mode !== "preview")
  ) {
    throw new Error(usage());
  }
  return args;
}

function yamlFiles(dir, into) {
  const found = into || [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yamlFiles(full, found);
    else if (entry.endsWith(".yaml")) found.push(full);
  }
  return found;
}

function parseAllowlist(text) {
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const token = line.split("#")[0].trim().replace(/^U\+/i, "");
    if (!token) continue;
    const cp = parseInt(token, 16);
    if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff)
      throw new Error("[WP-46:allowlist] invalid entry: " + line);
    set.add(cp);
  }
  return set;
}

function main(argv) {
  const args = parseArgs(argv);
  for (const [label, path] of [
    ["content", args.content],
    ["css", args.css],
    ["allowlist", args.allowlist],
  ]) {
    if (!existsSync(path)) {
      console.error("[WP-46:coverage] missing " + label + ": " + path);
      process.exitCode = 2;
      return;
    }
  }
  const cssText = readFileSync(args.css, "utf8");
  const allowlist = parseAllowlist(readFileSync(args.allowlist, "utf8"));
  const found = new Map();
  let files = 0;
  for (const file of yamlFiles(args.content)) {
    files += 1;
    const docs = parseAllYaml(readFileSync(file, "utf8"));
    collectCodepoints(docs, file, found);
  }
  const faces = parseCssFaces(cssText);
  const served = new Set();
  for (const face of faces) for (const cp of face.ranges) served.add(cp);
  const uncovered = [];
  const accepted = [];
  for (const [cp, rec] of found) {
    if (served.has(cp)) continue;
    if (allowlist.has(cp)) {
      accepted.push(hexOf(cp));
      continue;
    }
    uncovered.push({ cp, hex: hexOf(cp), count: rec.count, sources: rec.sources });
  }
  uncovered.sort((a, b) => a.cp - b.cp);
  accepted.sort();
  console.log(
    "[WP-46:coverage] files=" + files + " content-cps=" + found.size + " served-cps=" + served.size,
  );
  for (const hex of accepted) console.log("[WP-46:coverage] accepted-fallback " + hex);
  for (const item of uncovered) {
    console.log(
      "[WP-46:coverage] UNCOVERED " +
        item.hex +
        " count=" +
        item.count +
        " e.g. " +
        item.sources.slice(0, 3).join(", "),
    );
  }
  if (uncovered.length === 0) return;
  if (args.mode === "production") {
    console.error(
      "[WP-46:coverage] FAIL-CLOSED: " +
        uncovered.length +
        " authored character(s) outside the served subset (see UNCOVERED above).",
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    "[WP-46:coverage] preview: " + uncovered.length + " uncovered character(s) listed as warnings.",
  );
}

const isMain = process.argv[1] && process.argv[1].endsWith("coverage-check.mjs");
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(String((error && error.message) || error));
    process.exitCode = 2;
  }
}
