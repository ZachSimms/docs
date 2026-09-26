/** Unit tests for `lib/playground/project.ts`: the immutable file/directory model behind the playground. */
import { describe, expect, it } from "bun:test";
import {
  addDir,
  addFile,
  isValidPath,
  PROJECT_LIMITS,
  parseProject,
  remove,
  rename,
  setEntry,
  setOpen,
  closeTab,
  toTree,
  updateFile,
  type Project,
} from "@/lib/playground/project";

const base: Project = {
  files: { "main.ts": "import { add } from './lib/math';", "lib/math.ts": "export const add = 1;" },
  dirs: [],
  entry: "main.ts",
  open: "main.ts",
  tabs: ["main.ts"],
};

/** Unwrap a successful operation or fail the test with its error. */
function ok(result: ReturnType<typeof addFile>): Project {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.project;
}

describe("isValidPath", () => {
  it("accepts relative paths of safe segments", () => {
    expect(isValidPath("main.ts")).toBe(true);
    expect(isValidPath("src/geometry/shapes.rs")).toBe(true);
    expect(isValidPath("include/vec.h")).toBe(true);
    expect(isValidPath("a_b-c.d/e")).toBe(true);
  });

  it("rejects traversal, absolute paths, empty segments and odd characters", () => {
    for (const bad of [
      "",
      "/main.ts",
      "../x",
      "a/../b",
      "a/./b",
      "a//b",
      "a/",
      "a b.ts",
      "a\\b",
      "é.py",
      ".",
    ]) {
      expect(isValidPath(bad)).toBe(false);
    }
  });

  it("rejects paths deeper than the limit", () => {
    const deep = Array.from({ length: PROJECT_LIMITS.maxDepth + 1 }, (_, i) => `d${i}`).join("/");
    expect(isValidPath(deep)).toBe(false);
  });
});

describe("addFile", () => {
  it("adds a file, opens it and leaves the original untouched", () => {
    const next = ok(addFile(base, "lib/index.ts", "export * from './math';"));
    expect(next.files["lib/index.ts"]).toBe("export * from './math';");
    expect(next.open).toBe("lib/index.ts");
    expect(next.tabs).toEqual(["main.ts", "lib/index.ts"]);
    expect(base.files["lib/index.ts"]).toBeUndefined();
    expect(base.tabs).toEqual(["main.ts"]);
  });

  it("refuses duplicates, invalid names, and files under a file", () => {
    expect(addFile(base, "main.ts").ok).toBe(false);
    expect(addFile(base, "../evil.ts").ok).toBe(false);
    expect(addFile(base, "main.ts/x.ts").ok).toBe(false);
    expect(addFile(base, "lib").ok).toBe(false); // lib is a directory
  });

  it("enforces the file-count and size limits", () => {
    const files = Object.fromEntries(
      Array.from({ length: PROJECT_LIMITS.maxFiles }, (_, i) => [`f${i}.ts`, ""]),
    );
    const full: Project = { ...base, files, entry: "f0.ts", open: "f0.ts", tabs: [] };
    const tooMany = addFile(full, "one-more.ts");
    expect(tooMany.ok).toBe(false);
    const big = addFile(base, "big.txt", "x".repeat(PROJECT_LIMITS.maxBytes));
    expect(big.ok).toBe(false);
  });
});

describe("addDir", () => {
  it("adds an empty directory that shows in the tree", () => {
    const next = ok(addDir(base, "assets"));
    expect(next.dirs).toContain("assets");
    expect(toTree(next).map((n) => n.name)).toContain("assets");
  });

  it("refuses an existing file or directory name", () => {
    expect(addDir(base, "lib").ok).toBe(false);
    expect(addDir(base, "main.ts").ok).toBe(false);
  });
});

describe("updateFile", () => {
  it("replaces contents immutably", () => {
    const next = ok(updateFile(base, "main.ts", "console.log(1)"));
    expect(next.files["main.ts"]).toBe("console.log(1)");
    expect(base.files["main.ts"]).toContain("import");
  });

  it("refuses unknown files and oversize contents", () => {
    expect(updateFile(base, "nope.ts", "").ok).toBe(false);
    expect(updateFile(base, "main.ts", "x".repeat(PROJECT_LIMITS.maxBytes + 1)).ok).toBe(false);
  });
});

describe("rename", () => {
  it("renames a file and carries entry, open and tabs with it", () => {
    const next = ok(rename(base, "main.ts", "index.ts"));
    expect(next.files["index.ts"]).toBeDefined();
    expect(next.files["main.ts"]).toBeUndefined();
    expect(next.entry).toBe("index.ts");
    expect(next.open).toBe("index.ts");
    expect(next.tabs).toEqual(["index.ts"]);
  });

  it("renames a directory and moves everything inside it", () => {
    const withDir = ok(addDir(ok(setOpen(base, "lib/math.ts")), "lib/empty"));
    const next = ok(rename(withDir, "lib", "utils"));
    expect(Object.keys(next.files).sort()).toEqual(["main.ts", "utils/math.ts"]);
    expect(next.dirs).toContain("utils/empty");
    expect(next.dirs).not.toContain("lib/empty");
    expect(next.open).toBe("utils/math.ts");
  });

  it("refuses to overwrite, to move a directory into itself, or an invalid target", () => {
    const two = ok(addFile(base, "other.ts"));
    expect(rename(two, "other.ts", "main.ts").ok).toBe(false);
    expect(rename(base, "lib", "lib/inner").ok).toBe(false);
    expect(rename(base, "main.ts", "../x.ts").ok).toBe(false);
    expect(rename(base, "missing.ts", "x.ts").ok).toBe(false);
  });
});

describe("remove", () => {
  it("removes a file and its tab, reopening the entry", () => {
    const opened = ok(setOpen(base, "lib/math.ts"));
    const next = ok(remove(opened, "lib/math.ts"));
    expect(next.files["lib/math.ts"]).toBeUndefined();
    expect(next.tabs).not.toContain("lib/math.ts");
    expect(next.open).toBe("main.ts");
  });

  it("removes a directory recursively", () => {
    const next = ok(remove(ok(addDir(base, "lib/empty")), "lib"));
    expect(Object.keys(next.files)).toEqual(["main.ts"]);
    expect(next.dirs).toEqual([]);
  });

  it("refuses to remove the entry file or the directory holding it", () => {
    expect(remove(base, "main.ts").ok).toBe(false);
    const nested = ok(setEntry(base, "lib/math.ts"));
    expect(remove(nested, "lib").ok).toBe(false);
  });
});

describe("tabs", () => {
  it("setOpen adds a tab once; closeTab moves focus to a neighbour", () => {
    const a = ok(setOpen(base, "lib/math.ts"));
    const b = ok(setOpen(a, "lib/math.ts"));
    expect(b.tabs).toEqual(["main.ts", "lib/math.ts"]);
    const c = closeTab(b, "lib/math.ts");
    expect(c.tabs).toEqual(["main.ts"]);
    expect(c.open).toBe("main.ts");
  });
});

describe("toTree", () => {
  it("nests directories first, then files, alphabetically", () => {
    const project = ok(addFile(ok(addDir(base, "assets")), "b.ts"));
    const tree = toTree(project);
    expect(tree.map((n) => `${n.kind}:${n.name}`)).toEqual([
      "dir:assets",
      "dir:lib",
      "file:b.ts",
      "file:main.ts",
    ]);
    const lib = tree.find((n) => n.name === "lib");
    expect(lib?.kind === "dir" && lib.children.map((c) => c.path)).toEqual(["lib/math.ts"]);
  });
});

describe("parseProject", () => {
  it("accepts a valid stored project", () => {
    expect(parseProject(JSON.parse(JSON.stringify(base)))).toEqual(base);
  });

  it("rejects bad paths, a missing entry and oversize data", () => {
    expect(parseProject({ ...base, files: { "../x": "" } })).toBeNull();
    expect(parseProject({ ...base, entry: "gone.ts" })).toBeNull();
    expect(
      parseProject({ ...base, files: { "main.ts": "x".repeat(PROJECT_LIMITS.maxBytes + 1) } }),
    ).toBeNull();
    expect(parseProject("nope")).toBeNull();
  });

  it("repairs an open file or tabs that no longer exist", () => {
    const parsed = parseProject({ ...base, open: "gone.ts", tabs: ["gone.ts", "main.ts"] });
    expect(parsed?.open).toBe("main.ts");
    expect(parsed?.tabs).toEqual(["main.ts"]);
  });
});

describe("inherited property names", () => {
  it("are never mistaken for files", () => {
    expect(parseProject({ ...base, entry: "constructor" })).toBeNull();
    const withConstructor = ok(addFile(base, "constructor"));
    expect(Object.getOwnPropertyDescriptor(withConstructor.files, "constructor")?.value).toBe("");
    expect(ok(addFile(base, "toString")).open).toBe("toString");
    expect(updateFile(base, "valueOf", "x").ok).toBe(false);
  });
});
