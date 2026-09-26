/** Unit tests for `lib/playground/intellisense/ts-config.ts`: which files get the TypeScript service, and type acquisition. */
import { describe, expect, it } from "bun:test";
import {
  isTsServicePath,
  serviceFiles,
  typesSource,
  typesVersion,
  usesBunTypes,
  usesTsService,
  vfsPath,
} from "@/lib/playground/intellisense/ts-config";

describe("which projects and files get the TypeScript service", () => {
  it("covers the JS/TS project types, and Bun types only for Bun projects", () => {
    expect(usesTsService("react")).toBe(true);
    expect(usesTsService("hono")).toBe(true);
    expect(usesTsService("python")).toBe(false);
    expect(usesTsService("markdown")).toBe(false);
    expect(usesBunTypes("bun")).toBe(true);
    expect(usesBunTypes("hono")).toBe(true);
    expect(usesBunTypes("typescript")).toBe(false);
  });

  it("handles scripts of every flavor, not styles or markup", () => {
    for (const path of ["a.ts", "src/App.tsx", "x.js", "y.jsx", "z.mjs", "w.cts", "types.d.ts"])
      expect(isTsServicePath(path)).toBe(true);
    for (const path of ["index.html", "styles.css", "README.md", "package.json"])
      expect(isTsServicePath(path)).toBe(false);
  });

  it("mirrors scripts and package.json at the root of the virtual file system", () => {
    expect(vfsPath("src/main.ts")).toBe("/src/main.ts");
    expect(vfsPath("/src/main.ts")).toBe("/src/main.ts");
    expect(
      serviceFiles({
        "index.html": "<p>",
        "src/main.ts": "x",
        "package.json": "{}",
        ".env": "A=1",
      }),
    ).toEqual({ "/src/main.ts": "x", "/package.json": "{}" });
  });
});

describe("type acquisition", () => {
  it("asks for exact versions, falling back to latest for other ranges", () => {
    expect(typesVersion("^19.3.0")).toBe("19.3.0");
    expect(typesVersion("~4.13.9")).toBe("4.13.9");
    expect(typesVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1");
    expect(typesVersion(">=1 <2")).toBe("latest");
    expect(typesVersion("*")).toBe("latest");
  });

  it("writes one hinted import per dependency in package.json", () => {
    const files = {
      "package.json": JSON.stringify({ dependencies: { react: "^19.3.0", hono: "latest" } }),
    };
    expect(typesSource(files)).toBe(
      'import "react"; // types: 19.3.0\nimport "hono"; // types: latest',
    );
    expect(typesSource({})).toBe("");
  });
});

describe("the editor side of the TypeScript service", () => {
  it("shows type errors as warnings, leaving other severities alone", async () => {
    const { asWarnings } = await import("@/components/playground/intellisense/typescript");
    const out = asWarnings([
      {
        from: 0,
        to: 1,
        severity: "error",
        message: "Type 'number' is not assignable to type 'string'.",
      },
      { from: 2, to: 3, severity: "info", message: "note" },
    ]);
    expect(out.map((d) => d.severity)).toEqual(["warning", "info"]);
  });

  it("renders the signature, the documentation and tags as text (never as HTML)", async () => {
    const { renderHover } = await import("@/components/playground/intellisense/typescript");
    const { dom } = renderHover({
      start: 0,
      end: 3,
      typeDef: undefined,
      quickInfo: {
        kind: "function" as never,
        kindModifiers: "",
        textSpan: { start: 0, length: 3 },
        displayParts: [{ text: "function add(a: number): number", kind: "text" }],
        documentation: [{ text: "Adds <b>numbers</b>.", kind: "text" }],
        tags: [{ name: "param", text: [{ text: "a the first", kind: "text" }] }],
      },
    });
    expect(dom.querySelector(".pg-hover-sig")?.textContent).toBe("function add(a: number): number");
    expect(dom.querySelector("b")).toBeNull();
    expect(dom.textContent).toContain("Adds <b>numbers</b>.");
    expect(dom.querySelector(".pg-hover-tag")?.textContent).toBe("@param a the first");
  });
});

describe("basedpyright", () => {
  it("reads a workspace config that points at the bundled stubs and skips them", async () => {
    const { pyrightInitOptions } = await import("@/lib/playground/intellisense/pyright-config");
    const config = JSON.parse(pyrightInitOptions().files["/pyrightconfig.json"]!);
    expect(config).toMatchObject({
      typeshedPath: "/typeshed",
      include: ["**/*.py"],
      pythonVersion: "3.14",
      typeCheckingMode: "standard",
    });
  });

  it("maps project paths to URIs, and only Python files", async () => {
    const { pythonFiles, pythonUri } = await import("@/lib/playground/intellisense/pyright-config");
    expect(pythonUri("shapes/my circle.py")).toBe("file:///shapes/my%20circle.py");
    expect([
      ...pythonFiles({ "main.py": "x", "data/values.txt": "1", "t.pyi": "" }).keys(),
    ]).toEqual(["file:///main.py", "file:///t.pyi"]);
  });

  it("softens type errors (they have a rule name) but not syntax errors", async () => {
    const { softenDiagnostics } = await import("@/lib/playground/intellisense/pyright-config");
    expect(
      softenDiagnostics([
        { severity: 1, code: "reportAttributeAccessIssue" },
        { severity: 1 },
        { severity: 3, code: "reportUnusedVariable" },
      ]).map((d) => d.severity),
    ).toEqual([2, 1, 3]);
  });

  it("opens every project file in the server once initialized, and keeps them in sync", async () => {
    const { ProjectWorkspace } = await import("@/components/playground/intellisense/python");
    const { EditorState } = await import("@codemirror/state");
    const sent: string[] = [];
    const client = {
      notification: (method: string, params: { uri?: string; textDocument?: { uri: string } }) =>
        sent.push(`${method} ${params.uri ?? params.textDocument?.uri}`),
      didOpen: (file: { uri: string }) => sent.push(`open ${file.uri}`),
      didClose: (uri: string) => sent.push(`close ${uri}`),
    };
    const workspace = new ProjectWorkspace(client as never);
    workspace.setProject({ "main.py": "import shapes", "shapes/__init__.py": "" });
    expect(sent).toEqual([]); // nothing before the server is up
    workspace.connected();
    expect(sent).toEqual([
      "pyright/createFile file:///main.py",
      "open file:///main.py",
      "pyright/createFile file:///shapes/__init__.py",
      "open file:///shapes/__init__.py",
    ]);

    sent.length = 0;
    const view = { state: EditorState.create({ doc: "import shapes" }) };
    workspace.openFile("file:///main.py", "python", view as never);
    expect(sent).toEqual([]); // same text: nothing to send
    workspace.setProject({ "main.py": "edited in the editor", "shapes/__init__.py": "X = 1" });
    // main.py syncs from its editor; the other file from the project.
    expect(sent).toEqual(["textDocument/didChange file:///shapes/__init__.py"]);

    sent.length = 0;
    workspace.closeFile("file:///main.py", view as never);
    workspace.setProject({ "main.py": "print(1)" });
    expect(sent).toEqual([
      "close file:///shapes/__init__.py",
      "pyright/deleteFile file:///shapes/__init__.py",
      "textDocument/didChange file:///main.py",
    ]);
  });
});
