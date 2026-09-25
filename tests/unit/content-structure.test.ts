/**
 * Structure checks for the real `content/` reference topics: directories and sheets in order,
 * a minimum number of sections, `References` last, `Recipes` where promised, and code lines
 * that fit the code box.
 */
import { describe, expect, it } from "bun:test";
import { listGroupSheets, listTopicEntries, readSheetBody, type SheetRef } from "@/lib/content";
import { buildSearchIndex } from "@/lib/search";
import { drawTreeLine, parseTree, renderTreeLines } from "@/lib/file-tree";
import { extractToc } from "@/lib/toc";

/** A topic's expected layout: directories (slug → sheet slugs) and loose sheets, in display order. */
interface Layout {
  readonly entries: readonly string[]; // "dir/" for a directory, "slug" for a loose sheet
  readonly directories: Readonly<Record<string, readonly string[]>>;
}

/** Topics whose content is real reference material (not stubs), and how they are laid out. */
const TOPICS: Readonly<Record<string, Layout>> = {
  typescript: {
    entries: [
      "language/",
      "design-architecture/",
      "runtime-tooling/",
      "frontend/",
      "react/",
      "web-apis/",
      "backend/",
      "testing",
    ],
    directories: {
      language: ["fundamentals", "objects", "array-methods", "string-methods", "oop", "async-promises"],
      "design-architecture": ["design-patterns", "modules-packages"],
      "runtime-tooling": ["bun", "node", "pnpm-monorepos"],
      frontend: ["dom", "events", "forms"],
      react: ["react", "react-hooks", "typescript-react", "zustand", "tanstack-query", "next-js"],
      "web-apis": [
        "fetch-api",
        "canvas-2d",
        "webgl",
        "webgpu",
        "web-animations",
        "storage-indexeddb",
        "web-workers",
        "service-workers",
        "history-url-navigation",
        "web-crypto",
        "web-audio",
        "webrtc",
        "media-devices",
        "webcodecs",
        "clipboard",
        "notifications-push",
        "geolocation",
        "web-share",
        "fullscreen",
        "page-visibility",
      ],
      backend: ["hono", "file-io", "streaming", "websockets", "authentication"],
    },
  },
  databases: { entries: ["postgres", "db-design"], directories: {} },
  infrastructure: {
    entries: ["linux/", "containers/", "kubernetes/", "grafana", "communication-networks"],
    directories: {
      linux: ["sysadmin", "ssh-keys-certs"],
      containers: ["docker", "dockerfile"],
      kubernetes: ["kubernetes", "helm"],
    },
  },
};

/** Design sheets checked for sections and line length (the topic also holds the Demo sheet). */
const DESIGN_DIRECTORIES: Readonly<Record<string, readonly string[]>> = {
  principles: ["ux-ui", "color-theory"],
  css: ["css", "tailwind", "animation"],
};

/** Sheets that promise a `## Recipes` section of quick copy-paste snippets. */
const WITH_RECIPES: ReadonlySet<string> = new Set([
  "oop",
  "async-promises",
  "array-methods",
  "fetch-api",
  "streaming",
  "websockets",
  "testing",
  "bun",
  "node",
  "pnpm-monorepos",
  "hono",
  "postgres",
  "db-design",
  "react-hooks",
  "zustand",
  "tanstack-query",
  "next-js",
  "docker",
  "dockerfile",
  "kubernetes",
  "helm",
  "sysadmin",
  "ssh-keys-certs",
  "grafana",
  "css",
  "tailwind",
  "animation",
  "canvas-2d",
  "webgl",
  "storage-indexeddb",
  "web-workers",
  "service-workers",
]);

/** Each sheet's `##` sections are its subpages; fewer than this is a stub. */
const MIN_SECTIONS = 6;

/**
 * Characters a code box shows before it scrolls: the 64ch column minus the
 * `pre` padding. `text` fences are exempt (verbatim headers, URIs, diagrams);
 * `tree` fences are measured as drawn (see {@link wideTreeLines}).
 */
const MAX_CODE_LINE = 61;

/** Fence languages whose source lines are not checked against {@link MAX_CODE_LINE}. */
const UNCHECKED_LANGS: ReadonlySet<string> = new Set(["text", "tree"]);

/** Code lines longer than {@link MAX_CODE_LINE}, as `line: text`, ignoring `text`/`tree` fences. */
function longCodeLines(body: string): string[] {
  const long: string[] = [];
  let fence: { indent: number; lang: string } | undefined;
  body.split("\n").forEach((line, i) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```")) {
      fence = fence
        ? undefined
        : { indent: line.length - trimmed.length, lang: trimmed.slice(3).split(" ")[0] ?? "" };
      return;
    }
    if (fence && !UNCHECKED_LANGS.has(fence.lang) && line.slice(fence.indent).length > MAX_CODE_LINE) {
      long.push(`${i + 1}: ${line.trim()}`);
    }
  });
  return long;
}

/** Drawn `tree`-fence lines (guides, name, aligned comment) wider than {@link MAX_CODE_LINE}. */
function wideTreeLines(body: string): string[] {
  return [...body.matchAll(/^```tree[^\n]*\n([\s\S]*?)^```/gm)].flatMap((match) =>
    renderTreeLines(parseTree(match[1] ?? ""))
      .map(drawTreeLine)
      .filter((drawn) => drawn.length > MAX_CODE_LINE),
  );
}

/** Every sheet reference for a topic layout. */
function sheetsOf(topic: string, layout: Layout): SheetRef[] {
  return [
    ...Object.entries(layout.directories).flatMap(([group, slugs]) =>
      slugs.map((slug) => ({ topic, group, slug })),
    ),
    ...layout.entries.filter((e) => !e.endsWith("/")).map((slug) => ({ topic, slug })),
  ];
}

const ALL_SHEETS: SheetRef[] = [
  ...Object.entries(TOPICS).flatMap(([topic, layout]) => sheetsOf(topic, layout)),
  ...Object.entries(DESIGN_DIRECTORIES).flatMap(([group, slugs]) =>
    slugs.map((slug) => ({ topic: "design", group, slug })),
  ),
];

/** `topic/[group/]slug`, for test names. */
const label = (ref: SheetRef) => [ref.topic, ref.group, ref.slug].filter(Boolean).join("/");

for (const [topic, layout] of Object.entries(TOPICS)) {
  describe(`content/${topic}`, () => {
    it("lists its directories and loose sheets in order", () => {
      const entries = listTopicEntries(topic);
      expect(entries.map((e) => (e.kind === "group" ? `${e.slug}/` : e.slug))).toEqual([
        ...layout.entries,
      ]);
    });

    for (const [group, slugs] of Object.entries(layout.directories)) {
      it(`${group}/ holds its sheets in order`, () => {
        expect(listGroupSheets(topic, group).map((s) => s.slug)).toEqual([...slugs]);
      });
    }
  });
}

describe("content/design", () => {
  it("lists the principles and CSS directories before the Demo sheet", () => {
    const entries = listTopicEntries("design");
    expect(entries.map((e) => (e.kind === "group" ? `${e.slug}/` : e.slug))).toEqual([
      "principles/",
      "css/",
      "overview",
    ]);
    expect(entries.at(-1)?.title).toBe("Demo");
  });

  for (const [group, slugs] of Object.entries(DESIGN_DIRECTORIES)) {
    it(`${group}/ holds its sheets in order`, () => {
      expect(listGroupSheets("design", group).map((s) => s.slug)).toEqual([...slugs]);
    });
  }
});

describe("every reference sheet", () => {
  for (const sheet of ALL_SHEETS) {
    it(`${label(sheet)} has ${MIN_SECTIONS}+ sections, References last, Recipes if promised`, () => {
      const sections = extractToc(readSheetBody(sheet))
        .filter((e) => e.depth === 2)
        .map((e) => e.text);
      expect(sections.length).toBeGreaterThanOrEqual(MIN_SECTIONS);
      expect(sections.at(-1)).toBe("References");
      if (WITH_RECIPES.has(sheet.slug)) expect(sections.at(-2)).toBe("Recipes");
    });

    it(`${label(sheet)} keeps code lines and file trees within ${MAX_CODE_LINE} characters`, () => {
      const body = readSheetBody(sheet);
      expect(longCodeLines(body)).toEqual([]);
      expect(wideTreeLines(body)).toEqual([]);
    });
  }
});

describe("search index", () => {
  it("indexes every reference sheet under its nested url", () => {
    const urls = buildSearchIndex([...Object.keys(TOPICS), "design"]).map((d) => d.url);
    for (const sheet of ALL_SHEETS) {
      expect(urls).toContain(`/${label(sheet)}/`);
    }
    expect(urls).toContain("/typescript/web-apis/fetch-api/");
    expect(urls).toContain("/typescript/react/typescript-react/");
  });
});
