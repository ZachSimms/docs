/**
 * @file The playground's exercise panel (where the file tree is in project mode): the request
 * form, then the exercise (brief, requirements, hints, reference solution), then recent ones.
 *
 * Client component; everything it shows and does comes from {@link ExerciseSession}.
 */

"use client";

import { useState } from "react";
import {
  CODE_LANGUAGES,
  CODE_THEMES,
  DIFFICULTIES,
  EXAMPLE_REQUESTS,
  SIZES,
  THEME_GROUPS,
  optionLabel,
  themeFitsLanguage,
  type CodeLanguage,
} from "@/lib/exercises/options";
import type { CodeStore } from "@/lib/exercises/storage";
import { RecentList } from "./RecentList";
import { RichText } from "./RichText";
import type { ExerciseSession } from "./useExerciseSession";
import "./exercises.css";

/** How many suggested requests show at a time. */
const EXAMPLE_COUNT = 3;

/** A few suggested requests, drawn at random so they vary between visits. */
function drawExamples(random: () => number = Math.random): string[] {
  const pool = [...EXAMPLE_REQUESTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, EXAMPLE_COUNT);
}

/** Status text with a spinner. */
export function Busy({ label }: { label: string }) {
  return (
    <span className="ex-status" role="status">
      <span className="ex-spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

/** A link-styled button (the site's idiom). */
export function Action({
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

/** Props for {@link ExercisePanel}. */
interface ExercisePanelProps {
  readonly session: ExerciseSession;
  /** Hide the panel (the playground's `«`). */
  onHide(): void;
  /** Show the "How it works" card (first visit, or asked for). */
  readonly intro: boolean;
  /** Show or hide the card; hiding it for good is the playground's business. */
  onIntro(show: boolean): void;
  /** Start the exercise tour. */
  onTour(): void;
}

/** The "How it works" card: what the mode does, in the order you use it. */
function Intro({ onClose, onTour }: { onClose(): void; onTour(): void }) {
  return (
    <section className="ex-note ex-intro" data-kind="ok" aria-labelledby="ex-intro-title">
      <p className="ex-note-title" id="ex-intro-title">
        How exercises work
      </p>
      <ol>
        <li>
          <strong>Ask.</strong> Describe what you want to practice, or pick a theme, difficulty and
          language, then generate. An AI writes a task with hidden tests, and checks those tests
          against its own solution before you see them.
        </li>
        <li>
          <strong>Read.</strong> The task, its requirements and hints appear here; the starter code
          opens in the editor.
        </li>
        <li>
          <strong>Code and test.</strong> Write your solution and press ▶ Run tests (⌘↵). The tests
          run in your browser; each one says why it failed and what your code printed.
        </li>
        <li>
          <strong>Submit.</strong> When the tests pass, Submit asks the AI to review what tests
          can&apos;t check (did you use a class, is it clean) and marks the exercise passed.
        </li>
      </ol>
      <p>
        Your exercises and code stay in this browser (Recent).{" "}
        <Action onClick={onTour}>take the tour</Action> <Action onClick={onClose}>got it</Action>
      </p>
    </section>
  );
}

/** The form, the current exercise and the recent list. */
export function ExercisePanel({ session, onHide, intro, onIntro, onTour }: ExercisePanelProps) {
  const { store, form, exercise, progress, view, busy } = session;
  // With an exercise open the form folds away; generating or an empty list keeps it open.
  const formOpen = !exercise || busy !== null || session.askDownload;
  const setForm = (patch: Partial<CodeStore["form"]>) => session.setForm(patch);
  // Drawn once per mount; the panel renders client-side only, so there is no hydration to match.
  const [examples] = useState(drawExamples);
  /** Themes shown for the chosen language, by group ("Any" first, on its own). */
  const themesIn = (group: string | null) =>
    CODE_THEMES.filter((t) => t.group === group && themeFitsLanguage(t.id, form.language));

  const requestForm = (
    <form
      className="ex-form"
      data-tour="exercise-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) session.generate();
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
          placeholder="e.g. a shopping cart with discount codes and tax"
          onChange={(event) => setForm({ request: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (!busy) session.generate();
            }
          }}
        />
        <p className="ex-label ex-examples">
          try:{" "}
          {examples.map((example, i) => (
            <span key={example}>
              {i > 0 && " · "}
              <button type="button" className="link" onClick={() => setForm({ request: example })}>
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
            {themesIn(null).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            {THEME_GROUPS.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {themesIn(group.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
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
            onChange={(event) => {
              const language = event.target.value as CodeLanguage;
              // Async and TypeScript types don't exist in every language: fall back to "Any".
              setForm(
                themeFitsLanguage(form.theme, language) ? { language } : { language, theme: "any" },
              );
            }}
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
            onChange={(event) => setForm({ size: event.target.value as CodeStore["form"]["size"] })}
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
            <Action onClick={session.cancel}>cancel</Action>
          </>
        )}
      </div>
      {session.askDownload && (
        <div className="ex-note" data-kind="warn" role="group" aria-label="Download Python">
          <p>
            Python exercises run in your browser on Pyodide, about 6 MB downloaded once.{" "}
            <Action onClick={session.approveDownload}>download and generate</Action>{" "}
            <Action onClick={session.cancelDownload}>cancel</Action>
          </p>
        </div>
      )}
    </form>
  );

  return (
    <div className="ex pg-exercise">
      <div className="pg-bar">
        <span>Exercise</span>
        <button
          type="button"
          className="link ex-howto"
          aria-expanded={intro}
          onClick={() => onIntro(!intro)}
        >
          <i>how it works</i>
        </button>
        <button
          type="button"
          className="link"
          aria-label="Hide the exercise panel"
          title="Hide the exercise panel"
          onClick={onHide}
        >
          <i>«</i>
        </button>
      </div>
      <div className="pg-exercise-body">
        {intro && <Intro onClose={() => onIntro(false)} onTour={onTour} />}
        {formOpen ? (
          requestForm
        ) : (
          <details className="ex-new">
            <summary>
              <span className="ex-label">new exercise</span>
            </summary>
            {requestForm}
          </details>
        )}

        {session.error && (
          <div className="ex-note" data-kind="error" role="alert">
            <p>{session.error}</p>
          </div>
        )}

        {exercise ? (
          <article className="ex-exercise" aria-labelledby="ex-title" data-tour="exercise-brief">
            <h2 id="ex-title">
              {exercise.title}
              {progress?.passed && <span className="ex-ok"> ✓</span>}
            </h2>
            <p className="ex-meta">
              {[
                optionLabel(CODE_LANGUAGES, exercise.language),
                optionLabel(DIFFICULTIES, exercise.difficulty),
                exercise.theme === "any" ? null : optionLabel(CODE_THEMES, exercise.theme),
                optionLabel(SIZES, exercise.size),
                `${exercise.tests.length} tests`,
              ]
                .filter(Boolean)
                .join(" · ")}
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
                  The model&apos;s own reference solution didn&apos;t pass all of these tests, even
                  after a repair. If a test fails and you are sure your code follows the brief, the
                  test may be at fault.
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
                const judged = view.review?.requirements[i];
                return (
                  <li key={requirement}>
                    <span
                      className={
                        judged
                          ? judged.met
                            ? "ex-mark ex-ok"
                            : "ex-mark ex-bad"
                          : "ex-mark ex-label"
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

            <div className="ex-actions">
              <Action onClick={session.nextHint} disabled={view.hints >= exercise.hints.length}>
                {`Hint (${view.hints}/${exercise.hints.length})`}
              </Action>
              <Action
                onClick={() => session.setSolution(view.solution === "hidden" ? "ask" : "hidden")}
                disabled={view.solution === "shown"}
              >
                Solution
              </Action>
            </div>

            {view.hints > 0 && (
              <section aria-label="Hints">
                <h3>Hints</h3>
                <ol>
                  {exercise.hints.slice(0, view.hints).map((hint) => (
                    <li key={hint}>
                      <RichText text={hint} inline />
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {view.solution === "ask" && (
              <div className="ex-note" data-kind="warn">
                <p>
                  Sure? Struggling a bit longer is where the learning happens.{" "}
                  <Action onClick={() => session.setSolution("shown")}>show it</Action>{" "}
                  <Action onClick={() => session.setSolution("hidden")}>not yet</Action>
                </p>
              </div>
            )}
            {view.solution === "shown" && (
              <section aria-label="Reference solution">
                <h3>Reference solution</h3>
                <pre>
                  <code>{exercise.solution}</code>
                </pre>
              </section>
            )}
          </article>
        ) : (
          !busy &&
          !intro && (
            <p className="ex-label">
              No exercise yet: ask for one above.{" "}
              <Action onClick={() => onIntro(true)}>how it works</Action>
            </p>
          )
        )}

        <div data-tour="exercise-recent">
          <RecentList
            items={store.exercises.map((ex) => {
              const p = store.progress[ex.id];
              return {
                id: ex.id,
                title: ex.title,
                detail: `${optionLabel(CODE_LANGUAGES, ex.language)} · ${ex.difficulty}`,
                status: p?.passed ? (
                  <span className="ex-ok">✓ passed</span>
                ) : p?.best ? (
                  <span className="ex-label">{p.best} tests</span>
                ) : null,
              };
            })}
            currentId={store.currentId}
            disabled={session.working}
            heading="h3"
            noun="exercise"
            onSelect={session.select}
            onRemove={session.remove}
          />
        </div>
      </div>
    </div>
  );
}
