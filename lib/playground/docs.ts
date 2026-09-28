/**
 * @file Official docs in the reference panel, from DevDocs.
 *
 * DevDocs repackages the official references (MDN, Python, cppreference,
 * Rust, Godot, React, TypeScript, Bun, Node, …) as small HTML pages served
 * with CORS. The panel searches a docset's `index.json`, fetches one page at a
 * time, sanitizes it (DOMPurify), and shows it in a scriptless sandboxed frame
 * with a restrictive CSP and the docset's attribution. Hono and Tailwind aren't
 * repackaged there (or name no license), so their own sites are framed instead.
 */

import { z } from "zod";
import { isDocPath, splitFragment } from "./doc-path";
import type { LanguageId } from "./languages";

export { isDocPath, splitFragment };

/** Where DevDocs serves documents. */
export const DEVDOCS = "https://documents.devdocs.io/";

/** One docset from `public/playground/docs-manifest.json`. */
export interface Docset {
  readonly slug: string;
  readonly name: string;
  readonly release: string | null;
  readonly mtime: number;
  readonly home: string | null;
  readonly attribution: string;
}

/** A site that is shown in a frame instead of re-rendered (not in DevDocs, or no license to re-render). */
export interface FramedSource {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}

/** One searchable entry of a docset. */
export interface DocEntry {
  readonly slug: string;
  readonly name: string;
  /** Page path inside the docset, possibly with a `#fragment`. */
  readonly path: string;
  readonly type: string;
}

const manifestSchema = z.object({
  docs: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      release: z.string().nullable(),
      mtime: z.number().int(),
      home: z
        .string()
        .url()
        .refine((url) => url.startsWith("https://"), "https only")
        .nullable(),
      attribution: z.string(),
    }),
  ),
});

const indexSchema = z.object({
  entries: z
    .array(z.object({ name: z.string(), path: z.string(), type: z.string().catch("") }))
    .max(100_000),
});

/** Docsets per project type, most relevant first. */
export const DOCS_FOR: Readonly<Record<LanguageId, readonly string[]>> = {
  web: ["html", "css", "javascript", "dom"],
  "web-ts": ["typescript", "html", "css", "dom"],
  react: ["react", "javascript", "dom", "typescript"],
  typescript: ["typescript", "javascript"],
  javascript: ["javascript", "dom"],
  python: ["python~3.14"],
  bun: ["bun", "javascript", "http"],
  hono: ["bun", "http", "javascript"],
  cpp: ["cpp"],
  rust: ["rust"],
  gdscript: ["godot~4.7"],
  markdown: ["html"],
};

/** Official sites framed directly, per project type. */
export const FRAMED_FOR: Readonly<Partial<Record<LanguageId, readonly FramedSource[]>>> = {
  hono: [{ id: "hono", name: "Hono docs (hono.dev)", url: "https://hono.dev/docs/" }],
  web: [{ id: "tailwind", name: "Tailwind CSS docs", url: "https://tailwindcss.com/docs" }],
  react: [{ id: "tailwind", name: "Tailwind CSS docs", url: "https://tailwindcss.com/docs" }],
};

/** The manifest's docsets, parsed. */
export function parseManifest(json: unknown): Docset[] {
  return manifestSchema.parse(json).docs;
}

/** URL of a docset's search index. */
export const indexUrl = (set: Docset) => `${DEVDOCS}${set.slug}/index.json?${set.mtime}`;

/** Entries of a fetched `index.json`. */
export function parseIndex(slug: string, json: unknown): DocEntry[] {
  // Entries with unusual paths are dropped rather than trusted (the index is third-party data).
  return indexSchema
    .parse(json)
    .entries.filter((e) => isDocPath(e.path))
    .map((e) => ({ slug, ...e }));
}

/**
 * Rank entries for a query: exact name, then prefix, then word start, then
 * substring; a match in the query's own case and shorter names first within a
 * tier. C++ names match with or without `std::`.
 *
 * @returns At most `limit` entries.
 */
export function searchDocs(entries: readonly DocEntry[], query: string, limit = 30): DocEntry[] {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  const scored: { entry: DocEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    const bare = name.startsWith("std::") && !q.startsWith("std::") ? name.slice(5) : name;
    const index = bare.indexOf(q);
    if (index === -1) continue;
    const tier =
      bare === q || bare === `${q}()`
        ? 400
        : index === 0
          ? 300
          : /[\s.:_(<-]/.test(bare[index - 1] ?? "")
            ? 200
            : 100;
    const cased = entry.name.includes(raw) ? 50 : 0;
    scored.push({ entry, score: tier + cased - Math.min(bare.length, 49) });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((s) => s.entry);
}

/** URL of a page's HTML. */
export function pageUrl(set: Docset, path: string): string {
  const { page } = splitFragment(path);
  return `${DEVDOCS}${set.slug}/${page.split("/").map(encodeURIComponent).join("/")}.html?${set.mtime}`;
}

/** Where a link inside a docs page points. */
export type DocLink =
  | { kind: "page"; path: string }
  | { kind: "anchor"; fragment: string }
  | { kind: "external"; url: string };

/**
 * Resolve an `href` found in a page of `slug` at `path`.
 *
 * Relative links (`../array`) stay inside the docset; `#x` is an anchor on the
 * page; everything else (other sites, other docsets) opens in a new tab.
 */
export function resolveDocLink(slug: string, path: string, href: string): DocLink {
  if (href.startsWith("#")) return { kind: "anchor", fragment: href.slice(1) };
  const base = new URL(`${DEVDOCS}${slug}/${splitFragment(path).page}`);
  let target: URL;
  try {
    target = new URL(href, base);
  } catch {
    return { kind: "external", url: base.href };
  }
  const prefix = `${DEVDOCS}${slug}/`;
  if (target.href.startsWith(prefix) && target.protocol === "https:") {
    // Kept percent-encoded: that is how the index names pages (`class_%40gdscript`); pageUrl encodes it again.
    const page = target.pathname.slice(`/${slug}/`.length).replace(/\.html$/, "");
    const path = target.hash ? `${page}${target.hash}` : page;
    // A link to a path no index would hold opens on DevDocs instead.
    return isDocPath(path) ? { kind: "page", path } : { kind: "external", url: target.href };
  }
  return { kind: "external", url: /^https?:$/.test(target.protocol) ? target.href : base.href };
}

/** MDN section per MDN-based docset. */
const MDN: Readonly<Record<string, string>> = {
  javascript: "Web/JavaScript/Reference/",
  css: "Web/CSS/",
  html: "Web/HTML/",
  dom: "Web/API/",
  http: "Web/HTTP/",
};

/**
 * The page on the official site, when its address can be derived; otherwise
 * the docset's home (or a search on the official site).
 */
export function officialUrl(set: Docset, entry: Pick<DocEntry, "name" | "path">): string | null {
  const { page, fragment } = splitFragment(entry.path);
  const hash = fragment ? `#${fragment}` : "";
  const mdn = MDN[set.slug];
  if (mdn) return `https://developer.mozilla.org/en-US/docs/${mdn}${page}${hash}`;
  switch (set.slug) {
    case "python~3.14":
      return `https://docs.python.org/3.14/${page}.html${hash}`;
    case "cpp":
      return `https://en.cppreference.com/w/cpp/${page}`;
    case "node":
      return `https://nodejs.org/api/${page}.html${hash}`;
    case "bun":
      return `https://bun.com/docs/${page}`;
    case "rust":
      return `https://doc.rust-lang.org/std/?search=${encodeURIComponent(entry.name)}`;
    case "godot~4.7":
      return `https://docs.godotengine.org/en/stable/search.html?q=${encodeURIComponent(entry.name)}`;
    default:
      return set.home;
  }
}

/** Styles for a docs page, in the site's look, following the theme. */
const DOC_CSS = `
  --bg: light-dark(#f2f2f2, #161616);
  --fg: light-dark(#000, #e6e6e6);
  --chip: light-dark(#ddd, #333);
  --rule: light-dark(#d5d5d5, #333);
  --link: light-dark(#1f6feb, #58a6ff);
}
* { box-sizing: border-box; }
body { margin: 0.75rem 1rem 1.5rem; background: var(--bg); color: var(--fg); font: 14px/1.55 monospace; overflow-wrap: anywhere; }
h1 { font-size: 1.15em; margin: 0 0 0.75em; }
h2, h3, h4 { font-size: 1em; margin: 1.4em 0 0.5em; }
p, ul, ol, dl, table, pre { margin: 0 0 0.9em; }
a { color: var(--link); }
code { background: var(--chip); padding: 0 2px; }
pre { background: var(--chip); padding: 0.6em; overflow: auto; white-space: pre; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; display: block; overflow-x: auto; }
th, td { text-align: left; vertical-align: top; padding: 0.2em 1.25ch 0.2em 0; border-bottom: 1px dotted var(--rule); }
dt { font-weight: bold; }
dd { margin: 0 0 0.6em 2ch; }
img { max-width: 100%; height: auto; }
details.baseline-indicator { border: 1px dotted var(--rule); padding: 0.3em 0.6em; margin-bottom: 1em; }
.pg-doc-footer { margin-top: 2em; padding-top: 0.6em; border-top: 1px dotted currentColor; font-size: 0.85em; opacity: 0.8; }`;

/** Only what docs pages need: no scripts, styles, forms, frames or event handlers. */
const SANITIZE = {
  FORBID_TAGS: [
    "script",
    "style",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "base",
    // Image maps link without an <a>, past the frame's click handling.
    "map",
    "area",
  ],
  FORBID_ATTR: ["style", "srcset", "xlink:href"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Build the frame document for a page: sanitized HTML, the site's styles, a
 * CSP that allows only images and inline styles, and the attribution footer.
 *
 * @param html - The page HTML from DevDocs (untrusted).
 * @param set - Its docset (for the base URL and attribution).
 * @param path - The page path (for relative image URLs).
 * @param sanitize - DOMPurify's `sanitize` (injected; it needs a DOM).
 * @param theme - The site theme, or `null` for the OS preference.
 */
export function buildDocSrcDoc(
  html: string,
  set: Docset,
  path: string,
  sanitize: (dirty: string, config: typeof SANITIZE) => string,
  theme: "light" | "dark" | null,
): string {
  const { page } = splitFragment(path);
  const dir = page.includes("/") ? page.slice(0, page.lastIndexOf("/") + 1) : "";
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const version = set.release ? ` ${set.release}` : "";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'">
<base href="${escape(`${DEVDOCS}${set.slug}/${dir}`)}">
<style>:root { color-scheme: ${theme ?? "light dark"};${DOC_CSS}</style></head><body>
${sanitize(html, SANITIZE)}
<p class="pg-doc-footer">${escape(set.name)}${escape(version)} · ${escape(set.attribution)} · via DevDocs</p>
</body></html>`;
}
