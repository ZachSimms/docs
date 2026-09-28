/**
 * @file Server-only: calls to the model through the Vercel AI Gateway, and the mapping
 * from what can go wrong to what the learner is told.
 *
 * The AI SDK routes a plain `"creator/model"` id through the gateway, which authenticates
 * with `AI_GATEWAY_API_KEY`, or else with the Vercel project's OIDC token: on a deployment
 * that arrives with each request (the `x-vercel-oidc-token` header, read by `@vercel/oidc`),
 * locally it is `VERCEL_OIDC_TOKEN` from `vercel env pull`. The model is `EXERCISE_MODEL`, with
 * optional comma-separated `EXERCISE_FALLBACK_MODELS` that the gateway tries in order when
 * the first one fails or is rate limited.
 *
 * Output is schema-checked by the SDK (`Output.object`); output that doesn't parse is
 * retried once before giving up, since small free models occasionally emit broken JSON.
 */

import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { z } from "zod";
import type { ApiError } from "./schema";

/**
 * The default model: free on the gateway's free tier at the time of writing and trained
 * for code. Free-tier models come and go; set `EXERCISE_MODEL` to change it without a
 * code change (see the README).
 */
export const DEFAULT_MODEL = "poolside/laguna-s-2.1-free";

/** How long one generation may take before it is abandoned. */
export const GENERATION_TIMEOUT_MS = 100_000;

/** The configured model and fallbacks. */
export function modelConfig(env: Record<string, string | undefined> = process.env) {
  const model = env.EXERCISE_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = (env.EXERCISE_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m !== "" && m !== model);
  return { model, fallbacks };
}

/**
 * Whether the gateway may have credentials: an API key, a pulled OIDC token, or a Vercel
 * deployment (`VERCEL=1`), whose OIDC token comes with each request rather than from the
 * environment, so only the gateway itself can tell (a failure is then explained by
 * {@link classifyError}).
 */
export function gatewayConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim() || env.VERCEL === "1",
  );
}

/** Where this server runs, for error messages: `the Vercel "preview" environment`, `this server`. */
export function whereRunning(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL === "1"
    ? `the Vercel "${env.VERCEL_ENV ?? "unknown"}" environment`
    : "this server";
}

/** A failure with a message fit for the learner and a status code for the response. */
export class ExerciseError extends Error {
  constructor(
    readonly code: ApiError["code"],
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ExerciseError";
  }
}

/** The error, or the error it wraps (`RetryError.lastError`, `cause`), that says the most. */
function* errorChain(error: unknown): Generator<Record<string, unknown>> {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    yield record;
    if (Array.isArray(record.errors)) for (const inner of record.errors) yield* errorChain(inner);
    current = record.lastError ?? record.cause;
  }
}

/**
 * Turn anything thrown while calling the model into an {@link ExerciseError}.
 *
 * Classified by name and status code rather than `instanceof`, so it holds across the
 * duplicate copies of the SDK's error classes a bundle can contain.
 */
export function classifyError(error: unknown): ExerciseError {
  if (error instanceof ExerciseError) return error;
  for (const e of errorChain(error)) {
    const name = typeof e.name === "string" ? e.name : "";
    const status = typeof e.statusCode === "number" ? e.statusCode : undefined;
    if (name === "GatewayAuthenticationError" || status === 401) {
      const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
      return new ExerciseError(
        "config",
        hasKey
          ? `The AI Gateway rejected the AI_GATEWAY_API_KEY in ${whereRunning()}: check that it is a current AI Gateway key.`
          : `The AI Gateway has no credentials in ${whereRunning()}: AI_GATEWAY_API_KEY isn't set there and no OIDC token came with the request. See /api/exercises/status/ and the README.`,
        503,
      );
    }
    if (name === "GatewayModelNotFoundError" || name === "NoSuchModelError") {
      return new ExerciseError(
        "config",
        "The configured model isn't available on the AI Gateway. Set EXERCISE_MODEL to another model id.",
        503,
      );
    }
    if (name === "GatewayRateLimitError" || status === 429) {
      return new ExerciseError(
        "busy",
        "The free model is busy (rate limited). Wait a few seconds and try again.",
        429,
      );
    }
    if (name === "GatewayForbiddenError" || status === 402 || status === 403) {
      return new ExerciseError(
        "config",
        "The AI Gateway refused the request: the free credits may be used up, or the model isn't on your plan.",
        503,
      );
    }
    if (NoObjectGeneratedError.isInstance(e) || name === "AI_NoObjectGeneratedError") {
      return new ExerciseError(
        "model",
        "The model's answer didn't come out in the expected shape. Try again (or pick a stronger model).",
        502,
      );
    }
    if (name === "TimeoutError" || name === "AbortError") {
      return new ExerciseError("upstream", "The model took too long to answer. Try again.", 504);
    }
  }
  return new ExerciseError("upstream", "The AI service failed. Try again in a moment.", 502);
}

/** What {@link generate} returns: the validated object and the model that wrote it. */
export interface Generated<T> {
  readonly output: T;
  readonly model: string;
}

/**
 * Ask the model for one object matching `schema`.
 *
 * @param options.schema - What the output must parse as.
 * @param options.system - The system prompt.
 * @param options.prompt - The request.
 * @param options.maxOutputTokens - Cap on the answer (reasoning models count their thinking too).
 * @throws {ExerciseError} When the gateway isn't configured or the call fails.
 */
export async function generate<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  name: string;
}): Promise<Generated<T>> {
  if (!gatewayConfigured()) {
    throw new ExerciseError(
      "config",
      `The exercise generator isn't set up: AI_GATEWAY_API_KEY isn't set in ${whereRunning()}. Add it to .env.local (or run \`vercel env pull\`) and restart. See the README.`,
      503,
    );
  }
  const { model, fallbacks } = modelConfig();
  const attempt = async () => {
    const result = await generateText({
      model,
      system: options.system,
      prompt: options.prompt,
      output: Output.object({ schema: options.schema, name: options.name }),
      maxOutputTokens: options.maxOutputTokens ?? 16_000,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
      providerOptions: fallbacks.length > 0 ? { gateway: { models: fallbacks } } : undefined,
    });
    return { output: result.output as T, model: result.response?.modelId || model };
  };
  try {
    return await attempt();
  } catch (error) {
    // Broken JSON from a small model is usually a one-off: one more try.
    if (classifyError(error).code !== "model") throw classifyError(error);
    try {
      return await attempt();
    } catch (again) {
      throw classifyError(again);
    }
  }
}

/** The JSON error response for a failure. */
export function errorResponse(error: unknown): Response {
  const failure = classifyError(error);
  if (failure.code === "upstream") console.error("[exercises]", error);
  const body: ApiError = { error: failure.message, code: failure.code };
  return Response.json(body, { status: failure.status });
}
