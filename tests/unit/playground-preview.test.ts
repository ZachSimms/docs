/** Unit tests for the live preview document (`runtime/web-preview.ts`) and its loop guards. */
import { describe, expect, it } from "bun:test";
import { addLoopGuards } from "@/lib/playground/loop-guard";
import { fromDataUrl, linkWebDocument } from "@/lib/playground/module-linker";
import {
  buildPreviewSrcDoc,
  createLoopGuard,
  LOOP_GUARD,
  LOOP_LIMIT_MS,
} from "@/lib/playground/runtime/web-preview";
import { transpile } from "@/lib/playground/transpile";

const G = `${LOOP_GUARD}()`;

describe("buildPreviewSrcDoc", () => {
  it("adds a doctype and the shim before a bare fragment", () => {
    const doc = buildPreviewSrcDoc("<p>hi</p>", "tok-1");
    expect(doc.startsWith("<!doctype html><script>")).toBe(true);
    expect(doc).toContain('"tok-1"');
    expect(doc.endsWith("<p>hi</p>")).toBe(true);
  });

  it("keeps the page's doctype first and puts the shim in its head", () => {
    const withHead = buildPreviewSrcDoc(
      "<!doctype html><html><head><title>x</title></head><body></body></html>",
      "t",
    );
    expect(withHead.indexOf("<head>")).toBeLessThan(withHead.indexOf("<script>"));
    expect(withHead.indexOf("<script>")).toBeLessThan(withHead.indexOf("<title>"));
    const doctypeOnly = buildPreviewSrcDoc("<!DOCTYPE html>\n<p>x</p>", "t");
    expect(doctypeOnly.startsWith("<!DOCTYPE html><script>")).toBe(true);
  });

  it("can't be broken out of by a token containing a closing script tag", () => {
    const doc = buildPreviewSrcDoc("<p>x</p>", "</script><script>alert(1)");
    expect(doc.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe("addLoopGuards", () => {
  it("guards while, do-while and three-part for conditions, keeping lines", () => {
    expect(addLoopGuards("while (true) {}")).toBe(`while (${G} && (true)) {}`);
    expect(addLoopGuards("do {\n  i++;\n} while (i < 9)")).toBe(
      `do {\n  i++;\n} while (${G} && (i < 9))`,
    );
    expect(addLoopGuards("for (;;) x++;")).toBe(`for (;${G};) x++;`);
    expect(addLoopGuards("for (let i = 0, f = () => { a; b; }; i < 3; i++) {}")).toBe(
      `for (let i = 0, f = () => { a; b; }; ${G} && (i < 3); i++) {}`,
    );
    expect(addLoopGuards("if (x) while (y) z();")).toBe(`if (x) while (${G} && (y)) z();`);
  });

  it("leaves for-of/in, strings, comments, regexes, templates and property names alone", () => {
    for (const code of [
      "for (const x of xs) {} for (const k in o) {} for await (const x of it) {}",
      "const s = 'while (true)'; // for (;;)\nconst r = /while(x)/; `${a} for (;;)`;",
      "obj.while(1); obj?.for(2); ({ while: 1, for() {} });",
    ]) {
      expect(addLoopGuards(code)).toBe(code);
    }
  });

  it("returns code that doesn't parse unchanged (the browser reports the error)", () => {
    expect(addLoopGuards("while (")).toBe("while (");
  });
});

describe("createLoopGuard", () => {
  it("stops a loop that never yields, with a readable error", () => {
    const guard = createLoopGuard(30);
    const run = new Function(LOOP_GUARD, addLoopGuards("let i = 0; while (true) { i++; }"));
    const started = performance.now();
    expect(() => run(guard)).toThrow(/Stopped a loop that ran for over 0\.03 s/);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it("lets finite loops finish", () => {
    const guard = createLoopGuard(LOOP_LIMIT_MS);
    const run = new Function(
      LOOP_GUARD,
      addLoopGuards("let n = 0; for (let i = 0; i < 1e5; i++) n += i; return n;"),
    );
    expect(run(guard)).toBe(4999950000);
  });
});

describe("linking a page full of unclosed tags", () => {
  it("takes linear time and leaves the text as it was", async () => {
    const html = "<script <link <img <head ".repeat(12_000);
    const started = performance.now();
    const linked = await linkWebDocument(
      { "index.html": html },
      "index.html",
      transpile,
      addLoopGuards,
    );
    buildPreviewSrcDoc(linked.html, "t");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(linked.html).toBe(html);
  });
});

describe("linkWebDocument with loop guards", () => {
  it("guards module files, classic scripts and inline scripts, but not data scripts", async () => {
    const files = {
      "index.html": [
        '<script type="module" src="main.ts"></script>',
        '<script src="classic.js"></script>',
        "<script>while (a) {}</script>",
        '<script type="application/json">{"while": "(x)"}</script>',
      ].join("\n"),
      "main.ts": "let n: number = 0;\nwhile (n < 3) n++;",
      "classic.js": "for (;;) break;",
    };
    const { html, urls } = await linkWebDocument(files, "index.html", transpile, addLoopGuards);
    expect(fromDataUrl(urls.get("main.ts")!)).toContain(`while (${G} && (n < 3))`);
    const classicUrl = /<script src="([^"]+)"><\/script>/.exec(html)![1]!;
    expect(fromDataUrl(classicUrl)).toBe(`for (;${G};) break;`);
    expect(html).toContain(`<script>while (${G} && (a)) {}</script>`);
    expect(html).toContain('<script type="application/json">{"while": "(x)"}</script>');
  });

  it("installs the guard in the preview document before the page's own scripts", () => {
    const doc = buildPreviewSrcDoc("<script>while (a) {}</script>", "t");
    expect(doc.indexOf(`globalThis[${JSON.stringify(LOOP_GUARD)}]`)).toBeGreaterThan(-1);
    expect(doc.indexOf(LOOP_GUARD)).toBeLessThan(doc.indexOf("while (a)"));
  });
});
