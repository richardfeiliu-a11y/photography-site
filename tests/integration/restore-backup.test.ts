// WP-57 — restore backup (RED first).
// Verifies the WP-56 -> WP-57 round trip: create-backup encrypts a tar,
// restore-backup decrypts it back, content matches; wrong passphrase fails
// (GCM auth); --manifest integrity gate is fail-closed.
//
// P9 R1 (task 1.1): restore must be atomic — a failure may touch ONLY a
// temp file it owns, never pre-existing --out content. Also accepts the new
// directory protocol (--in backup-<id> -> archive.enc + manifest.json) and
// stays compatible with the legacy single-file format (--in x.enc +
// --manifest x.enc.manifest.json). Tests drive the real CLI (execFileSync).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const CREATE_SCRIPT = join(REPO_ROOT, "scripts", "backup", "create-backup.mjs");
const RESTORE_SCRIPT = join(REPO_ROOT, "scripts", "backup", "restore-backup.mjs");
const TEST_ROOT = join(REPO_ROOT, "tests", "tmp", "restore");
const PASSPHRASE = "restore-test-passphrase-456";

function run(script: string, args: string[], extraEnv: Record<string, string> = {}) {
  return execFileSync("node", [script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: "pipe",
  });
}

/** Exit code + stderr of a run that is expected to fail. */
function tryRun(script: string, args: string[], extraEnv: Record<string, string> = {}) {
  let exitCode = 0;
  let stderr = "";
  try {
    run(script, args, extraEnv);
  } catch (e: any) {
    exitCode = e.status ?? 1;
    stderr = (e.stderr ?? "").toString();
  }
  return { exitCode, stderr };
}

function sha256Buffer(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

/** List of *.tmp files directly under a dir (restore temp artifacts, 0600). */
function tempFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".tmp"))
    .map((d) => d.name);
}

function setupSource() {
  const src = join(TEST_ROOT, "src");
  mkdirSync(join(src, "ingest-masters"), { recursive: true });
  mkdirSync(join(src, "content", "galleries"), { recursive: true });
  writeFileSync(join(src, "ingest-masters", "master-1.raw"), "RAW_MASTER_1");
  writeFileSync(join(src, "content", "galleries", "g1.yaml"), "id: g1\nslug: g1\n");
  return src;
}

/**
 * Legacy single-file backup: x.enc + x.enc.manifest.json, ONLY for the
 * legacy-format restore paths. create-backup now publishes the directory
 * protocol (backup-<id>/archive.enc + manifest.json), so a legacy pair is
 * assembled from a real dir-protocol run (identical ciphertext bytes and the
 * matching manifest; the sole difference is the extra `backupFormat` field,
 * which restore ignores). The legacy restore path is still exercised with
 * genuinely produced ciphertext.
 */
function makeLegacyBackup(dir: string, stem: string): string {
  const srcDir = join(dir, `_src-${stem}`);
  run(CREATE_SCRIPT, ["--out", srcDir, "--sources", "tests/tmp/restore/src"], { BACKUP_PASSPHRASE: PASSPHRASE });
  const enc = join(dir, `${stem}.enc`);
  const manifest = `${enc}.manifest.json`;
  writeFileSync(enc, readFileSync(join(srcDir, "archive.enc")));
  writeFileSync(manifest, readFileSync(join(srcDir, "manifest.json")));
  rmSync(srcDir, { recursive: true, force: true });
  return enc;
}

/** Directory-protocol backup via the real CLI: --out backupDir. */
function makeDirProtocolBackup(dir: string): string {
  const backupDir = join(dir, "backup-1");
  run(CREATE_SCRIPT, ["--out", backupDir, "--sources", "tests/tmp/restore/src"], { BACKUP_PASSPHRASE: PASSPHRASE });
  return backupDir;
}

describe("WP-57 restore backup", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    setupSource();
  });
  afterEach(() => {
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch {}
  });

  test("create -> restore round-trips content and integrity gate passes (legacy single-file format)", () => {
    const enc = makeLegacyBackup(TEST_ROOT, "b");
    const tar = join(TEST_ROOT, "restored.tar");
    run(RESTORE_SCRIPT, ["--in", enc, "--out", tar, "--manifest", `${enc}.manifest.json`], { BACKUP_PASSPHRASE: PASSPHRASE });

    expect(existsSync(tar)).toBe(true);
    // Decrypted tar is a valid ustar archive containing the source paths.
    const data = readFileSync(tar);
    expect(data.subarray(257, 262).toString("ascii")).toBe("ustar");
    const asText = data.toString("utf8");
    expect(asText).toContain("ingest-masters");
    expect(asText).toContain("master-1.raw");
    expect(asText).toContain("g1.yaml");
  });

  test("restore fails with wrong passphrase (GCM auth)", () => {
    const enc = makeLegacyBackup(TEST_ROOT, "b");
    const tar = join(TEST_ROOT, "restored.tar");

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", enc, "--out", tar], { BACKUP_PASSPHRASE: "wrong-passphrase-999" });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("restore failed");
    expect(existsSync(tar)).toBe(false);
  });

  test("--manifest integrity gate is fail-closed on tampered container", () => {
    const enc = makeLegacyBackup(TEST_ROOT, "b");
    const tar = join(TEST_ROOT, "restored.tar");

    // Tamper with the encrypted container (a flipped byte mid-ciphertext).
    const buf = readFileSync(enc);
    const tampered = Buffer.from(buf);
    tampered[400] ^= 0xff;
    const tamperedPath = join(TEST_ROOT, "tampered.enc");
    writeFileSync(tamperedPath, tampered);

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", tamperedPath, "--out", tar, "--manifest", `${enc}.manifest.json`], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    // Either GCM auth (decryption) or the manifest gate catches it.
    expect(stderr).toMatch(/restore failed|integrity mismatch/);
  });

  test("legacy single-file format restores via inferred manifest (no --manifest arg)", () => {
    const legacy = makeLegacyBackup(TEST_ROOT, "b");
    const tar = join(TEST_ROOT, "restored.tar");

    run(RESTORE_SCRIPT, ["--in", legacy, "--out", tar], { BACKUP_PASSPHRASE: PASSPHRASE });

    expect(existsSync(tar)).toBe(true);
    const data = readFileSync(tar);
    expect(data.subarray(257, 262).toString("ascii")).toBe("ustar");
    expect(data.toString("utf8")).toContain("master-1.raw");
  });

  test("directory protocol restores correctly: content ok, no temp residue", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const tar = join(TEST_ROOT, "restored.tar");

    run(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar], { BACKUP_PASSPHRASE: PASSPHRASE });

    expect(existsSync(tar)).toBe(true);
    const data = readFileSync(tar);
    expect(data.subarray(257, 262).toString("ascii")).toBe("ustar");
    expect(data.toString("utf8")).toContain("master-1.raw");
    // Same corpus restored via the legacy single-file route must equal.
    const refTar = join(TEST_ROOT, "ref.tar");
    const legacyEnc = makeLegacyBackup(TEST_ROOT, "legacy");
    run(RESTORE_SCRIPT, ["--in", legacyEnc, "--out", refTar], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(sha256Buffer(data)).toBe(sha256Buffer(readFileSync(refTar)));
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("wrong passphrase, output pre-existing: original output hash unchanged + no temp residue", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar], { BACKUP_PASSPHRASE: "wrong-passphrase-999" });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("restore failed");
    expect(existsSync(tar)).toBe(true);
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("manifest mismatch with valid container: rejected, output hash unchanged + no temp residue", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));

    // Manifest has the REAL tarSha256; force a mismatch via --manifest override.
    const badManifest = join(TEST_ROOT, "bad-manifest.json");
    writeFileSync(badManifest, JSON.stringify({ tool: "create-backup.mjs", createdAt: "t", cipher: "aes-256-gcm", layout: "x", sources: [], keyFingerprint: "fp", tarSha256: "0".repeat(64), encSha256: "0".repeat(64), encBytes: 0 }, null, 2));

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar, "--manifest", badManifest], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("integrity mismatch");
    expect(existsSync(tar)).toBe(true);
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("P9 R1 Important-1: directory protocol with --out pointing at backup-1/archive.enc is rejected, ciphertext + manifest unchanged", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const enc = join(backupDir, "archive.enc");
    const encBefore = sha256Buffer(readFileSync(enc));
    const manifestBefore = sha256Buffer(readFileSync(join(backupDir, "manifest.json")));

    // Container and outPath are the SAME file via the directory protocol
    // (--in is a dir, --out is its archive.enc): the directory-vs-file
    // dev+ino comparison inevitably differs, so the guard must re-check the
    // resolved container. Otherwise restore would over-write the ciphertext
    // with plaintext (manifest's tarSha256 matches, gate still passes).
    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", enc], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("input and output must be different files");
    // Ciphertext untouched (not silently replaced by plaintext tar).
    expect(sha256Buffer(readFileSync(enc))).toBe(encBefore);
    expect(sha256Buffer(readFileSync(join(backupDir, "manifest.json")))).toBe(manifestBefore);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("input equals output (same file): restore is rejected, file untouched", () => {
    const legacy = makeLegacyBackup(TEST_ROOT, "b");
    const before = sha256Buffer(readFileSync(legacy));

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", legacy, "--out", legacy], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("input and output must be different files");
    expect(sha256Buffer(readFileSync(legacy))).toBe(before);
  });

  test("input missing, output pre-existing: original output hash unchanged", () => {
    const backupDir = join(TEST_ROOT, "backup-1");
    // Create a valid backup in the new directory protocol first.
    run(CREATE_SCRIPT, ["--out", backupDir, "--sources", "tests/tmp/restore/src"], { BACKUP_PASSPHRASE: PASSPHRASE });
    // Write a known file as the pre-existing output.
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));

    const { exitCode } = tryRun(RESTORE_SCRIPT, ["--in", "does-not-exist", "--out", tar, "--passphrase", PASSPHRASE], {});
    expect(exitCode).not.toBe(0);
    expect(existsSync(tar)).toBe(true);
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
  });
});
// ---------------------------------------------------------------------------
// P9 R8 (I8) — manifest resolution is fail-closed with explicit semantics:
//   - explicit --manifest pointing at a missing file must FAIL (the requested
//     gate must not silently no-op) and leave pre-existing output untouched.
//   - directory protocol REQUIRES archive.enc + manifest.json; a backup dir
//     missing its manifest is not restorable.
//   - legacy single-file format without a manifest stays restorable (compat)
//     but prints a recognizable NOTICE that the tar was NOT verified.
//   - unreadable / invalid-JSON manifests fail in every mode.
// All failure paths leave pre-existing --out content byte-identical.
// ---------------------------------------------------------------------------
describe("P9 R8 restore manifest semantics (I8)", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    setupSource();
  });
  afterEach(() => {
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch {}
  });

  test("I8: explicit --manifest to a MISSING file fails, pre-existing output untouched", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));
    const ghost = join(TEST_ROOT, "ghost.manifest.json");

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar, "--manifest", ghost], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("explicit --manifest does not exist");
    expect(existsSync(tar)).toBe(true);
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("I8: directory protocol backup with manifest.json DELETED fails (protocol requires it)", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    rmSync(join(backupDir, "manifest.json"));
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("directory-protocol manifest missing");
    expect(existsSync(tar)).toBe(true);
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("I8: legacy single-file WITHOUT manifest still restores but prints recognizable NOT-VERIFIED notice", () => {
    // Legacy pair WITHOUT the sidecar manifest (old restore used to accept
    // this silently; R8 requires a recognizable explanation instead).
    const enc = makeLegacyBackup(TEST_ROOT, "b");
    rmSync(`${enc}.manifest.json`);
    const tar = join(TEST_ROOT, "restored.tar");

    const out = run(RESTORE_SCRIPT, ["--in", enc, "--out", tar], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(existsSync(tar)).toBe(true);
    expect(out).toContain("NOT verified");
    expect(out).toContain("GCM authenticity only");
  });

  test("I8: corrupt (invalid JSON) explicit --manifest fails in any mode, output untouched", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const bad = join(TEST_ROOT, "corrupt.json");
    writeFileSync(bad, "{ not json !!!");
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar, "--manifest", bad], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("manifest unreadable or not valid JSON");
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });

  test("I8: manifest without usable tarSha256 fails the gate, output untouched", () => {
    const backupDir = makeDirProtocolBackup(TEST_ROOT);
    const bad = join(TEST_ROOT, "nohash.json");
    writeFileSync(bad, JSON.stringify({ tool: "create-backup.mjs", cipher: "aes-256-gcm" }));
    const tar = join(TEST_ROOT, "preexisting.tar");
    writeFileSync(tar, "PREEXISTING_CONTENT");
    const originalHash = sha256Buffer(readFileSync(tar));

    const { exitCode, stderr } = tryRun(RESTORE_SCRIPT, ["--in", backupDir, "--out", tar, "--manifest", bad], { BACKUP_PASSPHRASE: PASSPHRASE });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("no usable tarSha256");
    expect(sha256Buffer(readFileSync(tar))).toBe(originalHash);
    expect(tempFiles(TEST_ROOT)).toEqual([]);
  });
});
