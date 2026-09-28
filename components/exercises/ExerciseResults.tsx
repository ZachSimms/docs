/**
 * @file The playground's output pane in exercise mode: the test results, and the review.
 *
 * Client component; everything it shows comes from {@link ExerciseSession}.
 */

"use client";

import { summarizeReport } from "@/lib/exercises/harness";
import { RichText } from "./RichText";
import { Busy } from "./ExercisePanel";
import type { ExerciseSession } from "./useExerciseSession";

/** Test results and the review for the current exercise. */
export function ExerciseResults({ session }: { session: ExerciseSession }) {
  const { exercise, view } = session;
  const report = view.report;
  const summary = exercise && report ? summarizeReport(report, exercise.tests) : null;

  return (
    <section className="pg-console ex pg-results" aria-label="Test results">
      <div className="pg-bar">
        <span>Tests</span>
        {summary && (
          <span className={summary.allPassed ? "ex-ok" : "ex-bad"}>
            {summary.passed}/{summary.total} passed
          </span>
        )}
        <span className="pg-status">
          {view.activity === "testing" && <Busy label={session.status || "running…"} />}
          {view.activity === "reviewing" && <Busy label="Reviewing your code…" />}
        </span>
      </div>
      <div className="pg-results-body" aria-live="polite">
        {!exercise && (
          <p className="ex-label">
            Generate an exercise, then ▶ Run tests (⌘↵) to check your code.
          </p>
        )}
        {exercise && !report && view.activity === "idle" && (
          <p className="ex-label">
            {exercise.tests.length} hidden tests. ▶ Run tests (⌘↵) runs them against your code in
            your browser; Submit also asks for a review.
          </p>
        )}
        {view.review && (
          <section aria-labelledby="ex-review">
            <h3 id="ex-review" className="sr-only">
              Review
            </h3>
            <div className="ex-note" data-kind={view.review.verdict === "pass" ? "ok" : "warn"}>
              <p className="ex-note-title">
                {view.review.verdict === "pass" ? "Passed ✓" : "Not yet"}
              </p>
              <p>{view.review.summary}</p>
            </div>
            <RichText text={view.review.feedback} />
          </section>
        )}
        {view.error && (
          <div className="ex-note" data-kind="error" role="alert">
            <p>{view.error}</p>
          </div>
        )}
        {exercise && report && (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}
