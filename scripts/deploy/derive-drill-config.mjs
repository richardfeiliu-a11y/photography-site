#!/usr/bin/env node
// scripts/deploy/derive-drill-config.mjs — P9 F4: derive a drill nginx config
// from the DELIVERED site.conf by string substitution. This is the proof that
// the drill exercises the delivered configuration, not a hand-written
// simplified copy (F1 review finding: "另一份 HTTP 配置通过，不能证明交付
// 配置通过").
//
// Usage:
//   node scripts/deploy/derive-drill-config.mjs \
//     --template <deploy/nginx/site.conf> --out <drill-site.conf>
//     [--listen 127.0.0.1:18443] [--root <scratch>/www/current]
//     [--redirects <scratch>/www/redirects.conf]
//     [--pid <scratch>/logs/nginx.pid] [--error-log <scratch>/logs/error.log]
//     [--access-log <scratch>/logs/access.log]
//     [--certs-dir <worktree>/deploy/nginx/certs]
//     [--verify]   also run `nginx -t` on the derived config
//
// Only these environment-specific knobs are rewritten; every other directive
// (locations, cache policy, TLS settings, disable_symlinks, error_page,
// try_files, ...) is carried over byte-for-byte from the delivered template.
// The rewrite is a plain ordered string substitution, so the derived config
// stays structurally identical to the delivered one — the drill never becomes
// a second, simplified configuration that "backs" the delivered one.
//
// Non-production drill: loopback non-privileged port, scratch paths.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_NGINX = "/opt/homebrew/bin/nginx";

function main() {
  const args = process.argv.slice(2);
  let template = null;
  let out = null;
  let listen = "127.0.0.1:18443";
  let root = null;
  let redirects = null;
  let pid = null;
  let errorLog = null;
  let accessLog = null;
  let certsDir = null;
  let verify = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--template" && args[i + 1]) template = resolve(args[i + 1]);
    else if (args[i] === "--out" && args[i + 1]) out = resolve(args[i + 1]);
    else if (args[i] === "--listen" && args[i + 1]) listen = args[i + 1];
    else if (args[i] === "--root" && args[i + 1]) root = resolve(args[i + 1]);
    else if (args[i] === "--redirects" && args[i + 1]) redirects = resolve(args[i + 1]);
    else if (args[i] === "--pid" && args[i + 1]) pid = resolve(args[i + 1]);
    else if (args[i] === "--error-log" && args[i + 1]) errorLog = resolve(args[i + 1]);
    else if (args[i] === "--access-log" && args[i + 1]) accessLog = resolve(args[i + 1]);
    else if (args[i] === "--certs-dir" && args[i + 1]) certsDir = resolve(args[i + 1]);
    else if (args[i] === "--verify") verify = true;
  }
  if (!template || !out) {
    console.error(
      "usage: node scripts/deploy/derive-drill-config.mjs --template <site.conf> --out <drill.conf> [options]",
    );
    process.exitCode = 2;
    return;
  }
  if (!existsSync(template)) {
    console.error(`[derive-drill-config] template not found: ${template}`);
    process.exitCode = 1;
    return;
  }
  if (!root || !redirects || !pid || !errorLog || !accessLog || !certsDir) {
    console.error(
      "[derive-drill-config] --root/--redirects/--pid/--error-log/--access-log/--certs-dir are required",
    );
    process.exitCode = 2;
    return;
  }

  let source = readFileSync(template, "utf8");

  // R8/M2 — certificate paths: the template must NOT hard-code any checkout's
  // absolute path. Derivation rewrites the ssl_certificate{,_key} DIRECTIVE
  // lines with a prefix-anchored regex, so the template stays portable: a
  // template copied into a fresh clone derives with the SAME code path (the
  // old approach matched the literal absolute cert path of the original
  // checkout and failed with "token not found" anywhere else).
  function subCertLine(text, directive, to) {
    const re = new RegExp("^([ \\t]*" + directive + "\\s+)[^;]*;", "m");
    if (!re.test(text)) return null; // caller reports the missing token
    return text.replace(re, `$1${to};`);
  }

  // Rewrite the certificate directive lines first (regex, path-independent).
  // NOTE: rewrite ssl_certificate_key BEFORE ssl_certificate — the generic
  // directive's regex would otherwise also match the _key line's prefix.
  let certRewritten = subCertLine(source, "ssl_certificate_key", join(certsDir, "self-signed.key"));
  if (certRewritten === null) {
    console.error("[derive-drill-config] template token not found: ssl_certificate_key directive line");
    console.error(
      "[derive-drill-config] derivation aborted — the drill config would NOT be derived from this template",
    );
    process.exitCode = 1;
    return;
  }
  certRewritten = subCertLine(certRewritten, "ssl_certificate", join(certsDir, "self-signed.crt"));
  if (certRewritten === null) {
    console.error("[derive-drill-config] template token not found: ssl_certificate directive line");
    console.error(
      "[derive-drill-config] derivation aborted — the drill config would NOT be derived from this template",
    );
    process.exitCode = 1;
    return;
  }
  source = certRewritten;

  // Ordered substitutions — every rewrite is a documented, environment-only
  // knob. A missing expected token FAILS (never silently keeps the production
  // path): a successful derivation must be provably derived.
  const subs = [
    ["listen 8443 ssl", `listen ${listen} ssl`],
    ["root /var/www/current", `root ${root}`],
    ["include /var/www/redirects*.conf", `include ${redirects}`],
    ["pid /tmp/nginx-p9.pid", `pid ${pid}`],
    ["error_log stderr", `error_log ${errorLog}`],
    ["access_log /tmp/nginx-p9-access.log", `access_log ${accessLog}`],
  ].filter(([from]) => from !== null);

  let derived = source;
  for (const [from, to] of subs) {
    if (!derived.includes(from)) {
      console.error(`[derive-drill-config] template token not found: ${JSON.stringify(from)}`);
      console.error(
        "[derive-drill-config] derivation aborted — the drill config would NOT be derived from this template",
      );
      process.exitCode = 1;
      return;
    }
    derived = derived.split(from).join(to);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, derived);
  console.log(`[derive-drill-config] wrote ${out} (${derived.length} bytes, from ${template})`);

  if (verify) {
    // A drill config includes the redirects file. Before the FIRST redirect
    // activation there is no file yet, and nginx refuses an exact include of a
    // missing file — so, mirroring a host before first redirect publish, the
    // verify mode materializes an EMPTY placeholder beside the derived config
    // (its parent dir) and tests against it. This validates every other
    // directive of the derived config; the redirect include itself is a plain
    // rewrite line that nginx tests when the drill activates a redirect
    // (nginx -t + reload steps in nginx-coupled-rollback-drill.mjs).
    const redirectsPlaceholder = redirects;
    if (!existsSync(redirectsPlaceholder)) {
      mkdirSync(dirname(redirectsPlaceholder), { recursive: true });
      writeFileSync(redirectsPlaceholder, "# empty — pre-first-redirect-publish placeholder\n");
    }
    try {
      const nginx = process.env.NGINX_BIN || DEFAULT_NGINX;
      const out2 = execFileSync(nginx, ["-t", "-c", out], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      process.stdout.write(out2);
      console.log("[derive-drill-config] derived config nginx -t OK");
    } catch (e) {
      process.stderr.write(String((e && e.stderr) || e));
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("derive-drill-config.mjs")) {
  try {
    main();
  } catch (e) {
    console.error(String((e && e.stack) || e));
    process.exitCode = 1;
  }
}
