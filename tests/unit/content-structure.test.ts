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
      "realtime/",
      "three-js/",
      "webassembly/",
      "testing",
    ],
    directories: {
      language: [
        "fundamentals",
        "objects",
        "array-methods",
        "string-methods",
        "oop",
        "async-promises",
      ],
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
      realtime: [
        "fundamentals",
        "react-nextjs",
        "socket-io",
        "durable-objects",
        "chat-rooms",
        "game-worlds",
        "collaboration",
      ],
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
  aviation: {
    entries: ["atc-comms/", "msfs-2024/"],
    directories: {
      "atc-comms": [
        "fundamentals",
        "vfr-towered",
        "vfr-untowered",
        "ifr-departure",
        "ifr-enroute-arrival",
        "emergencies-lost-comms",
      ],
      "msfs-2024": [
        "sim-basics",
        "cessna-172",
        "cessna-172-classic",
        "cirrus-sr22",
        "vision-jet",
        "longitude",
      ],
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
  dsa: {
    entries: [
      "big-o",
      "linear-structures",
      "trees-graphs",
      "sorting-searching",
      "graph-algorithms",
      "recursion-dp",
      "problem-patterns",
      "interviews",
      "system-design-concepts",
      "system-design-interviews",
    ],
    directories: {},
  },
  "3d": {
    entries: ["fundamentals/", "blender/", "ai-workflows/", "export/"],
    directories: {
      fundamentals: ["core-concepts", "materials-lighting", "animation-rigging"],
      blender: [
        "interface-navigation",
        "modeling",
        "materials-uv",
        "lighting-rendering",
        "animation",
        "buildings-scenes",
        "python-scripting",
      ],
      "ai-workflows": ["ai-generation", "llm-blender"],
      export: ["web-threejs", "godot", "gta-v"],
    },
  },
  "game-dev": {
    entries: ["godot/", "design/"],
    directories: {
      design: ["open-world"],
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
  ...[
    "fundamentals",
    "react-nextjs",
    "socket-io",
    "durable-objects",
    "chat-rooms",
    "game-worlds",
    "collaboration",
  ].map((slug) => `typescript/realtime/${slug}`),
  ...[
    "fundamentals",
    "vfr-towered",
    "vfr-untowered",
    "ifr-departure",
    "ifr-enroute-arrival",
    "emergencies-lost-comms",
  ].map((slug) => `aviation/atc-comms/${slug}`),
  ...["cessna-172", "cessna-172-classic", "cirrus-sr22", "vision-jet", "longitude"].map(
    (slug) => `aviation/msfs-2024/${slug}`,
  ),
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
  "dsa/big-o",
  "dsa/linear-structures",
  "dsa/trees-graphs",
  "dsa/sorting-searching",
  "dsa/graph-algorithms",
  "dsa/recursion-dp",
  "dsa/problem-patterns",
  "dsa/interviews",
  "dsa/system-design-concepts",
  "dsa/system-design-interviews",
  "3d/fundamentals/core-concepts",
  "3d/fundamentals/materials-lighting",
  "3d/fundamentals/animation-rigging",
  "3d/blender/interface-navigation",
  "3d/blender/modeling",
  "3d/blender/materials-uv",
  "3d/blender/lighting-rendering",
  "3d/blender/animation",
  "3d/blender/buildings-scenes",
  "3d/blender/python-scripting",
  "3d/ai-workflows/ai-generation",
  "3d/ai-workflows/llm-blender",
  "3d/export/web-threejs",
  "3d/export/godot",
  "3d/export/gta-v",
]);

/** Visual components or live demos each design sheet must use at least this many times. */
const DESIGN_VISUALS: Readonly<Record<string, number>> = {
  "ux-ui": 3,
  "color-theory": 3,
  css: 3,
  animation: 3,
  tailwind: 20,
  "document-head": 2,
  "semantic-elements": 2,
  "forms-inputs": 2,
  "media-embeds": 2,
  "interactive-elements": 2,
  accessibility: 2,
};

/** A visual in MDX source: a color component, a diagram or a live demo fence. */
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
    if (
      fence &&
      !UNCHECKED_LANGS.has(fence.lang) &&
      line.slice(fence.indent).length > MAX_CODE_LINE
    ) {
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

describe("design/css/tailwind", () => {
  const LAYOUT_SECTIONS = ["Flexbox", "Grid", "Positions", "Animations"];
  const body = readSheetBody({ topic: "design", group: "css", slug: "tailwind" });
  const sections = extractToc(body)
    .filter((e) => e.depth === 2)
    .map((e) => e.text);

  it("has Flexbox, Grid, Positions and Animations sections between Style utilities and Variants", () => {
    const start = sections.indexOf("Style utilities");
    expect(sections.slice(start + 1, start + 1 + LAYOUT_SECTIONS.length)).toEqual(LAYOUT_SECTIONS);
    expect(sections[start + 1 + LAYOUT_SECTIONS.length]).toBe("Variants");
  });

  it("gives each of those sections live Tailwind demos", () => {
    for (const [i, name] of LAYOUT_SECTIONS.entries()) {
      const from = body.indexOf(`\n## ${name}\n`);
      const next = LAYOUT_SECTIONS[i + 1] ?? "Variants";
      const section = body.slice(from, body.indexOf(`\n## ${next}\n`, from));
      expect(section.match(/^```html demo tailwind\b/gm)?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });
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

/** Every DS&A code block shows TypeScript, JavaScript and Python in one synced, remembered tab group. */
const DSA_TABS = '<Tabs items={["TypeScript", "JavaScript", "Python"]} persist="dsa-lang">';

/** TypeScript-only syntax that must not survive into a JavaScript tab. */
const TS_ONLY =
  /:\s*(?:number|string|boolean|void|unknown|any|never|bigint)\b|<T\b[^>]*>|^\s*(?:export\s+)?(?:interface|type)\s+\w+|\b(?:private|protected|public|readonly)\s+\w|\bas\s+const\b|\bsatisfies\b|[\w)\]]!(?=[.;,)\]\s])/m;

/** DS&A sheets that are mostly code, and the fewest tab groups each must have. */
const DSA_MIN_TABS: Readonly<Record<string, number>> = {
  "big-o": 3,
  "linear-structures": 5,
  "trees-graphs": 5,
  "sorting-searching": 5,
  "graph-algorithms": 5,
  "recursion-dp": 5,
  "problem-patterns": 6,
  interviews: 1,
  "system-design-concepts": 2,
  "system-design-interviews": 0,
};

/** The code inside each fence of one language in a block. */
function fences(block: string, lang: string): string[] {
  return [...block.matchAll(new RegExp("```" + lang + "\\b[^\\n]*\\n([\\s\\S]*?)```", "g"))].map(
    (m) => m[1] ?? "",
  );
}

describe("content/dsa code tabs", () => {
  for (const [slug, min] of Object.entries(DSA_MIN_TABS)) {
    /** The sheet's `<Tabs …>` opening lines, trimmed. */
    const tabGroups = (body: string) =>
      [...body.matchAll(/^\s*<Tabs\b[^\n]*$/gm)].map((m) => m[0].trim());
    /** Every `<Tabs>…</Tabs>` block in the sheet. */
    const blocksOf = (body: string) =>
      [...body.matchAll(/<Tabs\b[\s\S]*?<\/Tabs>/g)].map((m) => m[0]);

    it(`dsa/${slug} uses only TypeScript/JavaScript/Python tabs synced by "dsa-lang"`, () => {
      const groups = tabGroups(readSheetBody({ topic: "dsa", slug }));
      expect(groups.filter((g) => g !== DSA_TABS)).toEqual([]);
    });

    it(`dsa/${slug} has at least ${min} tab groups, each ts → js → py`, () => {
      const body = readSheetBody({ topic: "dsa", slug });
      expect(tabGroups(body).length).toBeGreaterThanOrEqual(min);
      for (const block of blocksOf(body)) {
        expect(block.match(/<Tab>/g)?.length).toBe(3);
        expect(block).toMatch(/```ts\b[\s\S]*```js\b[\s\S]*```py(?:thon)?\b/);
      }
    });

    it(`dsa/${slug} has no TypeScript-only syntax in its JavaScript tabs`, () => {
      const body = readSheetBody({ topic: "dsa", slug });
      const leaks = blocksOf(body)
        .flatMap((block) => fences(block, "js"))
        .flatMap((code) => code.split("\n").filter((line) => TS_ONLY.test(line)))
        .map((line) => line.trim());
      expect(leaks).toEqual([]);
    });
  }

  it("dsa/big-o compares growth rates on a graph", () => {
    const body = readSheetBody({ topic: "dsa", slug: "big-o" });
    for (const fn of ["log2", "nlogn", "pow2"]) {
      expect(body).toContain(`fn: "${fn}"`);
    }
  });
});

/** 3D sheets that explain spatial ideas must draw them: fewest `<Diagram>`s per sheet. */
const THREE_D_DIAGRAMS: Readonly<Record<string, number>> = {
  "fundamentals/core-concepts": 2,
  "fundamentals/materials-lighting": 1,
  "fundamentals/animation-rigging": 1,
  "blender/materials-uv": 1,
  "export/web-threejs": 1,
};

describe("content/3d diagrams", () => {
  for (const [path, min] of Object.entries(THREE_D_DIAGRAMS)) {
    const [group, slug] = path.split("/") as [string, string];
    it(`3d/${path} has at least ${min} diagram(s)`, () => {
      const body = readSheetBody({ topic: "3d", group, slug });
      expect(body.match(/^<Diagram\b/gm)?.length ?? 0).toBeGreaterThanOrEqual(min);
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

/** Math sheets: numbered book-style headings are kept as they are, but each ends with its sources. */
const MATHS_SHEETS = [
  "math-fundamentals",
  "reading-graphs",
  "constants-units-conversions",
  "notation",
];

describe("content/math", () => {
  it("lists its sheets in order, with the coming-soon overview last", () => {
    expect(listTopicEntries("math").map((e) => e.slug)).toEqual([...MATHS_SHEETS, "overview"]);
  });

  for (const slug of MATHS_SHEETS) {
    it(`${slug} ends with a References section and keeps code lines short`, () => {
      const body = readSheetBody({ topic: "math", slug });
      const sections = extractToc(body).filter((e) => e.depth === 2);
      expect(sections.at(-1)?.text).toBe("References");
      expect(body.split("## References")[1]).toMatch(/^- \[.+\]\(https:\/\/.+\)/m);
      expect(longCodeLines(body)).toEqual([]);
    });
  }
});

/** Topic overviews that have no real content yet: a heading and the meme, nothing else. */
const COMING_SOON = ["math", "physics", "biology", "ml-ai", "python", "robotics"];
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

/** A one-line block component: `<Contrast …>text</Contrast>` or `<Diagram … />`. */
const ONE_LINE_COMPONENT = /^<([A-Z]\w*)\b.*(?:\/>|<\/\1>)\s*$/;

/**
 * One-line components followed directly by prose, as `line: text`. MDX merges
 * the two into one paragraph, so the component's `<figure>` lands inside a
 * `<p>`: the browser splits it apart, React's hydration fails, and the whole
 * page is re-rendered on the client.
 */
function componentsGluedToProse(body: string): string[] {
  const lines = body.split("\n");
  let fenced = false;
  return lines.flatMap((line, i) => {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    const next = lines[i + 1]?.trim() ?? "";
    return !fenced && ONE_LINE_COMPONENT.test(line) && next !== "" && !next.startsWith("<")
      ? [`${i + 1}: ${line.slice(0, 60)}`]
      : [];
  });
}

describe("MDX block components", () => {
  it("are never glued to the next paragraph (a <figure> inside <p> breaks hydration)", () => {
    const glued = listAllSheets().flatMap((sheet) =>
      componentsGluedToProse(readSheetBody(sheet)).map((line) => `${label(sheet)}:${line}`),
    );
    expect(glued).toEqual([]);
  });
});

describe("writing/nonfiction/technical-writing", () => {
  it("shows the docstring example in TypeScript and Python tabs", () => {
    const body = readSheetBody({
      topic: "writing",
      group: "nonfiction",
      slug: "technical-writing",
    });
    const section = body.split(/^## /m).find((s) => s.startsWith("Code comments and docstrings"));
    expect(section).toBeDefined();
    const tabs = section?.match(/<Tabs\b[\s\S]*?<\/Tabs>/)?.[0] ?? "";
    expect(tabs).toStartWith('<Tabs items={["TypeScript", "Python"]}>');
    expect(tabs).toMatch(/```ts\b[\s\S]*applyCoupon[\s\S]*```py\b[\s\S]*def apply_coupon/);
    expect(tabs).toContain(">>> apply_coupon(");
  });
});
