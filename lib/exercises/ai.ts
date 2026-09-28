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
 * How JSON is asked for depends on the models (the gateway's model list says, see
 * {@link modelInfo}). Models with schema-constrained output (`response_format`) get it through
 * `Output.object`. The others (the free ones, at the time of writing) would reject that request,
 * so they get the JSON Schema in the system prompt, and the reply is parsed and validated here,
 * with one follow-up turn that quotes the validation errors. Either way, output that doesn't
 * parse is retried once before giving up, since small models occasionally emit broken JSON.
 */

import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import type { ApiError } from "./schema";

/**
 * The default model: free on the gateway's free tier at the time of writing and trained
 * for code. Free-tier models come and go; set `EXERCISE_MODEL` to change it without a
 * code change (see the README).
 */
export const DEFAULT_MODEL = "poolside/laguna-s-2.1-free";

/** How long one generation may take before it is abandoned. */
export const GENERATION_TIMEOUT_MS = 100_000;

/** The gateway's public model metadata (no authentication needed). */
export const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

/** What the gateway says about a model: whether it exists, and if it takes a JSON schema. */
export interface ModelInfo {
  /** `null` when the gateway couldn't be asked. */
  readonly exists: boolean | null;
  /** Supports schema-constrained output (`response_format`). */
  readonly structured: boolean;
}

/** Answers per model id for this server instance (failed lookups aren't kept). */
const infoCache = new Map<string, Promise<ModelInfo>>();

/** Forget cached model metadata (tests). */
export function resetModelInfo(): void {
  infoCache.clear();
}

/**
 * Look a model up in the gateway's catalog.
 *
 * @param model - A `creator/model` id.
 * @returns What the gateway says; when it can't be asked, `{ exists: null, structured: false }`,
 *   which selects the JSON-in-the-prompt path that works with every model.
 */
export function modelInfo(model: string): Promise<ModelInfo> {
  const cached = infoCache.get(model);
  if (cached) return cached;
  const lookup = (async (): Promise<ModelInfo> => {
    try {
      const path = model.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`${GATEWAY_MODELS_URL}/${path}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (response.status === 404) return { exists: false, structured: false };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { supported_parameters?: unknown };
      const params = Array.isArray(body.supported_parameters) ? body.supported_parameters : [];
      return { exists: true, structured: params.includes("response_format") };
    } catch {
      infoCache.delete(model);
      return { exists: null, structured: false };
    }
  })();
  infoCache.set(model, lookup);
  return lookup;
}

/**
 * Pull the JSON object out of a model's text reply: without `<think>` blocks, Markdown fences
 * or any words around it.
 *
 * @returns The parsed value, or `undefined` if there is no JSON object to parse.
 */
export function extractJson(text: string): unknown {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end < start) return undefined;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/** Zod issues as short lines for the model: `tests.2.code: Too big: expected …`. */
function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/** ANSI color codes (the gateway's errors carry some). */
const ANSI = /\u001b\[[0-9;]*m/g;

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
    if (name === "GatewayInvalidRequestError" || status === 400) {
      return new ExerciseError(
        "config",
        `The AI Gateway refused the request for ${modelConfig().model}${detailOf(error)}. Try another model (EXERCISE_MODEL).`,
        502,
      );
    }
  }
  return new ExerciseError(
    "upstream",
    `The AI service failed${detailOf(error)}. Try again in a moment.`,
    502,
  );
}

/**
 * What the innermost error with something to say reports, for the learner and the site owner:
 * `: 500 upstream timeout`. No secrets travel in the gateway's errors.
 */
function detailOf(error: unknown): string {
  let status: number | undefined;
  let message = "";
  for (const e of errorChain(error)) {
    if (typeof e.statusCode === "number") status = e.statusCode;
    if (typeof e.message === "string" && e.message.trim()) message = e.message;
  }
  const text = message.replace(ANSI, "").replace(/\s+/g, " ").trim().slice(0, 240);
  const detail = [status, text].filter(Boolean).join(" ");
  return detail ? ` (${detail})` : "";
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
  const { model, fallbacks: configured } = modelConfig();
  const [info, ...fallbackInfo] = await Promise.all([model, ...configured].map(modelInfo));
  if (info.exists === false) {
    throw new ExerciseError(
      "config",
      `The model "${model}" isn't on the AI Gateway (free models come and go). Set EXERCISE_MODEL to another model id; see the README.`,
      503,
    );
  }
  const fallbacks = configured.filter((_, i) => fallbackInfo[i].exists !== false);
  // Constrained decoding only if every model the gateway may pick supports it.
  const structured =
    info.structured && fallbackInfo.every((f) => f.exists === false || f.structured);
  const common = {
    model,
    maxOutputTokens: options.maxOutputTokens ?? 16_000,
    maxRetries: 1,
    providerOptions: fallbacks.length > 0 ? { gateway: { models: fallbacks } } : undefined,
  };

  /** Schema-constrained output, for models that support it. */
  const constrained = async () => {
    const result = await generateText({
      ...common,
      system: options.system,
      prompt: options.prompt,
      output: Output.object({ schema: options.schema, name: options.name }),
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });
    return { output: result.output as T, model: result.response?.modelId || model };
  };

  /** The schema in the prompt, the reply validated here, one corrective turn if needed. */
  const prompted = async () => {
    const system = `${options.system}

Output format: reply with one JSON object and nothing else (no Markdown fence, no commentary). It must validate against this JSON Schema:
${JSON.stringify(z.toJSONSchema(options.schema))}`;
    const first = await generateText({
      ...common,
      system,
      prompt: options.prompt,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });
    const parsed = options.schema.safeParse(extractJson(first.text));
    if (parsed.success) return { output: parsed.data, model: first.response?.modelId || model };
    const again = await generateText({
      ...common,
      system,
      messages: [
        { role: "user", content: options.prompt },
        { role: "assistant", content: first.text.slice(0, 30_000) },
        {
          role: "user",
          content: `That reply doesn't validate against the schema:\n${describeIssues(parsed.error)}\nReply again with only the corrected, complete JSON object.`,
        },
      ],
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });
    const retried = options.schema.safeParse(extractJson(again.text));
    if (retried.success) return { output: retried.data, model: again.response?.modelId || model };
    throw new ExerciseError(
      "model",
      "The model's answer didn't come out in the expected shape. Try again (or pick a stronger model).",
      502,
    );
  };

  if (!structured) {
    try {
      return await prompted();
    } catch (error) {
      throw classifyError(error);
    }
  }
  try {
    return await constrained();
  } catch (error) {
    // Broken JSON from a small model is usually a one-off: one more try.
    if (classifyError(error).code !== "model") throw classifyError(error);
    try {
      return await constrained();
    } catch (again) {
      throw classifyError(again);
    }
  }
}

/** The JSON error response for a failure. */
export function errorResponse(error: unknown): Response {
  const failure = classifyError(error);
  if (failure.code !== "input" && failure.code !== "busy") console.error("[exercises]", error);
  const body: ApiError = { error: failure.message, code: failure.code };
  return Response.json(body, { status: failure.status });
}
