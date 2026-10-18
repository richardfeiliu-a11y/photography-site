#!/usr/bin/env node
// scripts/backup/restore-backup.mjs — WP-57: restore an encrypted backup.
//
// Usage:
//   # 新目录协议（主要）：--in 指向备份目录 (backup-<id>/archive.enc + manifest.json)
//   node scripts/backup/restore-backup.mjs --in backup-<id> --out restored.tar \
//     [--passphrase <key>] [--manifest <可选覆盖>]
//
//   # 旧单文件格式（兼容回归）：--in 指向 .enc 文件
//   node scripts/backup/restore-backup.mjs --in old.enc --out restored.tar \
//     --passphrase <key> [--manifest old.enc.manifest.json]
//
// 判定规则：若 --in 解析后是目录，读取 archive.enc + manifest.json（--manifest 覆盖）；
// 若是文件，按旧单文件格式处理（--manifest 缺省推断为 <enc>.manifest.json）。
//
// Decrypts a WP-56 AES-256-GCM container ([iv 12B][ciphertext][tag 16B])
// to a plaintext tar, then verifies the decrypted tar's sha256 against the
// resolved manifest's tarSha256 before publishing.
//
// R8/I8 — manifest resolution is now fail-closed with EXPLICIT semantics:
//   - directory protocol (--in backup-<id>): the protocol REQUIRES its own
//     manifest.json — a backup published without one is not restorable.
//     A missing/unreadable/invalid manifest fails the restore (exit 1), it is
//     never silently skipped.
//   - explicit --manifest <path>: the requested integrity gate MUST run — a
//     path that does not exist or cannot be parsed is a hard failure, never
//     "no manifest requested".
//   - legacy single-file format (--in x.enc): the inferred x.enc.manifest.json
//     remains OPTIONAL for backwards compatibility. When it is absent the
//     restore still succeeds (GCM authenticity only) and prints a clearly
//     identifiable notice that the integrity gate did NOT run.
// Every failure path leaves pre-existing --out content untouched (temp file +
// atomic rename only after all checks pass).
//
// Failure is atomic: the decrypt always lands in an exclusively-created temp
// file (O_CREAT|O_EXCL, 0600), verified in place, then atomically renamed over
// --out. Any failure cleans up ONLY that temp file and never touches
// pre-existing --out content. input==output (same dev+ino) is rejected.
//
// Non-production drill: writes only to --out; never touches real credentials.
import { createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  constants as fsConstants,
  createReadStream,
  createWriteStream,
  existsSync,
  openSync,
  readFile,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const FLAGS = fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY;
const MODE = 0o600;

function fail(message) {
  console.error(`[restore-backup] ${message}`);
  process.exitCode = 1;
}

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Exclusively-named temp path inside dir (random 8B, pid-tagged, .tmp). */
function uniqueTempPath(dir, stem) {
  const hex = createHash("sha256").update(randomBytes(8)).digest("hex").slice(0, 16);
  return `${dir}/${stem}.${hex}.${process.pid}.tmp`;
}

/** Read a byte range [start, end] of a file. */
function readRange(path, start, end) {
  return new Promise((res, rej) => {
    const chunks = [];
    const s = createReadStream(path, { start, end });
    s.on("data", (c) => chunks.push(c));
    s.on("end", () => res(Buffer.concat(chunks)));
    s.on("error", rej);
  });
}

function readAll(path) {
  return new Promise((res, rej) => {
    readFile(path, (err, buf) => (err ? rej(err) : res(buf)));
  });
}

/**
 * Same-file guard：a 与 b 解析为同一文件（st_dev + st_ino）时拒绝。
 * 一侧缺失（ENOENT)不计为错误 —— 输入缺失/输出全新分别由 decrypt 与
 * rename 路径处理，这里不预判。
 */
function assertDistinctFiles(a, b) {
  try {
    const aStat = statSync(a);
    const bStat = statSync(b);
    if (aStat.dev === bStat.dev && aStat.ino === bStat.ino) {
      throw new Error("input and output must be different files");
    }
  } catch (e) {
    if (e && e.code !== "ENOENT") throw e;
  }
}

/**
 * Resolve the effective container + manifest from --in / --manifest (裁定③).
 *
 * R8/I8 — returns a manifest MODE alongside the paths:
 *   - "explicit": the operator passed --manifest. The gate MUST run; a
 *     missing/unreadable file is a hard failure downstream.
 *   - "required": directory protocol default. The protocol REQUIRES a
 *     manifest; a missing one is a hard failure downstream.
 *   - "legacy-optional": single-file default. The manifest stays optional for
 *     backwards compatibility; when absent, the caller prints an
 *     identifiable notice and relies on GCM authenticity only.
 *
 * Same-file guard: input and output must be distinct files (st_dev + st_ino).
 * Input-not-existing surfaces here without creating any temp file.
 */
function resolveInputs(inArg, outPath, manifestArg) {
  // 输入 vs 输出同一文件（--in 与 --out 为同一文件/目录时命中）。
  assertDistinctFiles(inArg, outPath);

  let container;
  let manifest;
  let manifestMode;
  if (existsSync(inArg) && statSync(inArg).isDirectory()) {
    // 目录协议：backup-<id>/archive.enc + manifest.json（协议必需）
    container = join(inArg, "archive.enc");
    manifestMode = manifestArg ? "explicit" : "required";
    manifest = manifestArg ?? join(inArg, "manifest.json");
  } else {
    // 单文件协议：xxx.enc + (xxx.enc.manifest.json)（可选，兼容旧格式）
    container = inArg;
    manifestMode = manifestArg ? "explicit" : "legacy-optional";
    manifest = manifestArg ?? `${inArg}.manifest.json`;
  }

  // 目录协议下 --out 可指向目录内的 archive.enc 自身：此时 inArg（目录）与
  // outPath（文件）dev+ino 必不相同，上面的检测必然放行。须对解析出的
  // container 再查一次，否则 restore 会把密文 archive.enc 覆盖为明文 tar ——
  // manifest 的 tarSha256 恰是明文 tar 的哈希、门禁照常通过，备份毁损不可察觉。
  assertDistinctFiles(container, outPath);

  return { container, manifest, manifestMode };
}

/**
 * R8/I8 — resolve the manifest document for the integrity gate.
 *
 * Returns a parsed manifest object with a hex-string tarSha256, or null ONLY
 * for the legacy-optional branch when no manifest file exists. Everything
 * else fails with a thrown Error (caught by the caller → exit 1, output
 * untouched):
 *   - explicit/required mode with a missing file;
 *   - an unreadable/invalid-JSON manifest in ANY mode;
 *   - a manifest without a 64-hex-char tarSha256.
 */
async function resolveManifestDocument(manifest, manifestMode) {
  const exists = manifest !== null && existsSync(manifest);
  if (!exists) {
    if (manifestMode === "explicit")
      throw new Error(`explicit --manifest does not exist or is unreadable: ${manifest} — the requested integrity gate did NOT run, restore aborted`);
    if (manifestMode === "required")
      throw new Error(`directory-protocol manifest missing: ${manifest} — the backup directory protocol requires archive.enc + manifest.json; refusing to restore without the integrity gate`);
    return null; // legacy-optional
  }
  let doc;
  try {
    doc = JSON.parse(await readAll(manifest).then((b) => b.toString("utf8")));
  } catch (e) {
    throw new Error(`manifest unreadable or not valid JSON: ${manifest} — ${String((e && e.message) || e)}`);
  }
  if (!doc || typeof doc !== "object" || typeof doc.tarSha256 !== "string" || !/^[0-9a-f]{64}$/.test(doc.tarSha256)) {
    throw new Error(`manifest has no usable tarSha256 (expected a 64-hex-char string): ${manifest}`);
  }
  return doc;
}

async function decrypt(container, manifest, manifestMode, outPath, passphrase) {
  // Input must exist and be readable BEFORE creating any temp file.
  const size = statSync(container).size;
  const key = createHash("sha256").update(passphrase).digest(); // 32-byte key
  const iv = await readRange(container, 0, 11); // [iv 12B]
  const tag = await readRange(container, size - 16, size - 1); // [tag 16B]

  // 创建独占临时文件（同目录），aliasing-free: fd kept open for writes.
  const outDir = resolve(join(outPath, ".."));
  const tempPath = uniqueTempPath(outDir, "restore");
  const tempFd = openSync(tempPath, FLAGS, MODE);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const reader = createReadStream(container, { start: 12, end: size - 17 });
    const tempWrite = createWriteStream(null, { fd: tempFd });
    await pipeline(reader, decipher, tempWrite);

    // R8/I8 — integrity gate with EXPLICIT resolution semantics. The gate
    // runs BEFORE the atomic publish, so every failure path below leaves any
    // pre-existing --out content untouched.
    const manifestJson = await resolveManifestDocument(manifest, manifestMode);
    if (manifestJson === null) {
      // Only the legacy-optional branch lands here.
      console.log(
        "[restore-backup] NOTICE: legacy single-file format restored WITHOUT an integrity manifest —",
      );
      console.log(
        "[restore-backup] NOTICE: tar sha256 was NOT verified (GCM authenticity only). Provide --manifest or use the directory protocol for verifiable restores.",
      );
    } else {
      const tarSha = sha256Buffer(await readAll(tempPath));
      if (tarSha !== manifestJson.tarSha256) {
        throw new Error(`integrity mismatch: restored tar sha256 ${tarSha.slice(0, 16)}… != manifest ${manifestJson.tarSha256.slice(0, 16)}…`);
      }
      console.log("[restore-backup] integrity verified (tar sha256 matches manifest)");
    }

    // 原子发布：同文件系统 rename（成功后 tempPath 已不存在，finally 的 rm 静默跳过）。
    renameSync(tempPath, outPath);
  } finally {
    try { rmSync(tempPath, { force: true }); } catch {}
  }
}

async function main() {
  const args = process.argv.slice(2);
  let inArg = null;
  let outPath = null;
  let manifestArg = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--in" && args[i + 1]) inArg = resolve(args[i + 1]);
    if (args[i] === "--out" && args[i + 1]) outPath = resolve(args[i + 1]);
    if (args[i] === "--manifest" && args[i + 1]) manifestArg = resolve(args[i + 1]);
  }
  const passIdx = args.indexOf("--passphrase");
  const passphrase = passIdx >= 0 ? args[passIdx + 1] : process.env.BACKUP_PASSPHRASE ?? null;
  if (!inArg || !outPath || !passphrase) {
    fail("usage: node scripts/backup/restore-backup.mjs --in <backup.enc|backupDir> --out <plain.tar> [--passphrase <key>] [--manifest <manifest.json>]");
    return;
  }

  try {
    const { container, manifest, manifestMode } = resolveInputs(inArg, outPath, manifestArg);
    // Failure path: decrypt only cleans its own temp file; catch never touches outPath.
    await decrypt(container, manifest, manifestMode, outPath, passphrase);
    console.log(`[restore-backup] restored plaintext tar: ${outPath}`);
  } catch (e) {
    fail(`restore failed: ${String((e && e.stack) || e)}`);
  }
}

main();