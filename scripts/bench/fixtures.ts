// WP-07 fixture registry — joins the frozen media/stage3c-fixtures/ corpus
// (READ-ONLY; REAL_PHOTO_FIXTURE_MANIFEST.md header: "Nothing in
// media/stage3c-fixtures/ is modified") with the F01–F10 fixture-role
// metadata from that manifest (§1 "F01–F10 coverage").
//
// The role→filename mapping below is a STATIC import of the frozen manifest's
// primary-photo per role: the manifest is frozen, so hardcoding it here (with
// the citation) is honest — the harness cannot drift from the manifest without
// a code review. `verifyOnDisk()` fails loudly if manifest and disk diverge.
//
// Role queries: `createFixtureRegistry().byRole("F02")`.
import { readdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

/** Frozen corpus size (REAL_PHOTO_FIXTURE_MANIFEST.md: 113 decodable JPEGs). */
export const EXPECTED_JPEG_COUNT = 113;

export interface FixtureRole {
  /** Manifest fixture ID, F01–F10. */
  role: string;
  /** Manifest §1 category label. */
  category: string;
  /** Primary source filename for the role (manifest §1 primary; §2 core set). */
  file: string;
  /** Why this file was chosen (manifest citation). */
  note: string;
}

// REAL_PHOTO_FIXTURE_MANIFEST.md §1 (F01–F10 coverage) — primary photo per role.
// F10 has "no special assignment" (§1); DSC02367.jpg is the manifest §2
// baseline "normal" landscape, chosen as its representative.
export const FIXTURE_ROLES: readonly FixtureRole[] = [
  {
    role: "F01",
    category: "Bright / high-key",
    file: "DSC02071.jpg",
    note: "Manifest §1/§2: brightest frame in archive (L179.1); high-key stress.",
  },
  {
    role: "F02",
    category: "Dark",
    file: "DSC01889.jpg",
    note: "Manifest §1/§2: darkest decodable work (L25.3).",
  },
  {
    role: "F03",
    category: "Low-contrast",
    file: "DSC02454.jpg",
    note: "Manifest §1: flattest frame (C19.2, primary).",
  },
  {
    role: "F04",
    category: "Highly saturated",
    file: "DSC02560.jpg",
    note: "Manifest §1/§2: most saturated frame (S245.9, primary).",
  },
  {
    role: "F05",
    category: "Landscape",
    file: "DSC01836.jpg",
    note: "Manifest §1: ordinary wide 3:2 frame, listed primary for the role.",
  },
  {
    role: "F06",
    category: "Portrait",
    file: "DSC02416.jpg",
    note: "Manifest §1/§2: bright portrait (primary) for 80svh/82svh rules.",
  },
  {
    role: "F07",
    category: "Dense composition",
    file: "DSC01935.jpg",
    note: "Manifest §1/§2: detail throughout (primary dense stress).",
  },
  {
    role: "F08",
    category: "Minimal composition",
    file: "DSC02233.jpg",
    note: "Manifest §1/§2: large negative space (primary minimal case).",
  },
  {
    role: "F09",
    category: "Black & white (substitute)",
    file: "DSC02066.jpg",
    note: "Manifest §1: SUBSTITUTION — no true B&W exists; DSC02066 is the named primary substitute (S28.0).",
  },
  {
    role: "F10",
    category: "Color (default state)",
    file: "DSC02367.jpg",
    note: "Manifest §1: no special assignment; §2 baseline 'normal' landscape as representative.",
  },
] as const;

export interface FixtureEntry extends FixtureRole {
  /** Registry root the file resolves against (absolute). */
  dir: string;
  /** Absolute path of the fixture file. */
  absolutePath: string;
}

export interface FixtureRegistry {
  /** Absolute path of the fixture directory this registry reads. */
  dir: string;
  /** Resolve one role to its fixture entry; throws on unknown roles. */
  byRole(role: string): FixtureEntry;
  /** All ten role entries. */
  allRoles(): FixtureEntry[];
  /** Fail loudly if any role file is missing on disk, or if the corpus size
   *  is not the frozen 113 JPEGs (only checked for the real corpus dir). */
  verifyOnDisk(): void;
}

function resolveDir(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(dir);
}

/**
 * Create a fixture registry over a fixture directory. Defaults to the frozen
 * real corpus; tests may point it at a temp COPY (never mutate the real dir).
 */
export function createFixtureRegistry(
  dir: string = join(import.meta.dirname, "..", "..", "media", "stage3c-fixtures"),
): FixtureRegistry {
  const root = resolveDir(dir);

  const entry = (role: FixtureRole): FixtureEntry => ({
    ...role,
    dir: root,
    absolutePath: join(root, role.file),
  });

  return {
    dir: root,
    byRole(role: string): FixtureEntry {
      const found = FIXTURE_ROLES.find((r) => r.role === role);
      if (!found) {
        throw new Error(
          `[bench] unknown fixture role "${role}" — expected one of ${FIXTURE_ROLES.map((r) => r.role).join(", ")} (REAL_PHOTO_FIXTURE_MANIFEST.md §1).`,
        );
      }
      return entry(found);
    },
    allRoles(): FixtureEntry[] {
      return FIXTURE_ROLES.map(entry);
    },
    verifyOnDisk(): void {
      let onDisk: Set<string>;
      try {
        onDisk = new Set(readdirSync(root));
      } catch (cause) {
        throw new Error(
          `[bench] fixture directory unreadable: ${root} (${String(cause)})`,
        );
      }
      const missingFiles = FIXTURE_ROLES.filter((r) => !onDisk.has(r.file));
      if (missingFiles.length > 0) {
        throw new Error(
          `[bench] manifest/disk divergence — missing fixture files: ${missingFiles
            .map((r) => `${r.role}=${r.file}`)
            .join(", ")} (frozen contract: REAL_PHOTO_FIXTURE_MANIFEST.md; dir: ${root}).`,
        );
      }
      const jpegCount = [...onDisk].filter((n) => n.toLowerCase().endsWith(".jpg")).length;
      if (jpegCount !== EXPECTED_JPEG_COUNT) {
        throw new Error(
          `[bench] fixture corpus size drift — expected ${EXPECTED_JPEG_COUNT} JPEGs, found ${jpegCount} in ${root} (frozen contract: REAL_PHOTO_FIXTURE_MANIFEST.md).`,
        );
      }
    },
  };
}
