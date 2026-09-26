/**
 * @file The playground's code editor: one CodeMirror view, one state per file.
 *
 * Client component. Switching files swaps the view's state, so each file keeps
 * its own undo history, selection and scroll position. The language for a file
 * loads lazily from its extension. Touch-friendly defaults: no autocorrect,
 * autocapitalise or spellcheck, and a 16px font on coarse pointers (set in CSS)
 * so iOS doesn't zoom on focus. ⌘/Ctrl+Enter runs the project.
 *
 * `handleRef` exposes insert/move/undo/focus for the mobile symbol row. The
 * parent remounts the editor (with a `key`) to forget every file's state, as
 * after switching language or Reset.
 */

"use client";

import { useEffect, useRef, type RefObject } from "react";
import { basicSetup } from "codemirror";
import { indentWithTab, undo } from "@codemirror/commands";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { modeForPath } from "@/lib/playground/languages";
import { editorTheme, highlightStyle, loadLanguage } from "./editorSetup";

/** What the symbol row (and tests) can do to the editor. */
export interface EditorHandle {
  /** Replace the selection with `text` (one undoable change). */
  insert(text: string): void;
  /** Move the cursor by `delta` characters. */
  moveCursor(delta: number): void;
  undo(): void;
  focus(): void;
}

/** Props for {@link CodeEditor}. */
interface CodeEditorProps {
  /** The open file's path (picks the language and the per-file state). */
  path: string;
  /** The file's contents. */
  value: string;
  /** Called with the new contents after every edit. */
  onChange(path: string, value: string): void;
  /** ⌘/Ctrl+Enter. */
  onRun(): void;
  /** Soft-wrap long lines. */
  wrap: boolean;
  /** Every file path in the project; parked states of files that no longer exist are dropped. */
  paths: readonly string[];
  /** Receives the {@link EditorHandle}. */
  handleRef?: RefObject<EditorHandle | null>;
  /** Called when the editor gains or loses focus. */
  onFocusChange?(focused: boolean): void;
  /** Hover, completions and diagnostics for a file (see `useIntellisense`); a new function reloads them. */
  loadAssist?(path: string): Promise<Extension>;
}

/** Keep the latest value of a prop in a ref, for listeners created once. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Render the editor into a host `div`. */
export function CodeEditor({
  path,
  paths,
  value,
  onChange,
  onRun,
  wrap,
  handleRef,
  onFocusChange,
  loadAssist,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  const currentPath = useRef(path);
  const language = useRef(new Compartment());
  const wrapping = useRef(new Compartment());
  const assist = useRef(new Compartment());
  const loadAssistRef = useLatest(loadAssist);
  const onChangeRef = useLatest(onChange);
  const onRunRef = useLatest(onRun);
  const onFocusRef = useLatest(onFocusChange);
  const wrapRef = useLatest(wrap);

  /** A fresh state for a file, with every extension; its language loads afterward. */
  const makeState = (filePath: string, doc: string): EditorState => {
    const extensions: Extension[] = [
      basicSetup,
      // Above basicSetup's keymap, whose Mod-Enter would insert a blank line.
      Prec.high(
        keymap.of([{ key: "Mod-Enter", run: () => (onRunRef.current(), true) }, indentWithTab]),
      ),
      language.current.of([]),
      assist.current.of([]),
      wrapping.current.of(wrapRef.current ? EditorView.lineWrapping : []),
      indentUnit.of(modeForPath(filePath) === "gdscript" ? "\t" : "  "),
      editorTheme,
      syntaxHighlighting(highlightStyle),
      EditorView.contentAttributes.of({
        autocorrect: "off",
        autocapitalize: "off",
        spellcheck: "false",
        "aria-label": `Code editor: ${filePath}`,
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged)
          onChangeRef.current(currentPath.current, update.state.doc.toString());
        if (update.focusChanged) onFocusRef.current?.(update.view.hasFocus);
      }),
    ];
    return EditorState.create({ doc, extensions });
  };

  /** Load the file's language and apply it if that file is still open. */
  const applyLanguage = (filePath: string) => {
    void loadLanguage(modeForPath(filePath)).then((ext) => {
      if (currentPath.current === filePath && view.current) {
        view.current.dispatch({ effects: language.current.reconfigure(ext) });
      }
    });
    applyAssist(filePath);
  };

  /** Load the file's intellisense and apply it if that file is still open. */
  const applyAssist = (filePath: string) => {
    const load = loadAssistRef.current;
    if (!load) return;
    void load(filePath).then((ext) => {
      if (currentPath.current === filePath && view.current) {
        view.current.dispatch({ effects: assist.current.reconfigure(ext) });
      }
    });
  };

  // Create the view once.
  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({ parent: host.current, state: makeState(path, value) });
    view.current = v;
    applyLanguage(path);
    return () => {
      v.destroy();
      view.current = null;
    };
    // The view is created once; later prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch files: park the old state, restore (or create) the new one.
  useEffect(() => {
    const v = view.current;
    if (!v || currentPath.current === path) return;
    states.current.set(currentPath.current, v.state);
    currentPath.current = path;
    v.setState(states.current.get(path) ?? makeState(path, value));
    // A parked state keeps the wrap setting it had; apply the current one.
    v.dispatch({
      effects: wrapping.current.reconfigure(wrapRef.current ? EditorView.lineWrapping : []),
    });
    applyLanguage(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Content changed outside the editor (rename, reset, another tab): replace the document.
  useEffect(() => {
    const v = view.current;
    if (!v || currentPath.current !== path) return;
    const doc = v.state.doc.toString();
    if (doc !== value) v.dispatch({ changes: { from: 0, to: doc.length, insert: value } });
  }, [path, value]);

  // Forget parked states of deleted or renamed files, so a file re-created at the
  // same path starts fresh (undo can't bring back the deleted contents).
  const pathKey = paths.join("\n");
  useEffect(() => {
    const live = new Set(pathKey.split("\n"));
    for (const key of states.current.keys()) if (!live.has(key)) states.current.delete(key);
  }, [pathKey]);

  // Intellisense became available (or changed): reload it for the open file.
  useEffect(() => {
    if (view.current) applyAssist(currentPath.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAssist]);

  // Soft wrap on/off.
  useEffect(() => {
    view.current?.dispatch({
      effects: wrapping.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }, [wrap]);

  // Expose the handle for the symbol row.
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      insert(text) {
        const v = view.current;
        if (!v) return;
        v.dispatch(v.state.replaceSelection(text), {
          scrollIntoView: true,
          userEvent: "input.type",
        });
      },
      moveCursor(delta) {
        const v = view.current;
        if (!v) return;
        const head = Math.max(0, Math.min(v.state.doc.length, v.state.selection.main.head + delta));
        v.dispatch({ selection: EditorSelection.cursor(head), scrollIntoView: true });
      },
      undo() {
        if (view.current) undo(view.current);
      },
      focus() {
        view.current?.focus();
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return <div ref={host} className="pg-editor" data-path={path} />;
}
