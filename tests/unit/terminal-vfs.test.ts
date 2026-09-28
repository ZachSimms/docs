/** Unit tests for `lib/terminal/vfs.ts`: validation, paths, resolution and completion. */
import { describe, expect, it } from "bun:test";
import {
  buildFs,
  commonPrefix,
  complete,
  displayName,
  isExternal,
  isSiteTree,
  nodeForHref,
  normalizeHref,
  pathOf,
  resolvePath,
  type Fs,
  type FsNode,
  type SiteTree,
} from "@/lib/terminal/vfs";
import { TREE } from "../fixtures/terminal";

const fs: Fs = buildFs(TREE);

/** The node at a path, failing the test when it is missing. */
function node(path: string, cwd: FsNode = fs.root): FsNode {
  const found = resolvePath(fs, cwd, path);
  if (!found) throw new Error(`no node at ${path}`);
  return found;
}

describe("isSiteTree", () => {
  it("accepts a well-formed tree", () => {
    expect(isSiteTree(TREE)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSiteTree(null)).toBe(false);
    expect(isSiteTree({ root: TREE.root })).toBe(false);
    expect(isSiteTree({ ...TREE, root: { ...TREE.root, kind: "folder" } })).toBe(false);
    expect(isSiteTree({ ...TREE, root: { ...TREE.root, children: [{ name: 1 }] } })).toBe(false);
    expect(isSiteTree({ ...TREE, profile: { ...TREE.profile, links: [{ label: "x" }] } })).toBe(
      false,
    );
    expect(isSiteTree({ ...TREE, profile: { ...TREE.profile, bio: 3 } })).toBe(false);
  });
});

describe("buildFs", () => {
  it("links parents and indexes the site's own pages by href", () => {
    const strings = node("docs/python/language/strings");
    expect(strings.parent?.name).toBe("language");
    expect(fs.byHref.get("/python/language/strings/")).toBe(strings);
  });

  it("keeps an href for the first node that has it, and never indexes links", () => {
    expect(fs.byHref.get("/docs/")).toBe(node("docs"));
    expect([...fs.byHref.values()].some((n) => n.kind === "link")).toBe(false);
  });
});

describe("paths", () => {
  it("names nodes from home", () => {
    expect(pathOf(fs.root)).toBe("~");
    expect(pathOf(node("docs/python/overview"))).toBe("~/docs/python/overview");
  });

  it("marks directories with a slash", () => {
    expect(displayName(node("docs"))).toBe("docs/");
    expect(displayName(node("info"))).toBe("info");
  });

  it("normalizes pathnames to the tree's hrefs", () => {
    expect(normalizeHref("/python/overview")).toBe("/python/overview/");
    expect(normalizeHref("/python/overview/#lists")).toBe("/python/overview/");
    expect(normalizeHref("/python/?q=1")).toBe("/python/");
    expect(nodeForHref(fs, "/python/overview")?.name).toBe("overview");
    expect(nodeForHref(fs, "/nope/")).toBeUndefined();
  });

  it("tells links out from the site's own", () => {
    expect(isExternal("https://example.com")).toBe(true);
    expect(isExternal("//example.com")).toBe(true);
    expect(isExternal("mailto:a@b.c")).toBe(true);
    expect(isExternal("/docs/")).toBe(false);
  });
});

describe("resolvePath", () => {
  const python = () => node("docs/python");

  it("resolves home, absolute and relative paths", () => {
    expect(resolvePath(fs, python(), "~")).toBe(fs.root);
    expect(resolvePath(fs, python(), "/")).toBe(fs.root);
    expect(resolvePath(fs, python(), "~/info")?.name).toBe("info");
    expect(resolvePath(fs, python(), "/docs/physics")?.name).toBe("physics");
    expect(resolvePath(fs, python(), "language/oop")?.name).toBe("oop");
    expect(resolvePath(fs, python(), "./overview/")?.name).toBe("overview");
  });

  it("goes up with .., staying home at the top", () => {
    expect(resolvePath(fs, python(), "..")?.name).toBe("docs");
    expect(resolvePath(fs, python(), "../../..")).toBe(fs.root);
  });

  it("matches names ignoring case, titles, and listing numbers", () => {
    expect(resolvePath(fs, python(), "FastAPI")?.name).toBe("fastapi");
    expect(resolvePath(fs, python(), "OVERVIEW")?.name).toBe("overview");
    expect(resolvePath(fs, python(), "0/1")?.name).toBe("oop");
    expect(resolvePath(fs, python(), "9")).toBeUndefined();
  });

  it("falls back to a URL of the site for absolute paths", () => {
    expect(resolvePath(fs, fs.root, "/python/overview/")?.name).toBe("overview");
    expect(resolvePath(fs, fs.root, "/python/language/strings")?.name).toBe("strings");
    expect(resolvePath(fs, fs.root, "/nope/")).toBeUndefined();
  });

  it("from a page, matches its siblings too", () => {
    const overview = node("docs/python/overview");
    expect(resolvePath(fs, overview, "fastapi")?.name).toBe("fastapi");
    expect(resolvePath(fs, overview, "..")?.name).toBe("python");
    expect(resolvePath(fs, overview, "nope")).toBeUndefined();
  });

  it("finds nothing below a page", () => {
    expect(resolvePath(fs, fs.root, "info/x")).toBeUndefined();
    expect(resolvePath(fs, fs.root, "docs/nope/x")).toBeUndefined();
  });
});

describe("commonPrefix", () => {
  it("is the longest shared start, ignoring case", () => {
    expect(commonPrefix([])).toBe("");
    expect(commonPrefix(["overview"])).toBe("overview");
    expect(commonPrefix(["strings", "STRUCTS", "str"])).toBe("str");
  });
});

describe("complete", () => {
  const commands = ["cat", "cd", "clear", "ls"];
  const python = () => node("docs/python");

  it("completes command names, listing the choices when ambiguous", () => {
    expect(complete(fs, fs.root, "l", commands)).toEqual({ line: "ls ", choices: [] });
    expect(complete(fs, fs.root, "c", commands)).toEqual({
      line: "c",
      choices: ["cat", "cd", "clear"],
    });
    expect(complete(fs, fs.root, "cl", commands).line).toBe("clear ");
    expect(complete(fs, fs.root, "x", commands)).toEqual({ line: "x", choices: [] });
  });

  it("completes paths: a slash after a directory, a space after a page", () => {
    expect(complete(fs, fs.root, "cd d", commands).line).toBe("cd docs/");
    expect(complete(fs, fs.root, "cd docs/p", commands)).toEqual({
      line: "cd docs/p",
      choices: ["python/", "physics/"],
    });
    expect(complete(fs, python(), "cat ov", commands).line).toBe("cat overview ");
    expect(complete(fs, python(), "ls ", commands).choices).toEqual([
      "language/",
      "overview",
      "fastapi",
    ]);
  });

  it("extends to a shared prefix", () => {
    const tree: SiteTree = {
      ...TREE,
      root: {
        ...TREE.root,
        children: [
          { name: "stream-a", title: "A", href: "/a/", kind: "page" },
          { name: "stream-b", title: "B", href: "/b/", kind: "page" },
        ],
      },
    };
    const small = buildFs(tree);
    expect(complete(small, small.root, "cat st", commands)).toEqual({
      line: "cat stream-",
      choices: [],
    });
  });

  it("completes beside the page being read", () => {
    expect(complete(fs, node("docs/python/overview"), "cd fa", commands).line).toBe("cd fastapi ");
  });

  it("leaves unknown directories alone", () => {
    expect(complete(fs, fs.root, "cd nope/x", commands)).toEqual({
      line: "cd nope/x",
      choices: [],
    });
    expect(complete(fs, fs.root, "cd info/x", commands)).toEqual({
      line: "cd info/x",
      choices: [],
    });
  });

  it("completes #headings of the current page", () => {
    const anchors = ["lists", "list-comprehensions", "dicts"];
    expect(complete(fs, fs.root, "cd #d", commands, anchors).line).toBe("cd #dicts ");
    expect(complete(fs, fs.root, "cd #li", commands, anchors)).toEqual({
      line: "cd #list",
      choices: [],
    });
    expect(complete(fs, fs.root, "cd #list", commands, anchors).choices).toEqual([
      "#lists",
      "#list-comprehensions",
    ]);
    expect(complete(fs, fs.root, "cd #z", commands, anchors)).toEqual({
      line: "cd #z",
      choices: [],
    });
  });
});
