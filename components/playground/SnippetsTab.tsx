/**
 * @file The reference panel's Snippets tab: copy-ready code for the current project.
 *
 * Client component. Shows the project's snippet sets (see
 * `lib/playground/snippets`), starting on the one written in the open file's
 * language. A set loads (its own chunk) the first time it's shown. Each snippet
 * can be copied to the clipboard or inserted at the editor's cursor. If the
 * clipboard is refused, the snippet's code is selected so ⌘C / Ctrl+C copies it.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { padNumber } from "@/lib/format";
import type { EditorMode, LanguageId } from "@/lib/playground/languages";
import {
  defaultSnippetSet,
  filterSnippets,
  loadSnippets,
  SNIPPET_SETS,
  SNIPPETS_FOR,
  type Snippet,
  type SnippetSetId,
} from "@/lib/playground/snippets";
import { highlight, plainLines, type Token } from "./snippetHighlight";

/** How long "copied" / "inserted" stays on a button. */
const FEEDBACK_MS = 1500;

const cache = new Map<SnippetSetId, Promise<readonly Snippet[]>>();

/** Load a set once per page (a failed load is retried next time). */
function loadSet(id: SnippetSetId): Promise<readonly Snippet[]> {
  let pending = cache.get(id);
  if (!pending) {
    pending = loadSnippets(id).catch((error: unknown) => {
      cache.delete(id);
      throw error;
    });
    cache.set(id, pending);
  }
  return pending;
}

/** Props for {@link SnippetsTab}. */
interface SnippetsTabProps {
  /** The project type (picks the sets). */
  language: LanguageId;
  /** The open file's editor mode (picks the first set shown). */
  mode: EditorMode;
  /** Insert code at the editor's cursor; `false` if there's no editor to insert into. */
  onInsert?(code: string): boolean;
}

/** Render the tab. */
export function SnippetsTab({ language, mode, onInsert }: SnippetsTabProps) {
  const sets = SNIPPETS_FOR[language];
  const [picked, setPicked] = useState<SnippetSetId | null>(null);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<{ id: SnippetSetId; snippets: readonly Snippet[] } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Another project: start again from its own sets.
  const [pickedFor, setPickedFor] = useState(language);
  if (pickedFor !== language) {
    setPickedFor(language);
    setPicked(null);
  }

  const setId = picked && sets.includes(picked) ? picked : defaultSnippetSet(language, mode);
  const info = SNIPPET_SETS[setId];

  useEffect(() => {
    let live = true;
    loadSet(setId).then(
      (snippets) => live && (setLoaded({ id: setId, snippets }), setFailed(false)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [setId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const snippets = loaded?.id === setId ? loaded.snippets : null;
  const shown = useMemo(() => (snippets ? filterSnippets(snippets, query) : []), [snippets, query]);

  const say = (id: string, text: string) => {
    clearTimeout(timer.current);
    setFeedback({ id, text });
    timer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
  };

  const copy = async (snippet: Snippet, code: HTMLElement | null) => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      say(snippet.id, "copied");
    } catch {
      // No clipboard access (an insecure page, or permission refused): select the code instead.
      if (code) window.getSelection()?.selectAllChildren(code);
      say(snippet.id, "selected: press ⌘C / Ctrl+C");
    }
  };

  const insert = (snippet: Snippet) => {
    if (onInsert?.(snippet.code)) say(snippet.id, "inserted");
    else say(snippet.id, "no open editor");
  };

  return (
    <div className="pg-docs pg-snippets">
      <div className="pg-docs-search">
        {sets.length > 1 && (
          <select
            aria-label="Snippet language"
            value={setId}
            onChange={(e) => setPicked(e.target.value as SnippetSetId)}
          >
            {sets.map((id) => (
              <option key={id} value={id}>
                {SNIPPET_SETS[id].label}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          aria-label="Filter snippets"
          placeholder="Filter: class, async, try…"
          value={query}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
        />
      </div>
      <div className="pg-refs-list">
        <p className="pg-muted">
          {info.label}: {info.note}
        </p>
        {!snippets && !failed && <p role="status">loading…</p>}
        {failed && (
          <p role="status">Snippets couldn&apos;t load. Check the connection and reopen the tab.</p>
        )}
        {snippets && query.trim() && shown.length === 0 && <p role="status">no snippets match</p>}
        {!query.trim() && snippets && snippets.length > 3 && (
          <nav className="pg-snippet-index" aria-label="Snippets">
            {snippets.map((s) => (
              <button
                key={s.id}
                type="button"
                className="link"
                onClick={() =>
                  document
                    .getElementById(`pg-snippet-${setId}-${s.id}`)
                    ?.scrollIntoView({ block: "start", behavior: "smooth" })
                }
              >
                <i>{s.title}</i>
              </button>
            ))}
          </nav>
        )}
        {shown.map((snippet, i) => (
          <SnippetCard
            key={`${setId}:${snippet.id}`}
            setId={setId}
            index={i}
            snippet={snippet}
            mode={info.mode}
            feedback={feedback?.id === snippet.id ? feedback.text : null}
            onCopy={copy}
            onInsert={onInsert ? insert : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** Props for {@link SnippetCard}. */
interface SnippetCardProps {
  setId: SnippetSetId;
  index: number;
  snippet: Snippet;
  mode: EditorMode;
  feedback: string | null;
  onCopy(snippet: Snippet, code: HTMLElement | null): void;
  onInsert?(snippet: Snippet): void;
}

/** One snippet: title, actions, note and highlighted code. */
function SnippetCard({
  setId,
  index,
  snippet,
  mode,
  feedback,
  onCopy,
  onInsert,
}: SnippetCardProps) {
  const code = useRef<HTMLElement>(null);
  const [lines, setLines] = useState<Token[][]>(() => plainLines(snippet.code));

  useEffect(() => {
    let live = true;
    highlight(snippet.code, mode).then((result) => live && setLines(result));
    return () => {
      live = false;
    };
  }, [snippet.code, mode]);

  const headingId = `pg-snippet-${setId}-${snippet.id}`;
  return (
    <article className="pg-snippet" aria-labelledby={headingId}>
      <div className="pg-snippet-head">
        <h3 id={headingId}>
          {padNumber(index)}. {snippet.title}
        </h3>
        {snippet.file && <span className="pg-muted">{snippet.file}</span>}
        <span className="pg-bar-actions">
          <span className="pg-snippet-status" role="status" aria-live="polite">
            {feedback}
          </span>
          <button
            type="button"
            className="link"
            aria-label={`Copy ${snippet.title}`}
            onClick={() => onCopy(snippet, code.current)}
          >
            <i>copy</i>
          </button>
          {onInsert && (
            <button
              type="button"
              className="link"
              aria-label={`Insert ${snippet.title} at the cursor`}
              title="Insert at the cursor in the open file"
              onClick={() => onInsert(snippet)}
            >
              <i>insert</i>
            </button>
          )}
        </span>
      </div>
      {snippet.note && <p className="pg-snippet-note">{snippet.note}</p>}
      <pre className="pg-snippet-code" tabIndex={0} aria-label={`${snippet.title} code`}>
        <code ref={code}>
          {lines.map((line, l) => (
            <span key={l} className="pg-snippet-line">
              {line.map((token, t) =>
                token.className ? (
                  <span key={t} className={token.className}>
                    {token.text}
                  </span>
                ) : (
                  token.text
                ),
              )}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </article>
  );
}
