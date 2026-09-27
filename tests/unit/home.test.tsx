/** Unit tests for the home page's key menu and sky figure, and zen mode. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const pushed: string[] = [];
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: (url: string) => pushed.push(url) }),
}));

const { HomeKeys } = await import("@/components/HomeKeys");
const { ZenToggle, setZen } = await import("@/components/ZenToggle");
const { SkyFigure, skyCaption } = await import("@/components/SkyFigure");
const { ZEN_ATTRIBUTE, ZEN_INIT_SCRIPT, ZEN_STORAGE_KEY } = await import("@/lib/theme");

beforeEach(() => {
  pushed.length = 0;
  localStorage.clear();
  document.documentElement.removeAttribute(ZEN_ATTRIBUTE);
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => document.body.removeAttribute("data-search-open"));

describe("HomeKeys", () => {
  it("lists each section with its key and link, and nothing more", () => {
    const { container } = render(<HomeKeys />);
    const rows = [...container.querySelectorAll(".home-keys p")].map((p) => p.textContent);
    expect(rows).toEqual(["pProjects", "rResume", "bBlog", "gDocs"]);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs/");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-keyshortcuts", "g");
  });

  it("opens a section on its key, but not in text fields, with modifiers or over search", () => {
    render(
      <>
        <HomeKeys />
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

describe("SkyFigure", () => {
  it("shows tonight's moon in the light theme and the sun in the dark theme", () => {
    localStorage.setItem("theme", "light");
    const { container, unmount } = render(<SkyFigure />);
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("figcaption")).toHaveTextContent(
      /^(new moon|waxing crescent|first quarter|waxing gibbous|full moon|waning gibbous|last quarter|waning crescent), \d+%tonight's moon; d for the sun$/,
    );
    unmount();
    localStorage.setItem("theme", "dark");
    const dark = render(<SkyFigure />);
    expect(dark.container.querySelector("figcaption")).toHaveTextContent(
      /(equinox|solstice) (today|tomorrow|in \d+ days)today's sun; d for the moon$/,
    );
  });

  it("captions a known night and day", () => {
    const night = new Date("2024-01-25T17:54Z");
    expect(skyCaption("light", night)).toEqual([
      "full moon, 100%",
      "tonight's moon; d for the sun",
    ]);
    expect(skyCaption("dark", new Date(2026, 8, 27, 12))).toEqual([
      "winter solstice in 85 days",
      "today's sun; d for the moon",
    ]);
    expect(skyCaption("dark", new Date(2026, 11, 21, 12))[0]).toBe("winter solstice today");
    expect(skyCaption("dark", new Date(2026, 11, 20, 12))[0]).toBe("winter solstice tomorrow");
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
