/** Unit tests for the playground's UI pieces: file tree, console, reference panel, symbol row, sandbox frames. */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createRef } from "react";
import type { EditorHandle } from "@/components/playground/CodeEditor";
import { ConsolePane } from "@/components/playground/ConsolePane";
import { DOCS_MANIFEST_URL, resetDocsCache } from "@/components/playground/DocsTab";
import { FileTree, type TreeCommand } from "@/components/playground/FileTree";
import { ReferencePanel } from "@/components/playground/ReferencePanel";
import { SymbolRow } from "@/components/playground/SymbolRow";
import {
  PREVIEW_SANDBOX_FLAGS,
  SANDBOX_FLAGS,
  useSandboxFrame,
} from "@/components/playground/useSandboxFrame";
import { WebPreview } from "@/components/playground/WebPreview";
import { getLanguage } from "@/lib/playground/languages";
import { appendOutput, EMPTY_OUTPUT } from "@/lib/playground/output";
import { TEMPLATES } from "@/lib/playground/templates";
import {
  isPlaygroundPath,
  isSheetUrl,
  OPEN_REFERENCE_EVENT,
  openReference,
} from "@/lib/reference-panel";
import { resetSearchIndexCache } from "@/lib/search-index-client";
import type { SearchDoc } from "@/lib/search-rank";
import { EMBED_ATTRIBUTE, EMBED_INIT_SCRIPT } from "@/lib/theme";

describe("FileTree", () => {
  /** Render the Python starter's tree with a recording command handler. */
  function setup(respond: (c: TreeCommand) => string | null = () => null) {
    const commands: TreeCommand[] = [];
    const opened: string[] = [];
    render(
      <FileTree
        project={TEMPLATES.python}
        onOpen={(p) => opened.push(p)}
        onCommand={(c) => (commands.push(c), respond(c))}
      />,
    );
    return { commands, opened, tree: screen.getByRole("tree", { name: "Project files" }) };
  }

  it("draws the project with connectors, folders first, and marks the entry and open file", () => {
    const { tree } = setup();
    const rows = within(tree).getAllByRole("treeitem");
    expect(rows.map((r) => r.getAttribute("data-path"))).toEqual([
      "data",
      "data/values.txt",
      "shapes",
      "shapes/__init__.py",
      "shapes/circle.py",
      "main.py",
      "README.md",
    ]);
    expect(rows[0]).toHaveTextContent("├── data/");
    expect(rows[1]?.querySelector(".pg-tree-prefix")?.textContent).toBe("│   └── ");
    expect(rows[5]).toHaveTextContent("├── ▶ main.py");
    expect(rows[6]).toHaveTextContent("└── README.md");
    expect(rows[5]).toHaveAttribute("aria-selected", "true");
  });

  it("opens files on click, folds folders, and moves with the arrow keys", () => {
    const { tree, opened } = setup();
    fireEvent.click(within(tree).getByText("circle.py"));
    expect(opened).toEqual(["shapes/circle.py"]);
    fireEvent.click(within(tree).getByText("shapes/"));
    expect(within(tree).queryByText("circle.py")).toBeNull();
    const first = within(tree).getAllByRole("treeitem")[0]!;
    act(() => first.focus());
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.getAttribute("data-path")).toBe("data/values.txt");
  });

  it("renames with F2 and an inline field", () => {
    const { tree, commands } = setup();
    const row = within(tree)
      .getAllByRole("treeitem")
      .find((r) => r.dataset.path === "shapes/circle.py")!;
    act(() => row.focus());
    fireEvent.keyDown(document.activeElement!, { key: "F2" });
    const input = screen.getByRole("textbox", { name: "Rename shapes/circle.py" });
    fireEvent.change(input, { target: { value: "disc.py" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commands).toEqual([{ type: "rename", from: "shapes/circle.py", to: "shapes/disc.py" }]);
  });

  it("asks inline before deleting, and never uses a browser dialog", () => {
    const originalConfirm = window.confirm;
    let dialogs = 0;
    window.confirm = () => (dialogs++, true);
    try {
      const { tree, commands } = setup();
      const row = within(tree)
        .getAllByRole("treeitem")
        .find((r) => r.dataset.path === "data")!;
      act(() => row.focus());
      fireEvent.keyDown(document.activeElement!, { key: "Delete" });
      expect(screen.getByText(/delete data\/ and everything in it\?/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "yes" }));
      expect(commands).toEqual([{ type: "remove", path: "data" }]);
      expect(dialogs).toBe(0);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it("creates a file in the focused folder and shows the model's error inline", () => {
    const { tree, commands } = setup((c) =>
      c.type === "add-file" && c.path.endsWith("bad") ? "no good" : null,
    );
    const shapes = within(tree)
      .getAllByRole("treeitem")
      .find((r) => r.dataset.path === "shapes")!;
    act(() => shapes.focus());
    fireEvent.click(screen.getByRole("button", { name: "+ file" }));
    const input = screen.getByRole("textbox", { name: "New file name" });
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commands.at(-1)).toEqual({ type: "add-file", path: "shapes/bad" });
    expect(screen.getByRole("alert")).toHaveTextContent("no good");
    fireEvent.change(input, { target: { value: "square.py" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commands.at(-1)).toEqual({ type: "add-file", path: "shapes/square.py" });
    expect(screen.queryByRole("textbox", { name: "New file name" })).toBeNull();
  });

  it("lets keyboard users confirm a delete with Enter on the inline button", () => {
    const { tree, commands, opened } = setup();
    const row = within(tree)
      .getAllByRole("treeitem")
      .find((r) => r.dataset.path === "shapes/circle.py")!;
    act(() => row.focus());
    fireEvent.keyDown(document.activeElement!, { key: "Delete" });
    const yes = screen.getByRole("button", { name: "yes" });
    const enter = fireEvent.keyDown(yes, { key: "Enter" });
    expect(enter).toBe(true); // not swallowed by the tree, so the button's click still happens
    fireEvent.click(yes);
    expect(commands).toEqual([{ type: "remove", path: "shapes/circle.py" }]);
    expect(opened).toEqual([]);
  });

  it("offers the actions behind the ⋯ button, including set as entry", () => {
    const { commands } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Actions for shapes/circle.py" }));
    const menu = screen.getByRole("menu", { name: "Actions for shapes/circle.py" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Set as entry" }));
    expect(commands).toEqual([{ type: "set-entry", path: "shapes/circle.py" }]);
  });
});

describe("ConsolePane", () => {
  const base = {
    spec: getLanguage("python"),
    phase: "done" as const,
    status: "ran in 1.0 s · exit 0",
    stdin: "world",
    onStdin: () => undefined,
    onClear: () => undefined,
    askDownload: false,
    onApproveDownload: () => undefined,
    onCancelDownload: () => undefined,
  };

  it("renders program output as text, never as HTML", () => {
    const output = appendOutput(
      appendOutput(EMPTY_OUTPUT, "stdout", '<img src=x onerror="alert(1)">\n'),
      "stderr",
      "Traceback\n",
    );
    const { container } = render(<ConsolePane {...base} output={output} />);
    expect(container.querySelector(".pg-output img")).toBeNull();
    expect(screen.getByLabelText("Program output")).toHaveTextContent(
      '<img src=x onerror="alert(1)">',
    );
    expect(container.querySelector(".pg-stderr")).toHaveTextContent("Traceback");
    expect(screen.getByRole("status")).toHaveTextContent("ran in 1.0 s · exit 0");
  });

  it("shows stdin only for languages that read it, and the credit line", () => {
    const { unmount } = render(<ConsolePane {...base} output={EMPTY_OUTPUT} />);
    expect(screen.getByRole("textbox")).toHaveValue("world");
    expect(screen.getByText(/Pyodide/)).toBeInTheDocument();
    unmount();
    render(<ConsolePane {...base} spec={getLanguage("typescript")} output={EMPTY_OUTPUT} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("asks before the first big download", () => {
    const calls: string[] = [];
    render(
      <ConsolePane
        {...base}
        output={EMPTY_OUTPUT}
        askDownload
        onApproveDownload={() => calls.push("yes")}
        onCancelDownload={() => calls.push("no")}
      />,
    );
    expect(screen.getByRole("group", { name: "Download needed" })).toHaveTextContent("≈ 6 MB");
    fireEvent.click(screen.getByRole("button", { name: "download and run" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(calls).toEqual(["yes", "no"]);
  });
});

describe("ReferencePanel", () => {
  const docs: SearchDoc[] = [
    {
      topic: "design",
      slug: "tailwind",
      title: "Tailwind CSS",
      url: "/design/css/tailwind/",
      headings: ["Flexbox"],
      text: "flex grid",
    },
    {
      topic: "python",
      slug: "fundamentals",
      title: "Fundamentals",
      url: "/python/language/fundamentals/",
      headings: [],
      text: "lists",
    },
  ];
  const docsManifest = {
    docs: [
      {
        slug: "html",
        name: "HTML (MDN)",
        release: null,
        mtime: 2,
        home: "https://developer.mozilla.org/",
        attribution: "© MDN contributors. CC BY-SA 2.5+.",
      },
      {
        slug: "python~3.14",
        name: "Python 3.14",
        release: "3.14",
        mtime: 1,
        home: "https://docs.python.org/",
        attribution: "© Python Software Foundation. Licensed under the PSF License.",
      },
    ],
  };
  const docsIndex = {
    entries: [
      { name: "print()", path: "library/functions#print", type: "Built-in Functions" },
      { name: "pprint", path: "library/pprint", type: "Data Types" },
    ],
  };
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  beforeEach(() => {
    resetSearchIndexCache();
    resetDocsCache();
    fetched.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetched.push(url);
      if (url === DOCS_MANIFEST_URL) return new Response(JSON.stringify(docsManifest));
      if (url.endsWith("/index.json?1")) return new Response(JSON.stringify(docsIndex));
      if (url.includes("documents.devdocs.io")) return new Response("<h1>Built-in Functions</h1>");
      return new Response(JSON.stringify(docs));
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const props = {
    language: "python" as const,
    suggestions: getLanguage("python").refs,
    width: 420,
    onWidth: () => undefined,
    onClose: () => undefined,
    requested: null,
  };

  it("suggests sheets for the language, then searches and opens one in a frame", async () => {
    render(<ReferencePanel {...props} />);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("python/language/fundamentals");
    const box = screen.getByRole("combobox", { name: "Search reference sheets" });
    fireEvent.change(box, { target: { value: "flexbox" } });
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0]).toHaveTextContent("design/css/tailwind"),
    );
    fireEvent.keyDown(box, { key: "Enter" });
    const frame = screen.getByTitle("Reference: /design/css/tailwind/");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", "/design/css/tailwind/");
    expect(screen.getByRole("link", { name: /new tab/ })).toHaveAttribute("target", "_blank");
  });

  it("opens a sheet requested from ⌘K, and resizes from the keyboard", () => {
    const widths: number[] = [];
    const { rerender } = render(<ReferencePanel {...props} onWidth={(w) => widths.push(w)} />);
    rerender(
      <ReferencePanel
        {...props}
        onWidth={(w) => widths.push(w)}
        requested={{ url: "/cpp/fundamentals/", n: 1 }}
      />,
    );
    expect(screen.getByTitle("Reference: /cpp/fundamentals/")).toBeInTheDocument();
    const handle = screen.getByRole("separator", { name: "Resize reference panel width" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(widths).toEqual([436, 404]);
  });

  it("searches the official docs for the project and opens a page with its attribution link", async () => {
    render(<ReferencePanel {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Docs" }));
    const box = await screen.findByRole("combobox", { name: "Search the official docs" });
    await waitFor(() => expect(screen.getByText(/from Python 3\.14/)).toBeInTheDocument());
    fireEvent.change(box, { target: { value: "print" } });
    const results = screen.getByRole("listbox", { name: "Docs" });
    await waitFor(() =>
      expect(within(results).getAllByRole("option")[0]).toHaveTextContent("print()"),
    );
    expect(fetched).toContain("https://documents.devdocs.io/python~3.14/index.json?1");
    fireEvent.keyDown(box, { key: "Enter" });
    const frame = await screen.findByTitle("Python 3.14: print()");
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("default-src 'none'");
    expect(fetched).toContain("https://documents.devdocs.io/python~3.14/library/functions.html?1");
    expect(screen.getByRole("link", { name: /official/ })).toHaveAttribute(
      "href",
      "https://docs.python.org/3.14/library/functions.html#print",
    );
    fireEvent.click(screen.getByRole("button", { name: "← results" }));
    expect(screen.getByRole("combobox", { name: "Search the official docs" })).toHaveValue("print");
  });

  it("an Open docs request replaces a framed site, and is reported as shown", async () => {
    const shown: number[] = [];
    const web = { ...props, language: "web" as const };
    const { rerender } = render(<ReferencePanel {...web} />);
    fireEvent.click(screen.getByRole("tab", { name: "Docs" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tailwind CSS docs" }));
    expect(screen.getByTitle("Tailwind CSS docs")).toBeInTheDocument();
    rerender(
      <ReferencePanel
        {...web}
        requestedDoc={{ slug: "html", path: "reference/elements/div", name: "div", n: 1 }}
        onDocShown={() => shown.push(1)}
      />,
    );
    expect(await screen.findByTitle("HTML (MDN): div")).toBeInTheDocument();
    expect(screen.queryByTitle("Tailwind CSS docs")).toBeNull();
    expect(shown.length).toBeGreaterThan(0);
  });
});

describe("SymbolRow", () => {
  it("inserts symbols without taking focus, and handles indent, cursor and undo", () => {
    const calls: string[] = [];
    const handle = createRef<EditorHandle | null>() as { current: EditorHandle | null };
    handle.current = {
      insert: (t) => calls.push(`insert:${t}`),
      moveCursor: (d) => calls.push(`move:${d}`),
      undo: () => calls.push("undo"),
      focus: () => calls.push("focus"),
      showHover: () => calls.push("hover"),
    };
    const { rerender } = render(<SymbolRow handleRef={handle} indent={"\t"} visible={false} />);
    expect(screen.queryByRole("toolbar")).toBeNull();
    rerender(<SymbolRow handleRef={handle} indent={"\t"} visible />);
    const press = (name: string) => {
      const button = screen.getByRole("button", { name });
      const event = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
      act(() => void button.dispatchEvent(event));
      return event.defaultPrevented;
    };
    expect(press("{")).toBe(true); // default prevented: the editor keeps focus
    press("Tab");
    press("Cursor left");
    press("Undo");
    press("Info at cursor");
    expect(calls).toEqual(["insert:{", "insert:\t", "move:-1", "undo", "hover"]);
  });
});

describe("sandbox frames", () => {
  it("grant code runners allow-scripts only, and the preview forms too", () => {
    expect(SANDBOX_FLAGS).toBe("allow-scripts");
    expect(PREVIEW_SANDBOX_FLAGS).toBe("allow-scripts allow-forms");
    const { container } = render(
      <WebPreview
        project={TEMPLATES.web}
        refreshKey={0}
        onReload={() => undefined}
        onOutput={() => undefined}
      />,
    );
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-forms");
    expect(frame.getAttribute("sandbox")).not.toMatch(/same-origin|popups|top-navigation|modals/);
  });
});

describe("reference panel helpers", () => {
  it("recognize the playground path and site-relative sheet URLs only", () => {
    expect(isPlaygroundPath("/playground/")).toBe(true);
    expect(isPlaygroundPath("/playground")).toBe(true);
    expect(isPlaygroundPath("/playground/node/")).toBe(true);
    expect(isPlaygroundPath("/playground/node")).toBe(true);
    expect(isPlaygroundPath("/playground/godot/")).toBe(false);
    expect(isPlaygroundPath("/python/")).toBe(false);
    expect(isSheetUrl("/design/css/tailwind/")).toBe(true);
    expect(isSheetUrl("/python/overview/#lists")).toBe(true);
    for (const bad of [
      "https://evil.test/",
      "javascript:alert(1)",
      "//evil.test/",
      "/a/b/c/d/",
      42,
    ]) {
      expect(isSheetUrl(bad)).toBe(false);
    }
  });

  it("dispatch the open-reference event", () => {
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<{ url: string }>).detail.url);
    window.addEventListener(OPEN_REFERENCE_EVENT, listener);
    openReference("/cpp/fundamentals/");
    window.removeEventListener(OPEN_REFERENCE_EVENT, listener);
    expect(seen).toEqual(["/cpp/fundamentals/"]);
  });
});

describe("EMBED_INIT_SCRIPT", () => {
  /** Run the script against a fake window/document. */
  function runWith(framed: boolean | "throws") {
    const attrs = new Map<string, string>();
    const document = {
      documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) },
    };
    const self = {};
    const window = {
      self,
      get top() {
        if (framed === "throws") throw new Error("cross-origin");
        return framed ? {} : self;
      },
    };
    new Function("window", "document", EMBED_INIT_SCRIPT)(window, document);
    return attrs.has(EMBED_ATTRIBUTE);
  }

  it("marks <html data-embed> only when the page is framed", () => {
    expect(runWith(false)).toBe(false);
    expect(runWith(true)).toBe(true);
    expect(runWith("throws")).toBe(true);
  });
});

describe("useSandboxFrame", () => {
  type Frame = ReturnType<typeof useSandboxFrame>;

  /** Mount the hook and hand back its API plus what it delivered. */
  function mount() {
    const received: unknown[] = [];
    const api: { current: Frame | null } = { current: null };
    function Host() {
      api.current = useSandboxFrame(
        { srcDoc: "<p>x</p>" },
        "Test frame",
        (m) => received.push(m),
        true,
      );
      return api.current.element;
    }
    render(<Host />);
    const frame = screen.getByTitle("Test frame") as HTMLIFrameElement;
    return { api, received, frame };
  }

  /** Deliver a message to the page as if `source` posted it. */
  const deliver = (data: unknown, source: unknown) =>
    act(
      () =>
        void window.dispatchEvent(new MessageEvent("message", { data, source: source as Window })),
    );

  it("renders a sandboxed, hidden frame", () => {
    const { frame } = mount();
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame).toHaveAttribute("tabindex", "-1");
  });

  it("waits for ready, then posts the command and accepts only that run's messages from its own frame", async () => {
    const { api, received, frame } = mount();
    const target = frame.contentWindow!;
    const posted: unknown[] = [];
    target.postMessage = ((message: unknown) => void posted.push(message)) as Window["postMessage"];
    const sending = api.current!.send({ type: "run", token: "t1" });
    expect(posted).toEqual([]); // not ready yet
    deliver({ type: "ready" }, target);
    await sending;
    expect(posted).toEqual([{ type: "run", token: "t1" }]);

    deliver({ type: "out", token: "t1", stream: "stdout", text: "ok" }, target);
    deliver({ type: "out", token: "t1", stream: "stdout", text: "forged" }, window); // wrong source
    deliver({ type: "out", token: "old", stream: "stdout", text: "stale" }, target); // wrong token
    deliver({ type: "script", token: "t1", code: "alert(1)" }, target); // unknown shape
    expect(received).toEqual([{ type: "out", token: "t1", stream: "stdout", text: "ok" }]);

    act(() => api.current!.forget());
    deliver({ type: "out", token: "t1", stream: "stdout", text: "after stop" }, target);
    expect(received).toHaveLength(1);
  });
});
