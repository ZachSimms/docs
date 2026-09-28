/**
 * @file The coding exercise generator (`/exercises/`): ask for an exercise, solve it in the
 * editor, run the hidden tests, and get a review.
 *
 * Client component, rendered client-only (see `ExercisesLoader`). The flow:
 *
 * 1. The form posts the request to `/api/exercises/code/`.
 * 2. Before showing the exercise, its reference solution runs against its own tests in the
 *    sandbox. If any fail, the model is asked once to repair the exercise; one that still
 *    disagrees is shown with a warning, since a failing test may be the test's fault.
 * 3. The learner's code runs against the same tests (`Run tests`, ⌘↵), and `Submit` adds a
 *    model review of the requirements the tests can't check.
 *
 * Recent exercises, the code for each and progress are kept in `localStorage`.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/playground/CodeEditor";
import { summarizeReport, type HarnessReport } from "@/lib/exercises/harness";
import {
  ApiFailure,
  generateCodeExercise,
  repairCodeExercise,
  reviewCode,
} from "@/lib/exercises/client";
import {
  CODE_LANGUAGES,
  CODE_THEMES,
  DIFFICULTIES,
  SIZES,
  optionLabel,
  solutionFile,
} from "@/lib/exercises/options";
import type { CodeExercise, CodeReview } from "@/lib/exercises/schema";
import {
  EMPTY_CODE_STORE,
  STORE_KEYS,
  codeStore,
  omitKeys,
  remember,
  type CodeStore,
} from "@/lib/exercises/storage";
import { RichText } from "./RichText";
import { useStore } from "./useStore";
import { useTestRunner } from "./useTestRunner";
import "./exercises.css";

/** Requests to try, one click away. */
const EXAMPLES = [
  "I want an exercise for classes",
  "I need to practice linked lists",
  "a bank account with deposits and overdraft rules",
  "parse and validate dates without a library",
];

/** The runner, as passed to the exercise view. */
type Runner = ReturnType<typeof useTestRunner>;

/** A message for the learner from anything thrown. */
function messageOf(error: unknown): string {
  if (error instanceof ApiFailure) return error.message;
  return "Something went wrong. Try again.";
}

/** `3/5` → 3, for keeping the best score. */
function scoreOf(best: string | undefined): number {
  return best ? Number(best.split("/")[0]) || 0 : -1;
}

/** Status text with a spinner. */
function Busy({ label }: { label: string }) {
  return (
    <span className="ex-status" role="status">
      <span className="ex-spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

/** A link-styled button (the site's idiom). */
function Action({
  onClick,
  disabled,
  primary,
  children,
  label,
}: {
  onClick(): void;
  disabled?: boolean;
  primary?: boolean;
  children: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={primary ? "link ex-primary" : "link"}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <i>{children}</i>
    </button>
  );
}

/** The whole page: form, current exercise, recent exercises. */
export function CodeExercises() {
  const [store, setStore] = useStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE);
  const runner = useTestRunner();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const exercise = store.exercises.find((e) => e.id === store.currentId) ?? null;
  const form = store.form;

  const setForm = (patch: Partial<CodeStore["form"]>) =>
    setStore((s) => ({ ...s, form: { ...s.form, ...patch } }));

  /**
   * Run an exercise's reference solution against its own tests. `ran` is false when the
   * sandbox couldn't run anything at all (offline, runtime download blocked): that says
   * nothing about the tests, so it neither triggers a repair nor marks them as wrong. A
   * solution that doesn't compile (the JS/TS linker names the file) did run, and is repaired.
   */
  const verify = useCallback(
    async (ex: CodeExercise) => {
      const report = await runner.runTests(ex.language, ex.solution, ex.tests);
      const ran =
        report.loadError !== undefined ||
        report.results.some((r) => r !== null) ||
        /\bsolution\.(?:py|js|ts)\b/.test(report.other);
      return { ...summarizeReport(report, ex.tests), ran, other: report.other };
    },
    [runner],
  );

  const generate = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const { signal } = controller;
    setError(null);
    try {
      setBusy("Writing your exercise. Free models can take a minute…");
      let ex = await generateCodeExercise(
        { ...form, avoid: store.exercises.slice(0, 8).map((e) => e.title) },
        signal,
      );
      if (signal.aborted) return;
      setBusy(
        ex.language === "python"
          ? "Checking the tests against the reference solution (the first Python run downloads about 6 MB)…"
          : "Checking the tests against the reference solution…",
      );
      let check = await verify(ex);
      if (check.ran && !check.allPassed && !signal.aborted) {
        setBusy(
          "Some generated tests disagree with the reference solution: asking the model to fix them…",
        );
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

  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    runner.stop();
    setBusy(null);
  };

  useEffect(() => () => abort.current?.abort(), []);

  return (
    <div className="ex">
      <form
        className="ex-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void generate();
        }}
      >
        <div className="ex-field">
          <label htmlFor="ex-request" className="ex-label">
            What do you want to practice?
          </label>
          <textarea
            id="ex-request"
            rows={2}
            maxLength={500}
            value={form.request}
            placeholder="e.g. I need to practice linked lists"
            onChange={(event) => setForm({ request: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!busy) void generate();
              }
            }}
          />
          <p className="ex-label" style={{ margin: "0.35em 0 0" }}>
            try:{" "}
            {EXAMPLES.map((example, i) => (
              <span key={example}>
                {i > 0 && " · "}
                <button
                  type="button"
                  className="link"
                  onClick={() => setForm({ request: example })}
                >
                  <i>{example}</i>
                </button>
              </span>
            ))}
          </p>
        </div>
        <div className="ex-options">
          <label>
            <span className="ex-label">Theme</span>
            <select
              value={form.theme}
              onChange={(event) =>
                setForm({ theme: event.target.value as CodeStore["form"]["theme"] })
              }
            >
              {CODE_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ex-label">Difficulty</span>
            <select
              value={form.difficulty}
              onChange={(event) =>
                setForm({ difficulty: event.target.value as CodeStore["form"]["difficulty"] })
              }
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ex-label">Language</span>
            <select
              value={form.language}
              onChange={(event) =>
                setForm({ language: event.target.value as CodeStore["form"]["language"] })
              }
            >
              {CODE_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ex-label">Size</span>
            <select
              value={form.size}
              onChange={(event) =>
                setForm({ size: event.target.value as CodeStore["form"]["size"] })
              }
            >
              {SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ex-actions">
          <button type="submit" className="link ex-primary" disabled={busy !== null}>
            <i>&gt; Generate {form.size === "project" ? "mini-project" : "exercise"}</i>
          </button>
          {busy && (
            <>
              <Busy label={busy} />
              <Action onClick={cancel}>cancel</Action>
            </>
          )}
        </div>
      </form>

      {error && (
        <div className="ex-note" data-kind="error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {exercise ? (
        <ExerciseView
          key={exercise.id}
          exercise={exercise}
          code={store.drafts[exercise.id] ?? exercise.starterCode}
          progress={store.progress[exercise.id]}
          runner={runner}
          locked={busy !== null}
          onCode={(code) =>
            setStore((s) => ({ ...s, drafts: { ...s.drafts, [exercise.id]: code } }))
          }
          onProgress={(patch) =>
            setStore((s) => {
              const old = s.progress[exercise.id] ?? { passed: false };
              const best =
                patch.best !== undefined && scoreOf(patch.best) >= scoreOf(old.best)
                  ? patch.best
                  : old.best;
              return {
                ...s,
                progress: {
                  ...s.progress,
                  [exercise.id]: {
                    ...old,
                    ...patch,
                    best,
                    passed: old.passed || Boolean(patch.passed),
                  },
                },
              };
            })
          }
        />
      ) : (
        !busy && (
          <p className="ex-label">
            Describe what you want to practice, or pick a theme, then generate. You write the
            solution here, hidden tests check it in your browser, and a review checks what tests
            can&apos;t.
          </p>
        )
      )}

      {store.exercises.length > 0 && (
        <section aria-labelledby="ex-recent">
          <h2 id="ex-recent">Recent</h2>
          <ol className="ex-recent">
            {store.exercises.map((ex, i) => {
              const p = store.progress[ex.id];
              return (
                <li key={ex.id}>
                  <span className="ex-label">{String(i).padStart(2, "0")}. </span>
                  <button
                    type="button"
                    className="link"
                    aria-current={ex.id === store.currentId ? "true" : undefined}
                    disabled={busy !== null}
                    onClick={() => setStore((s) => ({ ...s, currentId: ex.id }))}
                  >
                    <i>{ex.title}</i>
                  </button>{" "}
                  <span className="ex-label">
                    {optionLabel(CODE_LANGUAGES, ex.language)} · {ex.difficulty}
                  </span>{" "}
                  {p?.passed ? (
                    <span className="ex-ok">✓ passed</span>
                  ) : p?.best ? (
                    <span className="ex-label">{p.best} tests</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="ex-hidden-frames">{runner.frames}</div>
    </div>
  );
}

/** Props for {@link ExerciseView}. */
interface ExerciseViewProps {
  readonly exercise: CodeExercise;
  readonly code: string;
  readonly progress: CodeStore["progress"][string] | undefined;
  readonly runner: Runner;
  /** A generation is running: the runner is taken. */
  readonly locked: boolean;
  onCode(code: string): void;
  onProgress(patch: { passed?: boolean; best?: string }): void;
}

/** One exercise: brief, editor, test results, review, hints and solution. */
function ExerciseView({
  exercise,
  code,
  progress,
  runner,
  locked,
  onCode,
  onProgress,
}: ExerciseViewProps) {
  const [report, setReport] = useState<HarnessReport | null>(null);
  const [review, setReview] = useState<CodeReview | null>(null);
  const [state, setState] = useState<"idle" | "testing" | "reviewing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState<"hidden" | "ask" | "shown">("hidden");
  const abort = useRef<AbortController | null>(null);
  const file = solutionFile(exercise.language);
  const working = state !== "idle" || locked;

  useEffect(() => () => abort.current?.abort(), []);

  const test = async () => {
    setState("testing");
    setError(null);
    setReview(null);
    const result = await runner.runTests(exercise.language, code, exercise.tests);
    setReport(result);
    const summary = summarizeReport(result, exercise.tests);
    onProgress({ best: `${summary.passed}/${summary.total}` });
    setState("idle");
    return result;
  };

  const submit = async () => {
    const result = await test();
    const outcomes = exercise.tests.map((t, i) => {
      const r = result.results[i];
      return {
        name: t.name,
        ok: r?.ok ?? false,
        message: result.loadError
          ? `the solution failed to load: ${result.loadError}`
          : r
            ? r.message
            : "did not finish",
      };
    });
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState("reviewing");
    try {
      const verdict = await reviewCode(exercise, code, outcomes, controller.signal);
      setReview(verdict);
      if (verdict.verdict === "pass") onProgress({ passed: true });
    } catch (e) {
      if (!controller.signal.aborted) setError(messageOf(e));
    } finally {
      if (abort.current === controller) abort.current = null;
      setState("idle");
    }
  };

  const summary = report ? summarizeReport(report, exercise.tests) : null;
  const meta = [
    optionLabel(CODE_LANGUAGES, exercise.language),
    optionLabel(DIFFICULTIES, exercise.difficulty),
    exercise.theme === "any" ? null : optionLabel(CODE_THEMES, exercise.theme),
    optionLabel(SIZES, exercise.size),
    `${exercise.tests.length} tests`,
  ].filter(Boolean);

  return (
    <article className="ex-exercise" aria-labelledby="ex-title">
      <h2 id="ex-title">
        {exercise.title}
        {progress?.passed && <span className="ex-ok"> ✓</span>}
      </h2>
      <p className="ex-meta">
        {meta.join(" · ")}
        <br />
        {progress?.verified === false ? (
          <span className="ex-warn">⚠ tests disagree with the reference solution</span>
        ) : progress?.verified ? (
          <span>✓ tests verified against a reference solution</span>
        ) : (
          <span className="ex-label">tests not checked</span>
        )}{" "}
        · by {exercise.model}
      </p>
      {progress?.verified === false && (
        <div className="ex-note" data-kind="warn">
          <p className="ex-note-title">Some tests may be wrong</p>
          <p>
            The model&apos;s own reference solution didn&apos;t pass all of these tests, even after
            a repair. If a test fails and you are sure your code follows the brief, the test may be
            at fault. Generating a new exercise is usually quicker.
          </p>
        </div>
      )}
      <p>
        <strong>{exercise.summary}</strong>
      </p>
      <RichText text={exercise.brief} />

      <h3>Requirements</h3>
      <ul className="ex-checks">
        {exercise.requirements.map((requirement, i) => {
          const judged = review?.requirements[i];
          return (
            <li key={requirement}>
              <span
                className={
                  judged ? (judged.met ? "ex-mark ex-ok" : "ex-mark ex-bad") : "ex-mark ex-label"
                }
                aria-label={judged ? (judged.met ? "met" : "not met") : undefined}
              >
                {judged ? (judged.met ? "✓" : "✗") : "·"}
              </span>
              <span>
                <RichText text={requirement} inline />
                {judged?.note && <span className="ex-detail"> {judged.note}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <h3>Your code</h3>
      <p className="ex-file">{file}</p>
      <div className="ex-editor">
        <CodeEditor
          path={file}
          paths={[file]}
          value={code}
          onChange={(_, value) => onCode(value)}
          onRun={() => {
            if (!working) void test();
          }}
          wrap={false}
        />
      </div>
      <div className="ex-actions">
        <Action primary onClick={() => void test()} disabled={working}>
          ▶ Run tests ⌘↵
        </Action>
        <Action onClick={() => void submit()} disabled={working}>
          Submit for review
        </Action>
        <Action
          onClick={() => setHints((h) => Math.min(h + 1, exercise.hints.length))}
          disabled={hints >= exercise.hints.length}
        >
          {`Hint (${hints}/${exercise.hints.length})`}
        </Action>
        <Action
          onClick={() => {
            if (window.confirm("Replace your code with the starter code?"))
              onCode(exercise.starterCode);
          }}
          disabled={working || code === exercise.starterCode}
        >
          Reset
        </Action>
        <Action
          onClick={() => setSolution(solution === "hidden" ? "ask" : "hidden")}
          disabled={solution === "shown"}
        >
          Solution
        </Action>
        {state === "testing" && <Busy label={runner.status || "running…"} />}
        {state === "reviewing" && <Busy label="Reviewing your code…" />}
        {state === "testing" && (
          <Action onClick={runner.stop} label="Stop the tests">
            stop
          </Action>
        )}
      </div>

      {error && (
        <div className="ex-note" data-kind="error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {hints > 0 && (
        <section aria-label="Hints">
          <h3>Hints</h3>
          <ol>
            {exercise.hints.slice(0, hints).map((hint) => (
              <li key={hint}>
                <RichText text={hint} inline />
              </li>
            ))}
          </ol>
        </section>
      )}

      {solution === "ask" && (
        <div className="ex-note" data-kind="warn">
          <p>
            Sure? Struggling a bit longer is where the learning happens.{" "}
            <Action onClick={() => setSolution("shown")}>show it</Action>{" "}
            <Action onClick={() => setSolution("hidden")}>not yet</Action>
          </p>
        </div>
      )}
      {solution === "shown" && (
        <section aria-label="Reference solution">
          <h3>Reference solution</h3>
          <pre>
            <code>{exercise.solution}</code>
          </pre>
        </section>
      )}

      {report && summary && (
        <section aria-labelledby="ex-tests" aria-live="polite">
          <h3 id="ex-tests">
            Tests:{" "}
            <span className={summary.allPassed ? "ex-ok" : "ex-bad"}>
              {summary.passed}/{summary.total} passed
            </span>
          </h3>
          {report.loadError && (
            <div className="ex-note" data-kind="error">
              <p className="ex-note-title">Your code didn&apos;t load</p>
              <pre>{report.loadError}</pre>
            </div>
          )}
          {!report.loadError && !report.done && report.other && (
            <div className="ex-note" data-kind="error">
              <p className="ex-note-title">
                {report.results.some((r) => r !== null)
                  ? "The run stopped early"
                  : "Your code didn't run"}
              </p>
              <pre>{report.other.slice(-2000)}</pre>
            </div>
          )}
          {!report.loadError && (
            <ul className="ex-checks">
              {exercise.tests.map((t, i) => {
                const r = report.results[i];
                return (
                  <li key={`${i}-${t.name}`}>
                    <span
                      className={
                        r ? (r.ok ? "ex-mark ex-ok" : "ex-mark ex-bad") : "ex-mark ex-label"
                      }
                      aria-label={r ? (r.ok ? "passed" : "failed") : "did not run"}
                    >
                      {r ? (r.ok ? "✓" : "✗") : "–"}
                    </span>
                    <span>
                      {t.name}
                      {r?.ms !== undefined && <span className="ex-label"> {r.ms} ms</span>}
                      {!r && (
                        <span className="ex-detail">
                          {" "}
                          did not finish (a crash or the time limit)
                        </span>
                      )}
                      {r && !r.ok && r.message && (
                        <span className="ex-detail">{`\n${r.message}`}</span>
                      )}
                      {r && (!r.ok || r.output) && (
                        <details>
                          <summary className="ex-label">
                            {r.output ? "output and test" : "test"}
                          </summary>
                          {r.output && <pre>{r.output}</pre>}
                          {!r.ok && <pre>{t.code}</pre>}
                        </details>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {review && (
        <section aria-labelledby="ex-review" aria-live="polite">
          <h3 id="ex-review">Review</h3>
          <div className="ex-note" data-kind={review.verdict === "pass" ? "ok" : "warn"}>
            <p className="ex-note-title">{review.verdict === "pass" ? "Passed ✓" : "Not yet"}</p>
            <p>{review.summary}</p>
          </div>
          <RichText text={review.feedback} />
        </section>
      )}
    </article>
  );
}
