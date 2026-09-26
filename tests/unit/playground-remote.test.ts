/** Unit tests for `lib/playground/runners/remote.ts`, against responses recorded from the live services. */
import { describe, expect, it } from "bun:test";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  buildCppRequest,
  buildRustRequest,
  buildWandboxRequest,
  parseCompilerExplorer,
  parseRustPlayground,
  parseWandbox,
  runCpp,
  runRust,
  ServiceUnavailable,
} from "@/lib/playground/runners/remote";
import type { RunEvent } from "@/lib/playground/runners/types";
import { TEMPLATES } from "@/lib/playground/templates";

/** The request bodies the builders produce, as far as the tests look. */
interface CeBody {
  source: string;
  files: { filename: string }[];
  options: {
    userArguments: string;
    executeParameters: { stdin: string };
    filters: { execute: boolean };
  };
}
interface WandboxBody {
  code: string;
  stdin: string;
  "compiler-option-raw": string;
}

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(__dirname, "..", "fixtures", "playground", name), "utf8"));

describe("request builders", () => {
  it("sends C++ projects to the CMake endpoint with every file and a generated build file", () => {
    const { url, body } = buildCppRequest(TEMPLATES.cpp, "21") as { url: string; body: CeBody };
    expect(url).toBe("https://godbolt.org/api/compiler/g162/cmake");
    expect(body.source).toContain("add_executable(app main.cpp src/vec.cpp)");
    expect(body.files.map((f) => f.filename).sort()).toEqual([
      "README.md",
      "include/vec.h",
      "main.cpp",
      "src/vec.cpp",
    ]);
    expect(body.options.executeParameters.stdin).toBe("21");
    expect(body.options.filters.execute).toBe(true);
  });

  it("uses the project's own CMakeLists.txt when it has one", () => {
    const project = {
      ...TEMPLATES.cpp,
      files: { ...TEMPLATES.cpp.files, "CMakeLists.txt": "# mine" },
    };
    const { body } = buildCppRequest(project, "") as { body: CeBody };
    expect(body.source).toBe("# mine");
    expect(body.files.some((f) => f.filename === "CMakeLists.txt")).toBe(false);
  });

  it("builds the Rust and Wandbox requests", () => {
    const rust = buildRustRequest("fn main() {}", "x") as { url: string; body: CeBody };
    expect(rust.url).toBe("https://godbolt.org/api/compiler/r1980/compile");
    expect(rust.body.options.userArguments).toContain("--edition 2024");
    const wandbox = buildWandboxRequest(TEMPLATES.cpp, "7") as { body: WandboxBody };
    expect(wandbox.body.code).toBe(TEMPLATES.cpp.files["main.cpp"]);
    expect(wandbox.body["compiler-option-raw"]).toBe("-std=c++2b\n-Iinclude\nsrc/vec.cpp");
    expect(wandbox.body.stdin).toBe("7");
  });
});

describe("parseCompilerExplorer", () => {
  it("reads a CMake build that ran", () => {
    const out = parseCompilerExplorer(fixture("ce-cmake-ok.json"));
    expect(out).toMatchObject({ ran: true, stdout: "5 7\n", exitCode: 0, compile: "" });
  });

  it("reads a CMake build that failed to compile", () => {
    const out = parseCompilerExplorer(fixture("ce-cmake-error.json"));
    expect(out.ran).toBe(false);
    expect(out.compile).toContain("src/vec.cpp:2:34: error: 'oops' was not declared in this scope");
  });

  it("reads a Rust run and a Rust compile error", () => {
    expect(parseCompilerExplorer(fixture("ce-rust-ok.json"))).toMatchObject({
      ran: true,
      stdout: "got 42\n",
      stderr: "warn\n",
    });
    const err = parseCompilerExplorer(fixture("ce-rust-error.json"));
    expect(err.ran).toBe(false);
    expect(err.compile).toContain("mismatched types");
    expect(err.compile).not.toContain("Build failed");
  });

  it("treats an unrecognisable body as the service being unavailable", () => {
    expect(() => parseCompilerExplorer("<html>")).toThrow(ServiceUnavailable);
  });
});

describe("fallback parsers", () => {
  it("reads Wandbox and Rust Playground runs", () => {
    expect(parseWandbox(fixture("wandbox-ok.json"))).toMatchObject({
      ran: true,
      stdout: "42\n",
      exitCode: 0,
    });
    const rp = parseRustPlayground(fixture("rust-playground-ok.json"));
    expect(rp).toMatchObject({ ran: true, stdout: "hi\n", exitCode: 0 });
    expect(rp.stderr).toBe("note\n");
  });

  it("reads compile failures", () => {
    expect(parseWandbox({ status: "1", compiler_error: "prog.cc:1: error: x" })).toMatchObject({
      ran: false,
      exitCode: null,
    });
    expect(
      parseRustPlayground({ success: false, stdout: "", stderr: "error[E0425]: nope\n" }),
    ).toMatchObject({
      ran: false,
      compile: "error[E0425]: nope\n",
    });
  });
});

/** A fetch that answers from a queue of canned responses and records requests. */
function fakeFetch(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  };
  return { impl, calls };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

const collect = () => {
  const events: RunEvent[] = [];
  return { events, emit: (e: RunEvent) => events.push(e) };
};

describe("runCpp / runRust", () => {
  const signal = new AbortController().signal;

  it("sends no cookies or referrer, and emits the program's output", async () => {
    const { impl, calls } = fakeFetch(json(fixture("ce-cmake-ok.json")));
    const { events, emit } = collect();
    const result = await runCpp({ project: TEMPLATES.cpp, stdin: "7", signal }, emit, impl);
    expect(result.exitCode).toBe(0);
    expect(events).toEqual([{ stream: "stdout", text: "5 7\n" }]);
    expect(calls[0]?.init.credentials).toBe("omit");
    expect(calls[0]?.init.referrerPolicy).toBe("no-referrer");
  });

  it("falls back to Wandbox on a 503 and says so", async () => {
    const { impl, calls } = fakeFetch(json({}, 503), json(fixture("wandbox-ok.json")));
    const { events, emit } = collect();
    await runCpp({ project: TEMPLATES.cpp, stdin: "", signal }, emit, impl);
    expect(calls.map((c) => c.url)).toEqual([
      "https://godbolt.org/api/compiler/g162/cmake",
      "https://wandbox.org/api/compile.json",
    ]);
    expect(events[0]).toEqual({
      stream: "info",
      text: "Compiler Explorer is unavailable (HTTP 503); trying Wandbox…\n",
    });
    expect(events.at(-1)).toEqual({ stream: "stdout", text: "42\n" });
  });

  it("gives a friendly error when both services are down", async () => {
    const { impl } = fakeFetch(new TypeError("offline"), json({}, 429));
    expect(
      runCpp({ project: TEMPLATES.cpp, stdin: "", signal }, collect().emit, impl),
    ).rejects.toThrow(/Wandbox is unavailable too \(HTTP 429\)/);
  });

  it("maps Rust error positions back to the module file", async () => {
    const error = {
      code: -1,
      didExecute: false,
      stdout: [],
      stderr: [{ text: "Build failed" }],
      buildResult: { code: 1, stderr: [{ text: " --> <source>:2:5" }] },
    };
    const { impl } = fakeFetch(json(error));
    const { events, emit } = collect();
    const result = await runRust({ project: TEMPLATES.rust, stdin: "", signal }, emit, impl);
    expect(result.exitCode).toBeNull();
    expect(events).toEqual([{ stream: "stderr", text: " --> src/geometry.rs:1:5\n" }]);
  });

  it("reports a missing Rust module without calling any service", async () => {
    const { impl, calls } = fakeFetch();
    const { events, emit } = collect();
    const project = { ...TEMPLATES.rust, files: { "src/main.rs": "mod gone;\nfn main() {}" } };
    await runRust({ project, stdin: "", signal }, emit, impl);
    expect(calls).toHaveLength(0);
    expect(events[0]?.text).toMatch(/file not found for module `gone`/);
  });

  it("warns that the Rust Playground fallback ignores stdin", async () => {
    const { impl } = fakeFetch(json({}, 502), json(fixture("rust-playground-ok.json")));
    const { events, emit } = collect();
    await runRust({ project: TEMPLATES.rust, stdin: "hello", signal }, emit, impl);
    expect(events.some((e) => /can't read stdin/.test(e.text))).toBe(true);
  });
});
