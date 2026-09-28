/**
 * @file Shapes of everything the exercise generators send and receive.
 *
 * The same Zod schemas validate what the model generates (the API rejects output that
 * doesn't parse), what the browser posts to the API, and what the browser reads back
 * from `localStorage`. Strings are capped so a runaway model or a forged request can't
 * push megabytes through.
 */

import { z } from "zod";
import {
  CODE_LANGUAGE_IDS,
  CODE_THEME_IDS,
  DIFFICULTY_IDS,
  MATH_AREA_IDS,
  SIZE_IDS,
} from "./options";

/** A string of at most `max` characters, with a description for the model. */
const text = (max: number, description: string) => z.string().max(max).describe(description);

/** One hidden test: a snippet in the exercise's language that throws when the code is wrong. */
export const testCase = z.object({
  name: text(120, "What the test checks, in a few words, e.g. 'pop on an empty stack raises'"),
  code: text(
    4000,
    "The test body. It runs with every top-level name of the learner's solution in scope. Fail with the assertion helpers from the instructions; never print.",
  ),
});

/** A test as generated. */
export type TestCase = z.infer<typeof testCase>;

/** A coding exercise as the model writes it. */
export const codeExerciseSpec = z.object({
  title: text(80, "Short title, e.g. 'Undo stack for a text editor'"),
  summary: text(200, "One sentence: what the learner builds and practices"),
  brief: text(
    6000,
    "The task in Markdown: context, what to implement (exact names and signatures), rules, and one or two worked examples. Do not reveal the solution.",
  ),
  requirements: z
    .array(text(300, "One checkable requirement"))
    .min(1)
    .max(10)
    .describe("Checklist of what a correct solution must do, including any required construct"),
  starterCode: text(
    6000,
    "Code the learner starts from: the required names and signatures with bodies left to fill in (pass / throw 'not implemented'), plus comments",
  ),
  tests: z.array(testCase).min(3).max(15),
  hints: z
    .array(text(500, "A hint"))
    .min(1)
    .max(4)
    .describe("Progressive hints, gentle first, never the full answer"),
  solution: text(8000, "A complete, idiomatic reference solution that passes every test"),
  concepts: z.array(text(40, "A concept")).max(6).describe("Concepts practiced, e.g. 'classes'"),
});

/** A coding exercise as the model writes it. */
export type CodeExerciseSpec = z.infer<typeof codeExerciseSpec>;

/** What the learner asked for. */
export const codeGenerateRequest = z.object({
  request: z.string().trim().max(500).default(""),
  theme: z.enum(CODE_THEME_IDS).default("any"),
  difficulty: z.enum(DIFFICULTY_IDS).default("beginner"),
  language: z.enum(CODE_LANGUAGE_IDS).default("python"),
  size: z.enum(SIZE_IDS).default("exercise"),
  /** Titles of recent exercises, so the next one is different. */
  avoid: z.array(z.string().max(80)).max(10).default([]),
});

/** What the learner asked for. */
export type CodeGenerateRequest = z.infer<typeof codeGenerateRequest>;

/** A generated exercise with the request that produced it, as the browser keeps it. */
export const codeExercise = codeExerciseSpec.extend({
  id: z.string().max(64),
  language: z.enum(CODE_LANGUAGE_IDS),
  difficulty: z.enum(DIFFICULTY_IDS),
  theme: z.enum(CODE_THEME_IDS),
  size: z.enum(SIZE_IDS),
  request: z.string().max(500),
  model: z.string().max(120),
  createdAt: z.string().max(40),
});

/** A generated exercise with the request that produced it. */
export type CodeExercise = z.infer<typeof codeExercise>;

/** Ask the model to fix an exercise whose reference solution fails its own tests. */
export const codeRepairRequest = z.object({
  exercise: codeExercise,
  failures: z.string().max(6000),
});

/** One test's outcome, as sent for review. */
export const testOutcome = z.object({
  name: z.string().max(120),
  ok: z.boolean(),
  message: z.string().max(1000).optional(),
});

/** Ask the model to review the learner's code. */
export const codeReviewRequest = z.object({
  exercise: codeExercise.pick({
    title: true,
    brief: true,
    requirements: true,
    language: true,
    difficulty: true,
  }),
  code: z.string().max(20_000),
  tests: z.array(testOutcome).max(20),
});

/** The model's review of a submission. */
export const codeReview = z.object({
  verdict: z
    .enum(["pass", "revise"])
    .describe("pass only if every requirement is met and every test passed"),
  summary: text(300, "One or two sentences for the learner"),
  requirements: z
    .array(
      z.object({
        requirement: text(300, "The requirement, as listed"),
        met: z.boolean(),
        note: text(400, "Why, pointing at the code; empty if obvious"),
      }),
    )
    .max(10),
  feedback: text(
    4000,
    "Markdown: what is good, what to fix (with line references), and one idea to go further. Never paste a full solution.",
  ),
});

/** The model's review of a submission. */
export type CodeReview = z.infer<typeof codeReview>;

/** How a math answer is checked. */
export const mathAnswer = z.object({
  kind: z
    .enum(["numeric", "expression", "text"])
    .describe(
      "numeric: one or more real numbers (checked exactly, e.g. 3/4 or x = 2, x = -3); expression: an algebraic expression, interval or matrix; text: a short phrase or proof sketch",
    ),
  display: text(
    300,
    "The answer as LaTeX (no $ delimiters), e.g. '\\frac{3}{4}' or 'x = 2,\\ x = -3'",
  ),
  values: z
    .array(z.number())
    .max(10)
    .describe("For numeric: every expected value as a decimal (unordered); empty otherwise"),
  tolerance: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "For numeric: absolute tolerance, e.g. 0.005 when the question asks for 2 decimal places; 0 when exact",
    ),
});

/** How a math answer is checked. */
export type MathAnswer = z.infer<typeof mathAnswer>;

/** A math problem as the model writes it. */
export const mathProblemSpec = z.object({
  title: text(80, "Short title"),
  statement: text(
    3000,
    "The problem in Markdown with LaTeX math between $...$ (inline) or $$...$$ (display)",
  ),
  answerFormat: text(
    200,
    "How to enter the answer, e.g. 'a fraction in lowest terms' or 'both solutions, comma-separated'",
  ),
  answer: mathAnswer,
  hints: z.array(text(500, "A hint, Markdown + LaTeX")).min(1).max(4),
  solution: text(5000, "Worked solution, step by step, Markdown + LaTeX"),
  concepts: z.array(text(40, "A concept")).max(6),
});

/** A math problem as the model writes it. */
export type MathProblemSpec = z.infer<typeof mathProblemSpec>;

/** What the learner asked for. */
export const mathGenerateRequest = z.object({
  request: z.string().trim().max(500).default(""),
  area: z.enum(MATH_AREA_IDS).default("any"),
  difficulty: z.enum(DIFFICULTY_IDS).default("beginner"),
  avoid: z.array(z.string().max(80)).max(10).default([]),
});

/** What the learner asked for. */
export type MathGenerateRequest = z.infer<typeof mathGenerateRequest>;

/** A generated problem with the request that produced it, as the browser keeps it. */
export const mathProblem = mathProblemSpec.extend({
  id: z.string().max(64),
  area: z.enum(MATH_AREA_IDS),
  difficulty: z.enum(DIFFICULTY_IDS),
  request: z.string().max(500),
  model: z.string().max(120),
  createdAt: z.string().max(40),
});

/** A generated problem with the request that produced it. */
export type MathProblem = z.infer<typeof mathProblem>;

/** Ask the model to check an answer (and the working, if any). */
export const mathCheckRequest = z.object({
  problem: mathProblem.pick({
    statement: true,
    answerFormat: true,
    answer: true,
    solution: true,
  }),
  answer: z.string().trim().max(500),
  working: z.string().max(4000).default(""),
});

/** The model's verdict on an answer. */
export const mathVerdict = z.object({
  correct: z
    .boolean()
    .describe("Whether the final answer is mathematically equivalent to the expected one"),
  feedback: text(
    3000,
    "Markdown + LaTeX for the learner: if wrong, where the reasoning went wrong (the first mistaken step if working was given) without giving the answer away; if right, a short confirmation and any sloppiness in the working",
  ),
});

/** The model's verdict on an answer. */
export type MathVerdict = z.infer<typeof mathVerdict>;

/** The error body every exercise API returns. */
export interface ApiError {
  readonly error: string;
  /** `config`: the gateway isn't set up; `busy`: rate limited; `model`: bad output; `input`: bad request. */
  readonly code: "config" | "busy" | "model" | "input" | "upstream";
}
