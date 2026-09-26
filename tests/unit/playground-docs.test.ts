/** Unit tests for `lib/playground/docs.ts`: DevDocs search, links, official URLs and the sanitized page document. */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildDocSrcDoc,
  DOCS_FOR,
  isDocPath,
  officialUrl,
  pageUrl,
  parseIndex,
  parseManifest,
  resolveDocLink,
  searchDocs,
  splitFragment,
  type Docset,
} from "@/lib/playground/docs";
import { LANGUAGE_IDS } from "@/lib/playground/languages";

const manifest = parseManifest(
  JSON.parse(
    readFileSync(
      path.join(__dirname, "..", "..", "public", "playground", "docs-manifest.json"),
      "utf8",
    ),
  ),
);
const js = manifest.find((d) => d.slug === "javascript")!;

describe("manifest", () => {
  it("has every docset a project type uses, with attribution", () => {
    const slugs = new Set(manifest.map((d) => d.slug));
    for (const id of LANGUAGE_IDS)
      for (const slug of DOCS_FOR[id]) expect(slugs.has(slug)).toBe(true);
    for (const set of manifest) expect(set.attribution.length).toBeGreaterThan(5);
  });
});

describe("searchDocs", () => {
  const entries = parseIndex("javascript", {
    entries: [
      { name: "Array.prototype.map()", path: "global_objects/array/map", type: "Array" },
      { name: "Map", path: "global_objects/map", type: "Map" },
      { name: "Map.prototype.get()", path: "global_objects/map/get", type: "Map" },
      { name: "WeakMap", path: "global_objects/weakmap", type: "WeakMap" },
    ],
  });

  it("ranks exact, then prefix, then word-start, then substring matches", () => {
    expect(searchDocs(entries, "map").map((e) => e.name)).toEqual([
      "Map",
      "Map.prototype.get()",
      "Array.prototype.map()",
      "WeakMap",
    ]);
    expect(searchDocs(entries, "   ")).toEqual([]);
  });

  it("prefers the query's own case, and ignores std:: in C++ names", () => {
    const rust = parseIndex("rust", {
      entries: [
        { name: "vec", path: "std/macro.vec", type: "Macros" },
        { name: "Vec", path: "std/vec/struct.vec", type: "Structs" },
      ],
    });
    expect(searchDocs(rust, "Vec")[0]?.name).toBe("Vec");
    expect(searchDocs(rust, "vec")[0]?.name).toBe("vec");
    const cpp = parseIndex("cpp", {
      entries: [
        { name: "Standard library header <vector>", path: "header/vector", type: "Headers" },
        { name: "std::vector::push_back", path: "container/vector/push_back", type: "Containers" },
        { name: "std::vector", path: "container/vector", type: "Containers" },
      ],
    });
    expect(searchDocs(cpp, "vector").map((e) => e.name)).toEqual([
      "std::vector",
      "std::vector::push_back",
      "Standard library header <vector>",
    ]);
  });
});

describe("pages and links", () => {
  it("builds page URLs without the fragment, versioned by mtime", () => {
    expect(pageUrl(js, "global_objects/array/map#syntax")).toBe(
      `https://documents.devdocs.io/javascript/global_objects/array/map.html?${js.mtime}`,
    );
    expect(splitFragment("library/functions#print")).toEqual({
      page: "library/functions",
      fragment: "print",
    });
  });

  it("keeps relative links inside the docset and sends the rest to a new tab", () => {
    expect(resolveDocLink("javascript", "global_objects/array/map", "../array")).toEqual({
      kind: "page",
      path: "global_objects/array",
    });
    expect(resolveDocLink("javascript", "global_objects/array/map", "#syntax")).toEqual({
      kind: "anchor",
      fragment: "syntax",
    });
    expect(resolveDocLink("javascript", "a/b", "https://tc39.es/")).toEqual({
      kind: "external",
      url: "https://tc39.es/",
    });
    expect(resolveDocLink("javascript", "a/b", "javascript:alert(1)").kind).toBe("external");
    expect(resolveDocLink("javascript", "a/b", "javascript:alert(1)")).not.toMatchObject({
      url: "javascript:alert(1)",
    });
    // Encoded links stay encoded (DevDocs names files with %40): never raw quotes or markup.
    const encoded = resolveDocLink("godot~4.7", "classes/class_node", "class_%40gdscript#x");
    expect(encoded).toEqual({ kind: "page", path: "classes/class_%40gdscript#x" });
    const hostile = resolveDocLink("javascript", "a/b", "x%22%3E%3Cstyle%3E/y");
    expect(JSON.stringify(hostile)).not.toMatch(/"x"|<style/);
  });

  it("links to the page on the official site where it can", () => {
    expect(officialUrl(js, { name: "map", path: "global_objects/array/map" })).toBe(
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/global_objects/array/map",
    );
    const python = manifest.find((d) => d.slug === "python~3.14")!;
    expect(officialUrl(python, { name: "print()", path: "library/functions#print" })).toBe(
      "https://docs.python.org/3.14/library/functions.html#print",
    );
    const rust = manifest.find((d) => d.slug === "rust")!;
    expect(officialUrl(rust, { name: "Vec", path: "std/vec/struct.vec" })).toContain("search=Vec");
  });
});

describe("isDocPath and parseIndex", () => {
  it("accepts DevDocs paths and drops anything that could carry markup", () => {
    for (const ok of [
      "container/vector/operator*",
      "properties/--*",
      "classes/class_%40gdscript#x",
      "functions/calc()",
    ])
      expect(isDocPath(ok)).toBe(true);
    for (const bad of ['a/b"><meta', "a/../b", "a b", "", "a/<b>"])
      expect(isDocPath(bad)).toBe(false);
    const entries = parseIndex("cpp", {
      entries: [
        { name: "ok", path: "a/b", type: "t" },
        { name: "bad", path: 'x"><style>', type: "t" },
      ],
    });
    expect(entries.map((e) => e.name)).toEqual(["ok"]);
  });
});

describe("buildDocSrcDoc", () => {
  const set: Docset = { ...js };
  const dirty =
    '<h1>map()</h1><script>alert(1)</script><img src="x.png" onerror="alert(1)"><a href="../array" onclick="x()">Array</a><form><input></form><iframe src="https://evil.test"></iframe>';
  // DOMPurify itself is exercised in a real browser (e2e): happy-dom's DOM makes it mis-sanitize.
  const passed: unknown[] = [];
  const doc = buildDocSrcDoc(
    dirty,
    set,
    "global_objects/array/map",
    (d, config) => (passed.push(config), d.replace(/<script[\s\S]*?<\/script>/g, "")),
    "dark",
  );

  it("sanitizes with scripts, styles, forms, frames and handlers forbidden, and adds a CSP and the attribution", () => {
    expect(doc).not.toContain("<script");
    expect(passed[0]).toMatchObject({
      FORBID_TAGS: expect.arrayContaining(["script", "style", "form", "iframe", "area"]),
      FORBID_ATTR: expect.arrayContaining(["xlink:href"]),
    });
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain(
      '<base href="https://documents.devdocs.io/javascript/global_objects/array/">',
    );
    expect(doc).toContain("MDN contributors");
    expect(doc).toContain("via DevDocs");
    expect(doc).toContain("color-scheme: dark;");
  });

  it("escapes the base URL, whatever the path holds", () => {
    const hostile = buildDocSrcDoc("", set, 'x"><meta http-equiv="refresh">/y', (d) => d, null);
    expect(hostile).not.toContain('"><meta');
    expect(hostile).toContain("x&quot;&gt;&lt;meta");
  });
});
