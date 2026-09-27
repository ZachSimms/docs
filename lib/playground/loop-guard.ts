/**
 * @file Infinite-loop protection for the live web preview.
 *
 * The preview runs the reader's code as they type (half a second after the
 * last keystroke), in a frame that most browsers run on the playground's own
 * thread: a half-typed `for (;;)` would freeze the whole tab, and again on
 * every reload, since the draft is saved. So every `while`, `do … while` and
 * three-part `for` gets a call to {@link LOOP_GUARD} in its condition. The
 * guard (`createLoopGuard`, installed by the preview shim in `web-preview.ts`)
 * throws once one task has been looping for a second without yielding.
 *
 * Tokens come from Sucrase's parser (already loaded to strip types), so
 * strings, comments, regexes and templates are never mistaken for code. If
 * anything doesn't parse, before or after, the code is left as it was.
 */

import { parse } from "sucrase/dist/esm/parser";
import { TokenType as tt } from "sucrase/dist/esm/parser/tokenizer/types";
import { LOOP_GUARD } from "./runtime/web-preview";

/** Token types that open or close a nesting level. */
const OPENERS = new Set<number>([tt.parenL, tt.braceL, tt.bracketL, tt.dollarBraceL]);
const CLOSERS = new Set<number>([tt.parenR, tt.braceR, tt.bracketR]);

/** A text insertion at a source offset. */
interface Insert {
  at: number;
  text: string;
}

/**
 * Add loop guards to one JavaScript module or script.
 *
 * `while (c)` becomes `while (guard() && (c))` and `for (a; c; b)` becomes
 * `for (a; guard() && (c); b)`; `for … of` / `for … in` walk finite
 * collections and are left alone. Line numbers are unchanged.
 *
 * @param code - Plain JavaScript (types already stripped).
 * @returns The guarded code, or `code` itself if it doesn't parse.
 */
export function addLoopGuards(code: string): string {
  let tokens;
  try {
    ({ tokens } = parse(code, false, false, false));
  } catch {
    return code; // the browser reports the syntax error
  }
  const call = `${LOOP_GUARD}()`;
  const inserts: Insert[] = [];

  /** Index of the token closing the parenthesis opened at `open`. */
  const closing = (open: number): number => {
    let depth = 0;
    for (let i = open; i < tokens.length; i++) {
      const type = tokens[i]!.type;
      if (OPENERS.has(type)) depth++;
      else if (CLOSERS.has(type) && --depth === 0) return i;
    }
    return -1;
  };

  /** Guard the condition held by tokens `from` (inclusive) to `to` (exclusive). */
  const guard = (from: number, to: number) => {
    if (from >= to) {
      // `for (;;)`: no condition to keep.
      inserts.push({ at: tokens[to]!.start, text: call });
      return;
    }
    inserts.push({ at: tokens[from]!.start, text: `${call} && (` });
    inserts.push({ at: tokens[to - 1]!.end, text: ")" });
  };

  tokens.forEach((token, i) => {
    const isWhile = token.type === tt._while;
    if (!isWhile && token.type !== tt._for) return;
    const previous = tokens[i - 1]?.type;
    if (previous === tt.dot || previous === tt.questionDot) return; // a property named `for`
    const open = tokens[i + 1];
    if (open?.type !== tt.parenL) return; // `for await`, or not a loop at all
    const close = closing(i + 1);
    if (close === -1) return;
    if (isWhile) {
      guard(i + 2, close);
      return;
    }
    // A three-part `for`: exactly two semicolons at the header's own depth.
    const semis: number[] = [];
    let depth = 0;
    for (let j = i + 2; j < close; j++) {
      const type = tokens[j]!.type;
      if (OPENERS.has(type)) depth++;
      else if (CLOSERS.has(type)) depth--;
      else if (type === tt.semi && depth === 0) semis.push(j);
    }
    if (semis.length === 2) guard(semis[0]! + 1, semis[1]!);
  });

  if (inserts.length === 0) return code;
  let out = code;
  for (const { at, text } of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, at) + text + out.slice(at);
  }
  try {
    parse(out, false, false, false);
  } catch {
    return code; // e.g. a method named `while`: better unguarded than broken
  }
  return out;
}
