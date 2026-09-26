/**
 * @file Run a Node project (Next.js) in a WebContainer: `npm install`, then `npm run dev`.
 *
 * Client-only, and only on the cross-origin-isolated `/playground/node/`.
 * One WebContainer per page (booting is expensive and only one may exist);
 * each run mounts the project, installs when the dependencies changed, and
 * starts the dev server, whose URL (on StackBlitz's origin) the preview shows.
 * Edits are written into the container while it runs, so the dev server
 * reloads them. Terminal output goes to the console.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { appendOutput, EMPTY_OUTPUT, type Output, type Stream } from "@/lib/playground/output";
import type { Project } from "@/lib/playground/project";
import {
  fileChanges,
  isPreviewUrl,
  needsInstall,
  terminalText,
  toFileTree,
} from "@/lib/playground/webcontainer";
import type { RunPhase } from "./usePlaygroundRun";

/** Wait after the last edit before writing it into the container. */
const WRITE_DELAY_MS = 300;

/** Environment for every process: no telemetry, no update checks. */
const ENV = { NEXT_TELEMETRY_DISABLED: "1", NO_UPDATE_NOTIFIER: "1", npm_config_fund: "false" };

let booting: Promise<WebContainer> | null = null;

/** The page's WebContainer, booted on first use. */
async function container(): Promise<WebContainer> {
  booting ??= import("@webcontainer/api").then(({ WebContainer }) =>
    WebContainer.boot({ coep: "credentialless", workdirName: "project" }),
  );
  booting.catch(() => (booting = null));
  return booting;
}

/** What the Node route's UI reads and does. */
export interface NodeRun {
  output: Output;
  phase: RunPhase;
  status: string;
  /** The dev server's URL once it listens. */
  url: string | null;
  run(project: Project): void;
  stop(): void;
  clear(): void;
  /** Write the project's current files into the running container. */
  sync(project: Project): void;
}

/** Run Node projects in a WebContainer. */
export function useNodeRun(): NodeRun {
  const [output, setOutput] = useState<Output>(EMPTY_OUTPUT);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  /** The running process (npm install, then the dev server), and a counter that retires old runs' callbacks. */
  const server = useRef<WebContainerProcess | null>(null);
  const runId = useRef(0);
  /** The files as the container has them. */
  const written = useRef<Record<string, string> | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** The `package.json` whose dependencies last installed successfully (a stopped install doesn't count). */
  const installed = useRef<string | undefined>(undefined);
  /** The dev server is up, so edits should reach it. */
  const serving = useRef(false);

  /** Kill whatever runs and forget pending writes. */
  const halt = useCallback(() => {
    clearTimeout(writeTimer.current);
    server.current?.kill();
    server.current = null;
    serving.current = false;
  }, []);

  const append = useCallback((stream: Stream, text: string) => {
    setOutput((current) => appendOutput(current, stream, text));
  }, []);

  /** Copy a process's terminal to the console until it ends; resolves with its exit code. */
  const pipe = useCallback(
    (process: WebContainerProcess, id: number) => {
      void (async () => {
        const reader = process.output.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          if (runId.current === id) append("stdout", terminalText(value));
        }
      })().catch(() => undefined); // the stream ends with the process
      return process.exit;
    },
    [append],
  );

  const stop = useCallback(() => {
    runId.current += 1;
    halt();
    setUrl(null);
    setPhase((p) => (p === "running" ? "stopped" : p));
    setStatus((s) => (s ? "stopped" : s));
  }, [halt]);

  const run = useCallback(
    (project: Project) => {
      halt();
      const id = ++runId.current;
      const live = () => runId.current === id;
      setUrl(null);
      setPhase("running");
      setOutput(EMPTY_OUTPUT);
      void (async () => {
        try {
          setStatus("booting WebContainer…");
          const wc = await container();
          if (!live()) return;
          const before = written.current;
          await wc.mount(toFileTree(project.files));
          if (before)
            for (const path of fileChanges(before, project.files).remove)
              await wc.fs.rm(path, { force: true, recursive: true });
          written.current = { ...project.files };
          const pkg = project.files["package.json"];
          if (needsInstall(installed.current, pkg)) {
            setStatus("npm install (the first time downloads ~200 MB)…");
            append("info", "$ npm install\n");
            installed.current = undefined;
            const install = await wc.spawn("npm", ["install", "--no-audit", "--no-fund"], {
              env: ENV,
            });
            // Stop or another Run kills it: a half-finished install is never reused.
            server.current = install;
            const code = await pipe(install, id);
            if (!live()) return;
            server.current = null;
            if (code !== 0) throw new Error(`npm install exited with ${code}`);
            installed.current = pkg;
          }
          setStatus("starting next dev…");
          append("info", "$ npm run dev\n");
          const off = wc.on("server-ready", (_port, serverUrl) => {
            if (!live()) return;
            if (!isPreviewUrl(serverUrl)) {
              append("stderr", `Not showing an unexpected preview address: ${serverUrl}\n`);
              return;
            }
            setUrl(serverUrl);
            setStatus("dev server running");
          });
          const dev = await wc.spawn("npm", ["run", "dev"], { env: ENV });
          if (!live()) {
            dev.kill();
            off();
            return;
          }
          server.current = dev;
          serving.current = true;
          const code = await pipe(dev, id);
          off();
          if (!live()) return;
          server.current = null;
          serving.current = false;
          setUrl(null);
          setPhase(code === 0 ? "done" : "failed");
          setStatus(`dev server exited · exit ${code}`);
        } catch (error) {
          if (!live()) return;
          append("stderr", `${error instanceof Error ? error.message : String(error)}\n`);
          setPhase("failed");
          setStatus("failed");
        }
      })();
    },
    [append, pipe, halt],
  );

  const sync = useCallback((project: Project) => {
    if (!written.current || !serving.current) return;
    clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      const before = written.current;
      if (!before) return;
      const { write, remove } = fileChanges(before, project.files);
      if (write.length === 0 && remove.length === 0) return;
      void container().then(async (wc) => {
        for (const [path, contents] of write) {
          const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
          if (dir) await wc.fs.mkdir(dir, { recursive: true });
          await wc.fs.writeFile(path, contents);
        }
        for (const path of remove) await wc.fs.rm(path, { force: true, recursive: true });
        written.current = { ...project.files };
      });
    }, WRITE_DELAY_MS);
  }, []);

  const clear = useCallback(() => setOutput(EMPTY_OUTPUT), []);

  // Leaving the page: stop the server (the container goes with the page).
  useEffect(() => halt, [halt]);

  return { output, phase, status, url, run, stop, clear, sync };
}
