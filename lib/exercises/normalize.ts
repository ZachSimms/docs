/**
 * @file Clean-ups applied to what the model returns before the browser sees it.
 *
 * Models often wrap code in Markdown fences even when asked for bare code, and
 * sometimes contradict themselves (a "pass" verdict next to failing tests, a numeric
 * answer with no values). These fixes are mechanical, so they live here rather than in
 * the prompts.
 */

import type { CodeExerciseSpec, CodeReview, MathProblemSpec } from "./schema";

/** Remove one surrounding Markdown code fence (```lang … ```), if the whole text is fenced. */
export function stripFence(code: string): string {
  const match = /^\s*(`{3,}|~{3,})[\w+#.-]*[^\n]*\n([\s\S]*?)\n\s*\1\s*$/.exec(code);
  return match ? match[2] : code;
}

/** Ensure text ends with exactly one newline (editors expect it). */
function endWithNewline(code: string): string {
  return `${code.replace(/\s+$/, "")}\n`;
}

/** Fix up a generated coding exercise. */
export function normalizeCodeExercise(spec: CodeExerciseSpec): CodeExerciseSpec {
  return {
    ...spec,
    starterCode: endWithNewline(stripFence(spec.starterCode)),
    solution: endWithNewline(stripFence(spec.solution)),
    tests: spec.tests.map((t) => ({ name: t.name.trim(), code: stripFence(t.code).trim() })),
  };
}

/** A review can't pass while a test fails, whatever the model said. */
export function normalizeReview(review: CodeReview, tests: readonly { ok: boolean }[]): CodeReview {
  const failing = tests.length === 0 || tests.some((t) => !t.ok);
  const unmet = review.requirements.some((r) => !r.met);
  return { ...review, verdict: failing || unmet ? "revise" : review.verdict };
}

/** A "numeric" answer with nothing to compare against is checked by the model instead. */
export function normalizeMathProblem(spec: MathProblemSpec): MathProblemSpec {
  const values = spec.answer.values.filter((v) => Number.isFinite(v));
  const kind =
    spec.answer.kind === "numeric" && values.length === 0 ? "expression" : spec.answer.kind;
  return {
    ...spec,
    answer: {
      ...spec.answer,
      kind,
      values: kind === "numeric" ? values : [],
      display: spec.answer.display.trim().replace(/^\$+|\$+$/g, ""),
    },
  };
}
