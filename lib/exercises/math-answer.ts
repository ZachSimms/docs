/**
 * @file Checking numeric math answers in the browser, without a model call.
 *
 * The learner's answer is split into values (`x = 2, x = -3`, `2 or -3`, `±√2`), and each
 * value is evaluated by a small recursive-descent parser: numbers, `+ - * / ^`, brackets,
 * implicit multiplication (`2π`, `3√2`, `2(1+x)` is not supported since there are no
 * variables), `%`, the constants π and e, a few functions, and simple LaTeX (`\frac{a}{b}`,
 * `\sqrt{x}`, `\pi`, `\cdot`). Nothing is ever `eval`'d. The values are compared, as an
 * unordered set, with the expected ones within the problem's tolerance.
 *
 * Anything it can't read is reported as `unreadable`, and the page falls back to the model.
 */

import type { MathAnswer } from "./schema";

/** The outcome of a local check. */
export type NumericCheck =
  | { readonly status: "correct" | "incorrect"; readonly values: readonly number[] }
  | { readonly status: "unreadable" };

/** Functions the parser knows. */
const FUNCTIONS: Readonly<Record<string, (x: number) => number>> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

/** Constants the parser knows. */
const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E };

type Token =
  { kind: "num"; value: number } | { kind: "id"; name: string } | { kind: "op"; op: string };

/** Rewrite simple LaTeX and Unicode math into the parser's plain syntax. */
export function plainMath(input: string): string {
  let s = input.trim().replace(/^\$+|\$+$/g, "");
  // \sqrt{x}, \frac{a}{b} and \dfrac, innermost first (\frac{\sqrt{3}}{2}), until stable.
  for (let i = 0; i < 20; i++) {
    const next = s
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
    if (next === s) break;
    s = next;
  }
  s = s
    .replace(/\\left|\\right/g, "")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\(ln|log|sin|cos|tan|exp)\b/g, "$1")
    .replace(/\\[,;!: ]/g, " ")
    .replace(/[{]/g, "(")
    .replace(/[}]/g, ")")
    .replace(/π/g, "pi")
    .replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");
  return s;
}

/** Split plain math into tokens, or `null` for a character the parser doesn't know. */
function tokenize(s: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    if (number) {
      // Two numbers in a row ("2 3", "1..2") are a typo, not a product.
      if (tokens.at(-1)?.kind === "num") return null;
      tokens.push({ kind: "num", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const name = /^[a-zA-Z]+/.exec(s.slice(i));
    if (name) {
      tokens.push({ kind: "id", name: name[0].toLowerCase() });
      i += name[0].length;
      continue;
    }
    if (s.startsWith("**", i)) {
      tokens.push({ kind: "op", op: "^" });
      i += 2;
      continue;
    }
    if ("+-*/^()%".includes(c)) {
      tokens.push({ kind: "op", op: c });
      i++;
      continue;
    }
    return null;
  }
  return tokens;
}

/** Evaluate plain math with no variables; `null` if it isn't a valid expression. */
export function evaluate(input: string): number | null {
  const tokens = tokenize(plainMath(input));
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (op: string) => {
    const t = peek();
    return t?.kind === "op" && t.op === op;
  };
  /** Whether the next token can start a factor (for implicit multiplication). */
  const startsFactor = () => {
    const t = peek();
    return (
      t !== undefined && (t.kind === "num" || t.kind === "id" || (t.kind === "op" && t.op === "("))
    );
  };

  const expression = (): number => {
    let value = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { op: string }).op;
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const term = (): number => {
    let value = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (tokens[pos++] as { op: string }).op;
        const right = unary();
        value = op === "*" ? value * right : value / right;
      } else if (startsFactor()) {
        value *= power();
      } else return value;
    }
  };
  const unary = (): number => {
    if (isOp("-")) {
      pos++;
      return -unary();
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  };
  const power = (): number => {
    const base = postfix();
    if (isOp("^")) {
      pos++;
      return base ** unary();
    }
    return base;
  };
  const postfix = (): number => {
    let value = primary();
    while (isOp("%")) {
      pos++;
      value /= 100;
    }
    return value;
  };
  const primary = (): number => {
    const t = tokens[pos++];
    if (!t) throw new Error("unexpected end");
    if (t.kind === "num") return t.value;
    if (t.kind === "op" && t.op === "(") {
      const value = expression();
      if (!isOp(")")) throw new Error("missing )");
      pos++;
      return value;
    }
    if (t.kind === "id") {
      if (t.name in CONSTANTS) return CONSTANTS[t.name];
      const fn = FUNCTIONS[t.name];
      // sin(x)^2 is (sin x)^2: a bracketed argument ends at its bracket; √2 takes a power.
      if (fn) return fn(isOp("(") ? primary() : power());
    }
    throw new Error("unexpected token");
  };

  try {
    const value = expression();
    return pos === tokens.length && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** `(1, 2)` or `[1, 2]` → `1, 2`: outer brackets around a list, but not `(1+2)*(3+4)`. */
function unwrapSet(s: string): string {
  const t = s.trim();
  if (!/^[([]/.test(t) || !/[)\]]$/.test(t)) return t;
  const inner = t.slice(1, -1);
  let depth = 0;
  for (const c of inner) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (depth < 0) return t; // the first bracket closes early: not one enclosing pair
  }
  return depth === 0 && /[,;]/.test(inner) ? inner : t;
}

/**
 * Read every value in an answer: `3/4`, `x = 2, x = -3`, `2 or -3`, `±√2`, `{1, 2}`.
 *
 * @param input - What the learner typed.
 * @param expectedCount - How many values are expected: with one, `1,000` reads as a thousand.
 * @returns The values, or `null` if any part can't be read.
 */
export function readValues(input: string, expectedCount = 1): number[] | null {
  let s = unwrapSet(plainMath(input)).replace(/\\pm|\+-|\+\/-/g, "±");
  if (expectedCount === 1 && /^\s*-?\d{1,3}(,\d{3})+(\.\d+)?\s*$/.test(s)) s = s.replace(/,/g, "");
  const parts = s
    .split(/,|;|\bor\b|\band\b/)
    .map((p) => p.replace(/^\s*[a-zA-Z](?:_?\d+)?\s*=\s*/, "").trim()) // x = 2, x_1 = 2
    .filter((p) => p !== "");
  if (parts.length === 0) return null;
  const values: number[] = [];
  for (const part of parts) {
    if (part.startsWith("±")) {
      const v = evaluate(part.slice(1));
      if (v === null) return null;
      values.push(v, -v);
      continue;
    }
    const v = evaluate(part);
    if (v === null) return null;
    values.push(v);
  }
  return values;
}

/**
 * Check a numeric answer locally.
 *
 * @param input - What the learner typed.
 * @param answer - The expected answer (only `kind: "numeric"` is checked here).
 */
export function checkNumeric(input: string, answer: MathAnswer): NumericCheck {
  if (answer.kind !== "numeric" || answer.values.length === 0) return { status: "unreadable" };
  const got = readValues(input, answer.values.length);
  if (!got) return { status: "unreadable" };
  if (got.length !== answer.values.length) return { status: "incorrect", values: got };
  const expected = [...answer.values].sort((a, b) => a - b);
  const actual = [...got].sort((a, b) => a - b);
  const ok = expected.every((want, i) => {
    const allowed = Math.max(answer.tolerance, 1e-9 * Math.max(1, Math.abs(want)));
    return Math.abs(actual[i] - want) <= allowed;
  });
  return { status: ok ? "correct" : "incorrect", values: got };
}
