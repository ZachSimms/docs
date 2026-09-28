/**
 * @file `POST /api/exercises/code/repair/`: fix an exercise whose reference solution
 * fails its own tests.
 *
 * Body: {@link codeRepairRequest} (the exercise and the failures the browser saw). Answers
 * with the corrected {@link CodeExercise} (same id and request), or an `ApiError`.
 */
import { codeSystemPrompt, repairPrompt } from "@/lib/exercises/prompts";
import { errorResponse, generate } from "@/lib/exercises/ai";
import { readRequest } from "@/lib/exercises/guard";
import { normalizeCodeExercise } from "@/lib/exercises/normalize";
import { codeExerciseSpec, codeRepairRequest, type CodeExercise } from "@/lib/exercises/schema";

/** Generation with a slow free model (and one retry) can take a while. */
export const maxDuration = 240;

/** Repair an exercise. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { exercise, failures } = await readRequest(request, codeRepairRequest, "generate");
    const { output, model } = await generate({
      schema: codeExerciseSpec,
      system: codeSystemPrompt(exercise.language),
      prompt: repairPrompt(exercise, failures),
      name: "exercise",
      signal: request.signal,
    });
    const repaired: CodeExercise = { ...exercise, ...normalizeCodeExercise(output), model };
    return Response.json(repaired);
  } catch (error) {
    return errorResponse(error);
  }
}
