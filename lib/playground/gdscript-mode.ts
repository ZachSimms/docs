/**
 * @file A small CodeMirror stream tokenizer for GDScript (Godot 4).
 *
 * Highlights keywords, built-in types and constants, annotations (`@export`),
 * strings (including `&"StringName"` and `^"NodePath"`), numbers, `#`
 * comments, node paths (`$Player`, `%UniqueName`) and function names after
 * `func`. No parse tree, so folding and smart indentation are basic; that is
 * enough for a practice editor, and it has no dependencies to go stale.
 */

import type { StreamParser, StringStream } from "@codemirror/language";

const KEYWORDS = new Set(
  (
    "if elif else for while match when break continue pass return class class_name extends is in as self " +
    "signal func static const enum var breakpoint preload await yield assert void super not and or " +
    "true false null tool onready export setget"
  ).split(" "),
);

const BUILTINS = new Set(
  (
    "int float bool String StringName NodePath Vector2 Vector2i Vector3 Vector3i Vector4 Color Rect2 " +
    "Transform2D Transform3D Basis Quaternion AABB Plane Array Dictionary Callable Signal Object Node " +
    "Node2D Node3D Resource RefCounted PackedScene PI TAU INF NAN print printerr push_error push_warning " +
    "range len str load"
  ).split(" "),
);

/** Tokenizer state: whether the next name is a function being declared, and an open triple-quoted string. */
export interface GdState {
  afterFunc: boolean;
  tripleQuote: '"""' | "'''" | null;
}

/** Consume the rest of a (possibly multi-line) triple-quoted string. */
function readTriple(stream: StringStream, state: GdState): string {
  const quote = state.tripleQuote ?? '"""';
  while (!stream.eol()) {
    if (stream.match(quote)) {
      state.tripleQuote = null;
      return "string";
    }
    stream.next();
  }
  return "string";
}

/** The GDScript stream parser for `StreamLanguage.define`. */
export const gdscriptMode: StreamParser<GdState> = {
  name: "gdscript",
  startState: () => ({ afterFunc: false, tripleQuote: null }),
  token(stream, state) {
    if (state.tripleQuote) return readTriple(stream, state);
    if (stream.eatSpace()) return null;
    if (stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match('"""') || stream.match("'''")) {
      state.tripleQuote = stream.current().slice(-3) as '"""' | "'''";
      return readTriple(stream, state);
    }
    if (stream.match(/^[&^]?"(?:[^"\\]|\\.)*"?/) || stream.match(/^[&^]?'(?:[^'\\]|\\.)*'?/))
      return "string";
    if (stream.match(/^@[A-Za-z_]\w*/)) return "meta";
    if (stream.match(/^[$%](?:"[^"]*"|[A-Za-z_][\w/]*)/)) return "variableName.special";
    if (stream.match(/^(?:0x[\da-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+)/))
      return "number";
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const word = stream.current();
      if (state.afterFunc) {
        state.afterFunc = false;
        return "def";
      }
      if (word === "func") {
        state.afterFunc = true;
        return "keyword";
      }
      if (KEYWORDS.has(word)) return "keyword";
      if (BUILTINS.has(word)) return "builtin";
      return /^[A-Z]/.test(word) ? "typeName" : "variableName";
    }
    if (stream.match(/^(?:->|:=|==|!=|<=|>=|\*\*|[-+*/%=<>!&|^~])/)) return "operator";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "#" }, indentOnInput: /^\s*(?:elif|else)\b/ },
};
