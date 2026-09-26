/**
 * @file Copy the pinned basedpyright browser worker into `public/` (it isn't committed).
 *
 * Usage: `bun scripts/copy-pyright.ts` (the `dev` and `build` scripts run it).
 * The bundle is ~18 MB (~3.2 MB gzip) and only downloads when a Python file
 * is focused in the playground.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PYRIGHT_VERSION } from "../lib/playground/intellisense/pyright-config";

const root = path.join(import.meta.dir, "..");
const pkg = path.join(root, "node_modules", "browser-basedpyright");
const { version } = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8")) as {
  version: string;
};
if (version !== PYRIGHT_VERSION)
  throw new Error(`browser-basedpyright is ${version}, but PYRIGHT_VERSION is ${PYRIGHT_VERSION}`);

const outDir = path.join(root, "public", "playground", "pyright", version);
const out = path.join(outDir, "pyright.worker.js");
mkdirSync(outDir, { recursive: true });
if (!existsSync(out)) copyFileSync(path.join(pkg, "dist", "pyright.worker.js"), out);
copyFileSync(path.join(pkg, "LICENSE.txt"), path.join(outDir, "LICENSE.txt"));
