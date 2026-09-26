/** Unit tests for `lib/playground/storage.ts`: drafts and preferences survive reloads, bad data never breaks the page. */
import { beforeEach, describe, expect, it } from "bun:test";
import { getLanguage } from "@/lib/playground/languages";
import {
  DEFAULT_PREFS,
  loadPrefs,
  loadProject,
  PROJECT_KEY_PREFIX,
  PREFS_KEY,
  savePrefs,
  saveProject,
} from "@/lib/playground/storage";

/** An in-memory Storage, optionally refusing writes (quota exceeded). */
function memoryStorage(failWrites = false): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (failWrites) throw new DOMException("full", "QuotaExceededError");
      data.set(k, v);
    },
  };
}

let store: Storage;
beforeEach(() => {
  store = memoryStorage();
});

describe("projects", () => {
  it("falls back to the language's template when nothing is stored", () => {
    expect(loadProject("rust", store)).toEqual(getLanguage("rust").template);
  });

  it("round-trips a saved project per language", () => {
    const edited = {
      ...getLanguage("python").template,
      files: { ...getLanguage("python").template.files, "extra.py": "x = 1" },
    };
    expect(saveProject("python", edited, store)).toBe(true);
    expect(loadProject("python", store)).toEqual(edited);
    expect(loadProject("cpp", store)).toEqual(getLanguage("cpp").template);
  });

  it("ignores corrupt, hostile or oversize stored values", () => {
    store.setItem(`${PROJECT_KEY_PREFIX}rust`, "{not json");
    expect(loadProject("rust", store)).toEqual(getLanguage("rust").template);
    store.setItem(
      `${PROJECT_KEY_PREFIX}rust`,
      JSON.stringify({
        files: { "../../etc": "x" },
        dirs: [],
        entry: "../../etc",
        open: "",
        tabs: [],
      }),
    );
    expect(loadProject("rust", store)).toEqual(getLanguage("rust").template);
    store.setItem(`${PROJECT_KEY_PREFIX}rust`, "x".repeat(2_000_000));
    expect(loadProject("rust", store)).toEqual(getLanguage("rust").template);
  });

  it("reports a failed save instead of throwing", () => {
    expect(saveProject("rust", getLanguage("rust").template, memoryStorage(true))).toBe(false);
    expect(saveProject("rust", getLanguage("rust").template, null)).toBe(false);
  });
});

describe("prefs", () => {
  it("returns defaults when empty or invalid, and round-trips valid prefs", () => {
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    store.setItem(PREFS_KEY, JSON.stringify({ language: "cobol", layout: "wide" }));
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    const prefs = {
      ...DEFAULT_PREFS,
      language: "cpp" as const,
      layout: { ...DEFAULT_PREFS.layout, refs: 480, tree: 300 },
      zen: true,
      welcomed: true,
      wrap: true,
      stdin: { cpp: "21" },
      approvedDownloads: ["python" as const],
    };
    expect(savePrefs(prefs, store)).toBe(true);
    expect(loadPrefs(store)).toEqual(prefs);
  });

  it("keeps valid fields when others are missing", () => {
    store.setItem(PREFS_KEY, JSON.stringify({ language: "rust" }));
    expect(loadPrefs(store).language).toBe("rust");
    expect(loadPrefs(store).layout).toEqual(DEFAULT_PREFS.layout);
  });

  it("clamps stored sizes and fills in missing ones", () => {
    store.setItem(PREFS_KEY, JSON.stringify({ layout: { tree: 5, refs: 99999, output: "x" } }));
    const { layout } = loadPrefs(store);
    expect(layout.tree).toBe(160);
    expect(layout.refs).toBe(1200);
    expect(layout.output).toBe(DEFAULT_PREFS.layout.output);
    expect(layout.godot).toBe(DEFAULT_PREFS.layout.godot);
  });
});
