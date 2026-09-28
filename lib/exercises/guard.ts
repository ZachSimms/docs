/**
 * @file Server-only: the checks every exercise API request passes before it costs a model
 * call: same-origin, a body size cap, schema validation and a per-client rate limit.
 *
 * The rate limit is an in-memory sliding window, so it is per server instance (a
 * serverless deployment may run several): it stops a runaway loop or a casual script,
 * not a determined attacker. The gateway's own spend limits are the real ceiling; set
 * a budget in the Vercel dashboard (see the README).
 */

import type { z } from "zod";
import { ExerciseError } from "./ai";

/** Largest request body accepted, in bytes (a review carries the learner's code). */
export const MAX_BODY_BYTES = 64 * 1024;

/** Requests per client per window, by bucket. */
export const RATE_LIMITS = {
  generate: { max: 20, windowMs: 10 * 60_000 },
  check: { max: 60, windowMs: 10 * 60_000 },
} as const;

/** Rate-limit bucket names. */
export type Bucket = keyof typeof RATE_LIMITS;

/** Request times per `bucket:client`. */
const hits = new Map<string, number[]>();

/**
 * Record a request and say whether it is within the limit.
 *
 * @param bucket - Which limit applies.
 * @param client - Who is asking (an IP address).
 * @param now - The current time, for tests.
 * @returns `true` if the request may proceed.
 */
export function allow(bucket: Bucket, client: string, now = Date.now()): boolean {
  const { max, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${client}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived server.
  if (hits.size > 10_000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}

/** Forget every recorded request (tests). */
export function resetRateLimits(): void {
  hits.clear();
}

/** The client's address: the first `x-forwarded-for` hop (set by Vercel), else `x-real-ip`. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Validate a POST request and parse its JSON body with `schema`.
 *
 * @throws {ExerciseError} For a cross-site request, a body that is too large or doesn't
 *   parse, or a client over its rate limit.
 */
export async function readRequest<T extends z.ZodType>(
  request: Request,
  schema: T,
  bucket: Bucket,
): Promise<z.infer<T>> {
  const origin = request.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      sameHost =
        new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
    } catch {
      sameHost = false;
    }
    if (!sameHost) throw new ExerciseError("input", "Cross-site requests aren't allowed.", 403);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new ExerciseError("input", "The request is too large.", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    throw new ExerciseError("input", "The request is too large.", 413);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ExerciseError("input", "The request isn't valid JSON.", 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "request";
    throw new ExerciseError("input", `Invalid ${where}: ${issue?.message ?? "bad value"}`, 400);
  }
  if (!allow(bucket, clientAddress(request))) {
    throw new ExerciseError(
      "busy",
      "That's a lot of requests: wait a few minutes before asking for more.",
      429,
    );
  }
  return parsed.data;
}
