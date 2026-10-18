#!/usr/bin/env node
// scripts/release/redirects.mjs — WP-52/WP-54: generate Nginx rewrite rules
// from content/redirects.yaml.
//
// Usage:
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs scripts/release/redirects.mjs
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs scripts/release/redirects.mjs --out deploy/nginx/redirects.conf
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs scripts/release/redirects.mjs --content <repo-root> [--out <file>]
//
// --content <repo-root>：内容仓库根（默认 ROOT），其内部含 content/：
//   <repo-root>/content/redirects.yaml  +  <repo-root>/content/galleries|places
//   （与 scripts/validate/content.ts 的 --content-root 语义一致）。
//
// P9 裁定②：本 CLI 不复制任何校验逻辑。redirects.yaml 的读取、shape 校验、
// draft 过滤、XOR、循环、冲突、canonical 碰撞全部委托给 WP-12 权威模块
// （src/lib/content/redirects.ts，经 scripts/release/redirect-validator.mjs 薄
// 适配层）。本脚本只做：解析参数 → 调用 validateRedirectsFromRoot → 把
// resolveRedirects 的 canonical destination 渲染成 Nginx rewrite 指令，并且
// fail-closed：任何错误 exit 1，不写输出。
//
// Unresolvable/dead rewrites abort the release: the release must not ship
// dead rewrites. Legal empty set (no redirect targets) → empty include.
//
// Non-production drill: operates on the local repo only.
import { validateRedirectsFromRoot } from "./redirect-validator.mjs";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));
const DEFAULT_CONTENT_ROOT = ROOT;
const DEFAULT_OUT = join(ROOT, "deploy", "nginx", "redirects.conf");

function main() {
  const args = process.argv.slice(2);
  let out = DEFAULT_OUT;
  let contentRoot = DEFAULT_CONTENT_ROOT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) out = resolve(args[i + 1]);
    else if (args[i] === "--content" && args[i + 1]) contentRoot = resolve(args[i + 1]);
  }

  let result;
  try {
    result = validateRedirectsFromRoot(contentRoot);
  } catch (e) {
    console.error(`[redirects] ${String((e && e.message) || e)}`);
    process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    console.error(`[redirects] ${result.errors.length} invalid redirect(s):`);
    for (const f of result.errors) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  // 有效空集合 → 写有效空 include（注释头）。
  const lines = ["# WP-52 — auto-generated from validated redirects", "# Do not edit by hand; regenerate with scripts/release/redirects.mjs", ""];
  for (const r of result.resolved) {
    const fromPath = r.oldPath.startsWith("/") ? r.oldPath : `/${r.oldPath}`;
    lines.push(`rewrite ^${fromPath}$ ${r.destination} permanent;`);
  }
  lines.push("");
  writeFileSync(out, lines.join("\n"));
  console.log(`[redirects] wrote ${result.resolved.length} rules -> ${out}`);
}

if (process.argv[1] && process.argv[1].endsWith("redirects.mjs")) {
  try {
    main();
  } catch (e) {
    console.error(String((e && e.stack) || e));
    process.exitCode = 1;
  }
}
