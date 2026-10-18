// Build-time loader for content/site/about.yaml (Monograph §6.7 colophon).
//
// Unlike home.yaml, a missing about file is VALID and yields empty sections
// (the page renders its minimal fallback). A present-but-malformed file
// fails closed like the other content readers.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";
import { aboutSchema, type AboutSettings } from "../../content-schemas";

export const ABOUT_SETTINGS_PATH = "content/site/about.yaml";

export interface AboutValidationIssue {
  severity: "error";
  rule: string;
  message: string;
  field?: string;
}

export interface AboutSettingsResult {
  ok: boolean;
  settings: AboutSettings;
  errors: AboutValidationIssue[];
}

const EMPTY: AboutSettings = {
  statement: null,
  approach: null,
  gear: null,
  contact: null,
  portrait: null,
};

export function readAboutFile(root: string): { data: unknown; filePath: string } | null {
  const filePath = resolve(root, ABOUT_SETTINGS_PATH);
  if (!existsSync(filePath)) return null;
  return { data: parseYaml(readFileSync(filePath, "utf8")) as unknown, filePath };
}

export function validateAboutSettings(data: unknown): AboutSettingsResult {
  const parsed = aboutSchema.safeParse(data ?? {});
  if (parsed.success) {
    return { ok: true, settings: parsed.data, errors: [] };
  }
  return {
    ok: false,
    settings: EMPTY,
    errors: parsed.error.issues.map((issue) => ({
      severity: "error",
      rule: "about:invalid",
      message: `[about:invalid] ${issue.path.join(".")}: ${issue.message}`,
      field: issue.path.join("."),
    })),
  };
}

/** Load + validate about.yaml; missing file → empty sections. */
export function loadAboutSettings(
  root: string,
): { settings: AboutSettings; present: boolean; errors: AboutSettingsIssue[] } {
  const file = readAboutFile(root);
  if (!file) return { settings: EMPTY, present: false, errors: [] };
  const result = validateAboutSettings(file.data);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return { settings: result.settings, present: true, errors: [] };
}

type AboutSettingsIssue = AboutValidationIssue;
