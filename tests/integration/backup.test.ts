// WP-56 — encrypted backup (RED first).
// Verifies: non-rebuildable data is captured, rebuildable output is excluded,
// client-side AES-256-GCM encryption round-trips, integrity manifest matches,
// failures are visible (exit code + stderr).
//
// P9 R7 (task 1.3): create-backup publishes a whole DIRECTORY atomically —
// backup-<id>/archive.enc + backup-<id>/manifest.json (backupFormat "dir-v1").
// The plaintext tar exists only inside an exclusive staging dir and is removed
// before the atomic rename. Tests drive the real CLI. A failure must leave no
// staging/temp residue and never touch a previous backup at --out.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const BACKUP_SCRIPT = join(REPO_ROOT, "scripts", "backup", "create-backup.mjs");
const TEST_ROOT = join(REPO_ROOT, "tests", "tmp", "backup");
const PASSPHRASE = "test-backup-passphrase-123";

/** Build a fixture tree under TEST_ROOT/src with a mix of data + rebuildable. */
function setupFixture() {
  const src = join(TEST_ROOT, "src");
  mkdirSync(join(src, "ingest-masters"), { recursive: true });
  mkdirSync(join(src, "content", "galleries"), { recursive: true });
  mkdirSync(join(src, "dist"), { recursive: true }); // rebuildable — must be excluded
  mkdirSync(join(src, "generated"), { recursive: true }); // rebuildable — must be excluded
  writeFileSync(join(src, "ingest-masters", "master-1.raw"), "RAW_MASTER_1");
  writeFileSync(join(src, "ingest-masters", "master-2.raw"), "RAW_MASTER_2");
  writeFileSync(join(src, "content", "galleries", "g1.yaml"), "id: g1\nslug: g1\n");
  writeFileSync(join(src, "content", "redirects.yaml"), "/old: { gallery_id: g1 }\n");
  writeFileSync(join(src, "dist", "index.html"), "<html>rebuildable</html>");
  writeFileSync(join(src, "generated", "out.jpg"), "GENERATED");
  return src;
}

/** Decrypt a backup container produced by create-backup.mjs. */
function decryptContainer(path: string, passphrase: string): Buffer {
  const key = createHash("sha256").update(passphrase).digest();
  const buf = readFileSync(path);
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function sha256Buffer(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Run create-backup against --out (real CLI). */
function runBackupOut(out: string, extraArgs: string[] = [], env: Record<string, string> = {}) {
  return execFileSync("node", [BACKUP_SCRIPT, "--out", out, "--sources", "tests/tmp/backup/src", ...extraArgs], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, BACKUP_PASSPHRASE: PASSPHRASE, ...env },
    stdio: "pipe",
  });
}

/** Exit code + stderr of a run that is expected to fail. */
function tryBackup(out: string, extraArgs: string[] = [], env: Record<string, string> = {}) {
  let exitCode = 0;
  let stderr = "";
  try {
    runBackupOut(out, extraArgs, env);
  } catch (e: any) {
    exitCode = e.status ?? 1;
    stderr = (e.stderr ?? "").toString();
  }
  return { exitCode, stderr };
}

/** Directory-protocol backup: runs the real CLI with --out TEST_ROOT/<stem>. */
function newBackup(stem: string): string {
  const out = join(TEST_ROOT, stem);
  runBackupOut(out);
  return out;
}

/**
 * Legacy single-file backup, x.enc + x.enc.manifest.json, for compat guards.
 * create-backup now only publishes the directory protocol, so the pair is
 * assembled from a real dir-protocol run (identical bytes, matching
 * tarSha256/encSha256) — proves the directory backup never disturbs the
 * legacy format that restore still reads.
 */
function makeLegacyBackup(stem: string): string {
  const srcDir = join(TEST_ROOT, `_legacy-src-${stem}`);
  runBackupOut(srcDir);
  const enc = join(TEST_ROOT, `${stem}.enc`);
  const manifest = `${enc}.manifest.json`;
  writeFileSync(enc, readFileSync(join(srcDir, "archive.enc")));
  writeFileSync(manifest, readFileSync(join(srcDir, "manifest.json")));
  rmSync(srcDir, { recursive: true, force: true });
  return enc;
}

/** *.tmp artifacts (dirs OR files) directly under dir — staging residue guard. */
function tmpArtifacts(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.name.endsWith(".tmp"))
    .map((d) => `${d.isDirectory() ? "dir:" : "file:"}${d.name}`);
}

describe("WP-56 encrypted backup", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    setupFixture();
  });
  afterEach(() => {
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch {}
  });

  test("captures non-rebuildable sources (ingest masters, authored yaml, redirects)", () => {
    const out = newBackup("backup-1");
    const pt = decryptContainer(join(out, "archive.enc"), PASSPHRASE).toString("utf8");
    expect(pt).toContain("ingest-masters");
    expect(pt).toContain("master-1.raw");
    expect(pt).toContain("master-2.raw");
    expect(pt).toContain("content");
    expect(pt).toContain("redirects.yaml");
  });

  test("excludes rebuildable output (dist, generated)", () => {
    const out = newBackup("backup-1");
    const pt = decryptContainer(join(out, "archive.enc"), PASSPHRASE).toString("utf8");
    expect(pt).not.toContain("dist");
    expect(pt).not.toContain("generated");
  });

  test("client-side AES-256-GCM round-trips and detects tampering", () => {
    const out = newBackup("backup-1");
    // Round-trip already proven by decryptContainer in prior tests; here
    // verify a flipped byte fails GCM auth.
    const buf = readFileSync(join(out, "archive.enc"));
    const tampered = Buffer.from(buf);
    tampered[200] ^= 0xff;
    const key = createHash("sha256").update(PASSPHRASE).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, tampered.subarray(0, 12));
    decipher.setAuthTag(tampered.subarray(tampered.length - 16));
    expect(() => {
      decipher.update(tampered.subarray(12, tampered.length - 16));
      decipher.final();
    }).toThrow();
  });

  test("integrity manifest records matching sha256 for the encrypted container", () => {
    const out = newBackup("backup-1");
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    expect(manifest.cipher).toBe("aes-256-gcm");
    expect(manifest.backupFormat).toBe("dir-v1");
    expect(manifest.sources).toContain("tests/tmp/backup/src");
    const actual = createHash("sha256").update(readFileSync(join(out, "archive.enc"))).digest("hex");
    expect(manifest.encSha256).toBe(actual);
    expect(manifest.tarSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.keyFingerprint).toMatch(/^[0-9a-f]{12}$/);
  });

  test("failures are visible: missing source aborts with exit != 0 and stderr", () => {
    const out = join(TEST_ROOT, "b.enc");
    const { exitCode, stderr } = tryBackup(out, ["--sources", "does/not/exist"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("source missing");
    // Failure happened before any staging dir was created.
    expect(existsSync(out)).toBe(false);
    expect(tmpArtifacts(TEST_ROOT)).toEqual([]);
  });

  test("failures are visible: weak passphrase aborts with exit != 0", () => {
    const out = join(TEST_ROOT, "b.enc");
    const { exitCode } = tryBackup(out, [], { BACKUP_PASSPHRASE: "short" });
    expect(exitCode).not.toBe(0);
    expect(existsSync(out)).toBe(false);
  });

  // ── P9 R7 — directory protocol, atomic publish, previous backup untouched ──

  test("output path cannot be written: fails, no plaintext residue, directory protocol", () => {
    const outDir = join(TEST_ROOT, "backup-1");
    // Make --out path unwritable by pre-creating a file with that name.
    writeFileSync(outDir, "blocked-by-file"); // 不是目录 → create-backup 无法 rename 到它

    let exitCode = 0;
    try {
      runBackupOut(outDir);
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }

    expect(exitCode).not.toBe(0);
    // 不得发布最终备份目录。
    expect(existsSync(join(TEST_ROOT, "backup-1", "archive.enc"))).toBe(false);
    // 不得残留本次 staging 目录或临时密文。
    expect(tmpArtifacts(TEST_ROOT)).toEqual([]);
    // The blocking file is untouched.
    expect(readFileSync(outDir, "utf8")).toBe("blocked-by-file");
  });

  test("directory protocol: archive.enc + manifest.json, no plaintext tar, sources recorded", () => {
    const out = newBackup("backup-1");
    expect(existsSync(join(out, "archive.enc"))).toBe(true);
    expect(existsSync(join(out, "manifest.json"))).toBe(true);
    // The plaintext tar must never survive into the final backup dir.
    expect(existsSync(join(out, "archive.tar"))).toBe(false);
    // Only the two deliverables exist in the published dir.
    const entries = readdirSync(out).filter((f) => !f.startsWith(".")).sort();
    expect(entries).toEqual(["archive.enc", "manifest.json"]);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    expect(manifest.backupFormat).toBe("dir-v1");
    expect(manifest.sources).toEqual(["tests/tmp/backup/src"]);
    expect(tmpArtifacts(TEST_ROOT)).toEqual([]);
  });

  test("R7: keeps plaintext out of the final dir; legacy single-file format untouched", () => {
    // A legacy-format backup (x.enc + x.enc.manifest.json) built beforehand.
    const legacyEnc = makeLegacyBackup("legacy");
    const legacyManifest = `${legacyEnc}.manifest.json`;
    const encBefore = sha256Buffer(readFileSync(legacyEnc));
    const manifestBefore = sha256Buffer(readFileSync(legacyManifest));

    // A fresh directory-protocol backup.
    const out = newBackup("backup-1");
    expect(existsSync(join(out, "archive.enc"))).toBe(true);
    expect(existsSync(join(out, "manifest.json"))).toBe(true);

    // 裁定③: create never migrates/renames/deletes existing backups.
    expect(sha256Buffer(readFileSync(legacyEnc))).toBe(encBefore);
    expect(sha256Buffer(readFileSync(legacyManifest))).toBe(manifestBefore);
    expect(tmpArtifacts(TEST_ROOT)).toEqual([]);
  });

  test("R7: target existing (previous backup) is refused; previous backup hash unchanged", () => {
    // A successful backup first (the "previous" one).
    const out = newBackup("backup-1");
    const encPath = join(out, "archive.enc");
    const manifestPath = join(out, "manifest.json");
    const encBefore = sha256Buffer(readFileSync(encPath));
    const manifestBefore = sha256Buffer(readFileSync(manifestPath));

    // A second backup at the same --out must fail before touching anything.
    const { exitCode, stderr } = tryBackup(out);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("already exists");
    // The previous backup is byte-for-byte unchanged.
    expect(sha256Buffer(readFileSync(encPath))).toBe(encBefore);
    expect(sha256Buffer(readFileSync(manifestPath))).toBe(manifestBefore);
    // And no staging/temp artifacts from the failed run.
    expect(tmpArtifacts(TEST_ROOT)).toEqual([]);
  });
});