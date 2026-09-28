/** Unit tests for the terminal component and its host, with `next/navigation` and `fetch` mocked. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TREE } from "../fixtures/terminal";

const calls: string[] = [];
let pathname = "/";
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => calls.push(`push ${url}`),
    back: () => calls.push("back"),
    forward: () => calls.push("forward"),
  }),
  usePathname: () => pathname,
}));

const { Terminal, SESSION_KEY, HISTORY_KEY } = await import("@/components/Terminal");
const { makeHost } = await import("@/lib/terminal/host");
const { OPEN_TERMINAL_EVENT, TerminalLink } = await import("@/components/TerminalLink");
const { resetTerminalCache, SITE_TREE_URL } = await import("@/lib/terminal/client");
const { buildFs } = await import("@/lib/terminal/vfs");

const originalFetch = globalThis.fetch;
let requested: string[] = [];
let treeStatus = 200;
/** Resolves a held page fetch, to test type-ahead while a command runs. */
let releasePage: (() => void) | null = null;

const OVERVIEW_HTML = `<html><body><main><h1>Overview</h1><p>Hello there.</p><h2 id="lists">Lists</h2></main></body></html>`;

beforeEach(() => {
  requested = [];
  calls.length = 0;
  pathname = "/";
  treeStatus = 200;
  releasePage = null;
  resetTerminalCache();
  sessionStorage.clear();
  localStorage.clear();
  document.documentElement.removeAttribute("data-embed");
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url === SITE_TREE_URL) {
      return new Response(JSON.stringify(TREE), {
        status: treeStatus,
        headers: { "content-type": "application/json" },
      });
    }
    if (url === "/python/overview/") {
      await new Promise<void>((resolve) => (releasePage = resolve));
      return new Response(OVERVIEW_HTML, { headers: { "content-type": "text/html" } });
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.innerHTML = "";
});

/** Press the backtick on the page. */
const pressBacktick = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "`", bubbles: true }));
  });

/** Re-render the terminal opened by {@link openTerminal} (after changing `pathname`). */
let rerenderTerminal = () => {};

/** Open the terminal and wait for the tree. */
async function openTerminal() {
  const { rerender } = render(<Terminal />);
  rerenderTerminal = () => rerender(<Terminal />);
  pressBacktick();
  await screen.findByRole("region", { name: "Terminal" });
  await waitFor(() => expect(screen.queryByText("loading…")).toBeNull());
  return screen.getByRole("textbox", { name: "Command" }) as HTMLInputElement;
}

/** Type a line and press Enter. */
async function enter(input: HTMLInputElement, line: string) {
  fireEvent.change(input, { target: { value: line } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

/** The output log's text. */
const log = () => screen.getByRole("log").textContent ?? "";

describe("Terminal", () => {
  it("is closed until ` opens it, then fetches the tree once and focuses the prompt", async () => {
    render(<Terminal />);
    expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
    pressBacktick();
    expect(await screen.findByRole("region", { name: "Terminal" })).toBeInTheDocument();
    await waitFor(() => expect(requested).toEqual([SITE_TREE_URL]));
    expect(screen.getByRole("textbox", { name: "Command" })).toHaveFocus();
    expect(document.body).toHaveAttribute("data-terminal", "docked");
    expect(log()).toContain("The site as a shell");
  });

  it("opens from the Terminal control's event, but never inside the reference panel", async () => {
    document.documentElement.setAttribute("data-embed", "");
    render(
      <>
        <Terminal />
        <TerminalLink />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
    document.documentElement.removeAttribute("data-embed");
    act(() => {
      window.dispatchEvent(new Event(OPEN_TERMINAL_EVENT));
    });
    expect(await screen.findByRole("region", { name: "Terminal" })).toBeInTheDocument();
  });

  it("runs commands, echoing them with the prompt, and prints links", async () => {
    const input = await openTerminal();
    await enter(input, "ls");
    expect(log()).toContain("zach:~$ ls");
    expect(screen.getByRole("link", { name: "docs/" })).toHaveAttribute("href", "/docs/");
    await enter(input, "cd docs/python");
    expect(calls).toEqual(["push /python/"]);
    expect(screen.getByText("terminal · ~/docs/python")).toBeInTheDocument();
  });

  it("follows the page being read", async () => {
    await openTerminal();
    pathname = "/python/overview/";
    rerenderTerminal();
    expect(await screen.findByText("terminal · ~/docs/python/overview")).toBeInTheDocument();
  });

  it("completes with Tab, listing the choices when there are several", async () => {
    const input = await openTerminal();
    fireEvent.change(input, { target: { value: "cd do" } });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input.value).toBe("cd docs/");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(log()).toContain("cat  cd  clear");
  });

  it("recalls the history with ↑ and ↓, keeping the line being typed", async () => {
    const input = await openTerminal();
    await enter(input, "pwd");
    await enter(input, "whoami");
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")).toEqual(["pwd", "whoami"]);
    fireEvent.change(input, { target: { value: "draft" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("whoami");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("pwd");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("draft");
  });

  it("clears with ctrl+l, cancels with ctrl+c, empties the line with ctrl+u", async () => {
    const input = await openTerminal();
    await enter(input, "pwd");
    fireEvent.keyDown(input, { key: "l", ctrlKey: true });
    expect(log()).not.toContain("pwd");
    fireEvent.change(input, { target: { value: "half" } });
    fireEvent.keyDown(input, { key: "c", ctrlKey: true });
    expect(log()).toContain("half^C");
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "gone" } });
    fireEvent.keyDown(input, { key: "u", ctrlKey: true });
    expect(input.value).toBe("");
  });

  it("queues lines typed while a command runs, and ctrl+c drops them", async () => {
    const input = await openTerminal();
    await enter(input, "cat docs/python/overview");
    await enter(input, "pwd");
    expect(log()).not.toContain("zach:~$ pwd");
    await waitFor(() => expect(releasePage).not.toBeNull());
    await act(async () => releasePage?.());
    await waitFor(() => expect(log()).toContain("zach:~$ pwd"));
    const text = log();
    expect(text.indexOf("Hello there.")).toBeLessThan(text.indexOf("zach:~$ pwd"));

    resetTerminalCache(); // fetch the page again, so the next cat waits for it
    releasePage = null;
    await enter(input, "cat docs/python/overview");
    await enter(input, "whoami");
    fireEvent.keyDown(input, { key: "c", ctrlKey: true });
    await waitFor(() => expect(releasePage).not.toBeNull());
    await act(async () => releasePage?.());
    expect(log()).not.toContain("Z Z");
  });

  it("hides on Esc and remembers the session across a reload", async () => {
    const input = await openTerminal();
    await enter(input, "pwd");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
    expect(document.body).not.toHaveAttribute("data-terminal");

    pressBacktick();
    await screen.findByRole("region", { name: "Terminal" });
    fireEvent.click(screen.getByRole("button", { name: "Full screen terminal" }));
    expect(document.body).toHaveAttribute("data-terminal", "max");
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "{}");
    expect(saved).toMatchObject({ open: true, max: true });
    expect(saved.entries.some((entry: { command?: string }) => entry.command === "pwd")).toBe(true);

    document.body.innerHTML = "";
    render(<Terminal />);
    expect(await screen.findByRole("region", { name: "Terminal" })).toHaveAttribute(
      "data-size",
      "max",
    );
    expect(log()).toContain("zach:~$ pwd");
    fireEvent.click(screen.getByRole("button", { name: "Hide the terminal" }));
    expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
  });

  it("inside the reference panel, neither restores nor overwrites the tab's session", async () => {
    const session = JSON.stringify({
      open: true,
      max: false,
      entries: [{ id: 1, path: "~", command: "pwd" }],
    });
    sessionStorage.setItem(SESSION_KEY, session);
    document.documentElement.setAttribute("data-embed", "");
    render(<Terminal />);
    pressBacktick();
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBe(session);
  });

  it("ignores a broken session and says when the tree cannot load", async () => {
    sessionStorage.setItem(SESSION_KEY, "{not json");
    treeStatus = 500;
    render(<Terminal />);
    pressBacktick();
    expect(await screen.findByText(/site tree unavailable/)).toBeInTheDocument();
  });
});

describe("makeHost", () => {
  const host = makeHost({
    router: () =>
      ({ push: (url: string) => calls.push(`push ${url}`), back() {}, forward() {} }) as never,
    history: () => [],
    clear: () => {},
    close: () => {},
    toggleMax: () => false,
  });
  const fs = buildFs(TREE);
  const overview = fs.byHref.get("/python/overview/")!;

  it("reads headings and text from the page on screen, without fetching", async () => {
    window.history.replaceState(null, "", "/python/overview/");
    document.body.innerHTML = `<main><h1>Overview</h1><h2 id="lists">Lists</h2><p>Body.</p></main>`;
    expect(host.showing(overview)).toBe(true);
    expect(await host.headings(overview)).toEqual([{ id: "lists", text: "Lists", level: 2 }]);
    expect(await host.pageText(overview)).toEqual(["# Overview", "", "## Lists", "", "Body."]);
    expect(requested).toEqual([]);
    expect(host.scrollToHeading("lists")).toBe(true);
    expect(window.location.hash).toBe("#lists");
    expect(host.scrollToHeading("nope")).toBe(false);
    window.history.replaceState(null, "", "/");
  });

  it("fetches other pages, and reports pages that fail to load", async () => {
    const info = fs.byHref.get("/info/")!;
    expect(await host.pageText(info)).toBeNull();
    expect(await host.headings(info)).toBeNull();
    expect(requested).toEqual(["/info/", "/info/"]);
  });

  it("offers zen mode only where the page does", () => {
    document.body.innerHTML = `<main></main>`;
    expect(host.zen()).toBeNull();
    document.body.innerHTML = `<div data-zen-able><main></main></div>`;
    expect(host.zen()).toBe(false);
    host.setZen(true);
    expect(host.zen()).toBe(true);
    host.setZen(false);
  });

  it("navigates with the router and scrolls the window", () => {
    host.navigate("/docs/");
    expect(calls).toContain("push /docs/");
    const scrolled: string[] = [];
    const scrollTo = window.scrollTo;
    const scrollBy = window.scrollBy;
    window.scrollTo = ((options: ScrollToOptions) =>
      scrolled.push(`to ${options.top}`)) as typeof window.scrollTo;
    window.scrollBy = ((options: ScrollToOptions) =>
      scrolled.push(`by ${Math.sign(options.top ?? 0)}`)) as typeof window.scrollBy;
    host.scroll("top");
    host.scroll("down");
    host.scroll("up");
    host.scroll("bottom");
    window.scrollTo = scrollTo;
    window.scrollBy = scrollBy;
    expect(scrolled.slice(0, 3)).toEqual(["to 0", "by 1", "by -1"]);
    expect(scrolled).toHaveLength(4);
  });
});
