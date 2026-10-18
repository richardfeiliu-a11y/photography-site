// WP-07 fixture integrity guard (frozen-corpus protection).
//
// Contract (WP-07 controller ruling / REAL_PHOTO_FIXTURE_MANIFEST.md header):
// NOTHING in media/stage3c-fixtures/ may be modified. Every harness run
// snapshots the directory's SHA-256 checksums BEFORE the run and verifies
// AFTER the run that nothing changed — a fresh scan each run, compared
// scan-vs-scan (no persistent baseline; the controller-evidence file
// docs/fixtures-stage3c-sha256.txt stays untouched and is not a runtime
// dependency of the harness). Mismatch = hard failure.
//
// Only *.jpg files are scanned (the frozen corpus is 113 JPEGs; .DS_Store
// noise is deliberately out of contract scope).
import { createHash } from "node:crypto";
import { createReadStream, readdirSync } from "node:fs";
import { join } from "node:path";

/** Snapshot of one fixture directory: relative filename → SHA-256 hex. */
export type ChecksumSnapshot = Map<string, string>;

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", rejectPromise);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
}

/** Fast full scan of every *.jpg in the directory (113 files is fine). */
export async function snapshotFixtureDir(dir: string): Promise<ChecksumSnapshot> {
  const names = readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith(".jpg"))
    .sort();
  const snapshot: ChecksumSnapshot = new Map();
  for (const name of names) {
    snapshot.set(name, await sha256File(join(dir, name)));
  }
  return snapshot;
}

/** Hard-fail unless the two snapshots are identical (added/removed/changed). */
export function assertSameSnapshot(
  before: ChecksumSnapshot,
  after: ChecksumSnapshot,
): void {
  const problems: string[] = [];
  for (const [name, sum] of before) {
    const afterSum = after.get(name);
    if (afterSum === undefined) {
      problems.push(`removed: ${name}`);
    } else if (afterSum !== sum) {
      problems.push(`changed: ${name} (${sum.slice(0, 12)}… → ${afterSum.slice(0, 12)}…)`);
    }
  }
  for (const name of after.keys()) {
    if (!before.has(name)) problems.push(`added: ${name}`);
  }
  if (problems.length > 0) {
    throw new Error(
      `[bench] FROZEN FIXTURE CORPUS VIOLATION — fixture files changed during the run:\n  ${problems.join("\n  ")}`,
    );
  }
}
