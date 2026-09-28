/**
 * @file What the exercise pages remember in `localStorage`: recent exercises and problems,
 * the learner's code for each, their progress, and the last form settings.
 *
 * Everything read back is validated with Zod (a store from an older version or edited by
 * hand is dropped, not trusted), and every access is wrapped: private windows and
 * blocked storage just mean nothing is remembered.
 */

import { z } from "zod";
import {
  CODE_LANGUAGE_IDS,
  CODE_THEME_IDS,
  DIFFICULTY_IDS,
  MATH_AREA_IDS,
  SIZE_IDS,
} from "./options";
import { codeExercise, mathProblem } from "./schema";

/** How many exercises (and problems) are kept; the oldest go first. */
export const MAX_KEPT = 12;

/** The coding page's store. */
export const codeStore = z.object({
  currentId: z.string().nullable(),
  exercises: z.array(codeExercise).max(MAX_KEPT),
  /** The learner's code per exercise id. */
  drafts: z.record(z.string(), z.string().max(40_000)),
  /**
   * Per exercise id: whether it has been passed (tests and review), the best test score, and
   * whether its reference solution passed its own tests when it was generated.
   */
  progress: z.record(
    z.string(),
    z.object({
      passed: z.boolean(),
      best: z.string().max(20).optional(),
      verified: z.boolean().optional(),
    }),
  ),
  form: z.object({
    request: z.string().max(500),
    theme: z.enum(CODE_THEME_IDS),
    difficulty: z.enum(DIFFICULTY_IDS),
    language: z.enum(CODE_LANGUAGE_IDS),
    size: z.enum(SIZE_IDS),
  }),
});

/** The coding page's store. */
export type CodeStore = z.infer<typeof codeStore>;

/** An empty coding store. */
export const EMPTY_CODE_STORE: CodeStore = {
  currentId: null,
  exercises: [],
  drafts: {},
  progress: {},
  form: { request: "", theme: "any", difficulty: "beginner", language: "python", size: "exercise" },
};

/** The math page's store. */
export const mathStore = z.object({
  currentId: z.string().nullable(),
  problems: z.array(mathProblem).max(MAX_KEPT),
  /** Per problem id: solved, and how many answers were checked. */
  progress: z.record(
    z.string(),
    z.object({ solved: z.boolean(), attempts: z.number().int().min(0) }),
  ),
  form: z.object({
    request: z.string().max(500),
    area: z.enum(MATH_AREA_IDS),
    difficulty: z.enum(DIFFICULTY_IDS),
  }),
});

/** The math page's store. */
export type MathStore = z.infer<typeof mathStore>;

/** An empty math store. */
export const EMPTY_MATH_STORE: MathStore = {
  currentId: null,
  problems: [],
  progress: {},
  form: { request: "", area: "any", difficulty: "beginner" },
};

/** Storage keys. */
export const STORE_KEYS = { code: "exercises:code:v1", math: "exercises:math:v1" } as const;

/**
 * Read a store, falling back to `empty` when it's missing, unreadable or invalid.
 *
 * @param key - The `localStorage` key.
 * @param schema - What the stored JSON must parse as.
 * @param empty - The fallback.
 */
export function loadStore<T>(key: string, schema: z.ZodType<T>, empty: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return empty;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : empty;
  } catch {
    return empty;
  }
}

/** Write a store; a full or blocked storage is ignored. */
export function saveStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do: progress just isn't remembered.
  }
}

/**
 * Add an item to the front of a list of at most {@link MAX_KEPT}, replacing one with the
 * same id, and return the ids that fell off the end (to forget their drafts).
 */
export function remember<T extends { id: string }>(
  items: readonly T[],
  item: T,
): { items: T[]; dropped: string[] } {
  const rest = items.filter((i) => i.id !== item.id);
  const all = [item, ...rest];
  return { items: all.slice(0, MAX_KEPT), dropped: all.slice(MAX_KEPT).map((i) => i.id) };
}

/** A copy of `record` without `keys`. */
export function omitKeys<V>(record: Record<string, V>, keys: readonly string[]): Record<string, V> {
  const out = { ...record };
  for (const key of keys) delete out[key];
  return out;
}

/**
 * Remove items from a recent list, and pick what is current afterward: the same item if it
 * stays, else the one that took the removed current item's place (or the one before it, at the
 * end of the list), else nothing.
 *
 * @param items - The recent list, newest first.
 * @param currentId - The open item's id.
 * @param ids - The ids to remove; every id when `"all"`.
 */
export function forget<T extends { id: string }>(
  items: readonly T[],
  currentId: string | null,
  ids: readonly string[] | "all",
): { items: T[]; currentId: string | null; removed: string[] } {
  const gone = new Set(ids === "all" ? items.map((i) => i.id) : ids);
  const kept = items.filter((i) => !gone.has(i.id));
  const removed = items.filter((i) => gone.has(i.id)).map((i) => i.id);
  if (currentId === null || !gone.has(currentId)) return { items: kept, currentId, removed };
  const at = items.findIndex((i) => i.id === currentId);
  const after = items.slice(at + 1).find((i) => !gone.has(i.id));
  const before = items
    .slice(0, at)
    .reverse()
    .find((i) => !gone.has(i.id));
  return { items: kept, currentId: (after ?? before)?.id ?? null, removed };
}
