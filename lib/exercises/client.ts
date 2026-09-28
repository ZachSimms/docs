/**
 * @file Browser side of the exercise API: typed calls that validate every response.
 *
 * Each call posts JSON to `/api/exercises/…` and parses the answer with the same Zod
 * schema the server used, so the UI only ever sees well-formed data. Failures become an
 * {@link ApiFailure} carrying the server's message (already written for the learner).
 */

import type { z } from "zod";
import {
  codeExercise,
  codeReview,
  mathProblem,
  mathVerdict,
  type ApiError,
  type CodeExercise,
  type CodeGenerateRequest,
  type CodeReview,
  type MathGenerateRequest,
  type MathProblem,
  type MathVerdict,
} from "./schema";

/** A failed call, with a message for the learner. */
export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly code: ApiError["code"] | "network",
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

/** POST `body` to `path` and parse the JSON answer with `schema`. */
async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiFailure(
      "Couldn't reach the server. Check your connection and try again.",
      "network",
    );
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiFailure(
      `The server answered ${response.status} without a readable body.`,
      "upstream",
    );
  }
  if (!response.ok) {
    const error = json as Partial<ApiError>;
    throw new ApiFailure(
      typeof error.error === "string" ? error.error : `The server answered ${response.status}.`,
      error.code ?? "upstream",
    );
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    throw new ApiFailure("The server's answer was malformed. Try again.", "model");
  return parsed.data;
}

/** Generate a coding exercise. */
export function generateCodeExercise(
  request: CodeGenerateRequest,
  signal?: AbortSignal,
): Promise<CodeExercise> {
  return post("/api/exercises/code/", request, codeExercise, signal);
}

/** Fix an exercise whose reference solution fails its own tests. */
export function repairCodeExercise(
  exercise: CodeExercise,
  failures: string,
  signal?: AbortSignal,
): Promise<CodeExercise> {
  return post("/api/exercises/code/repair/", { exercise, failures }, codeExercise, signal);
}

/** Review the learner's code. */
export function reviewCode(
  exercise: CodeExercise,
  code: string,
  tests: readonly { name: string; ok: boolean; message?: string }[],
  signal?: AbortSignal,
): Promise<CodeReview> {
  const { title, brief, requirements, language, difficulty } = exercise;
  return post(
    "/api/exercises/code/review/",
    {
      exercise: { title, brief, requirements, language, difficulty },
      code,
      tests: tests.map((t) => ({ ...t, message: t.message?.slice(0, 1000) })),
    },
    codeReview,
    signal,
  );
}

/** Generate a math problem. */
export function generateMathProblem(
  request: MathGenerateRequest,
  signal?: AbortSignal,
): Promise<MathProblem> {
  return post("/api/exercises/math/", request, mathProblem, signal);
}

/** Have the model check a math answer (and the working). */
export function checkMathAnswer(
  problem: MathProblem,
  answer: string,
  working: string,
  signal?: AbortSignal,
): Promise<MathVerdict> {
  const { statement, answerFormat, answer: expected, solution } = problem;
  return post(
    "/api/exercises/math/check/",
    { problem: { statement, answerFormat, answer: expected, solution }, answer, working },
    mathVerdict,
    signal,
  );
}
