/** Unit tests for `lib/playground/languages.ts` and the starter templates. */
import { describe, expect, it } from "bun:test";
import { listAllGroups, listAllSheets, sheetHref } from "@/lib/content";
import {
  DEFAULT_LANGUAGE,
  getLanguage,
  isLanguageId,
  LANGUAGE_IDS,
  LANGUAGES,
  modeForPath,
} from "@/lib/playground/languages";
import { isValidPath, parseProject } from "@/lib/playground/project";

describe("LANGUAGES", () => {
  it("covers every language id exactly once", () => {
    expect(LANGUAGES.map((l) => l.id).sort()).toEqual([...LANGUAGE_IDS].sort());
    expect(isLanguageId(DEFAULT_LANGUAGE)).toBe(true);
  });

  it("has valid, multi-file starter projects", () => {
    for (const lang of LANGUAGES) {
      const files = Object.keys(lang.template.files);
      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.every(isValidPath)).toBe(true);
      expect(files.some((f) => f.includes("/"))).toBe(true);
      expect(parseProject(lang.template)).toEqual(lang.template);
      expect(Object.values(lang.template.files).every((text) => text.trim().length > 0)).toBe(true);
    }
  });

  it("suggests reference sheets that exist", () => {
    const hrefs = new Set([
      ...listAllSheets().map((s) => sheetHref(s)),
      ...listAllGroups().map((g) => `/${g.topic}/${g.slug}/`),
    ]);
    for (const lang of LANGUAGES) {
      expect(lang.refs.length).toBeGreaterThan(0);
      for (const ref of lang.refs) expect(hrefs.has(ref.href)).toBe(true);
    }
  });

  it("names Compiler Explorer and its log retention for remote languages", () => {
    for (const id of ["cpp", "rust"] as const) {
      expect(getLanguage(id).credit).toMatch(/Compiler Explorer.*logged for 32 days/);
    }
  });

  it("gives every stdin language an example input", () => {
    for (const lang of LANGUAGES) expect(Boolean(lang.stdinExample)).toBe(lang.stdin);
  });

  it("asks before the big downloads", () => {
    expect(getLanguage("python").download?.megabytes).toBeGreaterThan(0);
    expect(getLanguage("gdscript").download?.megabytes).toBeGreaterThan(0);
    expect(getLanguage("typescript").download).toBeUndefined();
  });
});

describe("isLanguageId / getLanguage", () => {
  it("guards unknown values", () => {
    expect(isLanguageId("rust")).toBe(true);
    expect(isLanguageId("cobol")).toBe(false);
    expect(isLanguageId(3)).toBe(false);
    expect(() => getLanguage("cobol" as never)).toThrow(/Unknown/);
  });
});

describe("modeForPath", () => {
  it("maps extensions to editor modes", () => {
    expect(modeForPath("main.ts")).toBe("typescript");
    expect(modeForPath("App.TSX")).toBe("tsx");
    expect(modeForPath("include/vec.h")).toBe("cpp");
    expect(modeForPath("src/main.rs")).toBe("rust");
    expect(modeForPath("main.gd")).toBe("gdscript");
    expect(modeForPath("css/style.css")).toBe("css");
    expect(modeForPath("data/values.txt")).toBe("text");
    expect(modeForPath("Makefile")).toBe("text");
  });
});
