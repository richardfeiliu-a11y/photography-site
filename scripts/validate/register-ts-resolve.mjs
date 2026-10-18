// WP-13 — registers the ".ts" resolution retry hook (see ts-resolve.mjs).
// Preloaded with: node --experimental-strip-types --import <this file> <cli>
import { register } from "node:module";

register("./ts-resolve.mjs", import.meta.url);
