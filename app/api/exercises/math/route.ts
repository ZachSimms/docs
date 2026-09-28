/**
 * @file `POST /api/exercises/math/`: generate a math problem.
 *
 * Body: {@link mathGenerateRequest} (free-text request, area, difficulty). Answers with a
 * {@link MathProblem}, or an `ApiError`.
 */
import { MATH_SYSTEM, mathPrompt } from "@/lib/exercises/prompts";
import { errorResponse, generate } from "@/lib/exercises/ai";
import { readRequest } from "@/lib/exercises/guard";
import { normalizeMathProblem } from "@/lib/exercises/normalize";
import { mathGenerateRequest, mathProblemSpec, type MathProblem } from "@/lib/exercises/schema";

/** Generation with a slow free model (and one retry) can take a while. */
export const maxDuration = 240;

/** Generate a problem. */
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readRequest(request, mathGenerateRequest, "generate");
    const { output, model } = await generate({
      schema: mathProblemSpec,
      system: MATH_SYSTEM,
      prompt: mathPrompt(input),
      name: "problem",
      maxOutputTokens: 12_000,
    });
    const problem: MathProblem = {
      ...normalizeMathProblem(output),
      id: crypto.randomUUID(),
      area: input.area,
      difficulty: input.difficulty,
      request: input.request,
      model,
      createdAt: new Date().toISOString(),
    };
    return Response.json(problem);
  } catch (error) {
    return errorResponse(error);
  }
}
