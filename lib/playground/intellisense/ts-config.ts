/**
 * @file What the TypeScript language service needs to know about a project.
 *
 * Pure (no DOM, no TypeScript import), so it can be unit tested and shared by
 * the page and the worker. The service itself runs in
 * `components/playground/intellisense/ts.worker.ts`: it type-checks and
 * explains code, and never runs it.
 */

import type { LanguageId } from "../languages";
import { readDependencies } from "../npm";

/** TypeScript version of the service (npm alias `typescript-ls`). */
export const TS_SERVICE_VERSION = "6.0.3";

/** The standard library files, bundled by `scripts/build-ts-lib.ts`. */
export const TS_LIB_URL = `/playground/ts-lib/${TS_SERVICE_VERSION}.json`;

/** The `lib` setting (the bundle holds these and everything they reference). */
export const TS_LIBS = ["es2023", "dom", "dom.iterable"] as const;

/** Project types whose JS/TS files get the TypeScript service. */
const TS_PROJECTS: ReadonlySet<LanguageId> = new Set([
  "typescript",
  "javascript",
  "web",
  "web-ts",
  "react",
  "bun",
  "hono",
]);

/** Project types that see the emulated `Bun` global. */
const BUN_PROJECTS: ReadonlySet<LanguageId> = new Set(["bun", "hono"]);

/** Script files the service understands (declaration files included). */
const SCRIPT_FILE = /\.(?:[cm]?[jt]sx?)$/;

/** Does this project type use the TypeScript service? */
export function usesTsService(language: LanguageId): boolean {
  return TS_PROJECTS.has(language);
}

/** Does this project type get the `Bun` global's types? */
export function usesBunTypes(language: LanguageId): boolean {
  return BUN_PROJECTS.has(language);
}

/** Is this file one the service handles (hover, completions, diagnostics)? */
export function isTsServicePath(path: string): boolean {
  return SCRIPT_FILE.test(path);
}

/** The file's path inside the service's virtual file system (the project sits at `/`). */
export function vfsPath(path: string): string {
  return `/${path.replace(/^\/+/, "")}`;
}

/**
 * The files the service should mirror: scripts, plus `package.json` and
 * `tsconfig.json` (read for types, never executed).
 */
export function serviceFiles(files: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files)
      .filter(([path]) => isTsServicePath(path) || path === "package.json")
      .map(([path, code]) => [vfsPath(path), code]),
  );
}

/**
 * An exact version for type acquisition, which fetches types from jsDelivr
 * and only understands exact versions or tags: `^19.3.0` → `19.3.0`; any other
 * range → `latest`.
 */
export function typesVersion(range: string): string {
  const exact = /^[~^=v]?\s*(\d+\.\d+\.\d+(?:-[\w.]+)?)$/.exec(range.trim());
  return exact?.[1] ?? "latest";
}

/**
 * Source text that makes type acquisition fetch each dependency's types at
 * the project's version (`// types: <version>` is its per-import hint).
 * Packages without their own types fall back to DefinitelyTyped's `@types/*`,
 * which type acquisition always takes at `latest`.
 */
export function typesSource(files: Readonly<Record<string, string>>): string {
  const { versions } = readDependencies(files);
  return [...versions]
    .map(([name, range]) => `import "${name}"; // types: ${typesVersion(range)}`)
    .join("\n");
}

/**
 * Diagnostics held back while types are still downloading: "cannot find
 * module", "no declaration file" and missing JSX types would flash and disappear.
 */
export const PENDING_TYPES_CODES: readonly number[] = [2307, 2792, 2875, 7016, 7026];

/**
 * Diagnostics never shown: runs strip types without checking them, and the
 * playground resolves `./x.ts` imports and `.css` side-effect imports itself.
 */
export const IGNORED_CODES: readonly number[] = [
  // An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.
  5097,
  // Cannot find module './styles.css' (a side-effect import the linker turns into a style tag).
  2882,
];

/** Where the emulated Bun global's types are mounted. */
export const BUN_TYPES_PATH = "/node_modules/@types/bun-emulated/index.d.ts";

/** Types for the emulated `Bun` global (see `lib/playground/runtime/bun-shim.ts`). */
export const BUN_TYPES = `/** Bun, emulated in your browser (see the playground's help). */
interface BunFile {
  readonly name: string;
  exists(): Promise<boolean>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  bytes(): Promise<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array> | null;
}
interface BunServer {
  readonly port: number;
  readonly hostname: string;
  readonly development: boolean;
  readonly url: URL;
  stop(): void;
  fetch(input: string | Request): Promise<Response>;
}
interface BunServeOptions {
  port?: number;
  fetch(request: Request, server: BunServer): Response | Promise<Response>;
  error?(error: Error): Response | Promise<Response>;
}
declare var Bun: {
  /** The emulated version. */
  readonly version: string;
  readonly revision: string;
  readonly main: string;
  readonly argv: string[];
  /** Environment variables from the project's .env file. */
  readonly env: Record<string, string | undefined>;
  /** Register a request handler; the playground's HTTP panel sends it requests. */
  serve(options: BunServeOptions): BunServer;
  /** A file of the project (an in-memory copy). */
  file(path: string): BunFile;
  /** Write a file (to the in-memory copy). */
  write(destination: string | BunFile, data: string | Blob | ArrayBuffer | Uint8Array | Response): Promise<number>;
  sleep(ms: number | Date): Promise<void>;
  nanoseconds(): number;
  which(command: string): string | null;
  inspect(value: unknown): string;
  /** Not available in the emulation (throws). */
  spawn(...args: unknown[]): never;
  /** Not available in the emulation (throws). */
  spawnSync(...args: unknown[]): never;
  /** Not available in the emulation (throws). */
  $(...args: unknown[]): never;
};
declare var process: {
  readonly env: Record<string, string | undefined>;
  readonly argv: string[];
  readonly version: string;
  cwd(): string;
  exit(code?: number): never;
  nextTick(fn: (...args: unknown[]) => void, ...args: unknown[]): void;
};
`;
