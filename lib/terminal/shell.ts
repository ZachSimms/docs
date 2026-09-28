/**
 * @file The terminal's shell: parses a command line and runs the commands against the
 * site tree, through a {@link Host} that does everything touching the page.
 *
 * Client-safe and free of React: the terminal component supplies the host (router,
 * DOM, theme, fetch), and tests supply a fake one. Output is data (lines of
 * {@link Segment}s, some of them links), so the component renders it in the site's
 * own idiom and it can be kept in `sessionStorage` across reloads.
 *
 * A line holds commands separated by `;` (run each) or `&&` (stop at the first that
 * fails). Words may be quoted with `'…'` or `"…"`, or escaped with `\`. A first word
 * that is not a command but names a page goes there, like zsh's `AUTO_CD`.
 */

import type { Theme } from "../theme";
import type { Heading } from "./page-text";
import {
  displayName,
  isDir,
  isExternal,
  nodeForHref,
  pathOf,
  resolvePath,
  type Fs,
  type FsNode,
} from "./vfs";

/** How a piece of output is styled. */
export type Tone = "dim" | "error" | "strong";

/** A run of output text; with `href`, a link. */
export interface Segment {
  readonly text: string;
  readonly href?: string;
  readonly tone?: Tone;
}

/** One line of output. */
export type OutputLine = readonly Segment[];

/** A page `cd`/`open` can go to by its number in the last numbered listing. */
interface Target {
  readonly href: string;
  /** Set when the target is a node of the tree. */
  readonly node?: FsNode;
  /** A heading on `node`'s page, without `#`. */
  readonly anchor?: string;
}

/** Where `scroll` moves the page. */
export type ScrollTo = "top" | "bottom" | "up" | "down";

/**
 * What the Markdown pane shows: the source of whatever page the shell is on (`follow`,
 * so it changes with every `cd`), or one page's, pinned.
 */
export type SourceView =
  { readonly follow: true } | { readonly follow: false; readonly node: FsNode };

/** A result of the full-text search that `grep` prints. */
export interface SearchResult {
  readonly url: string;
  readonly title: string;
}

/** Everything the shell does outside itself. */
export interface Host {
  /** Go to a page of the site (client-side navigation). */
  navigate(href: string): void;
  /** Open a URL of another site in a new tab. */
  openExternal(href: string): void;
  back(): void;
  forward(): void;
  /** Whether `node`'s page is the one on screen (a `cd` may still be loading it). */
  showing(node: FsNode): boolean;
  /** The headings of `node`'s page: read from the page when it is showing, else fetched. */
  headings(node: FsNode): Promise<Heading[] | null>;
  /** The text of `node`'s page, or `null` when it could not be loaded. */
  pageText(node: FsNode): Promise<string[] | null>;
  /** Scroll the page being read to a heading; `false` when it has no such id. */
  scrollToHeading(id: string): boolean;
  scroll(to: ScrollTo): void;
  theme(): Theme;
  setTheme(theme: Theme): void;
  /** Zen mode, or `null` on pages that do not offer it. */
  zen(): boolean | null;
  setZen(on: boolean): void;
  /** Full-text search over every sheet. */
  search(query: string): Promise<SearchResult[]>;
  /** Open the ⌘K palette. */
  openSearch(): void;
  /** Show a page's Markdown source in the pane beside the page, or close it (`null`). */
  showSource(view: SourceView | null): void;
  /** Commands entered so far, oldest first. */
  history(): readonly string[];
  clear(): void;
  close(): void;
  /** Toggle between docked and full screen; returns whether it is now full screen. */
  toggleMax(): boolean;
}

/** What running a command gives back. */
interface Result {
  readonly lines: OutputLine[];
  /** `false` stops a `&&` chain. */
  readonly ok: boolean;
}

/** A command the shell knows. */
interface Command {
  /** `name args`, as `help` prints it. */
  readonly usage: string;
  readonly summary: string;
  run(args: string[]): Result | Promise<Result>;
}

/** Most rows `find` prints. */
const FIND_LIMIT = 40;
/** Most results `grep` asks the search index for. */
const GREP_LIMIT = 20;
/** How deep `tree` goes without `-L`. */
const TREE_DEPTH = 2;
/** Widest name column in a listing, so a long slug cannot push titles off screen. */
const NAME_COLUMN = 30;

/** Plain text. */
function text(value: string, tone?: Tone): Segment {
  return tone ? { text: value, tone } : { text: value };
}

/** A single-segment line. */
function line(value: string, tone?: Tone): OutputLine {
  return [text(value, tone)];
}

/** A failed command's message. */
function fail(message: string): Result {
  return { lines: [line(message, "error")], ok: false };
}

/** A successful command's lines. */
function ok(lines: OutputLine[] = []): Result {
  return { lines, ok: true };
}

/** `00.`, as the site numbers its lists. */
function number(n: number): Segment {
  return text(`${String(n).padStart(2, "0")}. `, "dim");
}

/** A link to a node, labeled with `label`. */
function nodeLink(node: FsNode, label: string): Segment {
  return { text: label, href: node.href };
}

/** One piece of a command line: a word, or a `;` / `&&` separator. */
type Token = { readonly word: string } | { readonly op: ";" | "&&" };

/**
 * Split a command line into words and separators.
 *
 * @example
 * tokenize(`cd "a b" && ls`); // [{word:"cd"},{word:"a b"},{op:"&&"},{word:"ls"}]
 * @throws {Error} On an unterminated quote.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let word = "";
  let inWord = false;
  const end = () => {
    if (inWord) tokens.push({ word });
    word = "";
    inWord = false;
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i] as string;
    if (c === "'" || c === '"') {
      const close = input.indexOf(c, i + 1);
      if (close === -1) throw new Error(`unterminated ${c}`);
      word += input.slice(i + 1, close);
      inWord = true;
      i = close;
    } else if (c === "\\" && i + 1 < input.length) {
      word += input[++i];
      inWord = true;
    } else if (c === ";") {
      end();
      tokens.push({ op: ";" });
    } else if (c === "&" && input[i + 1] === "&") {
      end();
      tokens.push({ op: "&&" });
      i++;
    } else if (/\s/.test(c)) {
      end();
    } else {
      word += c;
      inWord = true;
    }
  }
  end();
  return tokens;
}

/** Split `args` into flags (`-l`, `-L 3`) and the rest. */
function parseFlags(
  args: readonly string[],
  withValue: readonly string[] = [],
): { flags: Map<string, string>; rest: string[] } {
  const flags = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (/^-[a-zA-Z]+$/.test(arg)) {
      for (const flag of arg.slice(1)) {
        flags.set(flag, withValue.includes(flag) ? (args[++i] ?? "") : "");
      }
    } else rest.push(arg);
  }
  return { flags, rest };
}

/** `table[name]` when it is the table's own entry (so `constructor` is not a command). */
function own(table: Record<string, Command>, name: string): Command | undefined {
  return Object.prototype.hasOwnProperty.call(table, name) ? table[name] : undefined;
}

/** Every node below `node`, depth first, in display order. */
function descendants(node: FsNode): FsNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

/**
 * The shell: its state (current directory, previous directory, last numbered listing)
 * and its commands. One instance lives as long as the terminal.
 */
export class Shell {
  /** The node of the page being read, or of the page `cd` just went to. */
  private cwdNode: FsNode;
  /** Where `cd -` goes. */
  private previous: FsNode | null = null;
  /** The numbered rows the previous command printed, for `cd 3`. */
  private listed: Target[] = [];
  /** The numbered rows the running command prints; becomes {@link Shell.listed} after it. */
  private listing: Target[] = [];

  /** The command table; see {@link Shell.commandNames}. */
  private readonly commands: Record<string, Command>;

  /**
   * @param fs - The indexed tree.
   * @param host - Everything outside the shell.
   * @param cwd - Where it starts: the page being read.
   * @param onMove - Called whenever the current directory changes (the prompt follows it).
   */
  constructor(
    private readonly fs: Fs,
    private readonly host: Host,
    cwd: FsNode = fs.root,
    private readonly onMove: (node: FsNode) => void = () => {},
  ) {
    this.cwdNode = cwd;
    this.commands = this.table();
  }

  /** The current directory (a page, while one is being read). */
  get cwd(): FsNode {
    return this.cwdNode;
  }

  /** The prompt's path: `~/docs/python`. */
  get path(): string {
    return pathOf(this.cwdNode);
  }

  /** Every command name, alphabetical, for completion and `help`. */
  get commandNames(): string[] {
    return Object.keys(this.commands).sort();
  }

  /**
   * Follow the page being read: called when the reader navigates without the shell
   * (a click, `Esc`, the back button). Pages not in the tree (404) leave it as it is.
   */
  syncTo(pathname: string): void {
    const node = nodeForHref(this.fs, pathname);
    if (node && node !== this.cwdNode) this.moveTo(node);
  }

  /** Make `node` the current directory, remembering the old one for `cd -`. */
  private moveTo(node: FsNode): void {
    if (node === this.cwdNode) return;
    this.previous = this.cwdNode;
    this.cwdNode = node;
    this.onMove(node);
  }

  /**
   * Run one line of input.
   *
   * @returns The lines to print; empty for commands that only act (`cd`).
   */
  async run(input: string): Promise<OutputLine[]> {
    let tokens: Token[];
    try {
      tokens = tokenize(input);
    } catch (error) {
      return [line(`sh: ${(error as Error).message}`, "error")];
    }
    const out: OutputLine[] = [];
    let words: string[] = [];
    let skip = false;
    const flush = async (): Promise<boolean> => {
      const [name, ...args] = words;
      words = [];
      if (name === undefined) return true;
      const result = await this.exec(name, args);
      out.push(...result.lines);
      return result.ok;
    };
    for (const token of tokens) {
      if ("word" in token) {
        words.push(token.word);
        continue;
      }
      let succeeded = false;
      if (skip) words = [];
      else succeeded = await flush();
      skip = token.op === "&&" && !succeeded;
    }
    if (!skip) await flush();
    return out;
  }

  /** Run one command, or go to the page its name resolves to. */
  private async exec(name: string, args: string[]): Promise<Result> {
    this.listing = [];
    try {
      const command = own(this.commands, name);
      if (command) return await command.run(args);
      if (args.length === 0 && (resolvePath(this.fs, this.cwdNode, name) || name.includes("#"))) {
        return this.go(name, "cd");
      }
      return fail(`${name}: command not found (try help)`);
    } finally {
      // A number refers to the rows just printed, never to an older listing.
      this.listed = this.listing;
    }
  }

  /** Resolve an argument to a node, as `cd`, `ls`, `cat` and `toc` take them. */
  private resolve(arg: string): FsNode | undefined {
    return resolvePath(this.fs, this.cwdNode, arg);
  }

  /**
   * Go somewhere: a path, `path#heading`, `#heading` on this page, `-`, or the number
   * of a row in the last numbered listing.
   */
  private go(arg: string, command: string): Result {
    if (arg === "-") {
      if (!this.previous) return fail(`${command}: no previous page`);
      return this.visit(this.previous);
    }
    if (/^\d+$/.test(arg) && this.listed[Number(arg)]) {
      const target = this.listed[Number(arg)] as Target;
      if (target.anchor !== undefined && target.node === this.cwdNode) {
        return this.jump(target.anchor, command, target.node);
      }
      if (target.node) return this.visit(target.node, target.anchor);
      this.host.navigate(target.href);
      return ok();
    }
    const hash = arg.indexOf("#");
    if (hash !== -1) {
      const anchor = arg.slice(hash + 1);
      const path = arg.slice(0, hash);
      if (path === "") return this.jump(anchor, command, this.cwdNode);
      const node = this.resolve(path);
      if (!node) return fail(`${command}: no such page: ${path}`);
      return node === this.cwdNode ? this.jump(anchor, command, node) : this.visit(node, anchor);
    }
    const node = this.resolve(arg);
    if (!node) return fail(`${command}: no such page: ${arg}`);
    return this.visit(node);
  }

  /**
   * Scroll to a heading of `node`, the current page. If a `cd` is still loading it, go
   * there with the `#heading` instead, and the page opens at it.
   */
  private jump(anchor: string, command: string, node: FsNode): Result {
    if (!this.host.showing(node)) {
      this.host.navigate(`${node.href}#${anchor}`);
      return ok();
    }
    if (this.host.scrollToHeading(anchor)) return ok();
    return fail(`${command}: no heading #${anchor} on this page (try toc)`);
  }

  /** Open a node's page; a link out opens in a new tab and leaves the shell where it is. */
  private visit(node: FsNode, anchor?: string): Result {
    if (isExternal(node.href)) {
      this.host.openExternal(node.href);
      return ok([
        [text("opened "), { text: node.href, href: node.href }, text(" in a new tab", "dim")],
      ]);
    }
    const target = node.kind === "link" ? nodeForHref(this.fs, node.href) : node;
    if (target) this.moveTo(target);
    this.host.navigate(anchor ? `${node.href}#${anchor}` : node.href);
    return ok();
  }

  /** A directory's rows: `00. name/  Title`, names linked; with `long`, dates too. */
  private listDir(dir: FsNode, long: boolean): OutputLine[] {
    if (dir.children.length === 0) return [line("(empty)", "dim")];
    const width = Math.min(
      NAME_COLUMN,
      Math.max(...dir.children.map((node) => displayName(node).length)) + 2,
    );
    this.listing = dir.children.map((node) => ({ href: node.href, node }));
    return dir.children.map((node, i) => {
      const name = displayName(node);
      const pad = " ".repeat(Math.max(2, width - name.length));
      const date = long ? [text(`${(node.date ?? "").padEnd(10)}  `, "dim")] : [];
      const extra = node.kind === "link" ? ` → ${node.href}` : "";
      return [number(i), ...date, nodeLink(node, name), text(`${pad}${node.title}${extra}`, "dim")];
    });
  }

  /** A page's headings as numbered rows, `###` indented under `##`. */
  private async listHeadings(node: FsNode, command: string): Promise<Result> {
    const headings = await this.host.headings(node);
    if (headings === null) return fail(`${command}: could not load ${pathOf(node)}`);
    if (headings.length === 0) {
      return ok([[nodeLink(node, node.name || "~"), text(`  ${node.title} (no sections)`, "dim")]]);
    }
    const top = Math.min(...headings.map((h) => h.level));
    this.listing = headings.map((h) => ({ href: `${node.href}#${h.id}`, node, anchor: h.id }));
    return ok(
      headings.map((h, i) => [
        number(i),
        text("  ".repeat(h.level - top)),
        { text: h.text, href: `${node.href}#${h.id}` },
        text(`  #${h.id}`, "dim"),
      ]),
    );
  }

  /** `tree`'s lines below `node`, down to `depth` levels. */
  private treeLines(node: FsNode, depth: number, indent = ""): OutputLine[] {
    if (depth === 0) return [];
    return node.children.flatMap((child, i) => {
      const last = i === node.children.length - 1;
      return [
        [text(`${indent}${last ? "└── " : "├── "}`, "dim"), nodeLink(child, displayName(child))],
        ...this.treeLines(child, depth - 1, `${indent}${last ? "    " : "│   "}`),
      ];
    });
  }

  /** The commands, bound to this shell. */
  private table(): Record<string, Command> {
    const host = this.host;
    const commands: Record<string, Command> = {
      help: {
        usage: "help [command]",
        summary: "list the commands, or explain one",
        run: ([name]) => {
          if (name !== undefined) {
            const command = own(commands, name);
            if (!command) return fail(`help: no such command: ${name}`);
            return ok([line(command.usage, "strong"), line(`  ${command.summary}`)]);
          }
          const width = Math.max(...Object.values(commands).map((c) => c.usage.length)) + 2;
          return ok([
            line("Every page of the site is a path: ~ is home, ~/docs/python a topic.", "dim"),
            line("Tab completes, ↑↓ recall, a page's name alone goes there, esc hides.", "dim"),
            [],
            ...this.commandNames.map((key) => {
              const command = commands[key] as Command;
              return [text(command.usage.padEnd(width), "strong"), text(command.summary)];
            }),
          ]);
        },
      },
      ls: {
        usage: "ls [-l] [path]",
        summary: "list a directory; on a page, its sections (-l adds dates)",
        run: async (args) => {
          const { flags, rest } = parseFlags(args);
          const node = rest[0] === undefined ? this.cwdNode : this.resolve(rest[0]);
          if (!node) return fail(`ls: no such page: ${rest[0]}`);
          if (isDir(node)) return ok(this.listDir(node, flags.has("l")));
          if (node.kind === "link")
            return ok([[nodeLink(node, node.name), text(` → ${node.href}`, "dim")]]);
          return this.listHeadings(node, "ls");
        },
      },
      cd: {
        usage: "cd [path | #heading | -]",
        summary: "go to a page (no path: home; -: the last one; a number: that row)",
        run: ([arg]) => (arg === undefined ? this.visit(this.fs.root) : this.go(arg, "cd")),
      },
      open: {
        usage: "open <path | number>",
        summary: "same as cd; links out open in a new tab",
        run: ([arg]) =>
          arg === undefined ? fail("open: which page? (open <path>)") : this.go(arg, "open"),
      },
      pwd: {
        usage: "pwd",
        summary: "where you are, and its URL",
        run: () => ok([[text(pathOf(this.cwdNode)), text(`  ${this.cwdNode.href}`, "dim")]]),
      },
      tree: {
        usage: "tree [-L depth] [path]",
        summary: `the pages below a directory (${TREE_DEPTH} levels unless -L)`,
        run: (args) => {
          const { flags, rest } = parseFlags(args, ["L"]);
          const depth = flags.has("L") ? Number(flags.get("L")) : TREE_DEPTH;
          if (!Number.isInteger(depth) || depth < 1)
            return fail("tree: -L needs a whole number from 1");
          const node = rest[0] === undefined ? this.cwdNode : this.resolve(rest[0]);
          if (!node) return fail(`tree: no such page: ${rest[0]}`);
          const below = this.treeLines(node, depth);
          const shown = below.length;
          return ok([
            [nodeLink(node, pathOf(node))],
            ...below,
            line(`${shown} ${shown === 1 ? "page" : "pages"}`, "dim"),
          ]);
        },
      },
      find: {
        usage: "find <words>",
        summary: "pages whose name or title has every word",
        run: (args) => {
          const words = args.map((word) => word.toLowerCase());
          if (words.length === 0) return fail("find: what? (find <words>)");
          const hits = descendants(this.fs.root).filter((node) => {
            const haystack = `${pathOf(node)} ${node.title}`.toLowerCase();
            return words.every((word) => haystack.includes(word));
          });
          if (hits.length === 0) return fail(`find: nothing matches ${args.join(" ")}`);
          const shown = hits.slice(0, FIND_LIMIT);
          this.listing = shown.map((node) => ({ href: node.href, node }));
          return ok([
            ...shown.map((node, i) => [
              number(i),
              nodeLink(node, pathOf(node)),
              text(`  ${node.title}`, "dim"),
            ]),
            ...(hits.length > shown.length
              ? [line(`… and ${hits.length - shown.length} more`, "dim")]
              : []),
          ]);
        },
      },
      grep: {
        usage: "grep <words>",
        summary: "search the text of every sheet, best match first",
        run: async (args) => {
          const query = args.join(" ").trim();
          if (query === "") return fail("grep: what? (grep <words>)");
          let results: SearchResult[];
          try {
            results = (await host.search(query)).slice(0, GREP_LIMIT);
          } catch {
            return fail("grep: search index unavailable");
          }
          if (results.length === 0) return fail(`grep: no sheet mentions ${query}`);
          this.listing = results.map((result) => {
            const node = nodeForHref(this.fs, result.url);
            return node ? { href: result.url, node } : { href: result.url };
          });
          return ok(
            results.map((result, i) => {
              const node = nodeForHref(this.fs, result.url);
              const label = node ? pathOf(node) : result.url;
              return [
                number(i),
                { text: label, href: result.url },
                text(`  ${result.title}`, "dim"),
              ];
            }),
          );
        },
      },
      cat: {
        usage: "cat [path]",
        summary: "print a page as text",
        run: async ([arg]) => {
          const node = arg === undefined ? this.cwdNode : this.resolve(arg);
          if (!node) return fail(`cat: no such page: ${arg}`);
          if (isExternal(node.href))
            return fail(`cat: ${node.name} is another site (open ${node.name})`);
          const lines = await host.pageText(node);
          if (lines === null) return fail(`cat: could not load ${pathOf(node)}`);
          return ok(
            lines.map((value) => line(value, value.startsWith("#") ? "strong" : undefined)),
          );
        },
      },
      toc: {
        usage: "toc [path]",
        summary: "a page's sections; cd #section (or its number) jumps there",
        run: async ([arg]) => {
          const node = arg === undefined ? this.cwdNode : this.resolve(arg);
          if (!node) return fail(`toc: no such page: ${arg}`);
          if (isExternal(node.href)) return fail(`toc: ${node.name} is another site`);
          return this.listHeadings(node, "toc");
        },
      },
      back: {
        usage: "back",
        summary: "the browser's back button",
        run: () => (host.back(), ok()),
      },
      forward: {
        usage: "forward",
        summary: "the browser's forward button",
        run: () => (host.forward(), ok()),
      },
      scroll: {
        usage: "scroll [top | bottom | up | down]",
        summary: "scroll the page (down a screen without an argument)",
        run: ([to = "down"]) => {
          if (!["top", "bottom", "up", "down"].includes(to))
            return fail(`scroll: top, bottom, up or down, not ${to}`);
          host.scroll(to as ScrollTo);
          return ok();
        },
      },
      theme: {
        usage: "theme [light | dark]",
        summary: "switch the theme, or set one",
        run: ([theme]) => {
          if (theme !== undefined && theme !== "light" && theme !== "dark") {
            return fail(`theme: light or dark, not ${theme}`);
          }
          const next = theme ?? (host.theme() === "dark" ? "light" : "dark");
          host.setTheme(next);
          return ok([line(`theme: ${next}`, "dim")]);
        },
      },
      zen: {
        usage: "zen [on | off]",
        summary: "zen mode on sheets and posts: only the page and its contents",
        run: ([state]) => {
          const current = host.zen();
          if (current === null) return fail("zen: only on sheets and posts");
          if (state !== undefined && state !== "on" && state !== "off")
            return fail(`zen: on or off, not ${state}`);
          const on = state === undefined ? !current : state === "on";
          host.setZen(on);
          return ok([line(`zen: ${on ? "on" : "off"}`, "dim")]);
        },
      },
      md: {
        usage: "md [-c] [path]",
        summary:
          "the page's Markdown in a pane beside it, following each cd (a path pins one; -c closes)",
        run: (args) => {
          const { flags, rest } = parseFlags(args);
          if (flags.has("c")) {
            host.showSource(null);
            return ok();
          }
          if (rest[0] === undefined) {
            host.showSource({ follow: true });
            return this.cwdNode.source
              ? ok()
              : ok([
                  line(
                    `md: ${pathOf(this.cwdNode)} has no Markdown; the pane shows each sheet you cd to`,
                    "dim",
                  ),
                ]);
          }
          const node = this.resolve(rest[0]);
          if (!node) return fail(`md: no such page: ${rest[0]}`);
          if (!node.source) {
            return fail(`md: ${pathOf(node)} has no Markdown (sheets, directories and posts do)`);
          }
          host.showSource({ follow: false, node });
          return ok();
        },
      },
      search: {
        usage: "search",
        summary: "open the ⌘K search palette",
        run: () => (host.openSearch(), ok()),
      },
      whoami: {
        usage: "whoami",
        summary: "who the site is about",
        run: () => {
          const { fullName, role, bio, links } = this.fs.profile;
          return ok([
            [text(fullName, "strong"), text(` · ${role}`, "dim")],
            line(bio),
            links.flatMap((link, i) => [
              ...(i > 0 ? [text("  ")] : []),
              { text: link.label, href: link.href },
            ]),
          ]);
        },
      },
      history: {
        usage: "history",
        summary: "the commands entered so far",
        run: () => {
          const entries = host.history();
          return ok(
            entries.map((entry, i) => [text(`${String(i + 1).padStart(4)}  `, "dim"), text(entry)]),
          );
        },
      },
      clear: {
        usage: "clear",
        summary: "clear the screen (ctrl+l)",
        run: () => (host.clear(), ok()),
      },
      max: {
        usage: "max",
        summary: "toggle full screen",
        run: () => ok([line(host.toggleMax() ? "full screen" : "docked", "dim")]),
      },
      exit: {
        usage: "exit",
        summary: "hide the terminal (esc); ` brings it back",
        run: () => (host.close(), ok()),
      },
    };
    return commands;
  }
}
