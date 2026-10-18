// scripts/release/redirect-validator.mjs — P9 裁定② 薄适配层。
//
// 只做三件事：组织输入（从隔离内容根目录构建 WP-12 注册表）、调用权威
// WP-12 模块（src/lib/content/redirects.ts）、处理结果。不复制任何校验逻辑
// —— draft、XOR、循环、冲突、canonical 碰撞检查全部以 WP-12 为唯一权威。
//
// WP-12 模块是 TS 源文件：所有调用方（redirects.mjs、测试、后续任务 2.1
// 的 assemble-release.mjs）都必须通过下列启动参数加载，禁止依赖终端继承的
// NODE_OPTIONS（子进程环境显式置空 NODE_OPTIONS=""）：
//
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs <入口>
//
// import 说明：
//   - WP-12 的 src/ 内部使用无扩展名相对 specifier（"../../content-schemas"），
//     裸 Node 不解析——必须经 register-ts-resolve.mjs（ts-resolve hook）把
//     "./x" 重试为 "./x.ts"。redirects.ts 的扩展名 ".ts" 必须显式写出。
//   - ts-resolve hook 文件是 ".mjs"（无 TS 语法）——用显式扩展名 import。
//   - buildRegistries 需要 js-yaml：redirects.ts 自身也依赖 js-yaml，所以
//     package.json 的 package exports 已注册该包——这里显式 import 同一包，
//     包解析一致。
//
// 内容根约定（裁定② —— redirects 与注册表必须来自同一隔离根）：
//   - contentRoot 是"内容仓库根"，其内部含 content/ 子目录：
//       <contentRoot>/content/redirects.yaml   ← readRedirects 以它为根 resolve
//       <contentRoot>/content/galleries/*/meta.yaml
//       <contentRoot>/content/places/*.yaml
//   - 该语义与 scripts/validate/content.ts 的 --content-root（仓库根）一致：
//     readRedirects 把第一参数当作 repo root，resolve <root>/content/redirects.yaml
//     （见 src/lib/content/redirects.ts WP-03 约定：fixed authored path）。
//   - CLI（redirects.mjs）的 --content <root> 即该仓库根，默认 ROOT。
import { readRedirects, entriesFromRedirectsFile, validateRedirects, resolveRedirects } from "../../src/lib/content/redirects.ts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";

/** 从 content root（含 galleries/ 与 places/）构建 WP-12 注册表（只有 slug/id/status）。 */
export function buildRegistries(contentRoot) {
  const galleries = [];
  const places = [];

  const galleriesDir = join(contentRoot, "galleries");
  if (existsSync(galleriesDir)) {
    for (const entry of readdirSync(galleriesDir)) {
      const metaPath = join(galleriesDir, entry, "meta.yaml");
      if (!existsSync(metaPath)) continue;
      const meta = load(readFileSync(metaPath, "utf8"));
      if (meta && typeof meta === "object" && meta.id && meta.slug)
        galleries.push({ id: String(meta.id), slug: String(meta.slug), status: meta.status ?? "published" });
    }
  }

  const placesDir = join(contentRoot, "places");
  if (existsSync(placesDir)) {
    for (const file of readdirSync(placesDir)) {
      if (!file.endsWith(".yaml")) continue;
      const place = load(readFileSync(join(placesDir, file), "utf8"));
      if (place && typeof place === "object" && place.id && place.slug)
        places.push({ id: String(place.id), slug: String(place.slug) });
    }
  }

  return { galleries, places };
}

/**
 * 权威验证 + 解析。返回 { ok, errors, resolved }；任何错误都 fail-closed。
 *
 * @param contentRoot 仓库根，其内容布局为 <contentRoot>/content/{redirects.yaml,
 *                    galleries, places} —— redirects 与注册表来自同一隔离根
 *                    （裁定②）。
 *                    抛错（redirects.yaml 缺失/坏 YAML）由调用方转 exit 1。
 */
export function validateRedirectsFromRoot(contentRoot) {
  const contentDir = join(contentRoot, "content");
  const { data } = readRedirects(contentRoot);
  const { entries, fileErrors } = entriesFromRedirectsFile(data);
  if (fileErrors.length) return { ok: false, errors: fileErrors.map((e) => e.message ?? String(e)), resolved: [] };

  const { galleries, places } = buildRegistries(contentDir);
  const result = validateRedirects(entries, { mode: "production", galleries, places });
  if (!result.ok) return { ok: false, errors: result.errors.map((e) => e.message ?? String(e)), resolved: [] };

  const resolved = resolveRedirects(entries, { mode: "production", galleries, places });
  return { ok: true, errors: [], resolved: resolved.redirects };
}
