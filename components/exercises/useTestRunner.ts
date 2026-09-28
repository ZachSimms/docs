/**
 * @file Run an exercise's tests against some code, and get the parsed report back.
 *
 * Client hook over the playground's runner (`usePlaygroundRun`): the same sandboxed frame,
 * time limits and Stop, with the harness from `lib/exercises/harness.ts` as the project.
 * `runTests` resolves when the run ends (finished, failed, stopped or timed out) with the
 * {@link HarnessReport}; tests that never reported are left `null` in it.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePlaygroundRun } from "@/components/playground/usePlaygroundRun";
import { buildHarness, parseHarnessOutput, type HarnessReport } from "@/lib/exercises/harness";
import type { CodeLanguage } from "@/lib/exercises/options";
import type { TestCase } from "@/lib/exercises/schema";
import { outputText } from "@/lib/playground/output";
import type { Project } from "@/lib/playground/project";

/** How long output must stay unchanged after a run ends before it is read. */
const SETTLE_MS = 80;

/** A run in flight: what to parse its output with, and who is waiting. */
interface Pending {
  readonly nonce: string;
  readonly tests: readonly TestCase[];
  readonly resolve: (report: HarnessReport) => void;
  /** Whether this run has been seen running (a finished phase before that is the last run's). */
  started: boolean;
}

/** TypeScript tests are plain JS by convention; strip any types the model added anyway. */
async function prepareTests(language: CodeLanguage, tests: readonly TestCase[]) {
  if (language !== "typescript") return tests;
  const { transpile } = await import("@/lib/playground/transpile");
  return tests.map((test) => {
    try {
      // Wrapped in an async function so top-level `await` parses; unwrapped again after.
      const out = transpile("test.ts", `async function __t() {\n${test.code}\n}`);
      const body = /^[\s\S]*?async function __t\(\) \{\n([\s\S]*)\n\}\s*$/.exec(out)?.[1];
      return body === undefined ? test : { ...test, code: body };
    } catch {
      return test; // the harness reports the syntax error for this test alone
    }
  });
}

/** Run tests in the playground's sandbox. */
export function useTestRunner() {
  const run = usePlaygroundRun();
  const pending = useRef<Pending | null>(null);
  const { phase, output } = run;

  // The runner sets its phase at once but batches output on a timer, so the last chunks (an
  // error on stderr, say) can land just after the run ends: settle once output goes quiet.
  useEffect(() => {
    const current = pending.current;
    if (!current) return;
    if (phase === "running") {
      current.started = true;
      return;
    }
    if (!current.started) return;
    const timer = setTimeout(() => {
      if (pending.current !== current) return;
      pending.current = null;
      current.resolve(parseHarnessOutput(outputText(output), current.nonce, current.tests));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [phase, output]);

  /**
   * Run `tests` against `code`.
   *
   * @returns The report, once the run is over. A newer call supersedes this one, which then
   *   resolves with whatever it had (usually nothing).
   */
  const runTests = useCallback(
    async (language: CodeLanguage, code: string, tests: readonly TestCase[]) => {
      const prepared = await prepareTests(language, tests);
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const harness = buildHarness(language, code, prepared, nonce);
      const project: Project = {
        files: harness.files,
        dirs: [],
        entry: harness.entry,
        open: harness.entry,
        tabs: [harness.entry],
      };
      return new Promise<HarnessReport>((resolve) => {
        const previous = pending.current;
        if (previous) previous.resolve(parseHarnessOutput("", previous.nonce, previous.tests));
        pending.current = { nonce, tests: prepared, resolve, started: false };
        run.run(language, project, "");
      });
    },
    [run],
  );

  return {
    runTests,
    stop: run.stop,
    /** The runner's short status ("loading Python…", "ran in 1.2 s · exit 0"). */
    status: run.status,
    running: phase === "running",
    /** The hidden sandbox frame; render it somewhere in the page. */
    frames: run.frames,
  };
}
