/**
 * @file The symbol row above the on-screen keyboard (touch screens only).
 *
 * Client component. Coding symbols are awkward on phone keyboards, so while
 * the editor has focus on a coarse pointer, a row of them sits just above the
 * keyboard (tracked with the `visualViewport` API). Buttons act on
 * `pointerdown` with `preventDefault`, so the editor keeps focus and the
 * keyboard stays up; each insert is one undoable CodeMirror change.
 */

"use client";

import { useEffect, useState, type RefObject } from "react";
import type { EditorHandle } from "./CodeEditor";

/** Keys on the row: what the button shows, and what it does. */
export const SYMBOL_KEYS: readonly {
  label: string;
  name: string;
  action: "indent" | "left" | "right" | "undo" | string;
}[] = [
  { label: "⇥", name: "Tab", action: "indent" },
  ...[
    "{",
    "}",
    "(",
    ")",
    "[",
    "]",
    ";",
    ":",
    "=",
    '"',
    "'",
    "<",
    ">",
    "/",
    "\\",
    "|",
    "&",
    "_",
    "-",
    "$",
    "#",
  ].map((s) => ({
    label: s,
    name: s,
    action: s,
  })),
  { label: "←", name: "Cursor left", action: "left" },
  { label: "→", name: "Cursor right", action: "right" },
  { label: "↶", name: "Undo", action: "undo" },
];

/** Distance from the layout viewport's bottom to the visual viewport's bottom (the keyboard's height). */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/** Props for {@link SymbolRow}. */
interface SymbolRowProps {
  handleRef: RefObject<EditorHandle | null>;
  /** What ⇥ inserts (a tab for GDScript, two spaces otherwise). */
  indent: string;
  /** Show the row (the editor has focus). */
  visible: boolean;
}

/** Render the row. */
export function SymbolRow({ handleRef, indent, visible }: SymbolRowProps) {
  const inset = useKeyboardInset();
  if (!visible) return null;
  const press = (action: string) => {
    const editor = handleRef.current;
    if (!editor) return;
    if (action === "indent") editor.insert(indent);
    else if (action === "left") editor.moveCursor(-1);
    else if (action === "right") editor.moveCursor(1);
    else if (action === "undo") editor.undo();
    else editor.insert(action);
  };
  return (
    <div
      className="pg-symbols"
      role="toolbar"
      aria-label="Coding symbols"
      style={{ bottom: inset }}
    >
      {SYMBOL_KEYS.map((key) => (
        <button
          key={key.name}
          type="button"
          aria-label={key.name}
          tabIndex={-1}
          onPointerDown={(event) => {
            event.preventDefault(); // keep focus (and the keyboard) in the editor
            press(key.action);
          }}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
