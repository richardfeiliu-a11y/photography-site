// scripts/perf/engine.mjs — Node engine range checking shared by the perf
// measure harness and the baseline validator (R4 round4 / T7).
//
// WHY this file exists: the first implementation extracted only the FIRST
// number of the running version and of the `engines.node` range and compared
// them. `>=22.12.0 <23` then accepted v22.11.0 (below the floor) and any other
// v22.x, so a measurement taken on an unsupported runtime could be recorded —
// and validated — as satisfying the engine contract. The validator's job is to
// judge the RECORDED run, not to trust the harness's self-reported boolean, so
// the range logic has to be available to both sides.

/** Parse a version string like "v22.14.0" / "22.12" into [major, minor, patch]. */
export function parseVersion(value) {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(value ?? ""));
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function matchesComparator(version, token) {
  const op = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(token.trim());
  if (!op) return false;
  const target = parseVersion(op[2]);
  if (!target) return false;
  const cmp = compare(version, target);
  switch (op[1] ?? "") {
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
    case "=":
    case "":
      return cmp === 0;
    default:
      return false;
  }
}

/**
 * True when `version` satisfies the full `range` string.
 *
 * Supported (the forms this repo authors): `>=X <Y` space-separated AND
 * ranges, `||` alternatives, `^X.Y.Z`, `~X.Y.Z`, and bare exact versions.
 * An unrecognised or empty range returns false — an unparseable contract must
 * never be reported as satisfied.
 */
export function versionSatisfiesRange(version, range) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  const text = String(range ?? "").trim();
  if (text.length === 0) return false;

  return text.split("||").some((alternative) => {
    const part = alternative.trim();
    if (part.length === 0) return false;

    // Caret / tilde ranges expand into an upper bound before comparison.
    if (part.startsWith("^") || part.startsWith("~")) {
      const base = parseVersion(part.slice(1));
      if (!base || base[0] !== parsed[0]) return false;
      if (part.startsWith("~")) {
        return compare(parsed, base) >= 0 && parsed[0] === base[0] && parsed[1] === base[1];
      }
      return compare(parsed, base) >= 0;
    }

    const tokens = part.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;
    // A bare single token may still be a comma list (" >=18, <20 ").
    const comparators = tokens.flatMap((token) => token.split(",")).filter(Boolean);
    return comparators.every((token) => matchesComparator(parsed, token));
  });
}

/** Convenience wrapper: does the RUNNING node satisfy the requirement? */
export function nodeEngineSatisfied(range, version = process.version) {
  return versionSatisfiesRange(version, range);
}
