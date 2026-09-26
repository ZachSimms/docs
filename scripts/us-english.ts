/**
 * @file Rewrite British spellings to American ones across the project.
 *
 * Usage: `bun scripts/us-english.ts [--write]`. Without `--write` it prints
 * every change as `file:line  before → after` for review. Rules and the
 * keep-list are in `scripts/us-english-rules.ts`; external URLs and real API
 * names that use British spelling (for example Python's `CancelledError`) are
 * never touched.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { KEEP, matchCase, SPELLING_RULES } from "./us-english-rules";

const ROOT = path.join(import.meta.dir, "..");
/** Folders and files to rewrite. */
const TARGETS = [
  "content",
  "app",
  "components",
  "lib",
  "tests",
  "scripts",
  "public/images/diagrams",
  "README.md",
  "mdx-components.tsx",
  "next.config.ts",
];
const EXTENSIONS = new Set([".mdx", ".md", ".ts", ".tsx", ".css", ".svg", ".mjs"]);
/** Never rewritten: the rules themselves, generated files and fixtures recorded from services. */
const SKIP = [
  /us-english/,
  /node_modules/,
  /tests\/fixtures\/playground\//,
  /public\/playground\//,
];

/** Every file under the targets. */
export function files(): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    const full = path.join(ROOT, p);
    if (SKIP.some((s) => s.test(p))) return;
    if (statSync(full).isDirectory()) readdirSync(full).forEach((c) => walk(path.join(p, c)));
    else if (EXTENSIONS.has(path.extname(p))) out.push(p);
  };
  TARGETS.forEach(walk);
  return out;
}

/** Character ranges that must stay as written (URLs, kept API names). */
function protectedRanges(text: string): [number, number][] {
  return KEEP.flatMap((re) =>
    [...text.matchAll(new RegExp(re.source, `${re.flags.replace("g", "")}g`))].map(
      (m) => [m.index!, m.index! + m[0].length] as [number, number],
    ),
  );
}

/** Rewrite one file's text, returning the new text and the changes made. */
export function rewrite(text: string): {
  text: string;
  changes: { index: number; from: string; to: string }[];
} {
  const keep = protectedRanges(text);
  const hits: { index: number; from: string; to: string }[] = [];
  for (const rule of SPELLING_RULES) {
    for (const m of text.matchAll(new RegExp(rule.pattern.source, "gi"))) {
      const index = m.index!;
      if (keep.some(([a, b]) => index >= a && index < b)) continue;
      if (hits.some((h) => index < h.index + h.from.length && h.index < index + m[0].length))
        continue;
      const to = matchCase(m[0], rule.us(m[0]));
      if (to !== m[0]) hits.push({ index, from: m[0], to });
    }
  }
  hits.sort((a, b) => b.index - a.index);
  let out = text;
  for (const h of hits) out = out.slice(0, h.index) + h.to + out.slice(h.index + h.from.length);
  return { text: out, changes: hits.reverse() };
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  let total = 0;
  const perWord = new Map<string, number>();
  for (const file of files()) {
    const original = readFileSync(path.join(ROOT, file), "utf8");
    const { text, changes } = rewrite(original);
    if (changes.length === 0) continue;
    total += changes.length;
    for (const c of changes) {
      const key = `${c.from.toLowerCase()} → ${c.to.toLowerCase()}`;
      perWord.set(key, (perWord.get(key) ?? 0) + 1);
      if (!write) {
        const line = original.slice(0, c.index).split("\n").length;
        const lineText = original.split("\n")[line - 1]!.trim().slice(0, 140);
        console.log(`${file}:${line}  ${c.from} → ${c.to}  | ${lineText}`);
      }
    }
    if (write) writeFileSync(path.join(ROOT, file), text);
  }
  console.log(`\n${total} changes${write ? " written" : " (dry run)"}`);
  for (const [k, v] of [...perWord].sort((a, b) => b[1] - a[1]))
    console.log(`${String(v).padStart(4)}  ${k}`);
}
