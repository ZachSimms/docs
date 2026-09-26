/** Unit tests for `lib/playground/hover-docs.ts` (docs hovers) and the panel's docs requests. */
import { describe, expect, it } from "bun:test";
import {
  buildHoverIndex,
  completionNames,
  hoverLanguageFor,
  lookupHover,
  nameAt,
  parseHoverFile,
  type HoverDocFile,
} from "@/lib/playground/hover-docs";
import { parseDocRequest } from "@/lib/reference-panel";

const entry = (name: string, path = name) => ({ name, summary: `About ${name}.`, path });

const cpp: HoverDocFile = {
  slug: "cpp",
  docs: "C++ (cppreference)",
  attribution: "© cppreference.com",
  entries: [
    entry("std::vector"),
    entry("std::vector::push_back"),
    entry("std::string::push_back"),
    entry("std::deque::push_back"),
    entry("std::map::size"),
    entry("std::sort"),
  ],
};

describe("nameAt", () => {
  it("takes qualified names, per language", () => {
    const line = "  std::vector<int> v; v.push_back(1);";
    expect(nameAt(line, line.indexOf("vector") + 2, "cpp")?.name).toBe("std::vector");
    expect(nameAt(line, line.indexOf("push_back") + 1, "cpp")?.name).toBe("push_back");
    expect(nameAt('    println!("hi");', 6, "rust")?.name).toBe("println");
    expect(nameAt("\tnode.queue_free()", 8, "gdscript")?.name).toBe("node.queue_free");
    expect(nameAt("a:hover { grid-template-columns: 1fr }", 3, "css")?.name).toBe(":hover");
    expect(nameAt("a:hover { grid-template-columns: 1fr }", 14, "css")?.name).toBe(
      "grid-template-columns",
    );
    expect(nameAt("   ", 1, "cpp")).toBeNull();
    expect(nameAt("a :: b", 3, "cpp")).toBeNull();
  });
});

describe("lookupHover", () => {
  const index = buildHoverIndex(cpp, "cpp");

  it("finds exact names with or without std::", () => {
    expect(lookupHover(index, "std::vector", "cpp").entries.map((e) => e.name)).toEqual([
      "std::vector",
    ]);
    expect(lookupHover(index, "vector", "cpp").entries.map((e) => e.name)).toEqual(["std::vector"]);
    expect(lookupHover(index, "sort", "cpp").entries.map((e) => e.name)).toEqual(["std::sort"]);
  });

  it("finds members by their last segment, preferring the written qualifier", () => {
    const { entries, total } = lookupHover(index, "push_back", "cpp", 2);
    expect(total).toBe(3);
    expect(entries.map((e) => e.name)).toEqual([
      "std::vector::push_back",
      "std::string::push_back",
    ]);
    expect(lookupHover(index, "string::push_back", "cpp").entries[0]?.name).toBe(
      "std::string::push_back",
    );
    expect(lookupHover(index, "nothing", "cpp").entries).toEqual([]);
  });

  it("matches HTML and CSS names case-insensitively", () => {
    const css = parseHoverFile({
      slug: "css",
      docs: "CSS",
      attribution: "MDN",
      entries: [entry("display")],
    });
    expect(lookupHover(buildHoverIndex(css, "css"), "DISPLAY", "css").entries).toHaveLength(1);
  });
});

describe("hover files", () => {
  it("rejects malformed files", () => {
    expect(() => parseHoverFile({ slug: "cpp", entries: [] })).toThrow();
  });

  it("maps editor modes and offers completions once per name", () => {
    expect(hoverLanguageFor("cpp")).toBe("cpp");
    expect(hoverLanguageFor("python")).toBeNull();
    expect(completionNames(cpp).map((c) => c.label)).toEqual([
      "vector",
      "push_back",
      "size",
      "sort",
    ]);
  });
});

describe("parseDocRequest", () => {
  it("accepts docset pages and refuses anything else", () => {
    expect(
      parseDocRequest({
        slug: "godot~4.7",
        path: "classes/class_node#class-node-method-add-child",
        name: "add_child",
      }),
    ).toEqual({
      slug: "godot~4.7",
      path: "classes/class_node#class-node-method-add-child",
      name: "add_child",
    });
    expect(parseDocRequest({ slug: "cpp", path: "../../etc", name: "x" })).toBeNull();
    expect(parseDocRequest({ slug: "cpp", path: "https://evil.test/x", name: "x" })).toBeNull();
    expect(parseDocRequest({ slug: "../x", path: "a", name: "x" })).toBeNull();
    expect(parseDocRequest({ slug: "cpp", path: "a", name: "" })).toBeNull();
    expect(parseDocRequest(null)).toBeNull();
  });
});
