/**
 * @file Running a playground project: dispatch per language, output, limits, Stop.
 *
 * Client hook. JS/TS and Python go to the sandboxed runner frame (linked or
 * written out first, in this page, without evaluating anything); C++ and Rust
 * go to the remote services; GDScript goes to the Godot frame. The web
 * preview runs itself (see `WebPreview`) and reports its console through
 * {@link PlaygroundRun.appendExternal}.
 *
 * Limits: JS/TS 10 s from start, Python 30 s from when user code starts (the
 * first run downloads the runtime), remote runs 20 s per service and a 3 s cooldown
 * between them, Godot 30 s after the engine is up. Hitting a limit or pressing
 * Stop replaces the frame, which kills whatever was running. Every sandboxed
 * run gets a fresh frame, and a hard cap from its start that messages from the
 * sandbox can't clear or extend.
 */

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getLanguage, type LanguageId } from "@/lib/playground/languages";
import { linkModules, replaceModuleUrls } from "@/lib/playground/module-linker";
import { parseDotEnv } from "@/lib/playground/dotenv";
import type { HttpRequestMessage, HttpResult } from "@/lib/playground/http";
import { appendOutput, EMPTY_OUTPUT, type Output, type Stream } from "@/lib/playground/output";
import type { Project } from "@/lib/playground/project";
import { newRunToken, type FrameMessage } from "@/lib/playground/runtime/protocol";
import { buildRunnerSrcDoc } from "@/lib/playground/runtime/sandbox";
import { runCpp, runRust } from "@/lib/playground/runners/remote";
import type { RunEvent } from "@/lib/playground/runners/types";
import { transpile } from "@/lib/playground/transpile";
import { useSandboxFrame } from "./useSandboxFrame";

/** Pinned Pyodide build on jsDelivr (only ever loaded inside the sandbox). */
export const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
/** The Godot runner page (see `playground/godot-runner/`). */
export const GODOT_RUNNER_URL = "/playground/godot/index.html";

/** Time limits in milliseconds. */
export const RUN_LIMITS = {
  script: 10_000,
  python: 30_000,
  pythonLoad: 180_000,
  godot: 30_000,
  godotLoad: 180_000,
  remoteCooldown: 3_000,
  /** An emulated Bun server with no requests for this long is stopped. */
  serverIdle: 15 * 60_000,
  /** One HTTP panel request may take this long. */
  request: 10_000,
} as const;

/** Where a run is. */
export type RunPhase = "idle" | "running" | "done" | "stopped" | "failed";

/** Everything the UI reads and does. */
export interface PlaygroundRun {
  output: Output;
  phase: RunPhase;
  /**
   * Whether a sandbox may still be running code (a finished run's timers or
   * `_process` keep going until its frame is replaced): Stop stays enabled.
   */
  live: boolean;
  /** The port an emulated Bun server listens on, or `null` when none is running. */
  served: number | null;
  /** Send an HTTP panel request to the running server. */
  request(message: Omit<HttpRequestMessage, "id">): Promise<HttpResult>;
  /** Short status for the console bar: "loading…", "ran in 1.2 s · exit 0", … */
  status: string;
  run(language: LanguageId, project: Project, stdin: string): void;
  stop(): void;
  clear(): void;
  /** Output from the web preview. */
  appendExternal(stream: Stream, text: string): void;
  /** The hidden runner frame, to render anywhere in the page. */
  frames: ReactNode;
  /**
   * The Godot frame, shown as a small "Godot view" beside the console (a hidden
   * frame would have its animation frames throttled, stalling the engine).
   * `null` until the first GDScript run.
   */
  godotFrame: ReactNode;
}

let runnerDoc: string | undefined;
/** The runner frame's document, built on first use. */
const runnerSrcDoc = () => (runnerDoc ??= buildRunnerSrcDoc());

/** Seconds since `start`, one decimal. */
const elapsed = (start: number) => `${((performance.now() - start) / 1000).toFixed(1)} s`;

/** Run projects and collect their output. */
export function usePlaygroundRun(): PlaygroundRun {
  const [output, setOutput] = useState<Output>(EMPTY_OUTPUT);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [status, setStatus] = useState("");
  const [wantRunner, setWantRunner] = useState(false);
  const [wantGodot, setWantGodot] = useState(false);
  const [live, setLive] = useState(false);
  const [served, setServed] = useState<number | null>(null);
  const pending = useRef(new Map<string, (result: HttpResult) => void>());
  /** Re-arms the running server's idle cap (set by `run` for server projects). */
  const rearmIdle = useRef<(() => void) | null>(null);

  const token = useRef<string | null>(null);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<ReadonlyMap<string, string>>(new Map());
  const nextRemote = useRef(0);
  const activeFrame = useRef<"runner" | "godot" | null>(null);
  /** Backstop from the start of a run that nothing inside the sandbox can clear (see `run`). */
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The run whose "running" signal was already accepted (only the first one can be genuine). */
  const runningSeen = useRef<string | null>(null);

  const emit = useCallback((stream: Stream, text: string) => {
    setOutput((current) => appendOutput(current, stream, replaceModuleUrls(text, urls.current)));
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const finish = useCallback((next: RunPhase, text: string) => {
    clearTimer();
    token.current = null;
    abort.current = null;
    setPhase(next);
    setStatus(text);
  }, []);

  // Handlers for the sandbox frames' messages; defined before the frames so they can be passed in.
  const onFrameMessage = useRef<(message: FrameMessage) => void>(() => undefined);

  const runner = useSandboxFrame(
    { srcDoc: wantRunner ? runnerSrcDoc() : "" },
    "Code runner",
    (m) => onFrameMessage.current(m),
    wantRunner,
  );
  const godot = useSandboxFrame(
    { src: GODOT_RUNNER_URL },
    "Godot runner",
    (m) => onFrameMessage.current(m),
    wantGodot,
    false,
  );

  /** Kill the active frame's work after a limit. */
  const armLimit = useCallback(
    (ms: number, label: string) => {
      clearTimer();
      timer.current = setTimeout(() => {
        if (activeFrame.current === "runner") runner.reset();
        if (activeFrame.current === "godot") godot.reset();
        emit("stderr", `\nStopped: ${label} took longer than ${ms / 1000} s.\n`);
        finish("stopped", `stopped after ${ms / 1000} s`);
      }, ms);
    },
    [emit, finish, runner, godot],
  );

  useEffect(() => {
    onFrameMessage.current = (message) => {
      if (message.type === "out") emit(message.stream, message.text);
      else if (message.type === "serve") setServed(message.port);
      else if (message.type === "response") {
        const resolve = pending.current.get(message.id);
        pending.current.delete(message.id);
        resolve?.(
          message.error !== undefined || message.status === undefined
            ? { ok: false, error: message.error ?? "No response" }
            : {
                ok: true,
                status: message.status,
                statusText: message.statusText ?? "",
                headers: message.headers ?? [],
                body: message.body ?? "",
                truncated: message.truncated ?? false,
                ms: message.ms ?? 0,
              },
        );
      } else if (message.type === "progress") {
        if (token.current !== message.token) return; // the run already finished
        if (message.text === "running") {
          // User code shares the sandbox with the relay, so it could post "running" again to
          // keep re-arming the limit: only the first one per run counts.
          if (runningSeen.current === message.token) return;
          runningSeen.current = message.token;
          armLimit(
            activeFrame.current === "godot" ? RUN_LIMITS.godot : RUN_LIMITS.python,
            "the program",
          );
          setStatus("running…");
        } else setStatus(message.text);
      } else if (message.type === "done" && token.current === message.token) {
        const exit = message.exitCode === null ? "" : ` · exit ${message.exitCode}`;
        finish(
          message.exitCode === 0 ? "done" : "failed",
          `ran in ${elapsed(started.current)}${exit}`,
        );
      }
    };
  });

  const run = useCallback(
    (language: LanguageId, project: Project, stdin: string) => {
      const spec = getLanguage(language);
      // The preview runs itself; Markdown only previews.
      if (spec.runner === "web" || spec.runner === "markdown") return;
      if (
        (spec.runner === "cpp" || spec.runner === "rust") &&
        performance.now() < nextRemote.current
      ) {
        emit("info", "Please wait a moment between remote runs.\n");
        return;
      }
      clearTimer();
      if (cap.current) clearTimeout(cap.current);
      abort.current?.abort();
      setServed(null);
      rearmIdle.current = null;
      const runToken = newRunToken();
      token.current = runToken;
      started.current = performance.now();
      urls.current = new Map();
      setOutput(EMPTY_OUTPUT);
      setPhase("running");
      setStatus("running…");

      const fail = (error: unknown) => {
        if (token.current !== runToken) return;
        const message = error instanceof Error ? error.message : String(error);
        emit("stderr", `${message}\n`);
        finish("failed", "failed");
      };

      /**
       * Hard cap from the start of the run. A "done" posted by the sandbox (which user code
       * could forge) clears the ordinary limit but not this: when it fires, the frame is
       * replaced whatever the run's state, so nothing keeps running in the background.
       */
      const armCap = (ms: number, frame: "runner" | "godot") => {
        cap.current = setTimeout(() => {
          if (frame === "runner") runner.reset();
          else godot.reset();
          setLive(false);
          setServed(null);
          if (token.current !== runToken) return;
          emit("stderr", `\nStopped: the run took longer than ${ms / 1000} s.\n`);
          finish("stopped", `stopped after ${ms / 1000} s`);
        }, ms);
      };

      if (spec.runner !== "cpp" && spec.runner !== "rust") setLive(true);

      if (spec.runner === "script" || spec.runner === "bun") {
        const server = spec.runner === "bun";
        activeFrame.current = "runner";
        setWantRunner(true);
        linkModules(project.files, project.entry, transpile)
          .then(async (linked) => {
            if (token.current !== runToken) return;
            urls.current = linked.urls;
            for (const warning of linked.warnings) emit("info", `${warning}\n`);
            armLimit(RUN_LIMITS.script, server ? "starting the server" : "the program");
            if (server) {
              // A server stays up after its top level finishes; it stops when idle for too long.
              rearmIdle.current = () => {
                if (cap.current) clearTimeout(cap.current);
                armCap(RUN_LIMITS.serverIdle, "runner");
              };
              rearmIdle.current();
            } else armCap(RUN_LIMITS.script, "runner");
            runner.reset(); // a fresh frame per run: no state leaks between runs
            await runner.send({
              type: "run",
              token: runToken,
              kind: "js",
              entryUrl: linked.entryUrl,
              ...(server
                ? {
                    bun: {
                      files: { ...project.files },
                      env: parseDotEnv(project.files[".env"] ?? ""),
                      entry: project.entry,
                    },
                  }
                : {}),
            });
          })
          .catch(fail);
        return;
      }

      if (spec.runner === "python") {
        activeFrame.current = "runner";
        setWantRunner(true);
        setStatus("loading Python…");
        armLimit(RUN_LIMITS.pythonLoad, "loading Python");
        armCap(RUN_LIMITS.pythonLoad + RUN_LIMITS.python, "runner");
        // A fresh frame per run: code from an earlier run can't watch this one's files or stdin
        // (the runtime reloads from the browser's cache).
        runner.reset();
        void runner.send({
          type: "run",
          token: runToken,
          kind: "python",
          files: { ...project.files },
          entry: project.entry,
          stdin,
          indexUrl: PYODIDE_INDEX_URL,
        });
        return;
      }

      if (spec.runner === "godot") {
        activeFrame.current = "godot";
        setWantGodot(true);
        setStatus("loading Godot…");
        armLimit(RUN_LIMITS.godotLoad, "loading Godot");
        armCap(RUN_LIMITS.godotLoad + RUN_LIMITS.godot, "godot");
        // A fresh engine per run, for the same reason (and a frame an earlier script navigated
        // elsewhere is never reused).
        godot.reset();
        void godot.send({
          type: "run",
          token: runToken,
          files: { ...project.files },
          entry: project.entry,
        });
        return;
      }

      // C++ / Rust: remote services.
      activeFrame.current = null;
      nextRemote.current = performance.now() + RUN_LIMITS.remoteCooldown;
      const controller = new AbortController();
      abort.current = controller;
      const onEvent = (event: RunEvent) => {
        if (token.current === runToken) emit(event.stream, event.text);
      };
      const request = { project, stdin, signal: controller.signal };
      (spec.runner === "cpp" ? runCpp(request, onEvent) : runRust(request, onEvent))
        .then((result) => {
          if (token.current !== runToken) return;
          const exit = result.exitCode === null ? " · did not run" : ` · exit ${result.exitCode}`;
          finish(
            result.exitCode === 0 ? "done" : "failed",
            `ran in ${elapsed(started.current)}${exit}`,
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          fail(error);
        });
    },
    [armLimit, emit, finish, runner, godot],
  );

  /**
   * Stop whatever is running, including a finished run whose timers are still
   * going: the active frame is always replaced.
   */
  const stop = useCallback(() => {
    abort.current?.abort();
    if (cap.current) clearTimeout(cap.current);
    if (activeFrame.current === "runner") runner.reset();
    if (activeFrame.current === "godot") godot.reset();
    activeFrame.current = null;
    setLive(false);
    setServed(null);
    rearmIdle.current = null;
    if (!token.current) return;
    emit("info", "\nStopped.\n");
    finish("stopped", "stopped");
  }, [emit, finish, runner, godot]);

  const clear = useCallback(() => {
    setOutput(EMPTY_OUTPUT);
    if (!token.current) setStatus("");
  }, []);

  const appendExternal = useCallback((stream: Stream, text: string) => emit(stream, text), [emit]);

  const request = useCallback(
    (message: Omit<HttpRequestMessage, "id">): Promise<HttpResult> => {
      if (served === null)
        return Promise.resolve({ ok: false, error: "No server is running: press Run first." });
      rearmIdle.current?.();
      const id = newRunToken();
      return new Promise<HttpResult>((resolve) => {
        const timeout = setTimeout(() => {
          pending.current.delete(id);
          // A handler that never answers (an endless loop) holds the worker: replace it.
          runner.reset();
          setServed(null);
          setLive(false);
          emit(
            "stderr",
            `\nThe request took longer than ${RUN_LIMITS.request / 1000} s; the server was stopped.\n`,
          );
          resolve({
            ok: false,
            error: `No answer within ${RUN_LIMITS.request / 1000} s (the server was stopped).`,
          });
        }, RUN_LIMITS.request);
        pending.current.set(id, (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
        void runner.post({ type: "request", id, ...message }).then((sent) => {
          if (sent) return;
          clearTimeout(timeout);
          pending.current.delete(id);
          resolve({ ok: false, error: "The server isn't running any more: press Run." });
        });
      });
    },
    [served, runner, emit],
  );

  return {
    output,
    phase,
    live,
    served,
    request,
    status,
    run,
    stop,
    clear,
    appendExternal,
    frames: runner.element,
    godotFrame: godot.element,
  };
}
