/**
 * Structure checks for the real `content/` reference topics: directories and sheets in order,
 * a minimum number of sections, `References` last, `Recipes` where promised, and code lines
 * that fit the code box.
 */
import { describe, expect, it } from "bun:test";
import {
  listAllSheets,
  listGroupSheets,
  listTopicEntries,
  readSheetBody,
  type SheetRef,
} from "@/lib/content";
import { readImageDimensions } from "@/lib/images";
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
      "three-js/",
      "webassembly/",
      "testing",
    ],
    directories: {
      language: ["fundamentals", "objects", "array-methods", "string-methods", "oop", "async-promises"],
      "design-architecture": ["design-patterns", "software-architecture", "modules-packages"],
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
      "three-js": [
        "fundamentals",
        "geometry-materials",
        "lights-shadows",
        "models-animation",
        "shaders-postprocessing",
        "react-three-fiber",
      ],
      webassembly: ["fundamentals", "wat", "rust", "emscripten", "wasi-components"],
    },
  },
  databases: { entries: ["postgres", "db-design", "drizzle"], directories: {} },
  infrastructure: {
    entries: [
      "linux/",
      "containers/",
      "kubernetes/",
      "ansible",
      "grafana",
      "communication-networks",
      "system-design",
    ],
    directories: {
      linux: ["sysadmin", "ssh-keys-certs"],
      containers: ["docker", "dockerfile"],
      kubernetes: ["kubernetes", "helm"],
    },
  },
  physics: { entries: ["fundamentals", "numerical-weather-modeling", "overview"], directories: {} },
  "ml-ai": { entries: ["scikit-learn", "pytorch", "overview"], directories: {} },
  python: {
    entries: ["language/", "engineering/", "data/", "fastapi", "overview"],
    directories: {
      language: ["fundamentals", "strings", "datetime", "oop", "async-concurrency", "std-library"],
      engineering: ["packages", "testing", "design-patterns"],
      data: ["numpy", "pandas"],
    },
  },
  fitness: {
    entries: ["training/", "nutrition/", "recovery-mobility/"],
    directories: {
      training: ["energy-systems", "strength-training", "endurance", "training-plans"],
      nutrition: ["nutrition-hydration", "vitamins-minerals"],
      "recovery-mobility": ["running-warmup-drills", "stretching-recovery"],
    },
  },
  economics: { entries: ["microeconomics", "macroeconomics"], directories: {} },
  cpp: { entries: ["fundamentals"], directories: {} },
  finance: {
    entries: ["personal/", "business/"],
    directories: {
      personal: [
        "money-basics",
        "banking",
        "credit-debt",
        "investing",
        "retirement-taxes",
        "insurance-estate",
      ],
      business: [
        "accounting",
        "financial-statements",
        "corporate-finance",
        "valuation",
        "startup-finance",
      ],
    },
  },
  thinking: {
    entries: ["first-principles", "systems-thinking", "game-theory", "mental-models/"],
    directories: {
      "mental-models": [
        "general-thinking",
        "decision-making",
        "probability-risk",
        "cognitive-biases",
        "cross-discipline",
      ],
    },
  },
  leadership: {
    entries: [
      "ooda-loop",
      "extreme-ownership",
      "mission-command",
      "five-dysfunctions",
      "management",
      "leadership-models",
    ],
    directories: {},
  },
  startups: {
    entries: ["idea-to-mvp/", "advice/"],
    directories: {
      "idea-to-mvp": [
        "playbook",
        "ideation",
        "validation",
        "product-design",
        "building-mvp",
        "launch-iterate",
      ],
      advice: [
        "y-combinator",
        "a16z",
        "peter-thiel",
        "elon-musk",
        "steve-jobs",
        "jensen-huang",
        "founders",
        "designers",
      ],
    },
  },
  writing: {
    entries: ["nonfiction/", "fiction/", "worldbuilding/"],
    directories: {
      nonfiction: ["clear-writing", "persuasive-writing", "technical-writing"],
      fiction: ["story-structure", "character", "scene-prose"],
      worldbuilding: [
        "fundamentals",
        "physical-world",
        "societies-cultures",
        "magic-technology",
        "game-worlds",
      ],
    },
  },
  "game-dev": {
    entries: ["godot/"],
    directories: {
      godot: [
        "gdscript",
        "nodes-scenes",
        "input-physics",
        "ui-animation-audio",
        "shaders",
        "resources-saving-export",
      ],
    },
  },
};

/** Loose entry that is a topic's coming-soon page, not a reference sheet (checked further down). */
const OVERVIEW = "overview";

/** Design sheets checked for sections and line length (the topic also holds the Demo sheet). */
const DESIGN_DIRECTORIES: Readonly<Record<string, readonly string[]>> = {
  principles: ["ux-ui", "color-theory"],
  html: [
    "document-head",
    "semantic-elements",
    "forms-inputs",
    "media-embeds",
    "interactive-elements",
    "accessibility",
  ],
  css: ["css", "tailwind", "animation"],
};

/**
 * Sheets that promise a `## Recipes` section of quick copy-paste snippets: a bare slug
 * matches that slug in any topic, a `topic/group/slug` label matches one sheet.
 */
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
  "drizzle",
  "ansible",
  "software-architecture",
  "fastapi",
  "numpy",
  "pandas",
  "scikit-learn",
  "pytorch",
  "python/language/fundamentals",
  "strings",
  "datetime",
  "async-concurrency",
  "std-library",
  "packages",
  "python/engineering/design-patterns",
  "fitness/training/energy-systems",
  "fitness/training/strength-training",
  "fitness/training/endurance",
  "fitness/training/training-plans",
  "fitness/nutrition/nutrition-hydration",
  "fitness/nutrition/vitamins-minerals",
  "fitness/recovery-mobility/running-warmup-drills",
  "fitness/recovery-mobility/stretching-recovery",
  "cpp/fundamentals",
  "typescript/three-js/fundamentals",
  "typescript/three-js/geometry-materials",
  "typescript/three-js/lights-shadows",
  "typescript/three-js/models-animation",
  "typescript/three-js/shaders-postprocessing",
  "typescript/three-js/react-three-fiber",
  "typescript/webassembly/fundamentals",
  "wat",
  "rust",
  "emscripten",
  "wasi-components",
  "gdscript",
  "nodes-scenes",
  "input-physics",
  "ui-animation-audio",
  "shaders",
  "resources-saving-export",
  "document-head",
  "semantic-elements",
  "forms-inputs",
  "media-embeds",
  "interactive-elements",
  "design/html/accessibility",
  "startups/idea-to-mvp/building-mvp",
]);

/** Visual components or live demos each design sheet must use at least this many times. */
const DESIGN_VISUALS: Readonly<Record<string, number>> = {
  "ux-ui": 3,
  "color-theory": 3,
  css: 3,
  animation: 3,
  tailwind: 1,
  "document-head": 2,
  "semantic-elements": 2,
  "forms-inputs": 2,
  "media-embeds": 2,
  "interactive-elements": 2,
  accessibility: 2,
};

/** A visual in MDX source: a colour component, a diagram or a live demo fence. */
const VISUAL = /^(?:<(?:Swatches|Scale|Contrast|Diagram)\b|```html [^\n]*\bdemo\b)/gm;

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
    ...layout.entries
      .filter((e) => !e.endsWith("/") && e !== OVERVIEW)
      .map((slug) => ({ topic, slug })),
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
  it("lists the principles, HTML and CSS directories before the Demo sheet", () => {
    const entries = listTopicEntries("design");
    expect(entries.map((e) => (e.kind === "group" ? `${e.slug}/` : e.slug))).toEqual([
      "principles/",
      "html/",
      "css/",
      "overview",
    ]);
    expect(entries.at(-1)?.title).toBe("Demo");
  });

  for (const [group, slugs] of Object.entries(DESIGN_DIRECTORIES)) {
    it(`${group}/ holds its sheets in order`, () => {
      expect(listGroupSheets("design", group).map((s) => s.slug)).toEqual([...slugs]);
    });

    for (const slug of slugs) {
      const min = DESIGN_VISUALS[slug] ?? 0;
      it(`${group}/${slug} has at least ${min} visuals`, () => {
        const body = readSheetBody({ topic: "design", group, slug });
        expect(body.match(VISUAL)?.length ?? 0).toBeGreaterThanOrEqual(min);
      });
    }
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
      if (WITH_RECIPES.has(sheet.slug) || WITH_RECIPES.has(label(sheet))) {
        expect(sections.at(-2)).toBe("Recipes");
      }
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

/** Maths sheets: numbered book-style headings are kept as they are, but each ends with its sources. */
const MATHS_SHEETS = ["math-fundamentals", "reading-graphs", "constants-units-conversions", "notation"];

describe("content/maths", () => {
  it("lists its sheets in order, with the coming-soon overview last", () => {
    expect(listTopicEntries("maths").map((e) => e.slug)).toEqual([...MATHS_SHEETS, "overview"]);
  });

  for (const slug of MATHS_SHEETS) {
    it(`${slug} ends with a References section and keeps code lines short`, () => {
      const body = readSheetBody({ topic: "maths", slug });
      const sections = extractToc(body).filter((e) => e.depth === 2);
      expect(sections.at(-1)?.text).toBe("References");
      expect(body.split("## References")[1]).toMatch(/^- \[.+\]\(https:\/\/.+\)/m);
      expect(longCodeLines(body)).toEqual([]);
    });
  }
});

/** Topic overviews that have no real content yet: a heading and the meme, nothing else. */
const COMING_SOON = ["maths", "physics", "biology", "ml-ai", "python", "robotics"];
/** The shared meme on every coming-soon page. */
const COMING_SOON_IMAGE = "/images/coming-soon.png";

describe("coming-soon pages", () => {
  for (const topic of COMING_SOON) {
    it(`${topic}/overview is just a Coming soon heading and the meme`, () => {
      const body = readSheetBody({ topic, slug: "overview" }).trim();
      expect(extractToc(body).map((e) => e.text)).toEqual(["Coming soon"]);
      const lines = body.split("\n").filter((line) => line.trim() !== "");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toMatch(new RegExp(`^!\\[.+\\]\\(${COMING_SOON_IMAGE}\\)$`));
    });
  }

  it("the meme exists under public/ with real dimensions", () => {
    const size = readImageDimensions(COMING_SOON_IMAGE);
    expect(size?.width).toBeGreaterThan(0);
    expect(size?.height).toBeGreaterThan(0);
  });

  it("no sheet still carries the old placeholder text", () => {
    const stale = listAllSheets().filter((sheet) =>
      readSheetBody(sheet).includes("Replace this stub with real content"),
    );
    expect(stale.map(label)).toEqual([]);
  });
});
