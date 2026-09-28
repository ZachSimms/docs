/** Unit tests for `lib/terminal/tree.ts` against `tests/fixtures/content` and `tests/fixtures/posts`. */
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { buildSiteTree, projectSegment, SHEETS_NODE } from "@/lib/terminal/tree";
import { isSiteTree, type TreeNode } from "@/lib/terminal/vfs";
import { PROFILE } from "@/lib/profile";

const fixtures = path.join(__dirname, "..", "fixtures");
const tree = buildSiteTree({
  content: path.join(fixtures, "content"),
  posts: path.join(fixtures, "posts"),
  topics: [
    { slug: "alpha", name: "Alpha" },
    { slug: "epsilon", name: "Epsilon" },
  ],
});

/** A child by name, failing the test when it is missing. */
function at(node: TreeNode, ...names: string[]): TreeNode {
  let current = node;
  for (const name of names) {
    const next = current.children?.find((child) => child.name === name);
    if (!next) throw new Error(`no ${name} under ${current.href}`);
    current = next;
  }
  return current;
}

describe("buildSiteTree", () => {
  it("is a valid tree rooted at home, with the sections in navigation order", () => {
    expect(isSiteTree(tree)).toBe(true);
    expect(tree.root).toMatchObject({ name: "", href: "/", kind: "dir" });
    expect(tree.root.children?.map((node) => [node.name, node.kind])).toEqual([
      ["projects", "dir"],
      ["blog", "dir"],
      ["resume", "page"],
      ["docs", "dir"],
      ["playground", "page"],
      ["info", "page"],
    ]);
  });

  it("puts every topic under docs, then the every-sheet list", () => {
    const docs = at(tree.root, "docs");
    expect(docs.children?.map((node) => node.name)).toEqual(["alpha", "epsilon", SHEETS_NODE]);
    expect(at(docs, SHEETS_NODE)).toMatchObject({ href: "/sheets/", kind: "page" });
    expect(at(docs, "alpha")).toMatchObject({ title: "Alpha", href: "/alpha/", kind: "dir" });
  });

  it("lists a topic's directories and sheets in display order, with their sheets", () => {
    const epsilon = at(tree.root, "docs", "epsilon");
    expect(epsilon.children?.map((node) => [node.name, node.kind])).toEqual([
      ["grp", "dir"],
      ["loose", "page"],
      ["other", "dir"],
      ["empty", "dir"],
    ]);
    const grp = at(epsilon, "grp");
    expect(grp).toMatchObject({ title: "Group", href: "/epsilon/grp/", date: "2024-01-01" });
    expect(grp.children?.map((node) => [node.name, node.href])).toEqual([
      ["b", "/epsilon/grp/b/"],
      ["a", "/epsilon/grp/a/"],
    ]);
    expect(at(epsilon, "empty").children).toEqual([]);
    expect(grp.source).toBe("/source/epsilon/grp/index.md");
    expect(at(grp, "a").source).toBe("/source/epsilon/grp/a.md");
    expect(at(epsilon, "loose").source).toBe("/source/epsilon/loose.md");
    expect(at(tree.root, "docs", "epsilon")).not.toHaveProperty("source");
    expect(at(epsilon, "loose")).toMatchObject({ href: "/epsilon/loose/", title: "Loose sheet" });
  });

  it("lists posts newest first under blog, with their summaries", () => {
    const blog = at(tree.root, "blog");
    expect(blog.children?.map((node) => node.name)).toEqual(["hello-world", "same-day", "older"]);
    expect(at(blog, "hello-world")).toMatchObject({
      href: "/blog/hello-world/",
      kind: "page",
      date: "2026-01-02",
      note: "The first post.",
    });
    expect(at(blog, "older")).not.toHaveProperty("note");
    expect(at(blog, "older").source).toBe("/source/blog/older.md");
  });

  it("lists projects as links: a page of the site, a live URL or the source", () => {
    const projects = at(tree.root, "projects").children ?? [];
    expect(projects.every((node) => node.kind === "link")).toBe(true);
    expect(projects[0]).toMatchObject({ name: "zachs-docs", href: "/docs/" });
    const visualizer = projects.find((node) => node.name === "3d-algorithm-visualizer");
    expect(visualizer?.href).toStartWith("https://github.com/");
  });

  it("carries the profile for whoami", () => {
    expect(tree.profile).toMatchObject({ name: PROFILE.name, fullName: PROFILE.fullName });
    expect(tree.profile.links[0]).toEqual({ label: "GitHub", href: PROFILE.github });
  });
});

describe("projectSegment", () => {
  it("makes lowercase kebab-case, dropping apostrophes", () => {
    expect(projectSegment("Zach's Docs")).toBe("zachs-docs");
    expect(projectSegment("  3D Algorithm Visualizer! ")).toBe("3d-algorithm-visualizer");
  });
});
