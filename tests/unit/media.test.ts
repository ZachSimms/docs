/**
 * Media checks across `content/`: every `<YouTube>` has valid props, images are local, and
 * downloaded third-party images (`public/images/fitness/`, `public/images/aviation/`) are small,
 * used, credited under the image and listed in the README. Microsoft Flight Simulator images
 * also need the Game Content Usage Rules notice on their sheet.
 */
import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { listAllSheets, readSheetBody, type SheetRef } from "@/lib/content";
import { readImageDimensions } from "@/lib/images";
import { parseYouTubeProps } from "@/lib/youtube";

/** Longest side, in pixels, allowed for a downloaded image. */
const MAX_SIDE = 1200;
/** A credit line: `*Image: Artist, license, via [Wikimedia Commons](…).*` (also FAA public domain). */
const CREDIT =
  /^\*Image: .+, (?:public domain|CC0|\[CC[^\]]+\]\(https:\/\/creativecommons\.org\/[^)]+\)), via \[[^\]]+\]\(https:\/\/[^)]+\)\.\*$/;
/** Microsoft Flight Simulator content, used under Microsoft's Game Content Usage Rules. */
const GCUR_URL = "https://www.xbox.com/en-US/developers/rules";
const CREDIT_GCUR =
  /^\*Image: .+, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's \[Game Content Usage Rules\]\(https:\/\/www\.xbox\.com\/en-US\/developers\/rules\), via \[[^\]]+\]\(https:\/\/[^)]+\)\.\*$/;
/** A figure from a Cirrus manual, identified by part number and figure. */
const CREDIT_CIRRUS =
  /^\*Image: Cirrus Aircraft, .+ \(P\/N [0-9-]+\) fig\. [0-9]+-[0-9]+.*, © Cirrus Aircraft, all rights reserved, reproduced for reference\.\*$/;
/** The notice the Game Content Usage Rules require on any page that uses their content. */
const GCUR_NOTICE =
  "Microsoft Flight Simulator © Microsoft Corporation. Zach's Docs was created under Microsoft's \"Game Content Usage Rules\" using assets from Microsoft Flight Simulator, and it is not endorsed by or affiliated with Microsoft.";

/** Folders of downloaded third-party images, and the credit lines each accepts. */
const CREDITED_DIRS: Readonly<Record<string, readonly RegExp[]>> = {
  "/images/fitness/": [CREDIT],
  "/images/aviation/": [CREDIT, CREDIT_GCUR, CREDIT_CIRRUS],
};

/** Every file under a `public/` folder, recursively, as site paths. */
function filesUnder(dir: string): string[] {
  const root = path.join(process.cwd(), "public", dir);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((f) => !path.basename(f).startsWith(".") && fs.statSync(path.join(root, f)).isFile())
    .map((f) => `${dir}${f.split(path.sep).join("/")}`);
}

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
    [...body.matchAll(/<YouTube\b([^>]*?)\/>/g)].map((m) => ({
      ref,
      attrs: attributes(m[1] ?? ""),
    })),
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
        next:
          lines
            .slice(i + 1)
            .find((l) => l.trim() !== "")
            ?.trim() ?? "",
      })),
    );
  });

  it("are all local files under public/", () => {
    const remote = images.filter((img) => !img.src.startsWith("/"));
    expect(remote.map((img) => `${label(img.ref)}: ${img.src}`)).toEqual([]);
  });

  for (const [dir, credits] of Object.entries(CREDITED_DIRS)) {
    for (const img of images.filter((i) => i.src.startsWith(dir))) {
      it(`${label(img.ref)}: ${img.src} has alt text, a credit line and a sane size`, () => {
        expect(img.alt.length).toBeGreaterThan(10);
        expect(
          credits.some((credit) => credit.test(img.next)),
          img.next,
        ).toBe(true);
        const size = readImageDimensions(img.src);
        expect(size).toBeDefined();
        expect(Math.max(size?.width ?? Infinity, size?.height ?? Infinity)).toBeLessThanOrEqual(
          MAX_SIDE,
        );
      });
    }

    it(`every file in public${dir} is used by a sheet and credited in the README`, () => {
      const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8");
      const used = new Set(images.map((img) => img.src));
      const problems = filesUnder(dir).flatMap((file) => [
        ...(used.has(file) ? [] : [`${file} is unused`]),
        ...(readme.includes(`public${file}`) ? [] : [`${file} is not in the README`]),
      ]);
      expect(problems).toEqual([]);
    });
  }

  it("sheets using Microsoft Flight Simulator content carry the Game Content Usage Rules notice", () => {
    const sheets = SHEETS.filter(({ ref }) =>
      images.some((img) => img.ref === ref && CREDIT_GCUR.test(img.next)),
    );
    const missing = sheets.filter(
      ({ body }) => !body.includes(GCUR_NOTICE) || !body.includes(GCUR_URL),
    );
    expect(missing.map(({ ref }) => label(ref))).toEqual([]);
  });
});
