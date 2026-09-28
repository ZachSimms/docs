/**
 * @file `POST /api/exercises/code/review/`: review the learner's code.
 *
 * Body: {@link codeReviewRequest} (the exercise, the code, and the test results from the
 * browser). Answers with a {@link CodeReview}, or an `ApiError`. The verdict is forced to
 * "revise" while any test fails, whatever the model says.
 */
import { REVIEW_SYSTEM, reviewPrompt } from "@/lib/exercises/prompts";
import { errorResponse, generate } from "@/lib/exercises/ai";
import { readRequest } from "@/lib/exercises/guard";
import { normalizeReview } from "@/lib/exercises/normalize";
import { codeReview, codeReviewRequest } from "@/lib/exercises/schema";

/** A review is shorter than a generation, but free models can be slow. */
export const maxDuration = 240;

/** Review a submission. */
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readRequest(request, codeReviewRequest, "check");
    const { output } = await generate({
      schema: codeReview,
      system: REVIEW_SYSTEM,
      prompt: reviewPrompt(input),
      name: "review",
      maxOutputTokens: 8000,
    });
    return Response.json(normalizeReview(output, input.tests));
  } catch (error) {
    return errorResponse(error);
  }
}
