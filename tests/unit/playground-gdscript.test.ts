/** Unit tests for `lib/playground/gdscript-mode.ts`: the GDScript tokenizer. */
import { describe, expect, it } from "bun:test";
import { StringStream } from "@codemirror/language";
import { gdscriptMode, type GdState } from "@/lib/playground/gdscript-mode";

/** Tokenize lines, returning `[text, style]` pairs (whitespace dropped). */
function tokens(...lines: string[]): [string, string | null][] {
  const state: GdState = gdscriptMode.startState!(4);
  const out: [string, string | null][] = [];
  for (const line of lines) {
    const stream = new StringStream(line, 4, 4);
    while (!stream.eol()) {
      const style = gdscriptMode.token(stream, state);
      const text = stream.current();
      if (text.trim()) out.push([text, style]);
      stream.start = stream.pos;
    }
  }
  return out;
}

describe("gdscriptMode", () => {
  it("highlights declarations, annotations and node paths", () => {
    expect(tokens("@export var speed := 4.5")).toEqual([
      ["@export", "meta"],
      ["var", "keyword"],
      ["speed", "variableName"],
      [":=", "operator"],
      ["4.5", "number"],
    ]);
    expect(tokens("func _ready() -> void:")).toContainEqual(["_ready", "def"]);
    expect(tokens("$Player/Sprite.show()")[0]).toEqual(["$Player/Sprite", "variableName.special"]);
    expect(tokens("%Hud")[0]).toEqual(["%Hud", "variableName.special"]);
  });

  it("recognizes strings, StringNames, comments, built-ins and class names", () => {
    expect(tokens('print(&"jump", "hi") # say it')).toEqual([
      ["print", "builtin"],
      ["(", null],
      ['&"jump"', "string"],
      [",", null],
      ['"hi"', "string"],
      [")", null],
      ["# say it", "comment"],
    ]);
    expect(tokens("extends CharacterBody2D")[1]).toEqual(["CharacterBody2D", "typeName"]);
    expect(tokens("0x1F 0b101 1_000")).toEqual([
      ["0x1F", "number"],
      ["0b101", "number"],
      ["1_000", "number"],
    ]);
  });

  it("carries triple-quoted strings across lines", () => {
    const result = tokens('var doc = """first', 'second"""', "var x");
    expect(result).toContainEqual(['"""first', "string"]);
    expect(result).toContainEqual(['second"""', "string"]);
    expect(result.at(-2)).toEqual(["var", "keyword"]);
  });
});
