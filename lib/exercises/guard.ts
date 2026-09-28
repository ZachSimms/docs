/**
 * @file Server-only: the checks every exercise API request passes before it costs a model
 * call: the feature switch, same-origin browser provenance, a body size cap, schema
 * validation and rate limits.
 *
 * The rate limits are in memory, so per server instance (a serverless deployment may run
 * several). Three windows apply to each bucket: a short burst window and a daily cap per
 * client, and an hourly cap across all clients, which bounds what one instance can spend
 * however many addresses a script rotates through. They stop a runaway loop, a casual
 * script or a small botnet, not a determined attacker with many instances' worth of
 * traffic: the AI Gateway project budget is the hard ceiling; set one (see the README).
 */

import type { z } from "zod";
import { ExerciseError } from "./ai";

/** Largest request body accepted, in bytes (a review carries the learner's code). */
export const MAX_BODY_BYTES = 64 * 1024;

/** A limit: at most `max` requests per `windowMs`. */
export interface Limit {
  readonly max: number;
  readonly windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Requests per client per window, by bucket: a burst window and a daily cap. */
export const RATE_LIMITS = {
  generate: { max: 20, windowMs: 10 * MINUTE },
  check: { max: 60, windowMs: 10 * MINUTE },
} as const satisfies Record<string, Limit>;

/** Requests per client per day, by bucket. */
export const DAILY_LIMITS = {
  generate: { max: 60, windowMs: DAY },
  check: { max: 300, windowMs: DAY },
} as const satisfies Record<Bucket, Limit>;

/** Requests from all clients together per server instance, by bucket. */
export const GLOBAL_LIMITS = {
  generate: { max: 300, windowMs: HOUR },
  check: { max: 900, windowMs: HOUR },
} as const satisfies Record<Bucket, Limit>;

/** Rate-limit bucket names. */
export type Bucket = keyof typeof RATE_LIMITS;

/** A fixed window's start and how many requests it has counted. */
interface Count {
  start: number;
  count: number;
}

/** Counts per `window:bucket:client`. */
const counts = new Map<string, Count>();

/** The count for `key` in the window that holds `now` (a fresh one once the old has passed). */
function current(key: string, limit: Limit, now: number): Count {
  const found = counts.get(key);
  return found && now - found.start < limit.windowMs ? found : { start: now, count: 0 };
}

/**
 * Record a request and say whether it is within every limit. A refused request isn't
 * counted, so a client that keeps knocking isn't locked out for longer.
 *
 * @param bucket - Which limits apply.
 * @param client - Who is asking (see {@link clientKey}).
 * @param now - The current time, for tests.
 * @returns `true` if the request may proceed.
 */
export function allow(bucket: Bucket, client: string, now = Date.now()): boolean {
  const checks: [string, Limit][] = [
    [`burst:${bucket}:${client}`, RATE_LIMITS[bucket]],
    [`day:${bucket}:${client}`, DAILY_LIMITS[bucket]],
    [`all:${bucket}`, GLOBAL_LIMITS[bucket]],
  ];
  const windows = checks.map(([key, limit]) => [key, limit, current(key, limit, now)] as const);
  if (windows.some(([, limit, window]) => window.count >= limit.max)) return false;
  for (const [key, , window] of windows) {
    window.count += 1;
    counts.set(key, window);
  }
  // Keep the map from growing without bound on a long-lived server.
  if (counts.size > 20_000) {
    for (const [key, window] of counts) if (now - window.start >= DAY) counts.delete(key);
  }
  return true;
}

/** Forget every recorded request (tests). */
export function resetRateLimits(): void {
  counts.clear();
}

/** The client's address: the first `x-forwarded-for` hop (set by Vercel), else `x-real-ip`. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * The rate-limit key for an address. An IPv6 client is keyed by its /64 network, since one
 * subscriber is usually given a whole /64 and could otherwise rotate through 2^64 addresses;
 * an IPv4-mapped IPv6 address is keyed as the IPv4 address.
 */
export function clientKey(address: string): string {
  const ip = address
    .replace(/^\[|\]$/g, "")
    .split("%")[0]
    .toLowerCase();
  if (!ip.includes(":")) return ip;
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return mapped[1];
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return ip;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/** Whether the exercise API is switched off (`EXERCISES_DISABLED=1`), e.g. while under abuse. */
export function exercisesDisabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.EXERCISES_DISABLED?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/**
 * Whether the request comes from a page of this site, as a browser's `fetch` does: its
 * `Origin` names this host, and `Sec-Fetch-Site` (where the browser sends it) says
 * same-origin. Anything can forge headers, so this only turns away cross-site pages and
 * scripts that don't bother; the rate limits and the gateway budget do the rest.
 */
function fromThisSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  try {
    return new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

/**
 * Validate a POST request and parse its JSON body with `schema`.
 *
 * @throws {ExerciseError} When the API is switched off; for a request that isn't a
 *   same-origin JSON POST, a body that is too large or doesn't parse, or a client (or the
 *   instance) over its rate limit.
 */
export async function readRequest<T extends z.ZodType>(
  request: Request,
  schema: T,
  bucket: Bucket,
): Promise<z.infer<T>> {
  if (exercisesDisabled()) {
    throw new ExerciseError(
      "config",
      "The exercise generator is switched off for now. Try again later.",
      503,
    );
  }
  if (!fromThisSite(request)) {
    throw new ExerciseError("input", "Cross-site requests aren't allowed.", 403);
  }
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(type)) {
    throw new ExerciseError("input", "The request must be JSON.", 415);
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
  if (!allow(bucket, clientKey(clientAddress(request)))) {
    throw new ExerciseError(
      "busy",
      "That's a lot of requests: wait a while before asking for more.",
      429,
    );
  }
  return parsed.data;
}
