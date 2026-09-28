/**
 * @file `POST /api/exercises/math/check/`: have the model check an answer and the working.
 *
 * Numeric answers are checked in the browser first (`lib/exercises/math-answer.ts`); this
 * handles everything else (expressions, text) and gives feedback on the working. Body:
 * {@link mathCheckRequest}. Answers with a {@link MathVerdict}, or an `ApiError`.
 */
import { MATH_CHECK_SYSTEM, mathCheckPrompt } from "@/lib/exercises/prompts";
import { errorResponse, generate } from "@/lib/exercises/ai";
import { readRequest } from "@/lib/exercises/guard";
import { mathCheckRequest, mathVerdict } from "@/lib/exercises/schema";

/** A check is short, but free models can be slow. */
export const maxDuration = 240;

/** Check an answer. */
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readRequest(request, mathCheckRequest, "check");
    const { output } = await generate({
      schema: mathVerdict,
      system: MATH_CHECK_SYSTEM,
      prompt: mathCheckPrompt(input),
      name: "verdict",
      maxOutputTokens: 6000,
    });
    return Response.json(output);
  } catch (error) {
    return errorResponse(error);
  }
}
