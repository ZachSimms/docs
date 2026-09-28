/** Unit tests for `lib/terminal/shell.ts` against a fake host. */
import { beforeEach, describe, expect, it } from "bun:test";
import type { Heading } from "@/lib/terminal/page-text";
import {
  Shell,
  tokenize,
  type Host,
  type OutputLine,
  type SearchResult,
} from "@/lib/terminal/shell";
import { buildFs, pathOf, resolvePath, type FsNode } from "@/lib/terminal/vfs";
import type { Theme } from "@/lib/theme";
import { TREE } from "../fixtures/terminal";

const fs = buildFs(TREE);

/** Everything the fake host was asked to do. */
interface Calls {
  navigated: string[];
  external: string[];
  scrolled: string[];
  other: string[];
}

/** A host that records calls; the page on screen is `showing`. */
function fakeHost(calls: Calls, options: Partial<Host> & { showingHref?: string } = {}) {
  let theme: Theme = "light";
  let zen = false;
  const headings: Heading[] = [
    { id: "lists", text: "Lists", level: 2 },
    { id: "comprehensions", text: "Comprehensions", level: 3 },
  ];
  const host: Host = {
    navigate: (href) => calls.navigated.push(href),
    openExternal: (href) => calls.external.push(href),
    back: () => calls.other.push("back"),
    forward: () => calls.other.push("forward"),
    showing: (node) => node.href === (options.showingHref ?? "/python/overview/"),
    headings: async (node) =>
      node.name === "overview" ? headings : node.name === "broken" ? null : [],
    pageText: async (node) => (node.name === "overview" ? ["# Overview", "", "Some text."] : null),
    scrollToHeading: (id) =>
      headings.some((h) => h.id === id) ? (calls.scrolled.push(id), true) : false,
    scroll: (to) => calls.other.push(`scroll ${to}`),
    theme: () => theme,
    setTheme: (next) => {
      theme = next;
    },
    zen: () => zen,
    setZen: (on) => {
      zen = on;
    },
    search: async (query): Promise<SearchResult[]> =>
      query === "fail"
        ? Promise.reject(new Error("offline"))
        : query === "none"
          ? []
          : [
              { url: "/python/overview/", title: "Overview" },
              { url: "/gone/", title: "Gone" },
            ],
    openSearch: () => calls.other.push("search"),
    showSource: (view) =>
      calls.other.push(
        view === null ? "md close" : view.follow ? "md follow" : `md ${view.node.name}`,
      ),
    history: () => ["ls", "cd docs"],
    clear: () => calls.other.push("clear"),
    close: () => calls.other.push("close"),
    toggleMax: () => true,
    ...options,
  };
  return host;
}

/** Output as plain text, one string per line. */
function plain(lines: readonly OutputLine[]): string[] {
  return lines.map((line) => line.map((segment) => segment.text).join(""));
}

let calls: Calls;
let moves: string[];
let shell: Shell;

/** The node at a path from home. */
function at(path: string): FsNode {
  const node = resolvePath(fs, fs.root, path);
  if (!node) throw new Error(`no node at ${path}`);
  return node;
}

beforeEach(() => {
  calls = { navigated: [], external: [], scrolled: [], other: [] };
  moves = [];
  shell = new Shell(fs, fakeHost(calls), fs.root, (node) => moves.push(pathOf(node)));
});

describe("tokenize", () => {
  it("splits words and separators, honoring quotes and escapes", () => {
    expect(tokenize(`cd "a b" && ls; x\\ y 'c;d'`)).toEqual([
      { word: "cd" },
      { word: "a b" },
      { op: "&&" },
      { word: "ls" },
      { op: ";" },
      { word: "x y" },
      { word: "c;d" },
    ]);
    expect(tokenize(`  `)).toEqual([]);
    expect(tokenize(`""`)).toEqual([{ word: "" }]);
  });

  it("rejects an unterminated quote", () => {
    expect(() => tokenize(`cd "docs`)).toThrow('unterminated "');
  });
});

describe("Shell", () => {
  it("starts at home and lists it with numbers, names and titles", async () => {
    expect(shell.path).toBe("~");
    const out = await shell.run("ls");
    expect(plain(out)).toEqual([
      "00. projects/  Projects",
      "01. docs/      Docs",
      "02. info       Info",
    ]);
    expect(out[0]?.[1]).toEqual({ text: "projects/", href: "/projects/" });
  });

  it("lists with dates, links out, empty directories and bad paths", async () => {
    expect(plain(await shell.run("ls -l docs/python"))[1]).toBe(
      "01. 2026-01-01  overview   Overview",
    );
    expect(plain(await shell.run("ls projects"))[1]).toBe(
      "01. repo       Repo → https://github.com/x/y",
    );
    expect(plain(await shell.run("ls projects/repo"))).toEqual(["repo → https://github.com/x/y"]);
    expect(plain(await shell.run("ls docs/physics"))).toEqual(["(empty)"]);
    const bad = await shell.run("ls nope");
    expect(plain(bad)).toEqual(["ls: no such page: nope"]);
    expect(bad[0]?.[0]?.tone).toBe("error");
  });

  it("lists a page's sections, and says when it has none or cannot load", async () => {
    expect(plain(await shell.run("ls docs/python/overview"))).toEqual([
      "00. Lists  #lists",
      "01.   Comprehensions  #comprehensions",
    ]);
    expect(plain(await shell.run("ls info"))).toEqual(["info  Info (no sections)"]);
    const broken = {
      ...TREE.root,
      children: [{ name: "broken", title: "Broken", href: "/b/", kind: "page" as const }],
    };
    const small = buildFs({ ...TREE, root: broken });
    const other = new Shell(small, fakeHost(calls));
    expect(plain(await other.run("toc broken"))).toEqual(["toc: could not load ~/broken"]);
  });

  it("cd goes to pages and directories, and moves the prompt at once", async () => {
    expect(await shell.run("cd docs/python")).toEqual([]);
    expect(calls.navigated).toEqual(["/python/"]);
    expect(shell.path).toBe("~/docs/python");
    expect(moves).toEqual(["~/docs/python"]);
    await shell.run("cd ..");
    expect(shell.path).toBe("~/docs");
    await shell.run("cd");
    expect(shell.path).toBe("~");
    expect(calls.navigated).toEqual(["/python/", "/docs/", "/"]);
  });

  it("cd - goes back to the previous directory", async () => {
    expect(plain(await shell.run("cd -"))).toEqual(["cd: no previous page"]);
    await shell.run("cd docs; cd ~/info; cd -");
    expect(shell.path).toBe("~/docs");
  });

  it("cd with a number opens that row of the listing just printed, else a child", async () => {
    await shell.run("cd docs/python");
    await shell.run("ls");
    await shell.run("cd 1");
    expect(shell.path).toBe("~/docs/python/overview");
    // No listing printed just before: the number is a child of the current directory.
    await shell.run("cd ..");
    await shell.run("pwd");
    await shell.run("cd 0");
    expect(shell.path).toBe("~/docs/python/language");
  });

  it("jumps to headings of the page on screen", async () => {
    await shell.run("cd docs/python/overview");
    await shell.run("cd #lists");
    expect(calls.scrolled).toEqual(["lists"]);
    await shell.run("toc && cd 1");
    expect(calls.scrolled).toEqual(["lists", "comprehensions"]);
    expect(plain(await shell.run("cd #nope"))).toEqual([
      "cd: no heading #nope on this page (try toc)",
    ]);
    await shell.run("cd overview#lists");
    expect(calls.scrolled).toEqual(["lists", "comprehensions", "lists"]);
  });

  it("goes to a heading of another page, or of one still loading, by URL", async () => {
    await shell.run("cd docs/python/overview#lists");
    expect(calls.navigated).toEqual(["/python/overview/#lists"]);
    expect(plain(await shell.run("cd nope#x"))).toEqual(["cd: no such page: nope"]);
    const loading = new Shell(
      fs,
      fakeHost(calls, { showingHref: "/" }),
      at("docs/python/overview"),
    );
    await loading.run("cd #lists");
    expect(calls.navigated.at(-1)).toBe("/python/overview/#lists");
  });

  it("opens links: out of the site in a new tab, into it by navigating", async () => {
    const out = await shell.run("open projects/repo");
    expect(calls.external).toEqual(["https://github.com/x/y"]);
    expect(plain(out)).toEqual(["opened https://github.com/x/y in a new tab"]);
    expect(shell.path).toBe("~");
    await shell.run("open projects/docs-site");
    expect(calls.navigated).toEqual(["/docs/"]);
    expect(shell.path).toBe("~/docs");
    expect(plain(await shell.run("open"))).toEqual(["open: which page? (open <path>)"]);
    expect(plain(await shell.run("cd nowhere"))).toEqual(["cd: no such page: nowhere"]);
  });

  it("goes to a page named alone, like zsh's AUTO_CD", async () => {
    await shell.run("docs");
    expect(shell.path).toBe("~/docs");
    expect(plain(await shell.run("frobnicate"))).toEqual([
      "frobnicate: command not found (try help)",
    ]);
    expect(plain(await shell.run("constructor"))).toEqual([
      "constructor: command not found (try help)",
    ]);
  });

  it("chains with ; and stops && at the first failure", async () => {
    expect(plain(await shell.run("nope && pwd; pwd"))).toEqual([
      "nope: command not found (try help)",
      "~  /",
    ]);
    expect(plain(await shell.run("pwd && pwd"))).toEqual(["~  /", "~  /"]);
    expect(plain(await shell.run("nope && pwd && pwd"))).toHaveLength(1);
    expect(plain(await shell.run(`cd "docs`))).toEqual(['sh: unterminated "']);
    expect(await shell.run(";;")).toEqual([]);
  });

  it("follows the page being read, ignoring pages not in the tree", () => {
    shell.syncTo("/python/overview/");
    expect(shell.path).toBe("~/docs/python/overview");
    shell.syncTo("/missing/");
    expect(shell.path).toBe("~/docs/python/overview");
    expect(shell.cwd.name).toBe("overview");
  });

  it("prints pwd, tree and find", async () => {
    await shell.run("cd docs/python");
    expect(plain(await shell.run("pwd"))).toEqual(["~/docs/python  /python/"]);
    expect(plain(await shell.run("tree"))).toEqual([
      "~/docs/python",
      "├── language/",
      "│   ├── strings",
      "│   └── oop",
      "├── overview",
      "└── fastapi",
      "5 pages",
    ]);
    expect(plain(await shell.run("tree -L 1 ~/docs/python/language"))).toEqual([
      "~/docs/python/language",
      "├── strings",
      "└── oop",
      "2 pages",
    ]);
    expect(plain(await shell.run("tree -L 0"))).toEqual(["tree: -L needs a whole number from 1"]);
    expect(plain(await shell.run("tree nope"))).toEqual(["tree: no such page: nope"]);
    expect(plain(await shell.run("tree ~/info"))).toEqual(["~/info", "0 pages"]);
    expect(plain(await shell.run("find python str"))).toEqual([
      "00. ~/docs/python/language/strings  Strings",
    ]);
    expect(plain(await shell.run("cd 0 && pwd"))).toEqual([
      "~/docs/python/language/strings  /python/language/strings/",
    ]);
    expect(plain(await shell.run("find"))).toEqual(["find: what? (find <words>)"]);
    expect(plain(await shell.run("find zzz"))).toEqual(["find: nothing matches zzz"]);
  });

  it("caps find's rows", async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      name: `p${i}`,
      title: `Page ${i}`,
      href: `/p${i}/`,
      kind: "page" as const,
    }));
    const big = new Shell(
      buildFs({ ...TREE, root: { ...TREE.root, children: many } }),
      fakeHost(calls),
    );
    const out = plain(await big.run("find page"));
    expect(out).toHaveLength(41);
    expect(out.at(-1)).toBe("… and 5 more");
  });

  it("greps the search index, numbering the hits", async () => {
    expect(plain(await shell.run("grep lists"))).toEqual([
      "00. ~/docs/python/overview  Overview",
      "01. /gone/  Gone",
    ]);
    await shell.run("grep lists; cd 1");
    expect(calls.navigated.at(-1)).toBe("/gone/");
    expect(plain(await shell.run("grep"))).toEqual(["grep: what? (grep <words>)"]);
    expect(plain(await shell.run("grep none"))).toEqual(["grep: no sheet mentions none"]);
    expect(plain(await shell.run("grep fail"))).toEqual(["grep: search index unavailable"]);
  });

  it("cats a page, marking headings", async () => {
    const out = await shell.run("cat docs/python/overview");
    expect(plain(out)).toEqual(["# Overview", "", "Some text."]);
    expect(out[0]?.[0]?.tone).toBe("strong");
    expect(plain(await shell.run("cat info"))).toEqual(["cat: could not load ~/info"]);
    expect(plain(await shell.run("cat nope"))).toEqual(["cat: no such page: nope"]);
    expect(plain(await shell.run("cat projects/repo"))).toEqual([
      "cat: repo is another site (open repo)",
    ]);
    expect(plain(await shell.run("toc projects/repo"))).toEqual(["toc: repo is another site"]);
    expect(plain(await shell.run("toc nope"))).toEqual(["toc: no such page: nope"]);
  });

  it("opens the Markdown pane: following cd, pinned to a page, or closed", async () => {
    await shell.run("cd docs/python/overview");
    expect(await shell.run("md")).toEqual([]);
    await shell.run("md ~/docs/python/overview; md -c");
    expect(calls.other).toEqual(["md follow", "md overview", "md close"]);
    expect(plain(await shell.run("md .."))).toEqual([
      "md: ~/docs/python has no Markdown (sheets, directories and posts do)",
    ]);
    expect(plain(await shell.run("md nope"))).toEqual(["md: no such page: nope"]);
    await shell.run("cd ~");
    expect(plain(await shell.run("md"))).toEqual([
      "md: ~ has no Markdown; the pane shows each sheet you cd to",
    ]);
    expect(calls.other.at(-1)).toBe("md follow");
  });

  it("drives the browser: back, forward, scroll, search, clear, max, exit", async () => {
    await shell.run("back; forward; scroll; scroll top; search; clear; exit");
    expect(calls.other).toEqual([
      "back",
      "forward",
      "scroll down",
      "scroll top",
      "search",
      "clear",
      "close",
    ]);
    expect(plain(await shell.run("scroll sideways"))).toEqual([
      "scroll: top, bottom, up or down, not sideways",
    ]);
    expect(plain(await shell.run("max"))).toEqual(["full screen"]);
  });

  it("switches the theme and zen mode", async () => {
    expect(plain(await shell.run("theme"))).toEqual(["theme: dark"]);
    expect(plain(await shell.run("theme light"))).toEqual(["theme: light"]);
    expect(plain(await shell.run("theme blue"))).toEqual(["theme: light or dark, not blue"]);
    expect(plain(await shell.run("zen"))).toEqual(["zen: on"]);
    expect(plain(await shell.run("zen off"))).toEqual(["zen: off"]);
    expect(plain(await shell.run("zen maybe"))).toEqual(["zen: on or off, not maybe"]);
    const noZen = new Shell(fs, fakeHost(calls, { zen: () => null }));
    expect(plain(await noZen.run("zen"))).toEqual(["zen: only on sheets and posts"]);
  });

  it("prints help, whoami and history", async () => {
    const help = plain(await shell.run("help"));
    expect(help[0]).toContain("Every page of the site is a path");
    expect(help.some((line) => line.startsWith("cd [path | #heading | -]"))).toBe(true);
    expect(plain(await shell.run("help ls"))).toEqual([
      "ls [-l] [path]",
      "  list a directory; on a page, its sections (-l adds dates)",
    ]);
    expect(plain(await shell.run("help nope"))).toEqual(["help: no such command: nope"]);
    expect(plain(await shell.run("whoami"))).toEqual(["Z Z · Engineer", "Hi", "GitHub"]);
    expect(plain(await shell.run("history"))).toEqual(["   1  ls", "   2  cd docs"]);
    expect(shell.commandNames).toContain("grep");
  });
});
