/**
 * @file CodeMirror pieces for the playground editor: the site-colored theme,
 * syntax colors, and lazy language loading per editor mode.
 *
 * Client-only. Colors are CSS variables from `globals.css`, so the editor
 * follows light/dark without being reconfigured. Each language package is a
 * separate dynamic import, so the page only downloads the ones in use.
 */

"use client";

import { HighlightStyle, StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { EditorMode } from "@/lib/playground/languages";

/** Editor chrome: page colors, monospace type, dotted focus ring. */
export const editorTheme: Extension = EditorView.theme({
  "&": {
    color: "var(--fg)",
    backgroundColor: "var(--pre-bg)",
    height: "100%",
    fontSize: "var(--pg-code-size, 14px)",
  },
  "&.cm-focused": { outline: "1px dotted currentColor" },
  ".cm-scroller": { fontFamily: "monospace", lineHeight: "1.5" },
  ".cm-content": { caretColor: "var(--fg)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--sel-bg)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--pre-bg)",
    color: "var(--dot-mobile)",
    borderRight: "1px dotted var(--pre-border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--fg) 5%, transparent)",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "var(--chip)",
    outline: "1px dotted var(--dot-mobile)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg)",
    border: "1px dotted var(--fg)",
    color: "var(--fg)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--sel-bg)",
    color: "var(--sel-fg)",
  },
  ".pg-hover": {
    maxWidth: "min(70ch, 90vw)",
    maxHeight: "40vh",
    overflow: "auto",
    padding: "0.35em 1ch",
    fontFamily: "monospace",
    fontSize: "0.9em",
  },
  ".pg-hover-sig": { display: "block", whiteSpace: "pre-wrap", fontWeight: "bold" },
  ".pg-hover p": { margin: "0.4em 0 0", whiteSpace: "pre-wrap" },
  ".pg-hover-tag": { opacity: "0.8" },
  ".cm-diagnostic": { fontFamily: "monospace", whiteSpace: "pre-wrap" },
  ".cm-panels": { backgroundColor: "var(--bg)", color: "var(--fg)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--graph-0) 25%, transparent)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--chip)", border: "none", color: "var(--fg)" },
});

/** Token colors from the site's four graph colors (each has a light and a dark value). */
export const highlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword],
    color: "var(--graph-3)",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character],
    color: "var(--graph-2)",
  },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--graph-0)" },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--dot-mobile)",
    fontStyle: "italic",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.definition(tags.function(tags.variableName)),
    ],
    color: "var(--graph-0)",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.variableName)],
    color: "var(--graph-1)",
  },
  {
    tag: [tags.meta, tags.annotation, tags.processingInstruction, tags.special(tags.variableName)],
    color: "var(--graph-1)",
  },
  { tag: [tags.tagName, tags.heading], color: "var(--graph-3)", fontWeight: "bold" },
  { tag: [tags.attributeName, tags.propertyName], color: "var(--graph-0)" },
  { tag: tags.invalid, color: "var(--graph-1)", textDecoration: "underline wavy" },
]);

/**
 * Load the language support for an editor mode.
 *
 * @param mode - From `modeForPath`.
 * @returns The CodeMirror extension (empty for plain text).
 */
export async function loadLanguage(mode: EditorMode): Promise<Extension> {
  switch (mode) {
    case "javascript":
    case "jsx":
    case "typescript":
    case "tsx": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({
        jsx: mode === "jsx" || mode === "tsx",
        typescript: mode === "typescript" || mode === "tsx",
      });
    }
    case "html":
      return (await import("@codemirror/lang-html")).html();
    case "css":
      return (await import("@codemirror/lang-css")).css();
    case "python":
      return (await import("@codemirror/lang-python")).python();
    case "cpp":
      return (await import("@codemirror/lang-cpp")).cpp();
    case "rust":
      return (await import("@codemirror/lang-rust")).rust();
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "gdscript": {
      const { gdscriptMode } = await import("@/lib/playground/gdscript-mode");
      return StreamLanguage.define(gdscriptMode);
    }
    default:
      return [];
  }
}
