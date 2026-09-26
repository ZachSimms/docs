/**
 * Media checks across `content/`: every `<YouTube>` has valid props, images are local, and
 * downloaded third-party images (`public/images/fitness/`) are small, used, credited under
 * the image and listed in the README.
 */
import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { listAllSheets, readSheetBody, type SheetRef } from "@/lib/content";
import { readImageDimensions } from "@/lib/images";
import { parseYouTubeProps } from "@/lib/youtube";

/** Folder of downloaded, openly licensed images that need a credit line. */
const CREDITED_DIR = "/images/fitness/";
/** Longest side, in pixels, allowed for a downloaded image. */
const MAX_SIDE = 1200;
/** A credit line: `*Image: Artist, licence, via [Wikimedia Commons](…).*`. */
const CREDIT = /^\*Image: .+, (?:public domain|CC0|\[CC[^\]]+\]\(https:\/\/creativecommons\.org\/[^)]+\)), via \[[^\]]+\]\(https:\/\/[^)]+\)\.\*$/;

const label = (ref: SheetRef) => [ref.topic, ref.group, ref.slug].filter(Boolean).join("/");
const SHEETS = listAllSheets().map((ref) => ({ ref, body: readSheetBody(ref) }));

/** String attributes and `{number}` attributes of a JSX tag's attribute text. */
function attributes(text: string): Record<string, string | number> {
  const strings = [...text.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v] as const);
  const numbers = [...text.matchAll(/(\w+)=\{(\d+(?:\.\d+)?|-\d+)\}/g)].map(
    ([, k, v]) => [k, Number(v)] as const,
  );
  return Object.fromEntries([...strings, ...numbers]);
}

describe("<YouTube> embeds in content", () => {
  const embeds = SHEETS.flatMap(({ ref, body }) =>
    [...body.matchAll(/<YouTube\b([^>]*?)\/>/g)].map((m) => ({ ref, attrs: attributes(m[1] ?? "") })),
  );

  it("exist", () => {
    expect(embeds.length).toBeGreaterThan(0);
  });

  for (const { ref, attrs } of embeds) {
    it(`${label(ref)}: ${String(attrs.id)} has valid props`, () => {
      expect(() => parseYouTubeProps(attrs)).not.toThrow();
    });
  }

  it("never uses an unclosed <YouTube> tag", () => {
    const open = SHEETS.filter(({ body }) => /<YouTube\b(?![^>]*\/>)/.test(body));
    expect(open.map(({ ref }) => label(ref))).toEqual([]);
  });
});

describe("images in content", () => {
  const images = SHEETS.flatMap(({ ref, body }) => {
    const lines = body.split("\n");
    return lines.flatMap((line, i) =>
      [...line.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)].map((m) => ({
        ref,
        alt: m[1] ?? "",
        src: m[2] ?? "",
        next: lines.slice(i + 1).find((l) => l.trim() !== "")?.trim() ?? "",
      })),
    );
  });

  it("are all local files under public/", () => {
    const remote = images.filter((img) => !img.src.startsWith("/"));
    expect(remote.map((img) => `${label(img.ref)}: ${img.src}`)).toEqual([]);
  });

  for (const img of images.filter((i) => i.src.startsWith(CREDITED_DIR))) {
    it(`${label(img.ref)}: ${img.src} has alt text, a credit line and a sane size`, () => {
      expect(img.alt.length).toBeGreaterThan(10);
      expect(img.next).toMatch(CREDIT);
      const size = readImageDimensions(img.src);
      expect(size).toBeDefined();
      expect(Math.max(size?.width ?? Infinity, size?.height ?? Infinity)).toBeLessThanOrEqual(MAX_SIDE);
    });
  }

  it(`every file in public${CREDITED_DIR} is used by a sheet and credited in the README`, () => {
    const dir = path.join(process.cwd(), "public", CREDITED_DIR);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith(".")) : [];
    const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    const used = new Set(images.map((img) => img.src));
    const problems = files.flatMap((file) => [
      ...(used.has(`${CREDITED_DIR}${file}`) ? [] : [`${file} is unused`]),
      ...(readme.includes(`public${CREDITED_DIR}${file}`) ? [] : [`${file} is not in the README`]),
    ]);
    expect(problems).toEqual([]);
  });
});
