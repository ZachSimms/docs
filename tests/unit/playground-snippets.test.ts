/** Unit tests for the Snippets tab's data: structure, coverage per language, set choice, filtering, syntax. */
import { describe, expect, it } from "bun:test";
import { parser as cssParser } from "@lezer/css";
import { parser as pythonParser } from "@lezer/python";
import { parser as rustParser } from "@lezer/rust";
import type { Parser } from "@lezer/common";
import ts from "typescript";
import { LANGUAGE_IDS } from "@/lib/playground/languages";
import {
  defaultSnippetSet,
  filterSnippets,
  isSnippetSetId,
  loadSnippets,
  SNIPPET_SET_IDS,
  SNIPPET_SETS,
  SNIPPETS_FOR,
  type Snippet,
  type SnippetSetId,
} from "@/lib/playground/snippets";
import { transpile } from "@/lib/playground/transpile";

const all = new Map<SnippetSetId, readonly Snippet[]>();
for (const id of SNIPPET_SET_IDS) all.set(id, await loadSnippets(id));

/** Sets for general-purpose languages: each must cover what a beginner reaches for first. */
const PROGRAMMING: readonly SnippetSetId[] = [
  "javascript",
  "typescript",
  "python",
  "cpp",
  "rust",
  "gdscript",
];
const CORE = ["hello", "functions", "arrow", "classes", "errors", "async"] as const;

describe("snippet sets", () => {
  it("every set loads, with unique ids and tidy code", () => {
    for (const [id, snippets] of all) {
      expect(snippets.length).toBeGreaterThan(3);
      expect(new Set(snippets.map((s) => s.id)).size).toBe(snippets.length);
      for (const s of snippets) {
        const where = `${id}/${s.id}`;
        expect({ where, title: s.title.trim().length > 0 }).toEqual({ where, title: true });
        expect({ where, endsWithOneNewline: /[^\n]\n$/.test(s.code) }).toEqual({
          where,
          endsWithOneNewline: true,
        });
        expect({ where, trailingSpace: /[ \t]+$/m.test(s.code) }).toEqual({
          where,
          trailingSpace: false,
        });
        expect({ where, crlf: s.code.includes("\r") }).toEqual({ where, crlf: false });
      }
    }
  });

  it("each programming language has hello world, functions, arrow functions, classes, errors and async", () => {
    for (const id of PROGRAMMING) {
      const ids = all.get(id)!.map((s) => s.id);
      expect({ id, missing: CORE.filter((c) => !ids.includes(c)) }).toEqual({ id, missing: [] });
    }
  });

  it("every project type offers sets that exist, and every set is offered somewhere", () => {
    expect(Object.keys(SNIPPETS_FOR).sort()).toEqual([...LANGUAGE_IDS].sort());
    for (const sets of Object.values(SNIPPETS_FOR)) {
      expect(sets.length).toBeGreaterThan(0);
      for (const id of sets) expect(isSnippetSetId(id)).toBe(true);
    }
    const offered = new Set(Object.values(SNIPPETS_FOR).flat());
    expect([...SNIPPET_SET_IDS].filter((id) => !offered.has(id))).toEqual([]);
    for (const id of SNIPPET_SET_IDS) expect(SNIPPET_SETS[id].id).toBe(id);
  });

  it("indents GDScript with tabs and Python with spaces", () => {
    for (const s of all.get("gdscript")!) expect(/^ +\S/m.test(s.code)).toBe(false);
    for (const s of all.get("python")!) expect(/^\t/m.test(s.code)).toBe(false);
  });
});

describe("defaultSnippetSet", () => {
  it("starts on the set written in the open file's language", () => {
    expect(defaultSnippetSet("web", "css")).toBe("css");
    expect(defaultSnippetSet("web", "html")).toBe("html");
    expect(defaultSnippetSet("web", "javascript")).toBe("dom");
    expect(defaultSnippetSet("web-ts", "typescript")).toBe("typescript");
    expect(defaultSnippetSet("react", "tsx")).toBe("react");
    expect(defaultSnippetSet("react", "typescript")).toBe("typescript");
    expect(defaultSnippetSet("hono", "typescript")).toBe("hono");
  });

  it("falls back to the project's first set (a README, say)", () => {
    expect(defaultSnippetSet("python", "markdown")).toBe("python");
    expect(defaultSnippetSet("cpp", "text")).toBe("cpp");
    expect(defaultSnippetSet("javascript", "typescript")).toBe("javascript");
  });
});

describe("filterSnippets", () => {
  const js = all.get("javascript")!;

  it("keeps everything for a blank query", () => {
    expect(filterSnippets(js, "  ")).toHaveLength(js.length);
  });

  it("matches titles and keywords first, then code, needing every word", () => {
    const lambda = filterSnippets(js, "lambda");
    expect(lambda[0].id).toBe("arrow");
    const tryCatch = filterSnippets(js, "TRY catch");
    expect(tryCatch[0].id).toBe("errors");
    // "Promise.all" (with the dot) is only in one snippet's code
    expect(filterSnippets(js, "promise.all").map((s) => s.id)).toEqual(["promise-all"]);
    expect(filterSnippets(js, "class zzz")).toEqual([]);
  });

  it("puts title matches before note and keyword matches", () => {
    // The Responsive grid snippet's keywords mention cards; the Card snippet is named for it.
    const card = filterSnippets(all.get("tailwind")!, "card").map((s) => s.id);
    expect(card).toEqual(["card", "grid"]);
  });
});

describe("Tailwind set", () => {
  const tailwind = all.get("tailwind")!;

  it("is offered wherever a page can load it, after the plain HTML and CSS", () => {
    expect(SNIPPETS_FOR.web).toEqual(["html", "css", "tailwind", "dom", "javascript"]);
    expect(SNIPPETS_FOR["web-ts"]).toContain("tailwind");
    expect(SNIPPETS_FOR.react).toContain("tailwind");
  });

  it("starts with a whole page that loads the Tailwind 4 browser build", () => {
    const setup = tailwind[0];
    expect(setup.id).toBe("hello");
    expect(setup.code).toStartWith("<!doctype html>");
    expect(setup.code).toContain(
      '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>',
    );
  });

  it("uses no opacity utilities (Tailwind 4 removed them: write bg-black/50)", () => {
    // Checked against the 4.3.3 browser build: bg-, text- and border-opacity-* produce no CSS.
    // (flex-shrink-*, flex-grow, overflow-ellipsis and decoration-slice still work there.)
    for (const s of tailwind) {
      const removed = /\b(?:bg|text|border|divide|placeholder|ring)-opacity-\d+/.exec(s.code);
      expect({ id: s.id, removed: removed?.[0] ?? null }).toEqual({ id: s.id, removed: null });
    }
  });

  it("marks its React component as TSX", () => {
    expect(tailwind.find((s) => s.id === "react")?.mode).toBe("tsx");
    expect(tailwind.filter((s) => s.mode !== undefined).map((s) => s.id)).toEqual(["react"]);
  });
});

describe("snippet syntax", () => {
  /** The first syntax error in `code`, as `line: text`, or null. */
  function firstError(parser: Parser, code: string): string | null {
    let at: number | null = null;
    parser.parse(code).iterate({
      enter: (node) => {
        if (at === null && node.type.isError) at = node.from;
      },
    });
    if (at === null) return null;
    const line = code.slice(0, at).split("\n").length;
    return `${line}: ${code.split("\n")[line - 1]}`;
  }

  // Lezer's grammars are made for highlighting and tolerate a lot, but misreport some valid
  // JS/TS (destructured defaults, typed catch clauses) and C++ (brace initialization), so those
  // are checked with the TypeScript compiler's parser below instead, and C++ isn't checked here.
  const checks: [SnippetSetId, Parser][] = [
    ["python", pythonParser],
    ["rust", rustParser],
    ["css", cssParser],
  ];

  for (const [id, parser] of checks) {
    it(`parses every ${id} snippet without errors`, () => {
      for (const s of all.get(id)!) {
        expect({ snippet: s.id, error: firstError(parser, s.code) }).toEqual({
          snippet: s.id,
          error: null,
        });
      }
    });
  }

  it("JavaScript, TypeScript and TSX snippets have no syntax errors", () => {
    for (const [id, ext] of [
      ["javascript", "mjs"],
      ["dom", "js"],
      ["typescript", "ts"],
      ["bun", "ts"],
      ["hono", "ts"],
      ["react", "tsx"],
      ["tailwind", "tsx"],
    ] as const) {
      for (const s of all.get(id)!.filter((s) => id !== "tailwind" || s.mode === "tsx")) {
        const { diagnostics = [] } = ts.transpileModule(s.code, {
          fileName: `main.${s.mode === "tsx" ? "tsx" : ext}`,
          reportDiagnostics: true,
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
        });
        const errors = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
        expect({ snippet: `${id}/${s.id}`, errors }).toEqual({
          snippet: `${id}/${s.id}`,
          errors: [],
        });
      }
    }
  });

  it("TypeScript and TSX snippets compile with the playground's transpiler", () => {
    for (const [id, ext] of [
      ["typescript", "ts"],
      ["bun", "ts"],
      ["hono", "ts"],
      ["react", "tsx"],
      ["tailwind", "tsx"],
    ] as const) {
      for (const s of all.get(id)!.filter((s) => id !== "tailwind" || s.mode === "tsx"))
        expect(() => transpile(`main.${ext}`, s.code)).not.toThrow();
    }
  });
});
