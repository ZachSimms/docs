/**
 * @file Playground drafts and preferences in `localStorage`.
 *
 * Everything read back is untrusted: values are size-capped before parsing,
 * then validated (projects with `parseProject`, preferences with Zod), and
 * anything invalid falls back to the defaults. Writes report failure (quota,
 * private mode, storage disabled) instead of throwing, so the UI can say
 * "couldn't save" and keep working.
 */

import { z } from "zod";
import { DEFAULT_LANGUAGE, getLanguage, LANGUAGE_IDS, type LanguageId } from "./languages";
import { DEFAULT_LAYOUT, layoutSchema, type Layout } from "./layout";
import { parseProject, PROJECT_LIMITS, type Project } from "./project";

/** Key prefix for each language's project (`playground:v1:project:rust`). */
export const PROJECT_KEY_PREFIX = "playground:v1:project:";
/** Key of the preferences object. */
export const PREFS_KEY = "playground:v1:prefs";

/** Stored strings longer than this are ignored without parsing (JSON overhead on top of the byte limit). */
const MAX_STORED_CHARS = PROJECT_LIMITS.maxBytes * 3;

/** What the playground shows: projects of files, or generated exercises with hidden tests. */
export type PlaygroundMode = "code" | "exercise";

/** Preferences that persist across visits. */
export interface Prefs {
  /** Projects or exercises (see `components/exercises/`). */
  readonly mode: PlaygroundMode;
  /** The language shown on load. */
  readonly language: LanguageId;
  /** Sizes of the resizable parts (desktop and tablet). */
  readonly layout: Layout;
  /** Zen mode: only the editor, output and reference panel. */
  readonly zen: boolean;
  /** Whether the first-visit welcome card was dismissed (or the tour taken). */
  readonly welcomed: boolean;
  /** Soft-wrap long lines in the editor. */
  readonly wrap: boolean;
  /** The stdin box per language. */
  readonly stdin: Readonly<Partial<Record<LanguageId, string>>>;
  /** Whether the file tree is expanded (desktop). */
  readonly treeOpen: boolean;
  /** Languages whose one-time runtime download the reader already approved. */
  readonly approvedDownloads: readonly LanguageId[];
}

/** Preferences for a first visit. */
export const DEFAULT_PREFS: Prefs = {
  mode: "code",
  language: DEFAULT_LANGUAGE,
  layout: DEFAULT_LAYOUT,
  zen: false,
  welcomed: false,
  wrap: false,
  stdin: {},
  treeOpen: true,
  approvedDownloads: [],
};

const prefsSchema = z.object({
  mode: z.enum(["code", "exercise"]).catch(DEFAULT_PREFS.mode),
  language: z.enum(LANGUAGE_IDS).catch(DEFAULT_PREFS.language),
  layout: layoutSchema,
  zen: z.boolean().catch(DEFAULT_PREFS.zen),
  welcomed: z.boolean().catch(DEFAULT_PREFS.welcomed),
  wrap: z.boolean().catch(DEFAULT_PREFS.wrap),
  stdin: z
    .partialRecord(z.enum(LANGUAGE_IDS), z.string().max(64 * 1024))
    .catch(DEFAULT_PREFS.stdin),
  treeOpen: z.boolean().catch(DEFAULT_PREFS.treeOpen),
  // Ids of removed project types (like "nextjs") are dropped, keeping the other approvals.
  approvedDownloads: z
    .array(z.string())
    .max(64)
    .transform((ids) => ids.filter(isLanguageId))
    .catch([...DEFAULT_PREFS.approvedDownloads]),
});

/** `localStorage` if it can be reached; some browsers throw on access. */
function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read and JSON-parse a key, or `undefined` when missing, oversize or malformed. */
function readJson(storage: Storage | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    if (!raw || raw.length > MAX_STORED_CHARS) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Write a value as JSON; `false` when storage refuses. */
function writeJson(storage: Storage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * The saved project for a language, or its starter template.
 *
 * @param language - Which language's project.
 * @param storage - Storage to read (defaults to `localStorage`).
 */
export function loadProject(
  language: LanguageId,
  storage: Storage | null = defaultStorage(),
): Project {
  return (
    parseProject(readJson(storage, PROJECT_KEY_PREFIX + language)) ?? getLanguage(language).template
  );
}

/**
 * Save a language's project.
 *
 * @returns `false` if storage is unavailable or full.
 */
export function saveProject(
  language: LanguageId,
  project: Project,
  storage: Storage | null = defaultStorage(),
): boolean {
  return writeJson(storage, PROJECT_KEY_PREFIX + language, project);
}

/** Project types that no longer exist, whose saved projects are removed on load. */
export const REMOVED_LANGUAGES: readonly string[] = ["nextjs"];

/** Whether `id` is a current project type. */
function isLanguageId(id: string): id is LanguageId {
  return (LANGUAGE_IDS as readonly string[]).includes(id);
}

/** The saved preferences, with defaults for anything missing or invalid. */
export function loadPrefs(storage: Storage | null = defaultStorage()): Prefs {
  for (const id of REMOVED_LANGUAGES) {
    try {
      storage?.removeItem(PROJECT_KEY_PREFIX + id);
    } catch {
      // Storage disabled: nothing to clean up.
    }
  }
  const parsed = prefsSchema.safeParse(readJson(storage, PREFS_KEY) ?? {});
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}

/**
 * Save preferences.
 *
 * @returns `false` if storage is unavailable or full.
 */
export function savePrefs(prefs: Prefs, storage: Storage | null = defaultStorage()): boolean {
  return writeJson(storage, PREFS_KEY, prefs);
}
