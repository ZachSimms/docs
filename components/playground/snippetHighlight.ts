/**
 * @file Syntax highlighting for the Snippets tab, with the editor's own parsers.
 *
 * Client-only. Loads the Lezer parser for a mode through `loadLanguage` (the
 * same lazy chunks the editor uses), parses a snippet once, and returns its
 * lines as runs of text with `pg-tok-*` classes (colored in `playground.css`
 * with the editor's palette). No HTML strings: the result renders as React
 * text nodes.
 */

"use client";

import { Language, LanguageSupport } from "@codemirror/language";
import { highlightCode, tagHighlighter, tags } from "@lezer/highlight";
import type { EditorMode } from "@/lib/playground/languages";
import { loadLanguage } from "./editorSetup";

/** One run of text and its token classes ("" for plain text). */
export interface Token {
  readonly text: string;
  readonly className: string;
}

/** Tags to classes; mirrors `highlightStyle` in `editorSetup.ts`. */
const highlighter = tagHighlighter([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword],
    class: "pg-tok-kw",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character],
    class: "pg-tok-str",
  },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], class: "pg-tok-num" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], class: "pg-tok-comment" },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.definition(tags.function(tags.variableName)),
    ],
    class: "pg-tok-fn",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.variableName)],
    class: "pg-tok-type",
  },
  {
    tag: [tags.meta, tags.annotation, tags.processingInstruction, tags.special(tags.variableName)],
    class: "pg-tok-meta",
  },
  { tag: [tags.tagName, tags.heading], class: "pg-tok-tag" },
  { tag: [tags.attributeName, tags.propertyName], class: "pg-tok-attr" },
]);

const languages = new Map<EditorMode, Promise<Language | null>>();

/** The Lezer language for a mode, loaded once per page (`null` for plain text). */
function languageFor(mode: EditorMode): Promise<Language | null> {
  let pending = languages.get(mode);
  if (!pending) {
    pending = loadLanguage(mode).then(
      (ext) =>
        ext instanceof LanguageSupport ? ext.language : ext instanceof Language ? ext : null,
      () => {
        languages.delete(mode); // a failed chunk load (offline): try again next time
        return null;
      },
    );
    languages.set(mode, pending);
  }
  return pending;
}

/** Split code into lines of plain tokens (what shows before, or instead of, highlighting). */
export function plainLines(code: string): Token[][] {
  return code
    .replace(/\n$/, "")
    .split("\n")
    .map((text) => [{ text, className: "" }]);
}

/**
 * Highlight `code` as `mode`.
 *
 * @returns Its lines as tokens (the final newline dropped); plain lines if the
 *   language can't load or parse.
 */
export async function highlight(code: string, mode: EditorMode): Promise<Token[][]> {
  const language = await languageFor(mode);
  if (!language) return plainLines(code);
  const source = code.replace(/\n$/, "");
  try {
    const lines: Token[][] = [[]];
    highlightCode(
      source,
      language.parser.parse(source),
      highlighter,
      (text, className) => lines[lines.length - 1].push({ text, className }),
      () => lines.push([]),
    );
    return lines;
  } catch {
    return plainLines(code);
  }
}
