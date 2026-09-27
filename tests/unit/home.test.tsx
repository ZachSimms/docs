/** Unit tests for the home page's key menu, theme hint and activity grid, and zen mode. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const pushed: string[] = [];
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: (url: string) => pushed.push(url) }),
}));

const { HomeKeys } = await import("@/components/HomeKeys");
const { ZenToggle, setZen } = await import("@/components/ZenToggle");
const { ThemeHint } = await import("@/components/ThemeHint");
const { ActivityGrid } = await import("@/components/ActivityGrid");
const { buildActivity } = await import("@/lib/activity");
const { ZEN_ATTRIBUTE, ZEN_INIT_SCRIPT, ZEN_STORAGE_KEY } = await import("@/lib/theme");

const notes = { p: "agents", r: "SAIC since Oct 2024", b: "no posts yet", g: "21 topics" };

beforeEach(() => {
  pushed.length = 0;
  localStorage.clear();
  document.documentElement.removeAttribute(ZEN_ATTRIBUTE);
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => document.body.removeAttribute("data-search-open"));

describe("HomeKeys", () => {
  it("lists each section with its key, link and note", () => {
    const { container } = render(<HomeKeys notes={notes} />);
    const rows = [...container.querySelectorAll(".home-keys p")].map((p) => p.textContent);
    expect(rows).toEqual([
      "pProjectsagents",
      "rResumeSAIC since Oct 2024",
      "bBlogno posts yet",
      "gDocs21 topics",
    ]);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs/");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-keyshortcuts", "g");
  });

  it("opens a section on its key, but not in text fields, with modifiers or over search", () => {
    render(
      <>
        <HomeKeys notes={notes} />
        <input aria-label="field" />
      </>,
    );
    fireEvent.keyDown(window, { key: "r" });
    fireEvent.keyDown(window, { key: "g", metaKey: true });
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "p" });
    document.body.setAttribute("data-search-open", "");
    fireEvent.keyDown(window, { key: "b" });
    expect(pushed).toEqual(["/resume/"]);
  });
});

describe("ThemeHint", () => {
  it("names the theme the d key switches to", () => {
    localStorage.setItem("theme", "dark");
    render(<ThemeHint />);
    expect(screen.getByText("press d for light")).toBeInTheDocument();
  });
});

describe("ActivityGrid", () => {
  it("summarizes the totals, draws one cell per day and describes each day", () => {
    const activity = buildActivity({
      today: "2026-09-26",
      weeks: 2,
      commits: ["2026-09-25"],
      sheets: ["2026-09-25", "2026-09-25"],
      posts: [],
    });
    const { container } = render(<ActivityGrid activity={activity} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Last 2 weeks: 1 commit, 2 sheets, 0 posts",
    );
    expect(container.querySelectorAll(".activity-grid .activity-cell")).toHaveLength(14);
    expect(container.querySelector('[title="2026-09-25: 1 commit, 2 sheets"]')).toHaveAttribute(
      "data-level",
      "3",
    );
    expect(container.querySelector('[title="2026-09-24: nothing"]')).toHaveAttribute(
      "data-level",
      "0",
    );
  });

  it("leaves commits out of the summary when they are unknown", () => {
    const activity = buildActivity({
      today: "2026-09-26",
      weeks: 1,
      commits: null,
      sheets: [],
      posts: [],
    });
    render(<ActivityGrid activity={activity} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Last 1 weeks: 0 sheets, 0 posts");
  });
});

describe("zen mode", () => {
  it("the switch and the z key toggle <html data-zen> and remember it", () => {
    render(<ZenToggle />);
    const button = screen.getByRole("button", { name: "zen" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(document.documentElement).toHaveAttribute(ZEN_ATTRIBUTE);
    expect(localStorage.getItem(ZEN_STORAGE_KEY)).toBe("1");
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "z" });
    expect(document.documentElement).not.toHaveAttribute(ZEN_ATTRIBUTE);
    expect(localStorage.getItem(ZEN_STORAGE_KEY)).toBeNull();
  });

  it("the z key is ignored while search is open", () => {
    render(<ZenToggle />);
    document.body.setAttribute("data-search-open", "");
    fireEvent.keyDown(window, { key: "z" });
    expect(document.documentElement).not.toHaveAttribute(ZEN_ATTRIBUTE);
  });

  it("the init script restores a remembered choice before paint", () => {
    act(() => setZen(true));
    document.documentElement.removeAttribute(ZEN_ATTRIBUTE);
    new Function(ZEN_INIT_SCRIPT)();
    expect(document.documentElement).toHaveAttribute(ZEN_ATTRIBUTE);
  });
});
