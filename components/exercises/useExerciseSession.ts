/**
 * @file The playground's exercise mode, as state: the request form, generating (with the
 * self-check and one repair), the learner's code per exercise, test runs, the review, hints
 * and the reference solution.
 *
 * Client hook. The flow:
 *
 * 1. `generate` posts the form to `/api/exercises/code/`.
 * 2. Before the exercise is shown, its reference solution runs against its own tests in the
 *    playground's sandbox. If any fail, the model is asked once to repair the exercise; one
 *    that still disagrees is shown with a warning, since a failing test may be the test's fault.
 *    If the sandbox couldn't run anything (offline), nothing is repaired or flagged.
 * 3. `runTests` (⌘↵) runs the learner's code against the same tests, and `submit` adds a model
 *    review of the requirements the tests can't check.
 *
 * Recent exercises, the code for each and progress are kept in `localStorage`; test reports and
 * reviews live as long as the page.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaygroundRun } from "@/components/playground/usePlaygroundRun";
import {
  ApiFailure,
  generateCodeExercise,
  repairCodeExercise,
  reviewCode,
} from "@/lib/exercises/client";
import { summarizeReport, type HarnessReport } from "@/lib/exercises/harness";
import type { CodeLanguage } from "@/lib/exercises/options";
import type { CodeExercise, CodeReview } from "@/lib/exercises/schema";
import {
  EMPTY_CODE_STORE,
  STORE_KEYS,
  codeStore,
  forget,
  omitKeys,
  remember,
  type CodeStore,
} from "@/lib/exercises/storage";
import { useStore } from "./useStore";
import { useTestRunner } from "./useTestRunner";

/** What is happening to the current exercise. */
export type ExerciseActivity = "idle" | "testing" | "reviewing";

/** How far the reference solution is revealed. */
export type SolutionState = "hidden" | "ask" | "shown";

/** Per-exercise state that lasts as long as the page. */
export interface ExerciseView {
  readonly report: HarnessReport | null;
  readonly review: CodeReview | null;
  readonly activity: ExerciseActivity;
  readonly error: string | null;
  /** How many hints are shown. */
  readonly hints: number;
  readonly solution: SolutionState;
}

/** A view before anything has happened. */
export const EMPTY_VIEW: ExerciseView = {
  report: null,
  review: null,
  activity: "idle",
  error: null,
  hints: 0,
  solution: "hidden",
};

/** A message for the learner from anything thrown. */
function messageOf(error: unknown): string {
  return error instanceof ApiFailure ? error.message : "Something went wrong. Try again.";
}

/** `3/5` → 3, for keeping the best score. */
function scoreOf(best: string | undefined): number {
  return best ? Number(best.split("/")[0]) || 0 : -1;
}

/** Options for {@link useExerciseSession}. */
export interface SessionOptions {
  /** Whether the reader already approved a language's runtime download (Python's Pyodide). */
  approved(language: CodeLanguage): boolean;
  /** Remember the approval. */
  approve(language: CodeLanguage): void;
}

/** Everything the exercise mode shows and does. */
export type ExerciseSession = ReturnType<typeof useExerciseSession>;

/**
 * The exercise mode's state and actions.
 *
 * @param run - The playground's runner (shared with its own runs).
 * @param options - Runtime download approvals, kept in the playground's preferences.
 */
export function useExerciseSession(run: PlaygroundRun, options: SessionOptions) {
  const [store, setStore] = useStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE);
  const runner = useTestRunner(run);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The Python download needs an OK before the first Python exercise is generated. */
  const [askDownload, setAskDownload] = useState(false);
  const [views, setViews] = useState<Readonly<Record<string, ExerciseView>>>({});
  const abort = useRef<AbortController | null>(null);
  const reviewAbort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      reviewAbort.current?.abort();
    },
    [],
  );

  const exercise = store.exercises.find((e) => e.id === store.currentId) ?? null;
  const view = (exercise && views[exercise.id]) || EMPTY_VIEW;
  const code = exercise ? (store.drafts[exercise.id] ?? exercise.starterCode) : "";
  const progress = exercise ? store.progress[exercise.id] : undefined;

  const updateView = useCallback((id: string, patch: Partial<ExerciseView>) => {
    setViews((all) => ({ ...all, [id]: { ...(all[id] ?? EMPTY_VIEW), ...patch } }));
  }, []);

  const setForm = (patch: Partial<CodeStore["form"]>) =>
    setStore((s) => ({ ...s, form: { ...s.form, ...patch } }));

  const setProgress = useCallback(
    (id: string, patch: { passed?: boolean; best?: string }) =>
      setStore((s) => {
        const old = s.progress[id] ?? { passed: false };
        const best =
          patch.best !== undefined && scoreOf(patch.best) >= scoreOf(old.best)
            ? patch.best
            : old.best;
        return {
          ...s,
          progress: {
            ...s.progress,
            [id]: { ...old, ...patch, best, passed: old.passed || Boolean(patch.passed) },
          },
        };
      }),
    [setStore],
  );

  /**
   * Run an exercise's reference solution against its own tests. `ran` is false when the
   * sandbox couldn't run anything at all (offline, runtime download blocked): that says
   * nothing about the tests, so it neither triggers a repair nor marks them as wrong. A
   * solution that doesn't compile (the JS/TS linker names the file) did run, and is repaired.
   */
  const verify = async (ex: CodeExercise) => {
    const report = await runner.runTests(ex.language, ex.solution, ex.tests);
    const ran =
      report.loadError !== undefined ||
      report.results.some((r) => r !== null) ||
      /\bsolution\.(?:py|js|ts)\b/.test(report.other);
    return { ...summarizeReport(report, ex.tests), ran, other: report.other };
  };

  /** Generate an exercise; `approvedNow` when the reader just OK'd Python's download. */
  const generate = async (approvedNow = false) => {
    const form = store.form;
    if (form.language === "python" && !approvedNow && !options.approved("python")) {
      setAskDownload(true);
      return;
    }
    setAskDownload(false);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const { signal } = controller;
    setError(null);
    try {
      setBusy("Writing your exercise…");
      let ex = await generateCodeExercise(
        { ...form, avoid: store.exercises.slice(0, 8).map((e) => e.title) },
        signal,
      );
      if (signal.aborted) return;
      setBusy("Checking its tests against the reference solution…");
      let check = await verify(ex);
      if (check.ran && !check.allPassed && !signal.aborted) {
        setBusy("Some tests disagree with the reference solution: asking the model to fix them…");
        try {
          const fixed = await repairCodeExercise(ex, check.text, signal);
          setBusy("Checking the fixed exercise…");
          const again = await verify(fixed);
          if (again.ran && again.passed >= check.passed) {
            ex = fixed;
            check = again;
          }
        } catch {
          // Keep the original, flagged as unverified.
        }
      }
      if (signal.aborted) return;
      if (!check.ran) {
        setError(
          `The exercise is ready, but its tests couldn't be checked: the code runner didn't start${
            check.other ? ` (${check.other.split("\n").at(-1)})` : ""
          }. Running your own code will likely fail the same way; check your connection.`,
        );
      }
      setStore((s) => {
        const { items, dropped } = remember(s.exercises, ex);
        return {
          ...s,
          currentId: ex.id,
          exercises: items,
          drafts: omitKeys(s.drafts, dropped),
          progress: {
            ...omitKeys(s.progress, dropped),
            [ex.id]: { passed: false, verified: check.ran ? check.allPassed : undefined },
          },
        };
      });
    } catch (e) {
      if (!signal.aborted) setError(messageOf(e));
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(null);
      }
    }
  };

  /** Approve Python's download, then generate. */
  const approveDownload = () => {
    options.approve("python");
    void generate(true);
  };

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    runner.stop();
    setBusy(null);
  };

  const testCurrent = async (): Promise<HarnessReport | null> => {
    if (!exercise || busy) return null;
    const id = exercise.id;
    updateView(id, { activity: "testing", error: null, review: null });
    const report = await runner.runTests(exercise.language, code, exercise.tests);
    const summary = summarizeReport(report, exercise.tests);
    updateView(id, { report, activity: "idle" });
    setProgress(id, { best: `${summary.passed}/${summary.total}` });
    return report;
  };

  const submit = async () => {
    if (!exercise) return;
    const id = exercise.id;
    const submitted = code;
    const report = await testCurrent();
    if (!report) return;
    const outcomes = exercise.tests.map((t, i) => {
      const r = report.results[i];
      return {
        name: t.name,
        ok: r?.ok ?? false,
        message: report.loadError
          ? `the solution failed to load: ${report.loadError}`
          : r
            ? r.message
            : "did not finish",
      };
    });
    reviewAbort.current?.abort();
    const controller = new AbortController();
    reviewAbort.current = controller;
    updateView(id, { activity: "reviewing" });
    try {
      const review = await reviewCode(exercise, submitted, outcomes, controller.signal);
      updateView(id, { review });
      if (review.verdict === "pass") setProgress(id, { passed: true });
    } catch (e) {
      if (!controller.signal.aborted) updateView(id, { error: messageOf(e) });
    } finally {
      if (reviewAbort.current === controller) reviewAbort.current = null;
      updateView(id, { activity: "idle" });
    }
  };

  return {
    store,
    form: store.form,
    exercise,
    code,
    progress,
    view,
    busy,
    error,
    askDownload,
    /** The runner's short status ("loading Python…", "ran in 1.2 s · exit 0"). */
    status: runner.status,
    /** Whether the runner (or a review) is taken: Run, Submit and Reset wait. */
    working: busy !== null || view.activity !== "idle",
    setForm,
    generate: () => void generate(),
    approveDownload,
    cancelDownload: () => setAskDownload(false),
    cancel,
    select: (id: string) => setStore((s) => ({ ...s, currentId: id })),
    /** Remove exercises from the recent list, with their code and progress. */
    remove: (ids: readonly string[] | "all") => {
      setStore((s) => {
        const next = forget(s.exercises, s.currentId, ids);
        return {
          ...s,
          exercises: next.items,
          currentId: next.currentId,
          drafts: omitKeys(s.drafts, next.removed),
          progress: omitKeys(s.progress, next.removed),
        };
      });
      setViews((all) => omitKeys(all, ids === "all" ? Object.keys(all) : ids));
    },
    setCode: (value: string) => {
      if (!exercise) return;
      const id = exercise.id;
      setStore((s) => ({ ...s, drafts: { ...s.drafts, [id]: value } }));
    },
    resetCode: () => {
      if (!exercise) return;
      const { id, starterCode } = exercise;
      setStore((s) => ({ ...s, drafts: { ...s.drafts, [id]: starterCode } }));
    },
    runTests: () => void testCurrent(),
    submit: () => void submit(),
    stop: runner.stop,
    nextHint: () => {
      if (exercise)
        updateView(exercise.id, { hints: Math.min(view.hints + 1, exercise.hints.length) });
    },
    setSolution: (solution: SolutionState) => {
      if (exercise) updateView(exercise.id, { solution });
    },
  };
}
