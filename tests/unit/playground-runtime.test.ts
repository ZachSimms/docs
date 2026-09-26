/** Unit tests for the sandbox runtime: console formatting, the message filter and the workers (with fakes). */
import { describe, expect, it } from "bun:test";
import { formatConsoleArgs } from "@/lib/playground/runtime/format";
import {
  acceptFrameMessage,
  MAX_MESSAGE_TEXT,
  newRunToken,
} from "@/lib/playground/runtime/protocol";
import {
  buildRunnerSrcDoc,
  jsWorkerMain,
  pythonWorkerMain,
  type PyodideLike,
  type WorkerLike,
} from "@/lib/playground/runtime/sandbox";

describe("formatConsoleArgs", () => {
  it("prints strings raw and inspects everything else", () => {
    expect(formatConsoleArgs(["a", 1, true, null, undefined])).toBe("a 1 true null undefined");
    expect(formatConsoleArgs([{ a: 1, "b-c": "x", nested: { d: [1, 2] } }])).toBe(
      '{ a: 1, "b-c": "x", nested: { d: [ 1, 2 ] } }',
    );
    expect(formatConsoleArgs([[]])).toBe("[]");
    expect(formatConsoleArgs([new Map([["k", 1]]), new Set([1])])).toBe(
      'Map(1) { "k" => 1 } Set(1) { 1 }',
    );
    expect(formatConsoleArgs([BigInt(10), Symbol("s"), function named() {}])).toBe(
      "10n Symbol(s) [Function named]",
    );
  });

  it("handles cycles, depth and long collections", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(formatConsoleArgs([cyclic])).toBe('{ name: "x", self: [Circular] }');
    expect(formatConsoleArgs([{ a: { b: { c: { d: { e: 1 } } } } }])).toBe(
      "{ a: { b: { c: { d: [Object] } } } }",
    );
    expect(formatConsoleArgs([Array.from({ length: 105 }, (_, i) => i)])).toContain("… 5 more");
  });

  it("names class instances", () => {
    class Point {
      x = 1;
    }
    expect(formatConsoleArgs([new Point()])).toBe("Point { x: 1 }");
  });
});

describe("acceptFrameMessage", () => {
  const frame = {} as Window;
  const other = {} as Window;
  const token = newRunToken();

  it("accepts well-formed messages from the frame for the current run", () => {
    expect(
      acceptFrameMessage(
        { source: frame, data: { type: "out", token, stream: "stdout", text: "hi" } },
        frame,
        token,
      ),
    ).toEqual({
      type: "out",
      token,
      stream: "stdout",
      text: "hi",
    });
    expect(acceptFrameMessage({ source: frame, data: { type: "ready" } }, frame, null)?.type).toBe(
      "ready",
    );
  });

  it("drops messages from other windows, stale runs and malformed payloads", () => {
    const out = { type: "out", token, stream: "stdout", text: "hi" };
    expect(acceptFrameMessage({ source: other, data: out }, frame, token)).toBeNull();
    expect(
      acceptFrameMessage({ source: frame, data: { ...out, token: "old" } }, frame, token),
    ).toBeNull();
    expect(
      acceptFrameMessage({ source: frame, data: { ...out, stream: "html" } }, frame, token),
    ).toBeNull();
    expect(acceptFrameMessage({ source: frame, data: "<img onerror=x>" }, frame, token)).toBeNull();
    expect(acceptFrameMessage({ source: frame, data: out }, null, token)).toBeNull();
  });

  it("caps the text of a single message", () => {
    const big = { type: "out", token, stream: "stdout", text: "x".repeat(MAX_MESSAGE_TEXT + 5) };
    const accepted = acceptFrameMessage({ source: frame, data: big }, frame, token);
    expect(accepted?.type === "out" && accepted.text.length).toBe(MAX_MESSAGE_TEXT);
  });

  it("makes a distinct token per run", () => {
    expect(newRunToken()).not.toBe(newRunToken());
  });
});

/** A fake worker scope that records posted messages. */
function fakeScope() {
  const posted: Record<string, unknown>[] = [];
  const rejections: ((event: { reason: unknown }) => void)[] = [];
  const scope: WorkerLike = {
    postMessage: (m) => posted.push(m as Record<string, unknown>),
    onmessage: null,
    addEventListener: (_type, listener) => rejections.push(listener),
  };
  return { scope, posted, rejections };
}

describe("jsWorkerMain", () => {
  const original = { ...console };
  const restore = () => Object.assign(console, original);

  it("redirects console output and reports done", async () => {
    const { scope, posted } = fakeScope();
    jsWorkerMain(scope, formatConsoleArgs, async () => {
      console.log("hello", { a: 1 });
      console.error("bad");
    });
    try {
      await scope.onmessage?.({ data: { entryUrl: "data:x" } });
    } finally {
      restore();
    }
    expect(posted).toEqual([
      { type: "out", stream: "stdout", text: "hello { a: 1 }\n" },
      { type: "out", stream: "stderr", text: "bad\n" },
      { type: "done", exitCode: 0 },
    ]);
  });

  it("reports a thrown error with exit code 1, and unhandled rejections", async () => {
    const { scope, posted, rejections } = fakeScope();
    jsWorkerMain(scope, formatConsoleArgs, async () => {
      throw new TypeError("nope");
    });
    try {
      await scope.onmessage?.({ data: { entryUrl: "data:x" } });
      rejections[0]?.({ reason: "later" });
    } finally {
      restore();
    }
    expect(String(posted[0]?.text)).toContain("TypeError: nope");
    expect(posted[1]).toEqual({ type: "done", exitCode: 1 });
    expect(posted[2]).toEqual({
      type: "out",
      stream: "stderr",
      text: "Uncaught (in promise) Uncaught later\n",
    });
  });
});

/** A fake Pyodide that records what the worker asks of it. */
function fakePyodide(exitCode: unknown = 0) {
  const written: Record<string, string> = {};
  const dirs: string[] = [];
  const ran: string[] = [];
  let stdin: (() => string | null) | null = null;
  let stdout: ((b: Uint8Array) => number) | null = null;
  const py: PyodideLike = {
    FS: { mkdirTree: (p) => void dirs.push(p), writeFile: (p, d) => void (written[p] = d) },
    setStdout: (o) => void (stdout = o.write),
    setStderr: () => undefined,
    setStdin: (o) => void (stdin = o.stdin),
    loadPackagesFromImports: async () => undefined,
    runPythonAsync: async (code) => {
      ran.push(code);
      if (code.includes("runpy.run_path")) {
        stdout?.(new TextEncoder().encode("out\n"));
        return exitCode;
      }
      return undefined;
    },
    globals: { get: () => undefined },
    toPy: (v) => v,
  };
  return { py, written, dirs, ran, readStdin: () => stdin?.() };
}

describe("pythonWorkerMain", () => {
  it("boots once, writes the project tree, feeds stdin and reports the exit code", async () => {
    const { scope, posted } = fakeScope();
    const fake = fakePyodide(3);
    let boots = 0;
    pythonWorkerMain(scope, async () => {
      boots++;
      return fake.py;
    });
    const job = {
      files: { "main.py": "print(1)", "pkg/mod.py": "x = 1" },
      entry: "main.py",
      stdin: "a\nb",
      indexUrl: "https://cdn/",
    };
    await scope.onmessage?.({ data: job });
    await scope.onmessage?.({ data: job });
    expect(boots).toBe(1);
    expect(fake.written["/home/pyodide/project/pkg/mod.py"]).toBe("x = 1");
    expect(fake.dirs).toContain("/home/pyodide/project/pkg");
    expect([fake.readStdin(), fake.readStdin(), fake.readStdin()]).toEqual(["a", "b", null]);
    expect(posted).toContainEqual({ type: "out", stream: "stdout", text: "out\n" });
    expect(posted).toContainEqual({ type: "progress", text: "running" });
    expect(posted.filter((m) => m.type === "done")).toEqual([
      { type: "done", exitCode: 3 },
      { type: "done", exitCode: 3 },
    ]);
  });

  it("reports a failing boot as stderr", async () => {
    const { scope, posted } = fakeScope();
    pythonWorkerMain(scope, async () => {
      throw new Error("offline");
    });
    await scope.onmessage?.({ data: { files: {}, entry: "main.py", stdin: "", indexUrl: "x" } });
    expect(posted).toContainEqual({ type: "out", stream: "stderr", text: "offline\n" });
    expect(posted.at(-1)).toEqual({ type: "done", exitCode: 1 });
  });
});

describe("buildRunnerSrcDoc", () => {
  it("is a single script whose serialised code can't close its own tag", () => {
    const doc = buildRunnerSrcDoc();
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc.match(/<\/script>/g)).toHaveLength(1);
    expect(doc).toContain("formatConsoleArgs");
    expect(doc).toContain("pyodide.mjs");
  });
});
