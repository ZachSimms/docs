/**
 * @file The playground's toolbar: back link, project picker, Run/Stop/Reset, zen, help, Refs.
 *
 * Client component; stateless apart from the inline "reset?" confirmation.
 */

"use client";

import { useState } from "react";
import { DottedLink } from "@/components/DottedLink";
import {
  LANGUAGE_GROUPS,
  LANGUAGES,
  type LanguageId,
  type LanguageSpec,
} from "@/lib/playground/languages";

/** Props for {@link PlaygroundToolbar}. */
interface PlaygroundToolbarProps {
  spec: LanguageSpec;
  running: boolean;
  canStop: boolean;
  refsOpen: boolean;
  notice: string | null;
  onLanguage(id: LanguageId): void;
  onRun(): void;
  onStop(): void;
  onReset(): void;
  onZen(): void;
  onHelp(): void;
  onRefs(): void;
}

/** Render the toolbar. */
export function PlaygroundToolbar(props: PlaygroundToolbarProps) {
  const { spec, running, canStop, refsOpen, notice } = props;
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <header className="pg-toolbar">
      <DottedLink href="/" ariaLabel="Back to home">
        ../
      </DottedLink>
      <h1 className="pg-title">Playground</h1>
      <label className="pg-language" data-tour="project">
        <span className="sr-only">Project</span>
        <select
          value={spec.id}
          onChange={(event) => {
            setConfirmReset(false);
            props.onLanguage(event.target.value as LanguageId);
          }}
        >
          {LANGUAGE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {LANGUAGES.filter((l) => l.group === group).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {spec.runner !== "markdown" && (
        <button
          type="button"
          className="link pg-run"
          data-tour="run"
          onClick={props.onRun}
          disabled={running}
          aria-keyshortcuts="Meta+Enter Control+Enter"
        >
          <i>▶ Run</i>
          <span className="pg-kbd" aria-hidden="true">
            {" "}
            ⌘↵
          </span>
        </button>
      )}
      {spec.runner !== "web" && spec.runner !== "markdown" && (
        <button type="button" className="link" onClick={props.onStop} disabled={!canStop}>
          <i>Stop</i>
        </button>
      )}
      {confirmReset ? (
        <span className="pg-confirm" role="group" aria-label="Reset project">
          reset to the starter project?{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setConfirmReset(false);
              props.onReset();
            }}
          >
            <i>yes</i>
          </button>{" "}
          <button type="button" className="link" onClick={() => setConfirmReset(false)}>
            <i>no</i>
          </button>
        </span>
      ) : (
        <button type="button" className="link pg-reset" onClick={() => setConfirmReset(true)}>
          <i>Reset</i>
        </button>
      )}
      <span className="pg-toolbar-end">
        {notice && (
          <span className="pg-notice" role="status">
            {notice}
          </span>
        )}
        <button
          type="button"
          className="link pg-zen-toggle"
          aria-keyshortcuts="Meta+Alt+Z Control+Alt+Z"
          title="Zen mode (⌘⌥Z)"
          onClick={props.onZen}
        >
          <i>zen</i>
        </button>
        <button
          type="button"
          className="link"
          data-tour="help"
          aria-keyshortcuts="F1 Meta+/ Control+/"
          title="Help (F1)"
          onClick={props.onHelp}
        >
          <i>?</i>
          <span className="sr-only"> Help</span>
        </button>
        <button
          type="button"
          className="link pg-refs-toggle"
          data-tour="refs"
          aria-expanded={refsOpen}
          aria-keyshortcuts="Meta+K Control+K"
          onClick={props.onRefs}
        >
          <i>Refs</i>
          <span className="pg-kbd" aria-hidden="true">
            {" "}
            ⌘K
          </span>
        </button>
      </span>
    </header>
  );
}
