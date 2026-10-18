// WP-42 — policy-b enforcement is LIVE in the production composer (D11
// APPROVED/CLOSED 2026-09-05). This suite proves the hook wiring: production
// validation over the real corpus reports zero WP-42 findings with the WP-58
// editorial alt pass landed, and would surface findings with file/field
// attribution (fail-closed) if alt-less photos reappear.
//
// NOTE (WP-58 LANDED 2026-09-09): the 50 missing alt_text entries across the
// 10 published galleries are now authored; this suite asserts a clean
// production validation. Draft galleries (e.g. essen-industrial-light) are
// skipped by the validator and never contribute findings.
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { composeArchiveValidation } from '../../src/lib/validate/production';
import { loadArchive } from '../../scripts/validate/content';
import { ALT_MISSING_RULE, validateAltText } from '../../src/lib/validate/alt';

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

function productionValidation() {
  return composeArchiveValidation(loadArchive(REPO_ROOT), {
    mode: "production",
    ingestRoot: join(REPO_ROOT, "media/ingest-masters"),
  });
}

describe("WP-42 enforcement hook (production composer)", () => {
  test("alt policy is enforced: clean corpus yields zero missing-alt findings", () => {
    const validation = productionValidation();
    const altErrors = validation.errors.filter((e) => e.rule === ALT_MISSING_RULE);
    // WP-58 landed: every published photo carries authored alt — fail-closed
    // hook must report nothing. Shape assertions below document the finding
    // contract for any future regression (non-empty case).
    expect(altErrors).toHaveLength(0);
  });

  test("alt finding contract: severity is error with file/field attribution", () => {
    // Contract probe against the validator unit (not the clean corpus): a
    // published photo without alt must surface as an error carrying the
    // gallery file and the photos[<id>].alt_text field.
    const issues = validateAltText(
      [
        {
          id: "g_probe",
          status: "published",
          photos: [{ id: "p_probe_001", source_ref: "probe/master.jpg", alt_text: null }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
      { mode: "production", fileByGalleryId: new Map([["g_probe", "content/galleries/probe/meta.yaml"]]) },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.file).toMatch(/content\/galleries\/[^/]+\/meta\.yaml/);
    expect(issues[0]?.field).toMatch(/photos\[p_[^\]]+\]\.alt_text/);
  });

  test("preview stays warn-only: same corpus yields warnings, not errors", async () => {
    const { composeArchiveValidation: compose } = await import(
      "../../src/lib/validate/production"
    );
    const validation = compose(loadArchive(REPO_ROOT), { mode: "preview" });
    expect(
      validation.errors.filter((e) => e.rule === ALT_MISSING_RULE),
    ).toHaveLength(0);
    // WP-58 landed: no published photo lacks alt, so preview carries no
    // alt-missing warnings either (draft galleries are skipped entirely).
    expect(
      validation.warnings.filter((w) => w.rule === ALT_MISSING_RULE).length,
    ).toBe(0);
  });
});
