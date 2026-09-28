/**
 * @file `POST /api/exercises/code/`: generate a coding exercise.
 *
 * Body: {@link codeGenerateRequest} (free-text request, theme, difficulty, language,
 * size). Answers with a {@link CodeExercise}, or an `ApiError`. The browser then checks the
 * exercise by running its reference solution against its tests before showing it.
 */
import { codePrompt, codeSystemPrompt } from "@/lib/exercises/prompts";
import { errorResponse, generate } from "@/lib/exercises/ai";
import { readRequest } from "@/lib/exercises/guard";
import { normalizeCodeExercise } from "@/lib/exercises/normalize";
import { codeExerciseSpec, codeGenerateRequest, type CodeExercise } from "@/lib/exercises/schema";

/** Generation with a slow free model (and one retry) can take a while. */
export const maxDuration = 240;

/** Generate an exercise. */
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readRequest(request, codeGenerateRequest, "generate");
    const { output, model } = await generate({
      schema: codeExerciseSpec,
      system: codeSystemPrompt(input.language),
      prompt: codePrompt(input),
      name: "exercise",
    });
    const exercise: CodeExercise = {
      ...normalizeCodeExercise(output),
      id: crypto.randomUUID(),
      language: input.language,
      difficulty: input.difficulty,
      theme: input.theme,
      size: input.size,
      request: input.request,
      model,
      createdAt: new Date().toISOString(),
    };
    return Response.json(exercise);
  } catch (error) {
    return errorResponse(error);
  }
}
