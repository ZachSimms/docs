/** Unit tests for the ⌘K palette with `next/navigation` and `fetch` mocked. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { SearchDoc } from "@/lib/search-rank";

const pushed: string[] = [];
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: (url: string) => pushed.push(url) }),
}));

const { SearchPalette, resetSearchIndexCache, SEARCH_INDEX_URL, SEARCH_PLACEHOLDER } =
  await import("@/components/SearchPalette");
const { OPEN_SEARCH_EVENT } = await import("@/components/SearchLink");

const docs: SearchDoc[] = [
  {
    topic: "python",
    slug: "overview",
    title: "Overview",
    url: "/python/overview/",
    headings: ["Lists"],
    text: "list comprehension",
  },
  {
    topic: "physics",
    slug: "overview",
    title: "Overview",
    url: "/physics/overview/",
    headings: [],
    text: "force mass",
  },
  {
    topic: "typescript",
    slug: "websockets",
    title: "WebSockets",
    url: "/typescript/backend/websockets/",
    headings: ["Protocol"],
    text: "upgrade handshake",
  },
];

const originalFetch = globalThis.fetch;
let requested: string[] = [];

beforeEach(() => {
  requested = [];
  pushed.length = 0;
  resetSearchIndexCache();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested.push(String(input));
    return new Response(JSON.stringify(docs), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const pressCmdK = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  });

describe("SearchPalette", () => {
  it("is closed by default and opens on cmd+k, fetching the index once", async () => {
    render(<SearchPalette />);
    expect(screen.queryByRole("dialog")).toBeNull();

    pressCmdK();
    const dialog = await screen.findByRole("dialog", { name: "Search" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(requested).toEqual([SEARCH_INDEX_URL]));
    expect(document.body).toHaveAttribute("data-search-open");
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", SEARCH_PLACEHOLDER);
    expect(screen.getByPlaceholderText("Search titles, headings and text…")).toBeInTheDocument();

    pressCmdK();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body).not.toHaveAttribute("data-search-open");
  });

  it("opens from the open-search event and closes on Escape", async () => {
    render(<SearchPalette />);
    act(() => {
      window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
    });
    await screen.findByRole("dialog");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters results as you type, numbers them, and navigates on Enter", async () => {
    render(<SearchPalette />);
    pressCmdK();
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(requested.length).toBe(1));

    fireEvent.change(input, { target: { value: "overview" } });
    const options = await screen.findAllByRole("option");
    expect(options.map((l) => l.textContent)).toEqual(["physics/overview", "python/overview"]);
    expect(screen.getByText("01.")).toBeInTheDocument();
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", "search-hit-0");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(pushed).toEqual(["/python/overview/"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("makes the page inert while open and restores focus to the opener on close", async () => {
    render(<button type="button">opener</button>); // own container, like page content
    render(<SearchPalette />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    pressCmdK();
    await screen.findByRole("dialog");
    expect(opener.closest("[inert]")).not.toBeNull();

    pressCmdK();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("opens on '/' unless typing in a field, and starts each open with an empty query", async () => {
    render(
      <>
        <input aria-label="other" />
        <SearchPalette />
      </>,
    );
    const other = screen.getByRole("textbox", { name: "other" });
    act(() => {
      other.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "python" } });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    pressCmdK();
    expect(await screen.findByRole("combobox")).toHaveValue("");
  });

  it("reports an unavailable index and retries on the next open", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls === 1
        ? new Response("nope", { status: 500 })
        : new Response(JSON.stringify(docs));
    }) as unknown as typeof fetch;
    render(<SearchPalette />);
    pressCmdK();
    expect(await screen.findByText("search index unavailable")).toBeInTheDocument();
    pressCmdK();
    pressCmdK();
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(calls).toBe(2));
    fireEvent.change(input, { target: { value: "python" } });
    expect(await screen.findByRole("option")).toHaveTextContent("python/overview");
  });

  it("labels sheets inside directories with their full path", async () => {
    render(<SearchPalette />);
    pressCmdK();
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(requested.length).toBe(1));
    fireEvent.change(input, { target: { value: "backend" } });
    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("typescript/backend/websockets");
    expect(option).toHaveAttribute("href", "/typescript/backend/websockets/");
  });

  it("shows 'no results' for a query nothing matches", async () => {
    render(<SearchPalette />);
    pressCmdK();
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(requested.length).toBe(1));
    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(await screen.findByText("no results")).toBeInTheDocument();
  });
});
