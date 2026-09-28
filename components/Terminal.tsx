/**
 * @file The terminal: the whole site as a shell, docked along the bottom of the window.
 *
 * Client component mounted once in the root layout, so it stays open, with its
 * scrollback, while `cd` moves the page behind it. It opens on `` ` `` (when no field
 * has focus) or the `open-terminal` event fired by the "Terminal" controls, and hides on
 * `Esc` or `exit`. On `/terminal/` it starts full screen. The first open loads the shell (`lib/terminal/host.ts`, imported on
 * demand so pages carry none of it until then) and fetches `/site-tree.json`; the
 * commands live in `lib/terminal/shell.ts` and reach the page through `makeHost`.
 *
 * `md` opens the Markdown pane (`SourcePane`) beside the page; it follows `cd` unless
 * pinned to a path, and closes with the terminal's other state saved.
 *
 * The prompt follows the page being read (`usePathname`), so clicking a link, `Esc` or
 * the browser's back button moves it too. Output links are the site's own dotted links.
 * The scrollback and open state survive reloads in `sessionStorage`; the command
 * history is kept in `localStorage`, like a shell's history file.
 *
 * Non-modal on purpose: the page stays usable beside it. Its keystrokes never reach
 * the page's single-key shortcuts, which ignore text fields.
 */

"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { TERMINAL_KEY, isPlainKey } from "@/lib/keys";
import type { OutputLine, Shell } from "@/lib/terminal/shell";
import type { Fs } from "@/lib/terminal/vfs";
import { TERMINAL_PATH } from "@/lib/site";
import { EMBED_ATTRIBUTE } from "@/lib/theme";
import { DottedLink } from "./DottedLink";
import { SourcePane } from "./SourcePane";
import { OPEN_TERMINAL_EVENT, type OpenTerminalOptions } from "./TerminalLink";

/** The terminal's runtime, loaded on first open. */
type Runtime = typeof import("@/lib/terminal/host");

/** `sessionStorage` key for the open state and scrollback. */
export const SESSION_KEY = "terminal";
/** `localStorage` key for the command history. */
export const HISTORY_KEY = "terminal-history";
/** Scrollback kept, in entries (commands and output lines). */
const MAX_ENTRIES = 1000;
/** Commands kept in the history. */
const MAX_HISTORY = 200;
/** DOM id of the output log, which the input describes. */
const LOG_ID = "terminal-log";

/** A line of the scrollback: an entered command with its prompt, or a line of output. */
type Entry =
  | { readonly id: number; readonly path: string; readonly command: string }
  | { readonly id: number; readonly out: OutputLine };

/**
 * The Markdown pane: following the shell (the source of each page it `cd`s to), or
 * pinned to one page's source.
 */
type Pane =
  | { readonly follow: true }
  | { readonly follow: false; readonly path: string; readonly source: string };

/** What survives a reload. */
interface Session {
  readonly open: boolean;
  readonly max: boolean;
  readonly entries: readonly Entry[];
  /** Absent in sessions saved before the pane existed. */
  readonly pane?: Pane | null;
}

/** The tree's lifecycle inside the component. */
type FsState = { status: "idle" | "error" } | { status: "ready"; fs: Fs };

/** Nothing stored: closed, docked, empty. */
const EMPTY_SESSION: Session = { open: false, max: false, entries: [] };

/** Whether stored JSON is a pane state. */
function isPane(value: unknown): value is Pane {
  if (typeof value !== "object" || value === null) return false;
  const { follow, path, source } = value as Record<string, unknown>;
  return (
    follow === true || (follow === false && typeof path === "string" && typeof source === "string")
  );
}

/** Whether stored JSON is a session this version can use. */
function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const { open, max, entries, pane } = value as Record<string, unknown>;
  return (
    typeof open === "boolean" &&
    typeof max === "boolean" &&
    (pane === undefined || pane === null || isPane(pane)) &&
    Array.isArray(entries) &&
    entries.every(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === "number" &&
        (Array.isArray((entry as { out?: unknown }).out) ||
          typeof (entry as { command?: unknown }).command === "string"),
    )
  );
}

/**
 * Whether this page is the playground's reference panel (`<html data-embed>`, set before
 * hydration). The panel is a same-origin frame sharing the tab's `sessionStorage`, so a
 * terminal in it must neither open nor save anything over the page's own session.
 */
function isEmbedded(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute(EMBED_ATTRIBUTE);
}

/** The stored session, or {@link EMPTY_SESSION} (on the server, in the panel, or when storage fails). */
function readSession(): Session {
  if (typeof window === "undefined" || isEmbedded()) return EMPTY_SESSION;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    return isSession(parsed) ? parsed : EMPTY_SESSION;
  } catch {
    return EMPTY_SESSION;
  }
}

/** The session to start with: the stored one, opened full screen on `/terminal/`. */
function initialSession(): Session {
  const session = readSession();
  const arrived =
    typeof window !== "undefined" && !isEmbedded() && window.location.pathname === TERMINAL_PATH;
  return arrived ? { ...session, open: true, max: true } : session;
}

/** The stored command history, oldest first. */
function readHistory(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Write to storage, ignoring private mode and full or disabled storage. */
function store(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // The terminal still works; it just forgets on reload.
  }
}

/** Never changes; lets {@link useHydrated} tell the server render from the client's. */
function subscribeNothing(): () => void {
  return () => {};
}

/** `false` on the server and while hydrating, `true` after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** Where the shell is: the prompt's path, and the page's Markdown source if it has one. */
interface Place {
  readonly path: string;
  readonly source?: string;
}

/** Home, before the tree arrives (and on the server). */
const HOME: Place = { path: "~" };

/** The shell's place, as a store the component subscribes to: the shell moves it. */
class PlaceStore {
  private place: Place = HOME;
  private readonly listeners = new Set<() => void>();
  readonly get = (): Place => this.place;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(place: Place): void {
    if (place.path === this.place.path && place.source === this.place.source) return;
    this.place = place;
    this.listeners.forEach((listener) => listener());
  }
}

/** Server snapshot of the place. */
function homePlace(): Place {
  return HOME;
}

/** One line of output, links rendered as the site's dotted links. */
function Output({ line }: { line: OutputLine }) {
  return (
    <div className="terminal-line">
      {line.map((segment, i) =>
        segment.href ? (
          <DottedLink key={i} href={segment.href} inline prefetch={false}>
            {segment.text}
          </DottedLink>
        ) : (
          <span key={i} className={segment.tone ? `t-${segment.tone}` : undefined}>
            {segment.text}
          </span>
        ),
      )}
    </div>
  );
}

/** The prompt: `zach:~/docs/python$ `. */
function Prompt({ path }: { path: string }) {
  return (
    <span className="terminal-prompt" aria-hidden="true">
      <span className="t-dim">zach:</span>
      {path}
      <span className="t-dim">$</span>{" "}
    </span>
  );
}

/** The terminal itself; see the file header. Mount exactly once, in the root layout. */
export function Terminal() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [session] = useState(initialSession);
  const [open, setOpen] = useState(session.open);
  const [max, setMax] = useState(session.max);
  const [entries, setEntries] = useState<readonly Entry[]>(session.entries);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fsState, setFsState] = useState<FsState>({ status: "idle" });
  const [pane, setPane] = useState<Pane | null>(session.pane ?? null);
  const [placeStore] = useState(() => new PlaceStore());
  const place = useSyncExternalStore(placeStore.subscribe, placeStore.get, homePlace);
  const path = place.path;

  const shellRef = useRef<Shell | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const loadingRef = useRef(false);
  const nextId = useRef(Math.max(0, ...session.entries.map((entry) => entry.id)) + 1);
  const historyRef = useRef<string[] | null>(null);
  /** Position while walking the history with ↑/↓, and the line being typed before. */
  const recallRef = useRef<{ index: number; draft: string } | null>(null);
  const runRef = useRef(0);
  /** Lines entered while a command was still running, oldest first. */
  const queueRef = useRef<string[]>([]);
  /** Whether a command is running; a ref so two quick Enters cannot both start one. */
  const runningRef = useRef(false);
  const routerRef = useRef(router);
  const maxRef = useRef(max);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    routerRef.current = router;
    maxRef.current = max;
  }, [router, max]);

  const history = useCallback((): string[] => (historyRef.current ??= readHistory()), []);

  /** Append entries, keeping the last {@link MAX_ENTRIES}. */
  const print = useCallback(
    (items: readonly ({ path: string; command: string } | { out: OutputLine })[]) => {
      const added = items.map((item) => ({ ...item, id: nextId.current++ }) as Entry);
      setEntries((current) => [...current, ...added].slice(-MAX_ENTRIES));
    },
    [],
  );

  /** Fetch the tree the first time it is needed, and set up the shell on it. */
  const ensureFs = useCallback(() => {
    if (loadingRef.current || shellRef.current) return;
    loadingRef.current = true;
    import("@/lib/terminal/host")
      .then(async (runtime) => {
        const fs = await runtime.loadFs();
        const { Shell, makeHost, nodeForHref, pathOf } = runtime;
        const host = makeHost({
          router: () => routerRef.current,
          history,
          clear: () => setEntries([]),
          showSource: (view) =>
            setPane(
              view === null
                ? null
                : view.follow
                  ? { follow: true }
                  : { follow: false, path: pathOf(view.node), source: view.node.source ?? "" },
            ),
          close: () => setOpen(false),
          toggleMax: () => {
            const next = !maxRef.current;
            maxRef.current = next;
            setMax(next);
            return next;
          },
        });
        const start = nodeForHref(fs, window.location.pathname) ?? fs.root;
        const placeOf = (node: typeof start): Place =>
          node.source ? { path: pathOf(node), source: node.source } : { path: pathOf(node) };
        placeStore.set(placeOf(start));
        shellRef.current = new Shell(fs, host, start, (node) => placeStore.set(placeOf(node)));
        runtimeRef.current = runtime;
        setFsState({ status: "ready", fs });
      })
      .catch(() => setFsState({ status: "error" }))
      .finally(() => {
        loadingRef.current = false;
      });
  }, [history, placeStore]);

  /** Open (or focus) the terminal; `maximize` also makes it full screen. */
  const show = useCallback(
    (maximize = false) => {
      if (isEmbedded()) return;
      if (!open) openerRef.current = document.activeElement;
      setOpen(true);
      if (maximize) {
        maxRef.current = true;
        setMax(true);
      }
      ensureFs();
      inputRef.current?.focus();
    },
    [ensureFs, open],
  );

  const hide = useCallback(() => {
    setOpen(false);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body)
      opener.focus();
    else inputRef.current?.blur();
  }, []);

  // `` ` `` opens (or focuses) the terminal; the footer and navigation controls fire the event.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!isPlainKey(event, TERMINAL_KEY)) return;
      event.preventDefault();
      show();
    };
    const onOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as OpenTerminalOptions) : null;
      show(detail?.max === true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_TERMINAL_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_TERMINAL_EVENT, onOpen);
    };
  }, [show]);

  // Reopened by a reload: fetch the tree again (state is only set once it arrives).
  useEffect(() => {
    if (open) ensureFs();
  }, [open, ensureFs]);

  // Follow the page being read.
  useEffect(() => {
    shellRef.current?.syncTo(pathname);
  }, [pathname]);

  // While open, the page makes room for it (docked) or is covered (full screen); focus the prompt.
  // (It renders nothing until hydrated, so a terminal restored open, or opened by
  // `/terminal/`, only has a prompt to focus once `hydrated` flips.)
  useEffect(() => {
    if (!open || !hydrated) return;
    document.body.setAttribute("data-terminal", max ? "max" : "docked");
    inputRef.current?.focus();
    return () => document.body.removeAttribute("data-terminal");
  }, [open, max, hydrated]);

  // Remember the session; keep the newest output in view.
  useEffect(() => {
    if (!isEmbedded())
      store(() => sessionStorage, SESSION_KEY, { open, max, entries, pane } satisfies Session);
  }, [open, max, entries, pane]);

  // With the Markdown pane open, the page (docked) or the terminal (full screen) takes the left half.
  useEffect(() => {
    if (!open || !hydrated || !pane) return;
    document.body.setAttribute("data-source", "");
    return () => document.body.removeAttribute("data-source");
  }, [open, hydrated, pane]);
  useEffect(() => {
    const screen = screenRef.current;
    if (screen) screen.scrollTop = screen.scrollHeight;
  }, [entries, open, fsState, hydrated]);

  const fs = fsState.status === "ready" ? fsState.fs : null;

  /** Remember a command in the history file. */
  const remember = (command: string) => {
    const past = history();
    if (command.trim() === "" || past[past.length - 1] === command) return;
    past.push(command);
    past.splice(0, Math.max(0, past.length - MAX_HISTORY));
    store(() => localStorage, HISTORY_KEY, past);
  };

  /**
   * Run a line, then whatever was typed ahead while it ran (each echoed with the prompt
   * it runs at, as a shell prints type-ahead once its prompt comes back).
   */
  const execute = async (command: string) => {
    const shell = shellRef.current;
    print([{ path: placeStore.get().path, command }]);
    if (!shell || command.trim() === "") return;
    const run = ++runRef.current;
    runningRef.current = true;
    setBusy(true);
    const lines = await shell.run(command);
    if (run !== runRef.current) return; // interrupted with ctrl+c
    print(lines.map((out) => ({ out })));
    const next = queueRef.current.shift();
    if (next !== undefined) return execute(next);
    runningRef.current = false;
    setBusy(false);
  };

  /** Enter: run the typed line, or queue it behind the one still running. */
  const submit = () => {
    const command = input;
    setInput("");
    recallRef.current = null;
    remember(command);
    if (runningRef.current) queueRef.current.push(command);
    else void execute(command);
  };

  /** Tab: complete the last word, or list the choices. */
  const tab = () => {
    const shell = shellRef.current;
    const runtime = runtimeRef.current;
    if (!fs || !shell || !runtime) return;
    const completion = runtime.complete(
      fs,
      shell.cwd,
      input,
      shell.commandNames,
      runtime.pageAnchors(),
    );
    setInput(completion.line);
    if (completion.choices.length > 0) {
      print([{ path, command: input }, { out: [{ text: completion.choices.join("  ") }] }]);
    }
  };

  /** ↑/↓: walk the history, keeping the line being typed to come back to. */
  const recall = (delta: -1 | 1) => {
    const past = history();
    const at = recallRef.current ?? { index: past.length, draft: input };
    const index = Math.min(past.length, Math.max(0, at.index + delta));
    recallRef.current = { index, draft: at.draft };
    setInput(index === past.length ? at.draft : (past[index] ?? ""));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const ctrl = event.ctrlKey && !event.metaKey && !event.altKey;
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      tab();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      recall(event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      hide();
    } else if (ctrl && event.key === "l") {
      event.preventDefault();
      setEntries([]);
    } else if (ctrl && event.key === "c") {
      if (inputRef.current && inputRef.current.selectionStart !== inputRef.current.selectionEnd)
        return; // copy
      event.preventDefault();
      runRef.current++;
      queueRef.current = [];
      runningRef.current = false;
      setBusy(false);
      print([{ path, command: `${input}^C` }]);
      setInput("");
    } else if (ctrl && event.key === "u") {
      event.preventDefault();
      setInput("");
    }
  };

  if (!hydrated || !open) return null;

  return (
    <>
      {pane && (
        <SourcePane
          url={pane.follow ? place.source : pane.source}
          path={pane.follow ? place.path : pane.path}
          follow={pane.follow}
          onClose={() => setPane(null)}
        />
      )}
      <section className="terminal" data-size={max ? "max" : "docked"} aria-label="Terminal">
        <div className="terminal-bar">
          <span className="t-dim">terminal · {path}</span>
          <span>
            <button
              type="button"
              className="link terminal-max"
              aria-pressed={max}
              aria-label={max ? "Dock the terminal" : "Full screen terminal"}
              onClick={() => setMax(!max)}
            >
              <i>{max ? "dock" : "max"}</i>
            </button>
            <span className="terminal-max">{"  "}</span>
            <button type="button" className="link" aria-label="Hide the terminal" onClick={hide}>
              <i>esc</i>
            </button>
          </span>
        </div>
        <div
          ref={screenRef}
          className="terminal-screen"
          onClick={() => {
            // A click that is not a selection puts the caret back in the prompt.
            if (window.getSelection()?.isCollapsed ?? true) inputRef.current?.focus();
          }}
        >
          <div id={LOG_ID} role="log" aria-live="polite" aria-label="Terminal output">
            {entries.length === 0 && (
              <div className="terminal-line t-dim">
                The site as a shell. Try ls, cd docs, tree, grep &lt;words&gt; or help.
              </div>
            )}
            {entries.map((entry) =>
              "out" in entry ? (
                <Output key={entry.id} line={entry.out} />
              ) : (
                <div key={entry.id} className="terminal-line">
                  <Prompt path={entry.path} />
                  {entry.command}
                </div>
              ),
            )}
            {(fsState.status === "idle" || busy) && (
              <div className="terminal-line t-dim">{busy ? "…" : "loading…"}</div>
            )}
            {fsState.status === "error" && (
              <div className="terminal-line t-error">site tree unavailable; esc and ` to retry</div>
            )}
          </div>
          <label className="terminal-line terminal-input">
            <Prompt path={path} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                recallRef.current = null;
              }}
              onKeyDown={onKeyDown}
              aria-label="Command"
              aria-describedby={LOG_ID}
              aria-busy={busy}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
            />
          </label>
        </div>
      </section>
    </>
  );
}
