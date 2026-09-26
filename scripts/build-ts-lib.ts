/**
 * @file Bundle TypeScript's standard library declarations for the playground's language service.
 *
 * Usage: `bun scripts/build-ts-lib.ts`. Writes
 * `public/playground/ts-lib/<version>.json` (`{ "/lib.es5.d.ts": "…", … }`)
 * with the files `TS_LIBS` needs and everything they reference, from the
 * pinned `typescript-ls` package, so the worker never fetches them from a CDN.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TS_LIBS, TS_SERVICE_VERSION } from "../lib/playground/intellisense/ts-config";

const root = path.join(import.meta.dir, "..");
const libDir = path.join(root, "node_modules", "typescript-ls", "lib");
const { version } = JSON.parse(readFileSync(path.join(libDir, "..", "package.json"), "utf8")) as {
  version: string;
};
if (version !== TS_SERVICE_VERSION)
  throw new Error(`typescript-ls is ${version}, but TS_SERVICE_VERSION is ${TS_SERVICE_VERSION}`);

const files: Record<string, string> = {};
const queue: string[] = [...TS_LIBS];
while (queue.length > 0) {
  const lib = queue.shift()!;
  const name = `lib.${lib}.d.ts`;
  if (files[`/${name}`] !== undefined) continue;
  const text = readFileSync(path.join(libDir, name), "utf8");
  files[`/${name}`] = text;
  for (const match of text.matchAll(/^\/\/\/\s*<reference lib="([^"]+)"\s*\/>/gm))
    queue.push(match[1]!);
}

const outDir = path.join(root, "public", "playground", "ts-lib");
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${version}.json`);
writeFileSync(out, JSON.stringify(files));
const size = Object.values(files).reduce((n, t) => n + t.length, 0);
console.log(
  `wrote ${Object.keys(files).length} lib files (${Math.round(size / 1024)} KB) to ${path.relative(root, out)}`,
);
