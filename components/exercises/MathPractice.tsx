/**
 * @file The math problem generator (`/math/practice/`): ask for a problem, answer it, get
 * it checked, with hints and a worked solution.
 *
 * Client component, rendered client-only (see `MathPracticeLoader`). Numeric answers are
 * checked in the browser by `lib/exercises/math-answer.ts` (instant and free: fractions,
 * surds, π and several values in any order are understood); expressions, text answers and
 * "explain my mistake" go to the model, with the learner's working if they gave it.
 * Recent problems and progress are kept in `localStorage`.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { ApiFailure, checkMathAnswer, generateMathProblem } from "@/lib/exercises/client";
import { checkNumeric, readValues } from "@/lib/exercises/math-answer";
import { DIFFICULTIES, MATH_AREAS, optionLabel } from "@/lib/exercises/options";
import type { MathProblem, MathVerdict } from "@/lib/exercises/schema";
import {
  EMPTY_MATH_STORE,
  STORE_KEYS,
  forget,
  mathStore,
  omitKeys,
  remember,
  type MathStore,
} from "@/lib/exercises/storage";
import { RecentList } from "./RecentList";
import { RichText } from "./RichText";
import { useStore } from "./useStore";
import "./exercises.css";

/** Requests to try, one click away. */
const EXAMPLES = [
  "solving quadratics by factoring",
  "chain rule derivatives",
  "conditional probability with cards",
  "percent increase word problems",
];

/** A message for the learner from anything thrown. */
function messageOf(error: unknown): string {
  return error instanceof ApiFailure ? error.message : "Something went wrong. Try again.";
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
}: {
  onClick(): void;
  disabled?: boolean;
  primary?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      className={primary ? "link ex-primary" : "link"}
      onClick={onClick}
      disabled={disabled}
    >
      <i>{children}</i>
    </button>
  );
}

/** The whole sheet: form, current problem, recent problems. */
export function MathPractice() {
  const [store, setStore] = useStore(STORE_KEYS.math, mathStore, EMPTY_MATH_STORE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const problem = store.problems.find((p) => p.id === store.currentId) ?? null;
  const form = store.form;

  const setForm = (patch: Partial<MathStore["form"]>) =>
    setStore((s) => ({ ...s, form: { ...s.form, ...patch } }));

  const generate = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setBusy("Writing a problem. Free models can take a minute…");
    try {
      const next = await generateMathProblem(
        { ...form, avoid: store.problems.slice(0, 8).map((p) => p.title) },
        controller.signal,
      );
      setStore((s) => {
        const { items, dropped } = remember(s.problems, next);
        return {
          ...s,
          currentId: next.id,
          problems: items,
          progress: { ...omitKeys(s.progress, dropped), [next.id]: { solved: false, attempts: 0 } },
        };
      });
    } catch (e) {
      if (!controller.signal.aborted) setError(messageOf(e));
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(null);
      }
    }
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
          <label htmlFor="mx-request" className="ex-label">
            What do you want to practice?
          </label>
          <textarea
            id="mx-request"
            rows={2}
            maxLength={500}
            value={form.request}
            placeholder="e.g. integration by parts, or compound interest"
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
            <span className="ex-label">Area</span>
            <select
              value={form.area}
              onChange={(event) =>
                setForm({ area: event.target.value as MathStore["form"]["area"] })
              }
            >
              {MATH_AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ex-label">Difficulty</span>
            <select
              value={form.difficulty}
              onChange={(event) =>
                setForm({ difficulty: event.target.value as MathStore["form"]["difficulty"] })
              }
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ex-actions">
          <button type="submit" className="link ex-primary" disabled={busy !== null}>
            <i>&gt; Generate problem</i>
          </button>
          {busy && (
            <>
              <Busy label={busy} />
              <Action
                onClick={() => {
                  abort.current?.abort();
                  abort.current = null;
                  setBusy(null);
                }}
              >
                cancel
              </Action>
            </>
          )}
        </div>
      </form>

      {error && (
        <div className="ex-note" data-kind="error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {problem ? (
        <ProblemView
          key={problem.id}
          problem={problem}
          progress={store.progress[problem.id]}
          locked={busy !== null}
          onNext={() => void generate()}
          onAttempt={(solved) =>
            setStore((s) => {
              const old = s.progress[problem.id] ?? { solved: false, attempts: 0 };
              return {
                ...s,
                progress: {
                  ...s.progress,
                  [problem.id]: { solved: old.solved || solved, attempts: old.attempts + 1 },
                },
              };
            })
          }
        />
      ) : (
        !busy && (
          <p className="ex-label">
            Pick an area and a difficulty, or describe what you want to practice, then generate.
            Type your answer as you would write it: 3/4, 2√3, x = 2, x = -3.
          </p>
        )
      )}

      <RecentList
        items={store.problems.map((p) => {
          const progress = store.progress[p.id];
          return {
            id: p.id,
            title: p.title,
            detail: p.difficulty,
            status: progress?.solved ? (
              <span className="ex-ok">✓ solved</span>
            ) : progress && progress.attempts > 0 ? (
              <span className="ex-label">
                {progress.attempts} {progress.attempts === 1 ? "try" : "tries"}
              </span>
            ) : null,
          };
        })}
        currentId={store.currentId}
        disabled={busy !== null}
        heading="h2"
        noun="problem"
        onSelect={(id) => setStore((s) => ({ ...s, currentId: id }))}
        onRemove={(ids) =>
          setStore((s) => {
            const next = forget(s.problems, s.currentId, ids);
            return {
              ...s,
              problems: next.items,
              currentId: next.currentId,
              progress: omitKeys(s.progress, next.removed),
            };
          })
        }
      />
    </div>
  );
}

/** What can be typed in the answer box, beside it, for the moment someone wonders. */
function AnswerHelp() {
  return (
    <details className="ex-answer-help">
      <summary className="ex-label">how to type answers</summary>
      <table>
        <tbody>
          <tr>
            <td>fractions, decimals, percents</td>
            <td>
              <code>3/4</code> <code>0.75</code> <code>75%</code>
            </td>
          </tr>
          <tr>
            <td>roots, π, powers</td>
            <td>
              <code>2√3</code> <code>sqrt(2)/2</code> <code>2pi</code> <code>2^10</code>
            </td>
          </tr>
          <tr>
            <td>several answers, any order</td>
            <td>
              <code>x = 2, x = -3</code> <code>2 or -3</code> <code>±√2</code>
            </td>
          </tr>
          <tr>
            <td>LaTeX works too</td>
            <td>
              <code>
                \frac{"{"}1{"}"}
                {"{"}3{"}"}
              </code>{" "}
              <code>
                \sqrt{"{"}2{"}"}
              </code>
            </td>
          </tr>
          <tr>
            <td>expressions, words</td>
            <td>
              <code>2x + 1</code>, <code>(1, 3]</code>: checked by the AI
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

/** What the last check said. */
type Outcome =
  | { readonly by: "local"; readonly correct: boolean }
  | { readonly by: "model"; readonly verdict: MathVerdict };

/** Props for {@link ProblemView}. */
interface ProblemViewProps {
  readonly problem: MathProblem;
  readonly progress: MathStore["progress"][string] | undefined;
  readonly locked: boolean;
  onAttempt(solved: boolean): void;
  onNext(): void;
}

/** One problem: statement, answer box, checking, hints and the worked solution. */
function ProblemView({ problem, progress, locked, onAttempt, onNext }: ProblemViewProps) {
  const [answer, setAnswer] = useState("");
  const [working, setWorking] = useState("");
  const [showWorking, setShowWorking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const numeric = problem.answer.kind === "numeric";
  const reads = numeric && answer.trim() ? readValues(answer, problem.answer.values.length) : null;

  /** Ask the model (non-numeric answers, unreadable input, or "explain my mistake"). */
  const askModel = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setChecking(true);
    setError(null);
    try {
      const verdict = await checkMathAnswer(problem, answer, working, controller.signal);
      setOutcome({ by: "model", verdict });
      return verdict;
    } catch (e) {
      if (!controller.signal.aborted) setError(messageOf(e));
      return null;
    } finally {
      if (abort.current === controller) abort.current = null;
      setChecking(false);
    }
  };

  const check = async () => {
    if (!answer.trim()) return;
    setError(null);
    const local = checkNumeric(answer, problem.answer);
    if (local.status !== "unreadable") {
      setOutcome({ by: "local", correct: local.status === "correct" });
      onAttempt(local.status === "correct");
      return;
    }
    const verdict = await askModel();
    if (verdict) onAttempt(verdict.correct);
  };

  const correct = outcome
    ? outcome.by === "local"
      ? outcome.correct
      : outcome.verdict.correct
    : null;

  return (
    <article className="ex-exercise" aria-labelledby="mx-title">
      <h2 id="mx-title">
        {problem.title}
        {progress?.solved && <span className="ex-ok"> ✓</span>}
      </h2>
      <p className="ex-meta">
        {[
          problem.area === "any" ? null : optionLabel(MATH_AREAS, problem.area),
          optionLabel(DIFFICULTIES, problem.difficulty),
          problem.concepts.join(", ") || null,
        ]
          .filter(Boolean)
          .join(" · ")}
        <br />
        by {problem.model}
      </p>
      <RichText text={problem.statement} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!checking) void check();
        }}
      >
        <label htmlFor="mx-answer" className="ex-label">
          Your answer: {problem.answerFormat}
        </label>
        <div className="ex-answer">
          <input
            id="mx-answer"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setOutcome(null);
            }}
            placeholder={numeric ? "e.g. 3/4, 2√3, x = 2, x = -3" : "your answer"}
          />
          <button type="submit" className="link ex-primary" disabled={checking || !answer.trim()}>
            <i>Check</i>
          </button>
        </div>
        <p className="ex-preview" aria-live="polite">
          {numeric && answer.trim()
            ? reads
              ? `reads as ${reads.map((v) => +v.toPrecision(10)).join(", ")}`
              : "can't read that as a number: it will be checked by the model"
            : " "}
        </p>
        <AnswerHelp />
        <div className="ex-actions">
          <Action onClick={() => setShowWorking((w) => !w)}>
            {showWorking ? "Hide working" : "Add working (optional)"}
          </Action>
          <Action
            onClick={() => setHints((h) => Math.min(h + 1, problem.hints.length))}
            disabled={hints >= problem.hints.length}
          >
            {`Hint (${hints}/${problem.hints.length})`}
          </Action>
          <Action onClick={() => setSolution((s) => !s)}>
            {solution ? "Hide solution" : "Solution"}
          </Action>
          <Action onClick={onNext} disabled={locked}>
            Next problem
          </Action>
          {checking && <Busy label="Checking…" />}
        </div>
        {showWorking && (
          <div className="ex-field">
            <label htmlFor="mx-working" className="ex-label">
              Your working (LaTeX between $…$ is fine): the model points at the first step that goes
              wrong
            </label>
            <textarea
              id="mx-working"
              rows={6}
              maxLength={4000}
              value={working}
              onChange={(event) => setWorking(event.target.value)}
            />
          </div>
        )}
      </form>

      {error && (
        <div className="ex-note" data-kind="error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {outcome && correct !== null && (
        <div className="ex-note" data-kind={correct ? "ok" : "error"} aria-live="polite">
          <p className="ex-note-title">{correct ? "Correct ✓" : "Not quite"}</p>
          {outcome.by === "model" ? (
            <RichText text={outcome.verdict.feedback} />
          ) : correct ? (
            <p>
              {working.trim() ? (
                <>
                  Right answer.{" "}
                  <Action onClick={() => void askModel()} disabled={checking}>
                    get feedback on my working
                  </Action>
                </>
              ) : (
                "Nicely done."
              )}
            </p>
          ) : (
            <p>
              Try again, take a hint, or{" "}
              <Action onClick={() => void askModel()} disabled={checking}>
                explain my mistake
              </Action>
              {working.trim() ? "" : " (add your working for a sharper answer)"}.
            </p>
          )}
        </div>
      )}

      {hints > 0 && (
        <section aria-label="Hints">
          <h3>Hints</h3>
          <ol>
            {problem.hints.slice(0, hints).map((hint) => (
              <li key={hint}>
                <RichText text={hint} inline />
              </li>
            ))}
          </ol>
        </section>
      )}

      {solution && (
        <section aria-label="Worked solution">
          <h3>Worked solution</h3>
          <RichText text={problem.solution} />
          {!/\banswer\b/i.test(problem.solution) && (
            <p>
              Answer: <RichText text={`$${problem.answer.display}$`} inline />
            </p>
          )}
        </section>
      )}
    </article>
  );
}
