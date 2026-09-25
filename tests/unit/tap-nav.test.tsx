/** Unit tests for `components/TapNav.tsx`: touch double taps on the screen edges act like ← and →. */
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { TapNav } from "@/components/TapNav";

/** Window width in the test DOM; the edge zones are its outer quarters. */
const WIDTH = 400;

/** A touch (or other pointer) tap at `(x, y)` on `target`. */
function tap(target: Element, x: number, y = 300, pointerType = "touch") {
  const init = { clientX: x, clientY: y, pointerType, isPrimary: true, bubbles: true };
  fireEvent.pointerDown(target, init);
  fireEvent.pointerUp(target, init);
}

/** A page with a pinned ../ and a list whose second row is highlighted. */
function page(withActive = true) {
  const clicks: string[] = [];
  render(
    <>
      <div className="back-rail">
        <a href="#up" onClick={(e) => (e.preventDefault(), clicks.push("up"))}>
          ../
        </a>
      </div>
      <main>
        <p id="text">Some text to tap on.</p>
        <pre id="code">
          <code>wide code</code>
        </pre>
        <nav data-menu="">
          <span>00.</span>
          <a href="#a" onClick={(e) => (e.preventDefault(), clicks.push("a"))}>
            a
          </a>
          <span data-active={withActive ? "" : undefined}>01.</span>
          <a
            href="#b"
            data-active={withActive ? "" : undefined}
            onClick={(e) => (e.preventDefault(), clicks.push("b"))}
          >
            b
          </a>
        </nav>
      </main>
      <TapNav />
    </>,
  );
  return clicks;
}

describe("TapNav", () => {
  let width: number;
  beforeEach(() => {
    width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: WIDTH, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    document.body.removeAttribute("data-search-open");
  });

  it("goes up a level on a double tap at the left edge, and shows a < at that edge", () => {
    const clicks = page();
    const text = document.getElementById("text")!;
    tap(text, 20);
    expect(clicks).toEqual([]);
    tap(text, 25);
    expect(clicks).toEqual(["up"]);
    const flash = document.querySelector(".tap-flash");
    expect(flash).toHaveTextContent("<");
    expect(flash).toHaveClass("tap-flash-left");
  });

  it("opens the highlighted row on a double tap at the right edge", () => {
    const clicks = page();
    const text = document.getElementById("text")!;
    tap(text, 380);
    tap(text, 385);
    expect(clicks).toEqual(["b"]);
    expect(document.querySelector(".tap-flash")).toHaveTextContent(">");
  });

  it("does nothing (and shows nothing) at the right edge when no row is highlighted", () => {
    const clicks = page(false);
    const text = document.getElementById("text")!;
    tap(text, 380);
    tap(text, 385);
    expect(clicks).toEqual([]);
    expect(document.querySelector(".tap-flash")).toBeNull();
  });

  it("ignores the middle of the screen, single taps, mouse double clicks and mixed zones", () => {
    const clicks = page();
    const text = document.getElementById("text")!;
    tap(text, 200);
    tap(text, 200);
    tap(text, 20, 300, "mouse");
    tap(text, 20, 300, "mouse");
    tap(text, 20);
    tap(text, 380);
    expect(clicks).toEqual([]);
  });

  it("ignores taps on links and inside code boxes, and while an overlay is open", () => {
    const clicks = page();
    const link = document.querySelector('nav a[href="#a"]')!;
    tap(link, 20);
    tap(link, 20);
    const code = document.getElementById("code")!;
    tap(code, 20);
    tap(code, 20);
    document.body.setAttribute("data-search-open", "");
    const text = document.getElementById("text")!;
    tap(text, 20);
    tap(text, 20);
    expect(clicks).toEqual([]);
  });

  it("clears the edge glyph shortly after", async () => {
    page();
    const text = document.getElementById("text")!;
    tap(text, 20);
    tap(text, 20);
    expect(document.querySelector(".tap-flash")).not.toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 450)));
    expect(document.querySelector(".tap-flash")).toBeNull();
  });
});
