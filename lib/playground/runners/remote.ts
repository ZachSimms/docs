/**
 * @file C++ and Rust runners: public compile-and-run services called from the browser.
 *
 * Primary: Compiler Explorer (godbolt.org), which builds C++ projects with
 * CMake (so headers, folders and several `.cpp` files work) and runs Rust with
 * stdin. Fallbacks when it is down or rate-limiting: Wandbox for C++ and the
 * Rust Playground for Rust (no stdin there).
 *
 * Privacy and fairness: requests carry only the project files and stdin, with
 * no cookies (`credentials: "omit"`) and no referrer. Responses are validated
 * with Zod and returned as plain text. Runs are started only by the user; the
 * UI enforces a cooldown between them.
 */

import { z } from "zod";
import { CMAKE_FILE, CMAKE_TARGET, generateCMakeLists } from "../cmake";
import { stripAnsi } from "../output";
import { dirname, type Project } from "../project";
import {
  inlineRustModules,
  mapRustPositions,
  RustModuleError,
  type SourceLine,
} from "../rust-inline";
import type { Emit, Fetch, RunRequest, RunResult } from "./types";

/** Compiler Explorer's API root. */
export const COMPILER_EXPLORER = "https://godbolt.org/api";
/** Compiler ids, checked against `/api/compilers` on 2026-09-26. */
export const CE_COMPILERS = { cpp: "g162", rust: "r1980" } as const;
/** Wandbox's compile endpoint and C++ compiler. */
export const WANDBOX = "https://wandbox.org/api/compile.json";
const WANDBOX_CPP = "gcc-head";
/** The Rust Playground's execute endpoint. */
export const RUST_PLAYGROUND = "https://play.rust-lang.org/execute";
/** Each service is given this long before the run moves on to the fallback (or gives up). */
export const REMOTE_TIMEOUT_MS = 20_000;

/** A request ready for `fetch`: URL and JSON body. */
export interface RemoteRequest {
  readonly url: string;
  readonly body: unknown;
}

/** What a service said: compiler messages, program output, exit code. */
export interface RemoteOutcome {
  /** Compiler errors and warnings. */
  readonly compile: string;
  /** Whether the program ran. */
  readonly ran: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

/** The service couldn't be used (network error, 429, 5xx, bad response): try the fallback. */
export class ServiceUnavailable extends Error {
  override name = "ServiceUnavailable";
}

// ---- Compiler Explorer -------------------------------------------------------

const ceLines = z.array(z.object({ text: z.string() })).default([]);
const ceResult = z.object({
  code: z.number().nullable().optional(),
  stdout: ceLines,
  stderr: ceLines,
});
const ceResponse = z.object({
  code: z.number().nullable().optional(),
  didExecute: z.boolean().optional(),
  stdout: ceLines,
  stderr: ceLines,
  buildResult: ceResult.partial().optional(),
  buildsteps: z.array(ceResult.partial().extend({ step: z.string().optional() })).optional(),
  result: ceResult.partial().optional(),
  execResult: ceResult.partial().extend({ timedOut: z.boolean().optional() }).optional(),
  timedOut: z.boolean().optional(),
});

/** Compiler Explorer builds CMake projects in `/app`; paths read better without it. */
const CE_WORKDIR = /\/app\//g;

const joinLines = (lines: readonly { text: string }[] | undefined) =>
  stripAnsi((lines ?? []).map((l) => `${l.text}\n`).join("")).replace(CE_WORKDIR, "");

/** Options shared by every Compiler Explorer execution request. */
function ceOptions(userArguments: string, stdin: string, extra: Record<string, unknown> = {}) {
  return {
    userArguments,
    executeParameters: { args: [], stdin },
    compilerOptions: { executorRequest: true, skipAsm: true, ...extra },
    filters: { execute: true },
    tools: [],
    libraries: [],
  };
}

/**
 * Whether a project file is a `.env` file (`.env`, `.env.local`, in any folder): it may hold
 * the reader's keys, and a C/C++ build has no use for it, so it never leaves the browser.
 */
export function isEnvFile(path: string): boolean {
  return /(?:^|\/)\.env(?:\.[^/]*)?$/.test(path);
}

/** The project's paths that are sent to a compile service: all but `.env` files. */
const uploadedPaths = (project: Project) => Object.keys(project.files).filter((p) => !isEnvFile(p));

/**
 * Build a Compiler Explorer CMake request for a C/C++ project. A project
 * without its own `CMakeLists.txt` gets a generated one.
 */
export function buildCppRequest(project: Project, stdin: string): RemoteRequest {
  const paths = uploadedPaths(project);
  const cmake = project.files[CMAKE_FILE] ?? generateCMakeLists(paths);
  const files = paths
    .filter((p) => p !== CMAKE_FILE)
    .map((filename) => ({ filename, contents: project.files[filename] ?? "" }));
  return {
    url: `${COMPILER_EXPLORER}/compiler/${CE_COMPILERS.cpp}/cmake`,
    body: {
      source: cmake,
      options: ceOptions("-O1", stdin, { cmakeArgs: "", customOutputFilename: CMAKE_TARGET }),
      files,
      lang: "cmake",
      allowStoreCodeDebug: false,
    },
  };
}

/** Build a Compiler Explorer request for an inlined Rust crate. */
export function buildRustRequest(code: string, stdin: string): RemoteRequest {
  return {
    url: `${COMPILER_EXPLORER}/compiler/${CE_COMPILERS.rust}/compile`,
    body: {
      source: code,
      options: ceOptions("--edition 2024", stdin),
      lang: "rust",
      allowStoreCodeDebug: false,
    },
  };
}

/**
 * Read a Compiler Explorer response (the CMake and the compile endpoints
 * answer in slightly different shapes).
 *
 * @throws {ServiceUnavailable} When the body isn't a recognizable response.
 */
export function parseCompilerExplorer(json: unknown): RemoteOutcome {
  const parsed = ceResponse.safeParse(json);
  if (!parsed.success)
    throw new ServiceUnavailable("Compiler Explorer sent an unexpected response.");
  const r = parsed.data;
  const failedSteps = (r.buildsteps ?? []).filter((s) => (s.code ?? 0) !== 0);
  const compile =
    failedSteps.map((s) => joinLines(s.stderr) + joinLines(s.stdout)).join("") +
    joinLines(r.buildResult?.stderr) +
    (r.result && (r.result.code ?? 0) !== 0 ? joinLines(r.result.stderr) : "");
  const ran = r.didExecute ?? (r.execResult !== undefined && failedSteps.length === 0);
  if (!ran) {
    // "Build failed" is the compile endpoint's summary line; the details are in buildResult.
    const summary = compile ? "" : joinLines(r.stderr);
    return { compile: compile + summary, ran: false, stdout: "", stderr: "", exitCode: null };
  }
  const exec = r.execResult;
  const stdout = exec?.stdout?.length ? joinLines(exec.stdout) : joinLines(r.stdout);
  const stderr = exec?.stderr?.length ? joinLines(exec.stderr) : joinLines(r.stderr);
  const timedOut =
    exec?.timedOut || r.timedOut ? "\n(the program was stopped: time limit reached)\n" : "";
  return {
    compile,
    ran: true,
    stdout,
    stderr: stderr + timedOut,
    exitCode: exec?.code ?? r.code ?? null,
  };
}

// ---- Wandbox (C++ fallback) --------------------------------------------------

const wandboxResponse = z.object({
  status: z.string().optional(),
  compiler_error: z.string().optional(),
  compiler_output: z.string().optional(),
  program_output: z.string().optional(),
  program_error: z.string().optional(),
  signal: z.string().optional(),
});

/** Build a Wandbox request: the entry as `code`, the rest as `codes`, extra sources and include dirs as flags. */
export function buildWandboxRequest(project: Project, stdin: string): RemoteRequest {
  const others = uploadedPaths(project).filter((p) => p !== project.entry && p !== CMAKE_FILE);
  const sources = others.filter((p) => /\.(?:cpp|cc|cxx|c)$/i.test(p));
  const includeDirs = [
    ...new Set(others.filter((p) => /\.(?:h|hh|hpp|hxx)$/i.test(p)).map((p) => dirname(p) || ".")),
  ];
  return {
    url: WANDBOX,
    body: {
      compiler: WANDBOX_CPP,
      code: project.files[project.entry] ?? "",
      codes: others.map((file) => ({ file, code: project.files[file] ?? "" })),
      options: "",
      stdin,
      "compiler-option-raw": ["-std=c++2b", ...includeDirs.map((d) => `-I${d}`), ...sources].join(
        "\n",
      ),
      save: false,
    },
  };
}

/** Read a Wandbox response. */
export function parseWandbox(json: unknown): RemoteOutcome {
  const parsed = wandboxResponse.safeParse(json);
  if (!parsed.success) throw new ServiceUnavailable("Wandbox sent an unexpected response.");
  const r = parsed.data;
  const compile = (r.compiler_error ?? "") + (r.compiler_output ?? "");
  const ran =
    r.program_output !== undefined || r.program_error !== undefined || r.status !== undefined;
  const status = r.status === undefined || r.status === "" ? null : Number(r.status);
  const failedToBuild = !r.program_output && !r.program_error && compile.length > 0 && status !== 0;
  return {
    compile,
    ran: ran && !failedToBuild,
    stdout: r.program_output ?? "",
    stderr: (r.program_error ?? "") + (r.signal ? `\n(${r.signal})\n` : ""),
    exitCode: failedToBuild ? null : status,
  };
}

// ---- Rust Playground (Rust fallback) -----------------------------------------

const rustPlaygroundResponse = z.object({
  success: z.boolean(),
  exitDetail: z.string().optional(),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
});

/** Build a Rust Playground request (it has no stdin). */
export function buildRustPlaygroundRequest(code: string): RemoteRequest {
  return {
    url: RUST_PLAYGROUND,
    body: {
      channel: "stable",
      mode: "debug",
      edition: "2024",
      crateType: "bin",
      tests: false,
      code,
      backtrace: false,
    },
  };
}

/** Cargo's own progress lines, which the Rust Playground mixes into stderr. */
const CARGO_NOISE = /^\s+(?:Compiling|Finished|Running) .*\n/gm;

/** Read a Rust Playground response. */
export function parseRustPlayground(json: unknown): RemoteOutcome {
  const parsed = rustPlaygroundResponse.safeParse(json);
  if (!parsed.success)
    throw new ServiceUnavailable("The Rust Playground sent an unexpected response.");
  const r = parsed.data;
  const stderr = r.stderr.replace(CARGO_NOISE, "");
  const code = /status (\d+)/.exec(r.exitDetail ?? "")?.[1];
  const builtAndRan = r.success || r.stdout.length > 0 || /Running/.test(r.stderr);
  return builtAndRan
    ? {
        compile: "",
        ran: true,
        stdout: r.stdout,
        stderr,
        exitCode: code ? Number(code) : r.success ? 0 : null,
      }
    : { compile: stderr, ran: false, stdout: "", stderr: "", exitCode: null };
}

// ---- Running -----------------------------------------------------------------

/**
 * POST a request and parse the reply.
 *
 * @throws {ServiceUnavailable} On network errors, 429 and 5xx responses, or bad JSON.
 * @throws {DOMException} `AbortError` when the user stopped the run.
 */
async function send<T>(
  request: RemoteRequest,
  parse: (json: unknown) => T,
  signal: AbortSignal,
  fetchImpl: Fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request.body),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.any([signal, AbortSignal.timeout(REMOTE_TIMEOUT_MS)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ServiceUnavailable(
      error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error",
    );
  }
  if (response.status === 429 || response.status >= 500)
    throw new ServiceUnavailable(`HTTP ${response.status}`);
  if (!response.ok) throw new ServiceUnavailable(`HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ServiceUnavailable("unreadable response");
  }
  return parse(json);
}

/** Emit an outcome, mapping source positions if a mapper is given. */
function report(
  outcome: RemoteOutcome,
  emit: Emit,
  map: (text: string) => string = (t) => t,
): RunResult {
  if (outcome.compile) emit({ stream: "stderr", text: map(outcome.compile) });
  if (outcome.stdout) emit({ stream: "stdout", text: outcome.stdout });
  if (outcome.stderr) emit({ stream: "stderr", text: map(outcome.stderr) });
  return { exitCode: outcome.ran ? outcome.exitCode : null };
}

/** Try the primary service, then the fallback when the primary is unavailable. */
async function withFallback(
  primary: () => Promise<RemoteOutcome>,
  fallback: () => Promise<RemoteOutcome>,
  names: readonly [string, string],
  emit: Emit,
): Promise<RemoteOutcome> {
  try {
    return await primary();
  } catch (error) {
    if (!(error instanceof ServiceUnavailable)) throw error;
    emit({
      stream: "info",
      text: `${names[0]} is unavailable (${error.message}); trying ${names[1]}…\n`,
    });
  }
  try {
    return await fallback();
  } catch (error) {
    if (!(error instanceof ServiceUnavailable)) throw error;
    throw new Error(`${names[1]} is unavailable too (${error.message}). Try again in a minute.`);
  }
}

/**
 * Compile and run a C/C++ project.
 *
 * @throws {Error} When both services are unavailable (message for the console).
 */
export async function runCpp(
  request: RunRequest,
  emit: Emit,
  fetchImpl: Fetch = fetch,
): Promise<RunResult> {
  const { project, stdin, signal } = request;
  const outcome = await withFallback(
    () => send(buildCppRequest(project, stdin), parseCompilerExplorer, signal, fetchImpl),
    () => send(buildWandboxRequest(project, stdin), parseWandbox, signal, fetchImpl),
    ["Compiler Explorer", "Wandbox"],
    emit,
  );
  return report(outcome, emit);
}

/**
 * Compile and run a Rust crate (modules inlined first).
 *
 * @throws {Error} When both services are unavailable, or a module file is missing.
 */
export async function runRust(
  request: RunRequest,
  emit: Emit,
  fetchImpl: Fetch = fetch,
): Promise<RunResult> {
  const { project, stdin, signal } = request;
  let crate: { code: string; lines: readonly SourceLine[] };
  try {
    crate = inlineRustModules(project.files, project.entry);
  } catch (error) {
    if (error instanceof RustModuleError) {
      emit({ stream: "stderr", text: `${error.message}\n` });
      return { exitCode: null };
    }
    throw error;
  }
  const outcome = await withFallback(
    () => send(buildRustRequest(crate.code, stdin), parseCompilerExplorer, signal, fetchImpl),
    async () => {
      if (stdin)
        emit({
          stream: "info",
          text: "The Rust Playground can't read stdin; running without it.\n",
        });
      return send(buildRustPlaygroundRequest(crate.code), parseRustPlayground, signal, fetchImpl);
    },
    ["Compiler Explorer", "the Rust Playground"],
    emit,
  );
  return report(outcome, emit, (text) => mapRustPositions(text, crate.lines));
}
