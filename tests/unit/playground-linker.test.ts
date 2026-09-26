/** Unit tests for `lib/playground/module-linker.ts`: multi-file JS/TS projects become runnable data: URL modules. */
import { describe, expect, it } from "bun:test";
import {
  fromDataUrl,
  LinkError,
  linkModules,
  linkWebDocument,
  replaceModuleUrls,
  resolveSpecifier,
  toDataUrl,
} from "@/lib/playground/module-linker";
import { transpile } from "@/lib/playground/transpile";

/** Decode the module an entry URL points at. */
const source = (url: string) => fromDataUrl(url);

describe("toDataUrl / fromDataUrl", () => {
  it("round-trips UTF-8 source", () => {
    const url = toDataUrl("console.log('héllo ✓')");
    expect(url.startsWith("data:text/javascript;base64,")).toBe(true);
    expect(fromDataUrl(url)).toBe("console.log('héllo ✓')");
  });
});

describe("resolveSpecifier", () => {
  const files = {
    "main.ts": "",
    "lib/index.ts": "",
    "lib/math.ts": "",
    "lib/util.js": "",
    "data/config.json": "{}",
  };

  it("resolves relative paths with TS/JS extension rules and index files", () => {
    expect(resolveSpecifier("main.ts", "./lib/math", files)).toEqual({
      kind: "file",
      path: "lib/math.ts",
    });
    expect(resolveSpecifier("main.ts", "./lib/math.js", files)).toEqual({
      kind: "file",
      path: "lib/math.ts",
    });
    expect(resolveSpecifier("main.ts", "./lib", files)).toEqual({
      kind: "file",
      path: "lib/index.ts",
    });
    expect(resolveSpecifier("lib/math.ts", "./util.js", files)).toEqual({
      kind: "file",
      path: "lib/util.js",
    });
    expect(resolveSpecifier("lib/math.ts", "../data/config.json", files)).toEqual({
      kind: "file",
      path: "data/config.json",
    });
    expect(resolveSpecifier("lib/math.ts", "/main", files)).toEqual({
      kind: "file",
      path: "main.ts",
    });
  });

  it("sends bare specifiers to esm.sh and keeps absolute URLs", () => {
    expect(resolveSpecifier("main.ts", "lodash-es", files)).toEqual({
      kind: "url",
      url: "https://esm.sh/lodash-es",
    });
    expect(resolveSpecifier("main.ts", "https://x.dev/m.js", files)).toEqual({
      kind: "url",
      url: "https://x.dev/m.js",
    });
  });

  it("reports missing files, escapes above the root and Node built-ins", () => {
    expect(resolveSpecifier("main.ts", "./nope", files).kind).toBe("missing");
    expect(resolveSpecifier("main.ts", "../../etc/passwd", files).kind).toBe("missing");
    const builtin = resolveSpecifier("main.ts", "node:fs", files);
    expect(builtin.kind === "missing" && builtin.reason).toMatch(/browser/);
  });
});

describe("linkModules", () => {
  it("links a TS project: entry imports resolve to the transpiled dependency modules", async () => {
    const files = {
      "main.ts":
        'import { add } from "./lib";\nimport type { T } from "./lib/types";\nconsole.log(add(1, 2));',
      "lib/index.ts": 'export * from "./math";',
      "lib/math.ts": "export const add = (a: number, b: number): number => a + b;",
      "lib/types.ts": "export interface T { x: number }",
    };
    const linked = await linkModules(files, "main.ts", transpile);
    const entry = source(linked.entryUrl);
    expect(entry).not.toContain("./lib");
    expect(entry).not.toContain("import type");
    const indexUrl = linked.urls.get("lib/index.ts")!;
    expect(entry).toContain(indexUrl);
    expect(source(indexUrl)).toContain(linked.urls.get("lib/math.ts")!);
    expect(source(linked.urls.get("lib/math.ts")!)).toContain("(a, b) => a + b");
    // type-only modules are never loaded
    expect(linked.urls.has("lib/types.ts")).toBe(false);
  });

  it("rewrites dynamic imports with string literals and leaves computed ones alone", async () => {
    const files = {
      "main.js": 'const m = await import("./m.js");\nimport("./" + name);',
      "m.js": "export default 1;",
    };
    const linked = await linkModules(files, "main.js", transpile);
    const entry = source(linked.entryUrl);
    expect(entry).toContain(`import(${JSON.stringify(linked.urls.get("m.js"))})`);
    expect(entry).toContain('import("./" + name)');
  });

  it("links JSON files as JSON modules and reuses one URL per file", async () => {
    const files = {
      "main.js":
        'import a from "./a.js";\nimport b from "./b.js";\nimport cfg from "./c.json" with { type: "json" };',
      "a.js": 'import s from "./shared.js"; export default s;',
      "b.js": 'import s from "./shared.js"; export default s;',
      "shared.js": "export default 1;",
      "c.json": '{"x":1}',
    };
    const linked = await linkModules(files, "main.js", transpile);
    expect(linked.urls.get("c.json")?.startsWith("data:application/json;base64,")).toBe(true);
    expect(source(linked.urls.get("a.js")!)).toContain(linked.urls.get("shared.js")!);
    expect(source(linked.urls.get("b.js")!)).toContain(linked.urls.get("shared.js")!);
  });

  it("explains missing modules and import cycles", async () => {
    const missing = { "main.js": 'import "./gone.js";' };
    expect(linkModules(missing, "main.js", transpile)).rejects.toThrow(
      /Cannot find "\.\/gone\.js" imported from main\.js/,
    );
    const cycle = { "a.js": 'import "./b.js";', "b.js": 'import "./a.js";' };
    expect(linkModules(cycle, "a.js", transpile)).rejects.toThrow(/cycle: a\.js → b\.js → a\.js/);
    expect(linkModules(missing, "main.js", transpile)).rejects.toBeInstanceOf(LinkError);
  });

  it("reports syntax errors with the file name", async () => {
    const files = { "main.ts": "const x: = 1;" };
    expect(linkModules(files, "main.ts", transpile)).rejects.toThrow(/main\.ts/);
  });
});

describe("replaceModuleUrls", () => {
  it("turns data: URLs in an error message back into file paths", async () => {
    const files = { "main.js": 'import "./lib/x.js";', "lib/x.js": "throw new Error('boom')" };
    const linked = await linkModules(files, "main.js", transpile);
    const message = `Error: boom\n    at ${linked.urls.get("lib/x.js")}:1:7`;
    expect(replaceModuleUrls(message, linked.urls)).toBe("Error: boom\n    at lib/x.js:1:7");
  });
});

describe("linkWebDocument", () => {
  const files = {
    "index.html":
      '<link rel="stylesheet" href="css/style.css">\n<img src="img/logo.svg" alt="">\n<script type="module" src="js/main.js"></script>\n<script type="module">import { n } from "./js/util.js"; console.log(n);</script>',
    "css/style.css": "body { color: red; }",
    "img/logo.svg": "<svg xmlns='http://www.w3.org/2000/svg'/>",
    "js/main.js": 'import { n } from "./util.js"; console.log(n);',
    "js/util.js": "export const n = 1;",
  };

  it("inlines stylesheets and links module scripts, including inline ones", async () => {
    const { html, urls } = await linkWebDocument(files, "index.html", transpile);
    expect(html).toContain("<style>/* css/style.css */\nbody { color: red; }</style>");
    expect(html).not.toContain('href="css/style.css"');
    expect(html).toMatch(/<img src="data:image\/svg\+xml;base64,[^"]+" alt="">/);
    expect(html).toContain(`src="${urls.get("js/main.js")}"`);
    expect(html).toContain(urls.get("js/util.js")!);
    expect(html).not.toContain('"./js/util.js"');
  });

  it("keeps external URLs and reports missing local files", async () => {
    const withCdn = { "index.html": '<script src="https://cdn.jsdelivr.net/npm/x"></script>' };
    expect((await linkWebDocument(withCdn, "index.html", transpile)).html).toContain(
      'src="https://cdn.jsdelivr.net/npm/x"',
    );
    const broken = { "index.html": '<link rel="stylesheet" href="missing.css">' };
    expect(linkWebDocument(broken, "index.html", transpile)).rejects.toThrow(/missing\.css/);
  });

  it("keeps a closing style tag inside CSS from ending the inlined style block", async () => {
    const tricky = {
      "index.html": '<link rel="stylesheet" href="a.css">',
      "a.css": "a::after { content: '</style>'; }",
    };
    const { html } = await linkWebDocument(tricky, "index.html", transpile);
    expect(html).not.toContain("'</style>'");
  });
});

describe("inherited property names in imports", () => {
  it("don't resolve to Object.prototype members", () => {
    expect(resolveSpecifier("main.js", "./constructor", { "main.js": "" }).kind).toBe("missing");
  });
});

describe("npm packages", () => {
  const base = { "main.js": 'import { Hono } from "hono";\nimport { cors } from "hono/cors";' };

  it("uses package.json versions and pins React for other packages", async () => {
    const files = {
      "main.tsx":
        'import confetti from "canvas-confetti";\nimport { createRoot } from "react-dom/client";\nconfetti();\ncreateRoot(document.body).render(<b />);',
      "package.json": JSON.stringify({
        dependencies: { react: "19.3.0", "react-dom": "19.3.0", "canvas-confetti": "^1.9.0" },
      }),
    };
    const entry = fromDataUrl((await linkModules(files, "main.tsx", transpile)).entryUrl);
    expect(entry).toContain(
      "https://esm.sh/canvas-confetti@^1.9.0?deps=react@19.3.0,react-dom@19.3.0",
    );
    expect(entry).toContain("https://esm.sh/react-dom@19.3.0/client");
    expect(entry).toContain("https://esm.sh/react@19.3.0/jsx-runtime");
  });

  it("falls back to the latest and keeps subpaths", async () => {
    const entry = fromDataUrl((await linkModules(base, "main.js", transpile)).entryUrl);
    expect(entry).toContain('"https://esm.sh/hono"');
    expect(entry).toContain('"https://esm.sh/hono/cors"');
  });

  it("skips invalid package.json entries with a warning and refuses bad names", async () => {
    const files = {
      ...base,
      "package.json": JSON.stringify({
        dependencies: { hono: "4?evil=1", "../x": "1", Upper: "1" },
      }),
    };
    const linked = await linkModules(files, "main.js", transpile);
    expect(fromDataUrl(linked.entryUrl)).toContain('"https://esm.sh/hono"');
    expect(linked.warnings).toHaveLength(3);
    expect(resolveSpecifier("main.js", "Bad Name", files).kind).toBe("missing");
    const bun = resolveSpecifier("main.js", "bun:sqlite", files);
    expect(bun.kind === "missing" && bun.reason).toMatch(/emulation/);
  });
});

describe("CSS imports", () => {
  it("turn into a module that injects a <style>", async () => {
    const files = { "main.js": 'import "./styles.css";', "styles.css": "body { color: red; }" };
    const linked = await linkModules(files, "main.js", transpile);
    const css = fromDataUrl(linked.urls.get("styles.css")!);
    expect(css).toContain('document.createElement("style")');
    expect(css).toContain('"body { color: red; }"');
  });
});
