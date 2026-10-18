// WP-06 content-validation smoke test — the P1 exit item ("harness executes at
// least one passing content validation test").
//
// Scope note: this is a harness smoke test, NOT the WP-09/WP-13 schema work.
// The fixture is a trivially valid YAML document; the check is a placeholder
// structural check (document loads and has the expected keys). Real content
// schemas and fail-closed validation land with WP-09 (schema) / WP-13 (gate).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { load } from "js-yaml";

const FIXTURE_PATH = fileURLToPath(new URL("../fixtures/content/sample.yaml", import.meta.url));

describe("content validation smoke (P1 exit item)", () => {
  test("trivially valid YAML fixture loads and has the expected structure", async () => {
    const raw = await readFile(FIXTURE_PATH, "utf8");
    const doc = load(raw);
    expect(doc).toEqual({
      site: {
        id: "sample",
        title: "Sample Fixture Site",
        status: "published",
      },
    });
  });
});
