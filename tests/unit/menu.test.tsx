/** Unit tests for the list pages as a menu (`NumberedList`) and `Esc` → parent (`ParentLink`). */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { NumberedList } from "@/components/NumberedList";
import { ParentLink } from "@/components/ParentLink";
import { forgetCameFrom, rememberCameFrom } from "@/lib/keys";

const items = [
  { number: 2, href: "/a/", label: "Alpha" },
  { number: 1, href: "/b/", label: "Beta" },
  { number: 0, href: "/c/", label: "Gamma" },
];

/** Record clicks on `link` without letting next/link navigate. */
function trackClicks(link: HTMLElement): string[] {
  const clicks: string[] = [];
  link.addEventListener("click", (event) => {
    event.preventDefault();
    clicks.push(link.getAttribute("href") ?? "");
  });
  return clicks;
}

const active = () =>
  [...document.querySelectorAll("nav a[data-active]")].map((a) => a.textContent);

afterEach(() => {
  document.body.removeAttribute("data-search-open");
  forgetCameFrom();
});

describe("NumberedList as a menu", () => {
  it("highlights nothing until a key or the mouse picks a row", () => {
    render(<NumberedList items={items} />);
    expect(active()).toEqual([]);
  });

  it("moves the highlight with ↓/↑ and j/k, wrapping, and focuses the row", () => {
    render(<NumberedList items={items} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(active()).toEqual(["Alpha"]);
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Alpha" }));
    fireEvent.keyDown(window, { key: "j" });
    expect(active()).toEqual(["Beta"]);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(active()).toEqual(["Alpha"]);
    fireEvent.keyDown(window, { key: "k" });
    expect(active()).toEqual(["Gamma"]);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(active()).toEqual(["Beta"]);
  });

  it("marks the row's number with the highlight too", () => {
    const { container } = render(<NumberedList items={items} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(container.querySelector("span[data-active]")?.textContent).toBe("02.");
  });

  it("follows the mouse and keyboard focus", () => {
    render(<NumberedList items={items} />);
    fireEvent.mouseMove(screen.getByRole("link", { name: "Gamma" }));
    expect(active()).toEqual(["Gamma"]);
    fireEvent.focus(screen.getByRole("link", { name: "Beta" }));
    expect(active()).toEqual(["Beta"]);
  });

  it("opens the highlighted row on Enter when focus is elsewhere", () => {
    render(<NumberedList items={items} />);
    const gamma = screen.getByRole("link", { name: "Gamma" });
    const clicks = trackClicks(gamma);
    fireEvent.mouseMove(gamma);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(clicks).toEqual(["/c/"]);
  });

  it("ignores mouseenter alone (rows sliding under a still pointer while scrolling)", () => {
    render(<NumberedList items={items} />);
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Gamma" }));
    expect(active()).toEqual([]);
  });

  it("keeps moving while a key is held down", () => {
    render(<NumberedList items={items} />);
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "j", repeat: true });
    expect(active()).toEqual(["Beta"]);
  });

  it("never steals Enter from another focused control", () => {
    render(
      <>
        <NumberedList items={items} />
        <button type="button">Other</button>
      </>,
    );
    const gamma = screen.getByRole("link", { name: "Gamma" });
    const clicks = trackClicks(gamma);
    fireEvent.focus(gamma);
    const other = screen.getByRole("button", { name: "Other" });
    other.focus();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    other.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(clicks).toEqual([]);
  });

  it("leaves Enter to the browser when the highlighted link has focus", () => {
    render(<NumberedList items={items} />);
    const alpha = screen.getByRole("link", { name: "Alpha" });
    const clicks = trackClicks(alpha);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(alpha, { key: "Enter" });
    expect(clicks).toEqual([]);
  });

  it("ignores keys while typing, with modifiers, or with the search open", () => {
    render(<NumberedList items={items} />);
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "j" });
    fireEvent.keyDown(window, { key: "ArrowDown", altKey: true });
    document.body.setAttribute("data-search-open", "");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(active()).toEqual([]);
    input.remove();
  });

  it("only the first list on a page responds", () => {
    render(
      <>
        <NumberedList items={items} />
        <NumberedList items={[{ number: 0, href: "/z/", label: "Zeta" }]} />
      </>,
    );
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(active()).toEqual(["Alpha"]);
  });

  it("does nothing for an empty list", () => {
    render(<NumberedList items={[]} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(active()).toEqual([]);
  });
});

describe("NumberedList: → goes into the highlighted row", () => {
  it("opens the highlighted row on →, from the page or the row's own focus", () => {
    render(<NumberedList items={items} />);
    const beta = screen.getByRole("link", { name: "Beta" });
    const clicks = trackClicks(beta);
    fireEvent.mouseMove(beta);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "j" }); // focuses Gamma
    fireEvent.keyDown(window, { key: "k" }); // back to Beta, focused
    fireEvent.keyDown(beta, { key: "ArrowRight" });
    expect(clicks).toEqual(["/b/", "/b/"]);
  });

  it("treats l like →", () => {
    render(<NumberedList items={items} />);
    const alpha = screen.getByRole("link", { name: "Alpha" });
    const clicks = trackClicks(alpha);
    fireEvent.mouseMove(alpha);
    fireEvent.keyDown(window, { key: "l" });
    fireEvent.keyDown(window, { key: "L" }); // Shift+l is not a shortcut
    expect(clicks).toEqual(["/a/"]);
  });

  it("does nothing on → with no highlight or with another control focused", () => {
    render(
      <>
        <NumberedList items={items} />
        <button type="button">Tab</button>
      </>,
    );
    const alpha = screen.getByRole("link", { name: "Alpha" });
    const clicks = trackClicks(alpha);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.mouseMove(alpha);
    const tab = screen.getByRole("button", { name: "Tab" });
    tab.focus();
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(clicks).toEqual([]);
  });

  it("highlights the row you came back up from", () => {
    rememberCameFrom("/c/");
    render(<NumberedList items={items} />);
    expect(active()).toEqual(["Gamma"]);
    const gamma = screen.getByRole("link", { name: "Gamma" });
    const clicks = trackClicks(gamma);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(clicks).toEqual(["/c/"]);
  });

  it("ignores a remembered path that is not in the list", () => {
    rememberCameFrom("/elsewhere/");
    render(<NumberedList items={items} />);
    expect(active()).toEqual([]);
  });
});

describe("ParentLink", () => {
  it("renders the dotted link and follows it on Esc", () => {
    render(<ParentLink href="/typescript/" label="../" ariaLabel="Back to TypeScript" />);
    const link = screen.getByRole("link", { name: "Back to TypeScript" });
    expect(link).toHaveAttribute("href", "/typescript/");
    expect(link).toHaveAttribute("aria-keyshortcuts", "Escape ArrowLeft h");
    const clicks = trackClicks(link);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(clicks).toEqual(["/typescript/"]);
  });

  it("follows the link on ← too, and remembers the page it left", () => {
    window.history.replaceState(null, "", "/typescript/language/");
    render(<ParentLink href="/typescript/" label="../" />);
    const clicks = trackClicks(screen.getByRole("link", { name: "../" }));
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(clicks).toEqual(["/typescript/"]);
    // The parent's list will highlight the row for the page we just left.
    rememberCameFrom("/ignored/");
    fireEvent.click(screen.getByRole("link", { name: "../" }));
    render(<NumberedList items={[{ number: 0, href: "/typescript/language/", label: "L" }]} />);
    expect(active()).toEqual(["L"]);
    window.history.replaceState(null, "", "/");
  });

  it("treats h like ←", () => {
    render(<ParentLink href="/up/" label="../" />);
    const clicks = trackClicks(screen.getByRole("link", { name: "../" }));
    fireEvent.keyDown(window, { key: "h" });
    fireEvent.keyDown(window, { key: "h", metaKey: true });
    expect(clicks).toEqual(["/up/"]);
  });

  it("leaves ← alone when another control has focus (tabs, scrollable code)", () => {
    render(
      <>
        <ParentLink href="/" label="../" />
        <button type="button">Tab</button>
      </>,
    );
    const clicks = trackClicks(screen.getByRole("link", { name: "../" }));
    const tab = screen.getByRole("button", { name: "Tab" });
    tab.focus();
    fireEvent.keyDown(tab, { key: "ArrowLeft" });
    expect(clicks).toEqual([]);
  });

  it("stays put while typing, when Esc was handled, or with an overlay open", () => {
    render(<ParentLink href="/" label="../" />);
    const clicks = trackClicks(screen.getByRole("link", { name: "../" }));
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "Escape" });
    input.remove();
    const handled = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);
    document.body.setAttribute("data-search-open", "");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(clicks).toEqual([]);
  });
});
