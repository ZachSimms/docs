/**
 * @file Refresh `public/playground/docs-manifest.json` from DevDocs.
 *
 * Usage: `bun scripts/build-docs-manifest.ts`. DevDocs' manifest has no CORS
 * header and isn't meant to be fetched often, so the playground reads this
 * small committed copy instead: for each docset it uses, the version, the
 * `mtime` that versions the document URLs, and the attribution to show.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

/** The docsets the playground offers (DevDocs slugs). */
const SLUGS = [
  "html",
  "css",
  "javascript",
  "dom",
  "http",
  "typescript",
  "python~3.14",
  "cpp",
  "rust",
  "godot~4.7",
  "react",
  "nextjs",
  "bun",
  "node",
] as const;

/** Display names (DevDocs' own names are sometimes terse). */
const NAMES: Record<(typeof SLUGS)[number], string> = {
  html: "HTML (MDN)",
  css: "CSS (MDN)",
  javascript: "JavaScript (MDN)",
  dom: "Web APIs (MDN)",
  http: "HTTP (MDN)",
  typescript: "TypeScript",
  "python~3.14": "Python 3.14",
  cpp: "C++ (cppreference)",
  rust: "Rust",
  "godot~4.7": "Godot 4.7",
  react: "React",
  nextjs: "Next.js",
  bun: "Bun",
  node: "Node.js",
};

/** For docsets whose DevDocs entry carries no attribution (MDN content is CC-BY-SA 2.5+). */
const FALLBACK_ATTRIBUTION: Partial<Record<(typeof SLUGS)[number], string>> = {
  http: "© 2005–2025 MDN contributors. Licensed under the Creative Commons Attribution-ShareAlike License v2.5 or later.",
};

interface DevDoc {
  slug: string;
  release?: string;
  mtime: number;
  links?: { home?: string; code?: string };
  attribution?: string;
}

/** DevDocs' attribution HTML as plain text. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&copy;/g, "©")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const response = await fetch("https://devdocs.io/docs.json");
if (!response.ok) throw new Error(`DevDocs manifest: HTTP ${response.status}`);
const all = (await response.json()) as DevDoc[];

const docs = SLUGS.map((slug) => {
  const matches = all.filter((d) => d.slug === slug).sort((a, b) => b.mtime - a.mtime);
  const doc = matches[0];
  if (!doc) throw new Error(`DevDocs has no docset "${slug}"`);
  return {
    slug,
    name: NAMES[slug],
    release: doc.release ?? null,
    mtime: doc.mtime,
    home: doc.links?.home ?? null,
    attribution: plain(doc.attribution ?? "") || FALLBACK_ATTRIBUTION[slug] || "",
  };
});

const out = path.join(import.meta.dir, "..", "public", "playground", "docs-manifest.json");
writeFileSync(out, `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), docs }, null, 2)}\n`);
console.log(`wrote ${docs.length} docsets to ${path.relative(process.cwd(), out)}`);
