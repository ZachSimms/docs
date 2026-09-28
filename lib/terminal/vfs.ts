/**
 * @file The terminal's filesystem: the site tree from `/site-tree.json`, and path
 * resolution, listing and tab completion over it.
 *
 * Client-safe and pure (no DOM, no Node APIs), so every rule here is unit-tested
 * without mounting the terminal. The tree itself is built at build time by
 * `lib/terminal/tree.ts`.
 *
 * Paths read like a shell's: `~` (or `/`) is home, `..` goes up a level, `.` stays.
 * A segment matches a node's name, then its title (ignoring case), then its number in
 * the listing (`ls` prints `00.`, `01.` …), so `cd docs/python/0` works as well as the
 * full name. An absolute path that is not in the tree is tried as a URL of the site,
 * so `cd /python/overview/` works too.
 *
 * Every page is a node, so the current directory can be a page (the one being read);
 * `..` from it goes to its parent, as the site's `../` does, and names typed there
 * also match its siblings.
 */

/** What a node is: a listing page with children, a single page, or a link out (a project). */
export type NodeKind = "dir" | "page" | "link";

/** One node as stored in `/site-tree.json`. */
export interface TreeNode {
  /** Path segment: the URL slug, or the section key at the top level; `""` for home. */
  readonly name: string;
  /** Human-readable title, as the site lists it. */
  readonly title: string;
  /** Where the node lives: a path of this site with its trailing slash, or an external URL. */
  readonly href: string;
  readonly kind: NodeKind;
  /** `YYYY-MM-DD` for sheets and posts, a year for projects. */
  readonly date?: string;
  /** A description (projects) or a summary (posts). */
  readonly note?: string;
  /** In display order; present on every `dir`. */
  readonly children?: readonly TreeNode[];
}

/** A link printed by `whoami`. */
export interface ProfileLink {
  readonly label: string;
  readonly href: string;
}

/** The whole of `/site-tree.json`. */
export interface SiteTree {
  readonly root: TreeNode;
  readonly profile: {
    readonly name: string;
    readonly fullName: string;
    readonly role: string;
    readonly bio: string;
    readonly links: readonly ProfileLink[];
  };
}

/** A node linked to its parent, as the shell walks the tree. */
export interface FsNode {
  readonly name: string;
  readonly title: string;
  readonly href: string;
  readonly kind: NodeKind;
  readonly date?: string;
  readonly note?: string;
  /** `null` for home. */
  readonly parent: FsNode | null;
  /** Empty for pages and links. */
  readonly children: readonly FsNode[];
}

/** The tree ready for lookups. */
export interface Fs {
  readonly root: FsNode;
  readonly profile: SiteTree["profile"];
  /** Internal hrefs (`/python/overview/`) to their node; links out are not in it. */
  readonly byHref: ReadonlyMap<string, FsNode>;
}

/** Matches absolute (`https://…`), protocol-relative (`//…`) and `mailto:` URLs. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Whether an href leaves the site (and so opens in a new tab). */
export function isExternal(href: string): boolean {
  return EXTERNAL.test(href);
}

/** The node kinds `/site-tree.json` may contain. */
const KINDS: readonly string[] = ["dir", "page", "link"];

/** Whether `value` is a {@link TreeNode}, children included. */
function isTreeNode(value: unknown): value is TreeNode {
  if (typeof value !== "object" || value === null) return false;
  const node = value as Record<string, unknown>;
  return (
    typeof node.name === "string" &&
    typeof node.title === "string" &&
    typeof node.href === "string" &&
    KINDS.includes(node.kind as string) &&
    (node.date === undefined || typeof node.date === "string") &&
    (node.note === undefined || typeof node.note === "string") &&
    (node.children === undefined ||
      (Array.isArray(node.children) && node.children.every(isTreeNode)))
  );
}

/**
 * Whether `value` is a valid {@link SiteTree}: the site's own file, but still a
 * boundary. Hand-written for the same reason as `isSearchIndex` (no zod on the client).
 */
export function isSiteTree(value: unknown): value is SiteTree {
  if (typeof value !== "object" || value === null) return false;
  const { root, profile } = value as Record<string, unknown>;
  if (!isTreeNode(root) || typeof profile !== "object" || profile === null) return false;
  const p = profile as Record<string, unknown>;
  return (
    ["name", "fullName", "role", "bio"].every((key) => typeof p[key] === "string") &&
    Array.isArray(p.links) &&
    p.links.every(
      (link: unknown) =>
        typeof link === "object" &&
        link !== null &&
        typeof (link as ProfileLink).label === "string" &&
        typeof (link as ProfileLink).href === "string",
    )
  );
}

/**
 * Link every node to its parent and index the site's own pages by href.
 *
 * When two nodes share an href the first one in tree order keeps it, so a page
 * reached from a section (`~/playground`) wins over a project pointing at it.
 */
export function buildFs(tree: SiteTree): Fs {
  const byHref = new Map<string, FsNode>();
  const link = (node: TreeNode, parent: FsNode | null): FsNode => {
    const children: FsNode[] = [];
    const fsNode: FsNode = {
      name: node.name,
      title: node.title,
      href: node.href,
      kind: node.kind,
      ...(node.date === undefined ? {} : { date: node.date }),
      ...(node.note === undefined ? {} : { note: node.note }),
      parent,
      children,
    };
    if (node.kind !== "link" && !isExternal(node.href) && !byHref.has(node.href)) {
      byHref.set(node.href, fsNode);
    }
    for (const child of node.children ?? []) children.push(link(child, fsNode));
    return fsNode;
  };
  return { root: link(tree.root, null), profile: tree.profile, byHref };
}

/** Whether a node lists other nodes (`cd` into it, `ls` shows them). */
export function isDir(node: FsNode): boolean {
  return node.kind === "dir";
}

/**
 * A node's path from home: `~`, `~/docs`, `~/docs/python/overview`.
 *
 * @param node - Any node of the tree.
 */
export function pathOf(node: FsNode): string {
  const names: string[] = [];
  for (let at: FsNode | null = node; at?.parent; at = at.parent) names.unshift(at.name);
  return names.length === 0 ? "~" : `~/${names.join("/")}`;
}

/**
 * The name a listing shows for a node: directories end in `/`, as `ls -F` prints them.
 */
export function displayName(node: FsNode): string {
  return isDir(node) ? `${node.name}/` : node.name;
}

/**
 * A pathname of the site with its trailing slash and without a query or hash, as
 * the tree stores hrefs: `/python/overview` and `/python/overview/#lists` both give
 * `/python/overview/`.
 */
export function normalizeHref(pathname: string): string {
  const bare = pathname.replace(/[?#].*$/, "");
  return bare.endsWith("/") ? bare : `${bare}/`;
}

/**
 * The node of a page of the site.
 *
 * @param fs - The indexed tree.
 * @param pathname - E.g. `location.pathname`.
 * @returns The node, or `undefined` for a page the tree does not know (the 404 page).
 */
export function nodeForHref(fs: Fs, pathname: string): FsNode | undefined {
  return fs.byHref.get(normalizeHref(pathname));
}

/** One step down from `dir`: by name, then title (case-insensitive), then listing number. */
function child(dir: FsNode, segment: string): FsNode | undefined {
  const lower = segment.toLowerCase();
  return (
    dir.children.find((node) => node.name === segment) ??
    dir.children.find((node) => node.name.toLowerCase() === lower) ??
    dir.children.find((node) => node.title.toLowerCase() === lower) ??
    (/^\d+$/.test(segment) ? dir.children[Number(segment)] : undefined)
  );
}

/**
 * Resolve a path typed at the prompt.
 *
 * @param fs - The indexed tree.
 * @param cwd - The directory relative paths start from.
 * @param path - `~`, `/…`, `~/…`, `..`, `docs/python`, `3`, or a URL of the site.
 * @returns The node, or `undefined` if nothing matches. `..` at home stays home. A
 *   segment below a page or link matches nothing.
 */
export function resolvePath(fs: Fs, cwd: FsNode, path: string): FsNode | undefined {
  const absolute = path.startsWith("/") || path === "~" || path.startsWith("~/");
  const rest = absolute ? path.replace(/^~?\/?/, "") : path;
  let at: FsNode | undefined = absolute ? fs.root : cwd;
  for (const segment of rest.split("/")) {
    if (!at) break;
    if (segment === "" || segment === ".") continue;
    at = segment === ".." ? (at.parent ?? at) : child(at, segment);
  }
  if (at) return at;
  // `/python/overview/` is the page's URL rather than its path in the tree.
  if (path.startsWith("/")) return nodeForHref(fs, path);
  // Reading a page, a sibling is one step away: `cd other-sheet` as well as `cd ../other-sheet`.
  return !absolute && !isDir(cwd) && cwd.parent ? resolvePath(fs, cwd.parent, path) : undefined;
}

/** A tab completion: the new input, and the choices to print when it is ambiguous. */
export interface Completion {
  /** The input after completing; unchanged when there was nothing to add. */
  readonly line: string;
  /** More than one match: what to print below the prompt. Empty otherwise. */
  readonly choices: readonly string[];
}

/** The longest prefix shared by every string, compared case-insensitively. */
export function commonPrefix(words: readonly string[]): string {
  if (words.length === 0) return "";
  let prefix = words[0] ?? "";
  for (const word of words.slice(1)) {
    let i = 0;
    while (
      i < prefix.length &&
      i < word.length &&
      prefix[i]?.toLowerCase() === word[i]?.toLowerCase()
    )
      i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

/**
 * Complete the last word of `line`, as Tab does in a shell.
 *
 * The first word completes against `commands`; later words against paths (names in
 * the directory typed so far, or beside the page being read; `/` added after a
 * directory) or, when the word starts
 * with `#`, against `anchors` (the headings of the page being read).
 *
 * @param fs - The indexed tree.
 * @param cwd - The current directory.
 * @param line - The whole input.
 * @param commands - Command names.
 * @param anchors - Heading ids of the current page, without `#`.
 */
export function complete(
  fs: Fs,
  cwd: FsNode,
  line: string,
  commands: readonly string[],
  anchors: readonly string[] = [],
): Completion {
  const start = line.search(/\S+$/);
  const word = start === -1 ? "" : line.slice(start);
  const head = start === -1 ? line : line.slice(0, start);
  const unchanged = { line, choices: [] };

  // The first word is a command.
  if (head.trim() === "") {
    const matches = commands.filter((name) => name.startsWith(word));
    if (matches.length === 1) return { line: `${head}${matches[0]} `, choices: [] };
    const prefix = commonPrefix(matches);
    return prefix.length > word.length
      ? { line: `${head}${prefix}`, choices: [] }
      : { line, choices: matches.length > 1 ? matches : [] };
  }

  // `#heading` on the current page.
  if (word.startsWith("#")) {
    const typed = word.slice(1).toLowerCase();
    const matches = anchors.filter((id) => id.toLowerCase().startsWith(typed));
    if (matches.length === 1) return { line: `${head}#${matches[0]} `, choices: [] };
    const prefix = commonPrefix(matches);
    return prefix.length > typed.length
      ? { line: `${head}#${prefix}`, choices: [] }
      : { line, choices: matches.length > 1 ? matches.map((id) => `#${id}`) : [] };
  }

  const slash = word.lastIndexOf("/");
  const dirPart = slash === -1 ? "" : word.slice(0, slash + 1);
  const typed = slash === -1 ? word : word.slice(slash + 1);
  const base = isDir(cwd) ? cwd : (cwd.parent ?? cwd);
  const dir = dirPart === "" ? base : resolvePath(fs, cwd, dirPart);
  if (!dir || !isDir(dir)) return unchanged;
  const lower = typed.toLowerCase();
  const matches = dir.children.filter((node) => node.name.toLowerCase().startsWith(lower));
  const only = matches.length === 1 ? matches[0] : undefined;
  if (only) {
    return { line: `${head}${dirPart}${only.name}${isDir(only) ? "/" : " "}`, choices: [] };
  }
  const prefix = commonPrefix(matches.map((node) => node.name));
  if (prefix.length > typed.length) return { line: `${head}${dirPart}${prefix}`, choices: [] };
  return { line, choices: matches.length > 1 ? matches.map(displayName) : [] };
}
