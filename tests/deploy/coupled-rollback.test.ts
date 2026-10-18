// P9 F4 — coupled release + redirect rollback invariants (§3.3) against a
// REAL local nginx process, driven by the DELIVERED configuration.
//
// This suite exercises DEPLOYMENT_ARCHITECTURE §3.3 core invariants with a
// real nginx (independent loopback process on a non-privileged port), a drill
// config DERIVED from deploy/nginx/site.conf by scripts/deploy/
// derive-drill-config.mjs — never a hand-written simplified copy:
//   1. Derivation: the drill config is derived from the delivered template by
//      string substitution (only environment paths/ports change).
//   2. §3.3.5: a content-only release switch does NOT reload nginx (worker
//      PID unchanged) and serves the new content.
//   3. §3.3.6: a redirect change does nginx -t + reload and serves the new
//      301 for a representative historical path.
//   4. §3.3.7: after an activated release fails smoke, BOTH the exact
//      previous release AND the exact previous redirect config are restored,
//      nginx reloaded, and old content + old 301 verified.
//
// If the environment cannot run nginx (no brew binary / port unavailable),
// the suite is skipped with a note — the acceptance evidence is then the
// drill script scripts/deploy/nginx-coupled-rollback-drill.mjs, which runs
// the full 8-step §3.3 lifecycle against the same delivered configuration.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { runDeployTransaction } from "../../scripts/deploy/deploy-transaction.mjs";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const TEMPLATE = join(REPO_ROOT, "deploy", "nginx", "site.conf");
const CERTS = join(REPO_ROOT, "deploy", "nginx", "certs");
const DERIVE = join(REPO_ROOT, "scripts", "deploy", "derive-drill-config.mjs");
const NGINX_BIN = process.env.NGINX_BIN || "/opt/homebrew/bin/nginx";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function nginxAvailable(): { ok: boolean; reason?: string } {
  try {
    execFileSync(NGINX_BIN, ["-v"], { stdio: ["ignore", "pipe", "ignore"] });
    return { ok: true };
  } catch {
    return { ok: false, reason: `nginx binary not usable: ${NGINX_BIN}` };
  }
}

function run(cmd: string, args: string[]): string {
  // nginx -t prints "syntax is ok" to stderr; merge stderr so assertions on
  // test output see it.
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** nginx -t against a config; returns stdout+stderr (nginx -t speaks stderr). */
function nginxTest(confPath: string): string {
  const res = spawnSync(NGINX_BIN, ["-t", "-c", confPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return String((res.stdout || "") + (res.stderr || "")).trim();
}

/** curl helper: parses the FIRST response block only. */
function curl(listen: string, path: string) {
  const [host, port] = listen.split(":");
  const out = execFileSync(
    "curl",
    ["-sk", "--max-time", "3", "-i", `https://${host}:${port}${path}`],
    {
      encoding: "utf8",
    },
  );
  const headerBlock = out.slice(0, out.search(/\r?\n\r?\n/));
  const m = headerBlock.match(/^HTTP\/\S+ (\d+)/m);
  const status = m ? Number(m[1]) : 0;
  const loc = (headerBlock.match(/^location: (.+)$/im) || [])[1] || "";
  const body = out.slice(out.search(/\r?\n\r?\n/) + 4);
  return { status, location: loc, body };
}

/** Child worker PIDs of the nginx master (ppid match, not ps -g). */
function workerPids(master: number): number[] {
  const out = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
  const res: number[] = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    if (Number(m[2]) === master && /nginx/.test(m[3])) res.push(Number(m[1]));
  }
  return res;
}

function waitForBehavior(listen: string, path: string, expectStatus: number, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = curl(listen, path);
    if (r.status === expectStatus) return r;
    execFileSync("/bin/sh", ["-c", "sleep 0.05"], { stdio: "ignore" });
  }
  const last = curl(listen, path);
  throw new Error(
    `behavior did not settle: expected ${expectStatus} for ${path}, last=${last.status} ${last.location || ""}`,
  );
}

function makeRelease(dir: string, name: string, indexHtml: string) {
  const d = join(dir, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "index.html"), indexHtml);
  writeFileSync(
    join(d, "manifest.json"),
    JSON.stringify({
      files: [{ path: "index.html", sha256: sha256(indexHtml) }],
    }),
  );
}

function setCurrent(www: string, releases: string, name: string) {
  const tmp = join(www, ".current-new");
  try {
    unlinkSync(tmp);
  } catch {}
  symlinkSync(join(releases, name), tmp);
  renameSync(tmp, join(www, "current"));
}

function currentTarget(www: string): string | null {
  const cur = join(www, "current");
  if (!existsSync(cur)) return null;
  return readlinkSync(cur).split("/").pop() || null;
}

const ng = nginxAvailable();
const skip = !ng.ok;

describe.skipIf(skip)("P9 F4 coupled rollback (§3.3, real nginx)", () => {
  let scratch: string;
  let www: string;
  let logs: string;
  let certs: string;
  let releases: string;
  let conf: string;
  let pidFile: string;
  let listen: string;
  let masterPid = 0;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), "p9-coupled-rollback-"));
    // unique loopback port per run to avoid clashes between concurrent suites
    const port = 19000 + (process.pid % 1000);
    listen = `127.0.0.1:${port}`;
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  // Rebuild the scratch layout before each test: tests stop nginx but the
  // per-test filesystem state (releases, redirects, certs) is refreshed.
  beforeEach(() => {
    rmSync(scratch, { recursive: true, force: true });
    www = join(scratch, "www");
    logs = join(scratch, "logs");
    certs = join(scratch, "certs");
    releases = join(www, "releases");
    conf = join(scratch, "drill-site.conf");
    pidFile = join(logs, "nginx.pid");
    for (const d of [www, logs, certs, releases]) mkdirSync(d, { recursive: true });
    cpSync(join(CERTS, "self-signed.crt"), join(certs, "self-signed.crt"));
    cpSync(join(CERTS, "self-signed.key"), join(certs, "self-signed.key"));
    // The drill config is DERIVED from the delivered template for every test
    // (only environment paths/ports change) — the same derivation the drill
    // script uses, so every test exercises the delivered configuration.
    run("node", [
      DERIVE,
      "--template",
      TEMPLATE,
      "--out",
      conf,
      "--listen",
      listen,
      "--root",
      join(www, "current"),
      "--redirects",
      join(www, "redirects.conf"),
      "--pid",
      pidFile,
      "--error-log",
      join(logs, "error.log"),
      "--access-log",
      join(logs, "access.log"),
      "--certs-dir",
      certs,
    ]);
  });

  afterEach(() => {
    if (masterPid) {
      try {
        execFileSync(NGINX_BIN, ["-s", "quit", "-c", conf], { stdio: "ignore" });
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          try {
            process.kill(masterPid, 0);
          } catch {
            masterPid = 0;
            break;
          }
          execFileSync("/bin/sh", ["-c", "sleep 0.05"], { stdio: "ignore" });
        }
        if (masterPid) {
          try {
            process.kill(masterPid, "SIGKILL");
          } catch {}
        }
      } catch {}
      masterPid = 0;
    }
  });

  function startNginx() {
    const proc = spawn(NGINX_BIN, ["-c", conf], { stdio: ["ignore", "ignore", "pipe"] });
    proc.on("error", (e) => {
      throw new Error(`nginx spawn error: ${String(e)}`);
    });
    // nginx writes the pid file asynchronously after binding — poll for it
    const deadline = Date.now() + 5000;
    let pid = 0;
    while (Date.now() < deadline) {
      if (existsSync(pidFile)) {
        const raw = Number(readFileSync(pidFile, "utf8").trim());
        if (raw > 0) {
          pid = raw;
          break;
        }
      }
      execFileSync("/bin/sh", ["-c", "sleep 0.05"], { stdio: "ignore" });
    }
    if (!pid) throw new Error("nginx did not write a pid file in time");
    masterPid = pid;
    return pid;
  }

  test("derivation: drill config derives from the delivered template", () => {
    // beforeEach already derived the config from the delivered template.
    const derived = readFileSync(conf, "utf8");
    // environment knobs rewritten
    expect(derived).toContain(`listen ${listen} ssl`);
    expect(derived).toContain(`root ${join(www, "current")}`);
    expect(derived).toContain(`include ${join(www, "redirects.conf")}`);
    expect(derived).toContain(`pid ${pidFile}`);
    // delivered security directive survives verbatim (F1 syntax)
    expect(derived).toContain("disable_symlinks if_not_owner from=$document_root;");
    // no production paths leak into the ACTUAL DIRECTIVES (the template's
    // leading comment documents the production layout and is preserved as-is)
    expect(derived).not.toContain("root /var/www/current");
    expect(derived).not.toContain("include /var/www/");
    expect(derived).not.toContain("pid /tmp/nginx-p9.pid");
    expect(derived).not.toContain("listen 8443 ssl");
    // the derived config must pass nginx -t (empty redirects placeholder)
    writeFileSync(join(www, "redirects.conf"), "# empty\n");
    const out = nginxTest(conf);
    expect(out).toContain("syntax is ok");
  });

  test("content-only release: no reload, new content served (§3.3.5)", () => {
    writeFileSync(join(www, "redirects.conf"), "# empty\n");
    makeRelease(releases, "rel-A", "<html>rel-A</html>");
    setCurrent(www, releases, "rel-A");
    startNginx();

    const r1 = curl(listen, "/");
    expect(r1.status).toBe(200);
    expect(r1.body).toContain("rel-A");

    // content-only switch — no nginx -t, no reload
    const pidBefore = workerPids(masterPid);
    makeRelease(releases, "rel-B", "<html>rel-B</html>");
    setCurrent(www, releases, "rel-B");
    const pidAfter = workerPids(masterPid);
    expect(pidAfter).toEqual(pidBefore); // worker set unchanged => no reload

    const r2 = curl(listen, "/");
    expect(r2.status).toBe(200);
    expect(r2.body).toContain("rel-B");
  });

  test("redirect change: nginx -t + reload + new 301 (§3.3.3-6)", () => {
    writeFileSync(join(www, "redirects.conf"), "# empty\n");
    makeRelease(releases, "rel-A", "<html>rel-A</html>");
    setCurrent(www, releases, "rel-A");
    startNginx();

    // candidate redirects B adds /old-west
    const confB = join(scratch, "candidate-B.conf");
    writeFileSync(
      confB,
      [
        "# B",
        "rewrite ^/old-north$ /galleries/north permanent;",
        "rewrite ^/old-west$ /galleries/west permanent;",
        "",
      ].join("\n"),
    );

    // §3.3.3 test before activation
    writeFileSync(join(www, "redirects.conf"), readFileSync(confB));
    const t = nginxTest(conf);
    expect(t).toContain("syntax is ok");

    // §3.3.4/5 activate with release + reload
    run(NGINX_BIN, ["-s", "reload", "-c", conf]);
    // §3.3.6 smoke: representative historical path returns 301
    const r = waitForBehavior(listen, "/old-west", 301);
    expect(r.status).toBe(301);
    expect(r.location).toContain("/galleries/west");
  });

  // R9/F2 — smoke THROWS (not {ok:false}) after C became live: the same
  // unified restore must reload nginx back to B and re-verify the OLD HTTP
  // behavior. Guards against a disk-only rollback being reported as a
  // complete coupled rollback.
  test("R9/F2: smoke throw after activation reloads previous config AND verifies old 301 (§3.3.7)", () => {
    writeFileSync(join(www, "redirects.conf"), "# B\nrewrite ^/old-south$ /galleries/south permanent;\n");
    makeRelease(releases, "rel-B", "<html>rel-B</html>");
    setCurrent(www, releases, "rel-B");
    startNginx();
    // B live: old-south 301 observable
    run(NGINX_BIN, ["-s", "reload", "-c", conf]);
    waitForBehavior(listen, "/old-south", 301);

    // candidate C: DROPS the /old-south rule (config regression) and serves
    // different content — activating it must be fully reversible even when
    // the smoke check dies with an exception.
    makeRelease(releases, "rel-C", "<html>rel-C</html>");
    const confC = join(scratch, "candidate-C-r9.conf");
    writeFileSync(confC, "# C — no rules\n");
    const txp = runDeployTransaction({
      root: www,
      release: join(releases, "rel-C"),
      candidateRedirects: confC,
      liveRedirects: join(www, "redirects.conf"),
      nginxConf: conf,
      nginxBin: NGINX_BIN,
      smoke: async () => {
        throw new Error("synthetic smoke exception (R9/F2 regression)");
      },
    });
    return txp.then((tx) => {
      expect(tx.ok).toBe(false);
      expect(tx.rolledBack).toBe(true);
      expect(tx.rollbackError).toBeNull();
      // current symlink restored to B
      expect(currentTarget(www)).toBe("rel-B");
      // live include bytes restored to B's config
      expect(readFileSync(join(www, "redirects.conf"), "utf8")).toContain("/old-south");
      // nginx actually reloaded back: old 301 observable again (real HTTP)
      const rr = waitForBehavior(listen, "/old-south", 301);
      expect(rr.location).toContain("/galleries/south");
      const r = curl(listen, "/");
      expect(r.body).toContain("rel-B");
    });
  });

  // R9/F2 — first publish + smoke throw: back to NEVER-DEPLOYED (option A):
  // no current symlink, no new include, nothing activated. The transaction
  // is exercised in filesystem mode here (the real-nginx sibling test above
  // covers the full reload/HTTP path); option A semantics are about DISK
  // state and do not depend on a running server.
  test("R9/F2: first-publish smoke throw returns to never-deployed state (option A)", () => {
    // no current, no include — first publish
    makeRelease(releases, "rel-A", "<html>rel-A</html>");
    const confA = join(scratch, "candidate-A-r9.conf");
    writeFileSync(confA, "# A\nrewrite ^/old-a$ /galleries/ok permanent;\n");
    const txp = runDeployTransaction({
      root: www,
      release: join(releases, "rel-A"),
      candidateRedirects: confA,
      liveRedirects: join(www, "redirects.conf"),
      skipNginxTest: true,
      smoke: async () => {
        throw new Error("synthetic first-publish exception (R9/F2)");
      },
    });
    return txp.then((tx) => {
      expect(tx.ok).toBe(false);
      expect(tx.rolledBack).toBe(true);
      expect(existsSync(join(www, "current"))).toBe(false);
      expect(existsSync(join(www, "redirects.conf"))).toBe(false);
    });
  });

  test("coupled rollback restores BOTH previous release and redirects (§3.3.7)", () => {
    writeFileSync(join(www, "redirects.conf"), "# empty\n");
    makeRelease(releases, "rel-A", "<html>rel-A</html>");
    setCurrent(www, releases, "rel-A");
    startNginx();

    // snapshot previous (rel-A content + its redirect config)
    const confB = join(scratch, "candidate-B.conf");
    writeFileSync(
      confB,
      [
        "# B",
        "rewrite ^/old-north$ /galleries/north permanent;",
        "rewrite ^/old-west$ /galleries/west permanent;",
        "",
      ].join("\n"),
    );
    // baseline: activate B (has old-west 301) as the "previous" state
    writeFileSync(join(www, "redirects.conf"), readFileSync(confB));
    run(NGINX_BIN, ["-s", "reload", "-c", conf]);
    waitForBehavior(listen, "/old-west", 301);
    const prevRelease = currentTarget(www);
    const prevRedirects = readFileSync(join(www, "redirects.conf"));

    // deploy a BROKEN C: content marker missing + redirects drop old-west
    makeRelease(releases, "rel-C", "<html>rel-C (broken)</html>");
    const confC = join(scratch, "candidate-C.conf");
    writeFileSync(
      confC,
      ["# C", "rewrite ^/old-north$ /galleries/north permanent;", ""].join("\n"),
    );
    nginxTest(conf);
    setCurrent(www, releases, "rel-C");
    writeFileSync(join(www, "redirects.conf"), readFileSync(confC));
    run(NGINX_BIN, ["-s", "reload", "-c", conf]);
    // C config live: old-west 301 gone (dropped rule), content marker missing
    waitForBehavior(listen, "/old-west", 404);
    const cSmoke = curl(listen, "/");
    expect(cSmoke.body).not.toContain("rel-C-ok"); // deliberate failure

    // §3.3.7 coupled rollback: restore EXACT previous release + redirects
    setCurrent(www, releases, prevRelease!);
    writeFileSync(join(www, "redirects.conf"), prevRedirects);
    run(NGINX_BIN, ["-s", "reload", "-c", conf]);

    // post-rollback: old release content + old 301 restored together
    const rr = waitForBehavior(listen, "/old-west", 301);
    expect(rr.location).toContain("/galleries/west");
    const r = curl(listen, "/");
    expect(r.body).toContain(prevRelease!); // rel-A content back
    expect(r.body).not.toContain("rel-C");
    expect(currentTarget(www)).toBe(prevRelease);
  });
});
