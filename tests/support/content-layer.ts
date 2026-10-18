// WP-03 Content Layer test harness — direct loader invocation (see
// docs/implementation/WP-03.md for the mechanism decision).
//
// How it works, against astro 7.2.9 (verified in node_modules, matches
// TECHNICAL_API_VERIFICATION.md §1):
//   - The REAL `src/content.config.ts` is imported (Vitest aliases the virtual
//     `astro:content` module to astro's own implementation, see
//     vitest.config.ts), so the tests exercise the actual deliverable file:
//     its glob() loader instances and its (placeholder) schemas.
//   - Each collection's real glob loader runs via `loader.load(context)` with
//     a LoaderContext assembled the same way astro's ContentLayer builds one.
//     Nothing about the filesystem is mocked: glob() itself resolves `base`,
//     walks the real `content/` tree (tinyglobby), reads the real files
//     (node:fs), generates real entry IDs, and writes real digests.
//   - The only supplied pieces are infrastructure astro does not export for
//     standalone use: (1) the extension→parser map (`entryTypes`) — astro
//     builds its YAML parser inline in dist/core/config/settings.js and does
//     not export it, so file CONTENTS are parsed with the project-pinned
//     js-yaml; (2) an in-memory DataStore/MetaStore/logger implementing the
//     documented `astro/loaders` interfaces (astro's MutableDataStore class is
//     not reachable through astro's package `exports` map).
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { LoaderContext } from "astro/loaders";
import { load as parseYaml } from "js-yaml";

/** Repository root (the Astro `config.root` the glob loader resolves `base` against). */
export const PROJECT_ROOT_URL: URL = new URL("../../", import.meta.url);

type DataStore = LoaderContext["store"];
type MetaStore = LoaderContext["meta"];
type EntryRecord = ReturnType<DataStore["values"]>[number];

/** Minimal structural shape astro's internal content-entry types satisfy. */
interface MinimalEntryType {
  extensions: string[];
  getEntryInfo(args: { contents: string; fileUrl: URL }): { data: unknown; rawData?: string };
}

/** In-memory DataStore: records exactly what the loader loaded. */
function createMemoryStore(): DataStore {
  const map = new Map<string, EntryRecord>();
  // The documented DataStore interface is generic over entry data (TData);
  // the in-memory implementation is deliberately stringly-typed at this
  // boundary, hence the structural cast.
  const impl = {
    get: (key: string): EntryRecord | undefined => map.get(key),
    entries: (): Array<[string, EntryRecord]> => [...map.entries()],
    set: (opts: EntryRecord): boolean => {
      map.set(opts.id, opts);
      return true;
    },
    values: (): EntryRecord[] => [...map.values()],
    keys: (): string[] => [...map.keys()],
    delete: (key: string): void => {
      map.delete(key);
    },
    clear: (): void => {
      map.clear();
    },
    has: (key: string): boolean => map.has(key),
    addModuleImport: (_fileName: string): void => {
      // Only used by deferred-render (Markdown) entries; YAML entries never hit it.
    },
  };
  return impl as unknown as DataStore;
}

function createMemoryMetaStore(): MetaStore {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    has: (key) => map.has(key),
    delete: (key) => {
      map.delete(key);
    },
  };
}

function createSilentLogger(): LoaderContext["logger"] {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop, debug: noop } as unknown as LoaderContext["logger"];
}

// YAML entry type: mirrors the parser astro registers for `.yaml`/`.yml`
// (contents -> object via a YAML 1.2 parser) using the project-pinned js-yaml.
const yamlEntryType: MinimalEntryType = {
  extensions: [".yaml", ".yml"],
  getEntryInfo({ contents, fileUrl }) {
    return {
      data: parseYaml(contents, { filename: fileURLToPath(fileUrl) }) as unknown,
      rawData: contents,
    };
  },
};

/**
 * Loads one collection from the REAL `src/content.config.ts` by running its
 * real glob loader against the real filesystem. Returns the loaded entries
 * sorted by ID.
 */
export async function loadCollection(
  name: "galleries" | "places",
): Promise<{ entries: EntryRecord[] }> {
  const { collections } = await import("../../src/content.config");
  const collectionConfig = collections[name];
  if (!collectionConfig || !("loader" in collectionConfig) || !collectionConfig.loader) {
    throw new Error(`Collection "${name}" is missing from src/content.config.ts`);
  }

  const store = createMemoryStore();
  const context: LoaderContext & { entryTypes: Map<string, MinimalEntryType> } = {
    collection: name,
    store,
    meta: createMemoryMetaStore(),
    logger: createSilentLogger(),
    // Partial AstroConfig: the glob loader only uses root, srcDir and
    // prerenderConflictBehavior (verified in astro 7.2.9 dist/content/loaders/glob.js).
    config: {
      root: PROJECT_ROOT_URL,
      srcDir: new URL("src/", PROJECT_ROOT_URL),
    } as unknown as LoaderContext["config"],
    // Applies the collection's own (placeholder) Zod schema — same role as
    // astro's internal parseData, so the samples must survive the real schemas.
    // Schema object variants carry .parse; function variants (dynamic schemas)
    // are not used by the WP-03 placeholder schemas and are passed through.
    parseData: (async ({ data }: { data: Record<string, unknown> }) => {
      const schema = collectionConfig.schema;
      if (schema && typeof schema === "object" && "parse" in schema) {
        return schema.parse(data) as Record<string, unknown>;
      }
      return data;
    }) as unknown as LoaderContext["parseData"],
    generateDigest: (data) =>
      createHash("sha256")
        .update(typeof data === "string" ? data : JSON.stringify(data))
        .digest("base64"),
    // Required by the LoaderContext type but never called for YAML entries
    // (no markdown rendering in the WP-03 collections).
    renderMarkdown: (async () => {
      throw new Error("renderMarkdown is not supported by the WP-03 test harness");
    }) as unknown as LoaderContext["renderMarkdown"],
    entryTypes: new Map<string, MinimalEntryType>([
      [".yaml", yamlEntryType],
      [".yml", yamlEntryType],
    ]),
  };

  // `entryTypes` is added to the context by astro's ContentLayer internally and
  // is not part of the public LoaderContext type — hence the narrowing cast.
  await (collectionConfig.loader.load as (ctx: typeof context) => Promise<void>)(context);

  return { entries: store.values().sort((a, b) => a.id.localeCompare(b.id)) };
}
