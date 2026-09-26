/**
 * @file The TypeScript language service, in a module worker.
 *
 * It mirrors the project's scripts into a virtual file system and answers
 * hover, completion and diagnostic requests from the editor (the
 * `@valtown/codemirror-ts` worker shape, over Comlink). Types for npm
 * dependencies are downloaded from jsDelivr as `.d.ts` text; nothing here runs
 * user code or downloaded code. The standard library comes from the site
 * (`scripts/build-ts-lib.ts`).
 */

/// <reference lib="webworker" />

import { setupTypeAcquisition } from "@typescript/ata";
import {
  createSystem,
  createVirtualTypeScriptEnvironment,
  type VirtualTypeScriptEnvironment,
} from "@typescript/vfs";
import { createWorker } from "@valtown/codemirror-ts/worker";
import * as Comlink from "comlink";
import ts from "typescript-ls";
import {
  BUN_TYPES,
  BUN_TYPES_PATH,
  IGNORED_CODES,
  PENDING_TYPES_CODES,
  TS_LIBS,
  typesSource,
} from "@/lib/playground/intellisense/ts-config";

/** How the page starts the service. */
export interface TsServiceOptions {
  libUrl: string;
  bunTypes: boolean;
}

/** Compiler options: modern, strict, JSX for React, `./x.ts` imports allowed. */
const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: TS_LIBS.map((lib) => `lib.${lib}.d.ts`),
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  allowJs: true,
  checkJs: false,
  allowImportingTsExtensions: true,
  noEmit: true,
  esModuleInterop: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  moduleDetection: ts.ModuleDetectionKind.Force,
  types: [],
};

let options: TsServiceOptions | undefined;
/** Called (through Comlink) when downloaded types change what diagnostics say. */
let onTypes: () => void = () => undefined;
let env: VirtualTypeScriptEnvironment | undefined;
/** Paths mirrored from the project (not lib or downloaded files). */
let mirrored = new Set<string>();
let pendingTypes = 0;
/** Types arrived since the page was last told. */
let received = false;
let acquire: ((source: string) => Promise<void>) | undefined;

const base = createWorker(async () => {
  if (!options) throw new Error("start() first");
  const response = await fetch(options.libUrl);
  if (!response.ok) throw new Error(`TypeScript lib files: HTTP ${response.status}`);
  const fsMap = new Map(Object.entries((await response.json()) as Record<string, string>));
  const compilerOptions = { ...COMPILER_OPTIONS };
  if (options.bunTypes) {
    fsMap.set(BUN_TYPES_PATH, BUN_TYPES);
    compilerOptions.types = ["bun-emulated"];
  }
  const system = createSystem(fsMap);
  // `@typescript/vfs` is typed against the site's own TypeScript; the APIs it uses are the same.
  const created = createVirtualTypeScriptEnvironment(
    system,
    options.bunTypes ? [BUN_TYPES_PATH] : [],
    ts as never,
    compilerOptions as never,
  );
  acquire = setupTypeAcquisition({
    projectName: "easy-docs playground",
    typescript: ts as never,
    delegate: {
      receivedFile: (code, path) => {
        upsert(created, path, code);
        received = true;
      },
    },
    logger: { log() {}, error() {}, groupCollapsed() {}, groupEnd() {} },
  });
  return created;
});

/** Create or replace a file. */
function upsert(target: VirtualTypeScriptEnvironment, path: string, code: string) {
  if (target.getSourceFile(path)) {
    if (target.getSourceFile(path)?.text !== code) target.updateFile(path, code);
  } else target.createFile(path, code || " ");
}

/** Fetch types for the project's dependencies (and anything its files import). */
async function acquireTypes(source: string) {
  if (!acquire || !source.trim()) return;
  pendingTypes += 1;
  try {
    await acquire(source);
  } catch {
    // Types are a nicety: a failed download leaves `any` behind, never an error.
  } finally {
    pendingTypes -= 1;
    if (pendingTypes === 0 && received) {
      received = false;
      onTypes();
    }
  }
}

const service = {
  ...base,

  /** Set up the service; resolves once the standard library is loaded. */
  async start(startOptions: TsServiceOptions, typesChanged: () => void) {
    options = startOptions;
    onTypes = typesChanged;
    await base.initialize();
    env = base.getEnv() as VirtualTypeScriptEnvironment;
  },

  /**
   * Mirror the project: create or update every given file and delete mirrored
   * files that are gone. Starts type acquisition for `package.json` and imports.
   */
  syncFiles(files: Record<string, string>) {
    if (!env) return;
    for (const path of mirrored) if (!(path in files)) env.deleteFile(path);
    for (const [path, code] of Object.entries(files)) upsert(env, path, code);
    mirrored = new Set(Object.keys(files));
    const project = Object.fromEntries(Object.entries(files).map(([p, c]) => [p.slice(1), c]));
    void acquireTypes([typesSource(project), ...Object.values(files)].join("\n"));
  },

  /** Diagnostics, minus the ones the playground makes moot (and "missing module" while types load). */
  getLints({ path }: { path: string }) {
    return base.getLints({
      path,
      diagnosticCodesToIgnore:
        pendingTypes > 0 ? [...IGNORED_CODES, ...PENDING_TYPES_CODES] : [...IGNORED_CODES],
    });
  },
};

/** What the page talks to. */
export type TsService = typeof service;

Comlink.expose(service);
