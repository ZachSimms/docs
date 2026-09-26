/** Unit tests for the presentational components and the MDX component map. */
import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it } from "bun:test";
import { DottedLink } from "@/components/DottedLink";
import { NumberedList } from "@/components/NumberedList";
import { Page } from "@/components/Page";
import { useMDXComponents } from "@/mdx-components";
import { MdxImage } from "@/components/MdxImage";
import { Note } from "@/components/Note";
import { Toc } from "@/components/Toc";
import { SheetView } from "@/components/SheetView";
import { Graph, Graphs } from "@/components/Graph";
import { ThemeToggle } from "@/components/ThemeToggle";
import { STORAGE_KEY } from "@/lib/theme";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { OPEN_SEARCH_EVENT } from "@/components/SearchLink";

describe("DottedLink", () => {
  it("wraps its label in <i> inside an anchor", () => {
    render(<DottedLink href="/info/">Info</DottedLink>);
    const link = screen.getByRole("link", { name: "Info" });
    expect(link).toHaveAttribute("href", "/info/");
    expect(link.querySelector("i")).toHaveTextContent("Info");
  });

  it("adds the inline class when requested", () => {
    render(
      <DottedLink href="https://example.com" inline>
        ext
      </DottedLink>,
    );
    expect(screen.getByRole("link", { name: /^ext/ })).toHaveClass("inline");
  });

  it("opens other sites in a new tab, safely, and says so to screen readers", () => {
    render(<DottedLink href="https://developer.mozilla.org/">MDN</DottedLink>);
    const link = screen.getByRole("link", { name: "MDN (opens in a new tab)" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("i")).toHaveTextContent(/^MDN$/);
    expect(link.querySelector(".sr-only")).toHaveTextContent("(opens in a new tab)");
  });

  it("treats protocol-relative URLs as other sites too", () => {
    render(<DottedLink href="//example.com/x">x</DottedLink>);
    expect(screen.getByRole("link", { name: /^x/ })).toHaveAttribute("target", "_blank");
  });

  it("keeps internal, hash and mailto links in the same tab", () => {
    render(
      <>
        <DottedLink href="/typescript/">internal</DottedLink>
        <DottedLink href="#section">hash</DottedLink>
        <DottedLink href="mailto:me@example.com">mail</DottedLink>
      </>,
    );
    for (const name of ["internal", "hash", "mail"]) {
      const link = screen.getByRole("link", { name });
      expect(link).not.toHaveAttribute("target");
      expect(link.querySelector(".sr-only")).toBeNull();
    }
  });
});

describe("DottedLink attribute forwarding", () => {
  it("keeps id, aria and data attributes and merges class names", () => {
    render(
      <DottedLink
        href="#user-content-fn-1"
        inline
        id="user-content-fnref-1"
        className="ref"
        data-footnote-ref
        aria-describedby="footnote-label"
      >
        1
      </DottedLink>,
    );
    const link = screen.getByRole("link", { name: "1" });
    expect(link).toHaveAttribute("id", "user-content-fnref-1");
    expect(link).toHaveClass("inline");
    expect(link).toHaveClass("ref");
    expect(link).toHaveAttribute("data-footnote-ref");
    expect(link).toHaveAttribute("aria-describedby", "footnote-label");
  });
});

describe("NumberedList", () => {
  it("renders 'NN.' spans followed by dotted links, separated by <br>", () => {
    const { container } = render(
      <NumberedList
        items={[
          { number: 8, href: "/physics/", label: "Physics" },
          { number: 1, href: "/design/", label: "Design" },
        ]}
      />,
    );
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    const spans = [...nav!.querySelectorAll("span")].map((s) => s.textContent);
    expect(spans).toEqual(["08.", "01."]);
    expect(nav!.querySelectorAll("a > i")).toHaveLength(2);
    expect(nav!.querySelectorAll("br")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Physics" })).toHaveAttribute("href", "/physics/");
  });

  it("renders an empty nav when there are no items", () => {
    const { container } = render(<NumberedList items={[]} />);
    expect(container.querySelector("nav")?.childElementCount).toBe(0);
  });
});

describe("Page", () => {
  it("renders the h1, the dash separator, children and the footer link", () => {
    const { container } = render(
      <Page title="Zach" footer={{ href: "/info/", label: "Info" }}>
        <p>body</p>
      </Page>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Zach");
    const main = container.querySelector("main")!;
    expect(main.children[1]).toHaveTextContent("-");
    expect(main).toHaveTextContent("body");
    const footerLink = container.querySelector("footer p a");
    expect(footerLink).toHaveAttribute("href", "/info/");
    expect(footerLink?.querySelector("i")).toHaveTextContent("Info");
  });

  it("pins the footer link to the top only when asked", () => {
    const { container, rerender } = render(
      <Page title="X" footer={{ href: "/physics/", label: "../", ariaLabel: "Back to topic" }}>
        <p />
      </Page>,
    );
    expect(container.querySelector(".back-rail")).toBeNull();

    rerender(
      <Page
        title="X"
        footer={{ href: "/physics/", label: "../", ariaLabel: "Back to topic" }}
        pinFooterLink
      >
        <p />
      </Page>,
    );
    const pinned = container.querySelector(".back-rail a");
    expect(pinned).toHaveAttribute("href", "/physics/");
    expect(pinned).toHaveAttribute("aria-label", "Back to topic");
    expect(pinned?.querySelector("i")).toHaveTextContent("../");
    expect(container.querySelectorAll('a[href="/physics/"]')).toHaveLength(2);
  });

  it("adds Search and theme links to every footer", () => {
    const { container } = render(
      <Page title="X" footer={{ href: "/", label: "../" }}>
        <p />
      </Page>,
    );
    const labels = [...container.querySelectorAll("footer a i, footer button i")].map(
      (i) => i.textContent,
    );
    expect(labels).toEqual(["../", "Search"]);
  });

  it("Search footer link dispatches the open-search event", () => {
    render(
      <Page title="X" footer={{ href: "/", label: "../" }}>
        <p />
      </Page>,
    );
    let fired = false;
    window.addEventListener(OPEN_SEARCH_EVENT, () => (fired = true), { once: true });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(fired).toBe(true);
  });
});

describe("ThemeToggle", () => {
  it("shows a moon in light mode, flips the theme on click and persists it", () => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("data-theme");
    render(<ThemeToggle />);
    const toggle = screen.getByRole("button", { name: /toggle theme/i });
    expect(toggle.querySelector("svg")).toHaveAttribute("data-icon", "moon");
    expect(toggle).toHaveAttribute("data-target", "dark");
    expect(toggle).toHaveAttribute("title", "Switch to dark mode");

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(toggle.querySelector("svg")).toHaveAttribute("data-icon", "sun");
    expect(toggle).toHaveAttribute("data-target", "light");
    expect(toggle).toHaveAttribute("title", "Switch to light mode");

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("data-theme");
  });

  it("toggles on a bare `d` keypress, but not with modifiers or while typing", () => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("data-theme");
    render(<ThemeToggle />);
    const theme = () => document.documentElement.getAttribute("data-theme");

    fireEvent.keyDown(window, { key: "d" });
    expect(theme()).toBe("dark");
    fireEvent.keyDown(window, { key: "d" });
    expect(theme()).toBe("light");

    fireEvent.keyDown(window, { key: "d", metaKey: true });
    fireEvent.keyDown(window, { key: "D", shiftKey: true });
    expect(theme()).toBe("light");

    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "d" });
    expect(theme()).toBe("light");
    input.remove();
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("data-theme");
  });
});

describe("MdxImage", () => {
  it("uses next/image with real dimensions for a file under public/", () => {
    render(<MdxImage src="/images/design/spacing.png" alt="swatch" />);
    const img = screen.getByRole("img", { name: "swatch" });
    expect(img).toHaveAttribute("width", "320");
    expect(img).toHaveAttribute("height", "120");
  });

  it("falls back to a lazy plain <img> for remote or unknown sources", () => {
    render(<MdxImage src="https://example.com/x.png" alt="remote" />);
    const img = screen.getByRole("img", { name: "remote" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).not.toHaveAttribute("width");
  });

  it("renders nothing without a src", () => {
    const { container } = render(<MdxImage alt="" />);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("DottedLink external branch", () => {
  it("renders a plain anchor for absolute and protocol-relative URLs", () => {
    render(
      <>
        <DottedLink href="https://example.com/">abs</DottedLink>
        <DottedLink href="//example.com/">rel</DottedLink>
      </>,
    );
    expect(screen.getByRole("link", { name: /^abs/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: /^rel/ })).toHaveAttribute("href", "//example.com/");
  });

  it("applies aria-label when provided", () => {
    render(
      <DottedLink href="/sheets/" ariaLabel="All cheatsheets">
        v
      </DottedLink>,
    );
    expect(screen.getByRole("link", { name: "All cheatsheets" })).toHaveTextContent("v");
  });
});

describe("useMDXComponents", () => {
  it("maps anchors to inline dotted links and honours caller overrides", () => {
    const components = useMDXComponents({ h2: () => <h2>custom</h2> });
    const A = components.a as ComponentType<{ href: string; title?: string; children: ReactNode }>;
    const H2 = components.h2 as ComponentType;
    render(
      <>
        <A href="/physics/" title="Physics topic">
          go
        </A>
        <H2 />
      </>,
    );
    const link = screen.getByRole("link", { name: "Physics topic" });
    expect(link).toHaveClass("inline");
    expect(link.querySelector("i")).toHaveTextContent("go");

    const Back = components.a as ComponentType<Record<string, unknown>>;
    render(
      <Back href="#user-content-fnref-1" id="back" aria-label="Back to reference 1">
        ↩
      </Back>,
    );
    expect(screen.getByRole("link", { name: "Back to reference 1" })).toHaveAttribute("id", "back");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("custom");
  });

  it("exposes every authoring component by name", () => {
    const components = useMDXComponents();
    for (const name of [
      "Note",
      "Callout",
      "Tabs",
      "Tab",
      "Steps",
      "Step",
      "Cards",
      "Card",
      "Graph",
    ]) {
      expect(typeof components[name]).toBe("function");
    }
  });
});

describe("Note", () => {
  it("renders an aside with a label and the children", () => {
    render(<Note kind="tip">use the scale</Note>);
    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("data-kind", "tip");
    expect(note).toHaveTextContent("tip: use the scale");
  });

  it("defaults the label to note", () => {
    render(<Note>plain</Note>);
    expect(screen.getByRole("note")).toHaveTextContent("note: plain");
  });
});

describe("Toc", () => {
  const entries = [
    { id: "one", text: "One", depth: 2 as const },
    { id: "one-a", text: "One A", depth: 3 as const },
    { id: "two", text: "Two", depth: 2 as const },
  ];

  it("renders a dotted link per heading, indents ### entries and marks the first as current", () => {
    render(<Toc entries={entries} />);
    const nav = screen.getByRole("navigation", { name: "Contents" });
    const links = [...nav.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#one", "#one-a", "#two"]);
    expect(links[1]).toHaveClass("toc-sub");
    expect(links[0]).toHaveAttribute("aria-current", "location");
    expect(links[2]).not.toHaveAttribute("aria-current");
    expect(links[0]?.querySelector("i")).toHaveTextContent("One");
  });

  it("tracks the scroll position and marks the parent of a current ### entry", async () => {
    // Headings at fixed viewport offsets; the reading line is 30% of innerHeight.
    const tops: Record<string, number> = { one: -500, "one-a": 10, two: 2000 };
    const headings = Object.entries(tops).map(([id, top]) => {
      const h = document.createElement("h2");
      h.id = id;
      h.getBoundingClientRect = () => ({ top }) as DOMRect;
      document.body.append(h);
      return h;
    });
    try {
      render(<Toc entries={entries} />);
      fireEvent.scroll(window);
      const nav = screen.getByRole("navigation", { name: "Contents" });
      await waitFor(() =>
        expect(nav.querySelector('[aria-current="location"]')).toHaveTextContent("One A"),
      );
      expect(nav.querySelector("[data-parent-active]")).toHaveTextContent("One");
    } finally {
      headings.forEach((h) => h.remove());
    }
  });

  it("pins a clicked entry until the reader scrolls again, and skips hidden headings", async () => {
    // "two" is past the reading line, but a click on it must win over the scroll position.
    const tops: Record<string, number> = { one: -500, "one-a": 10, two: 2000 };
    const headings = Object.entries(tops).map(([id, top]) => {
      const h = document.createElement("h2");
      h.id = id;
      h.getBoundingClientRect = () => ({ top }) as DOMRect;
      h.checkVisibility = () => id !== "one-a"; // e.g. inside a closed <details>
      document.body.append(h);
      return h;
    });
    try {
      render(<Toc entries={entries} />);
      const nav = screen.getByRole("navigation", { name: "Contents" });
      const current = () => nav.querySelector('[aria-current="location"]');
      fireEvent.scroll(window);
      await waitFor(() => expect(current()).toHaveTextContent("One"));

      const two = nav.querySelector<HTMLAnchorElement>('a[href="#two"]')!;
      two.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(two);
      fireEvent.scroll(window);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(current()).toHaveTextContent("Two");

      fireEvent.wheel(window);
      fireEvent.scroll(window);
      await waitFor(() => expect(current()).toHaveTextContent("One"));
    } finally {
      headings.forEach((h) => h.remove());
    }
  });

  it("shows ^ / v indicators only where the contents overflow, and they scroll it", async () => {
    render(<Toc entries={entries} />);
    const nav = screen.getByRole("navigation", { name: "Contents" });
    // happy-dom does no layout: fake a list 900px tall in a 300px box.
    Object.defineProperty(nav, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(nav, "scrollHeight", { value: 900, configurable: true });
    const scrolled: number[] = [];
    nav.scrollBy = ((options: ScrollToOptions) =>
      scrolled.push(options.top ?? 0)) as typeof nav.scrollBy;
    const up = () => screen.queryByRole("button", { name: "Scroll contents up" });
    const down = () => screen.queryByRole("button", { name: "Scroll contents down" });

    nav.scrollTop = 0;
    fireEvent.scroll(nav);
    await waitFor(() => expect(down()).toBeInTheDocument());
    expect(up()).toBeNull();
    expect(nav).toHaveAttribute("data-more-down");
    expect(nav).not.toHaveAttribute("data-more-up");

    nav.scrollTop = 600;
    fireEvent.scroll(nav);
    await waitFor(() => expect(up()).toBeInTheDocument());
    expect(down()).toBeNull();

    fireEvent.click(up()!);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toBeLessThan(0);
  });

  it("renders nothing for fewer than two headings", () => {
    const { container } = render(<Toc entries={entries.slice(0, 1)} />);
    expect(container.querySelector(".toc")).toBeNull();
    expect(container.querySelector(".toc-menu-button")).toBeNull();
  });

  describe("menu (narrow viewports)", () => {
    const button = () => screen.getByRole("button", { name: "Table of contents" });
    const panel = () => document.getElementById("toc-menu-panel");

    it("starts closed: a ≡ button with aria-expanded false and no panel", () => {
      render(<Toc entries={entries} />);
      expect(button()).toHaveTextContent("≡");
      expect(button()).toHaveAttribute("aria-expanded", "false");
      expect(button()).toHaveAttribute("aria-controls", "toc-menu-panel");
      expect(panel()).toBeNull();
      expect(document.body).not.toHaveAttribute("data-toc-open");
    });

    it("opens a panel listing every entry with the current one marked, and flags the body", () => {
      render(<Toc entries={entries} />);
      fireEvent.click(button());
      expect(button()).toHaveAttribute("aria-expanded", "true");
      const links = [...panel()!.querySelectorAll("a")];
      expect(links.map((a) => a.getAttribute("href"))).toEqual(["#one", "#one-a", "#two"]);
      expect(links[1]).toHaveClass("toc-sub");
      expect(links[0]).toHaveAttribute("aria-current", "location");
      expect(document.body).toHaveAttribute("data-toc-open");
    });

    it("closes when an entry is chosen, and that entry becomes current", () => {
      render(<Toc entries={entries} />);
      fireEvent.click(button());
      fireEvent.click(panel()!.querySelectorAll("a")[2]!);
      expect(panel()).toBeNull();
      expect(button()).toHaveAttribute("aria-expanded", "false");
      expect(document.body).not.toHaveAttribute("data-toc-open");
      const rail = screen.getByRole("navigation", { name: "Contents" });
      expect(rail.querySelectorAll("a")[2]).toHaveAttribute("aria-current", "location");
    });

    it("closes on Escape, claiming the key so the page doesn't also go up a level", () => {
      render(<Toc entries={entries} />);
      fireEvent.click(button());
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(button());
    });

    it("closes on a press outside, but not inside the panel", () => {
      render(<Toc entries={entries} />);
      fireEvent.click(button());
      fireEvent.pointerDown(panel()!);
      expect(panel()).not.toBeNull();
      fireEvent.pointerDown(document.body);
      expect(panel()).toBeNull();
    });

    it("toggles closed from the button", () => {
      render(<Toc entries={entries} />);
      fireEvent.click(button());
      fireEvent.click(button());
      expect(panel()).toBeNull();
    });

    it("leaves Escape to search when search is open on top", () => {
      render(<Toc entries={entries} />);
      fireEvent.click(button());
      document.body.setAttribute("data-search-open", "");
      try {
        const event = new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        });
        act(() => {
          window.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(false);
        expect(panel()).not.toBeNull();
      } finally {
        document.body.removeAttribute("data-search-open");
      }
    });

    it("closes when focus tabs out of it, not when it moves within", () => {
      render(
        <>
          <Toc entries={entries} />
          <button type="button">elsewhere</button>
        </>,
      );
      fireEvent.click(button());
      const [first, second] = [...panel()!.querySelectorAll("a")];
      fireEvent.focusOut(first!, { relatedTarget: second });
      expect(panel()).not.toBeNull();
      fireEvent.focusOut(second!, {
        relatedTarget: screen.getByRole("button", { name: "elsewhere" }),
      });
      expect(panel()).toBeNull();
    });

    it("closes when the viewport widens past the breakpoint", () => {
      const listeners: (() => void)[] = [];
      const mql = {
        matches: false,
        addEventListener: (_: string, fn: () => void) => listeners.push(fn),
        removeEventListener: () => {},
      };
      const original = window.matchMedia;
      window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
      try {
        render(<Toc entries={entries} />);
        fireEvent.click(button());
        mql.matches = true;
        act(() => listeners.forEach((fn) => fn()));
        expect(panel()).toBeNull();
        expect(document.body).not.toHaveAttribute("data-toc-open");
      } finally {
        window.matchMedia = original;
      }
    });

    it("moves focus to the chosen section's heading", () => {
      const heading = document.createElement("h2");
      heading.id = "two";
      document.body.append(heading);
      try {
        render(<Toc entries={entries} />);
        fireEvent.click(button());
        fireEvent.click(panel()!.querySelectorAll("a")[2]!);
        expect(document.activeElement).toBe(heading);
        expect(heading).toHaveAttribute("tabindex", "-1");
      } finally {
        heading.remove();
      }
    });
  });
});

describe("SheetView", () => {
  const toc = [
    { id: "one", text: "One", depth: 2 as const },
    { id: "two", text: "Two", depth: 2 as const },
  ];

  it("renders the title, body, date, pinned back link and the table of contents", () => {
    const { container } = render(
      <SheetView
        title="Array methods"
        date="2026-09-25"
        back={{ href: "/typescript/language/", label: "../", ariaLabel: "Back to directory" }}
        toc={toc}
      >
        <p>sheet body</p>
      </SheetView>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Array methods");
    expect(container.querySelector("main")).toHaveTextContent("sheet body");
    expect(container.querySelector("main time")).toHaveAttribute("dateTime", "2026-09-25");
    expect(container.querySelector(".back-rail a")).toHaveAttribute(
      "href",
      "/typescript/language/",
    );
    expect(screen.getByRole("navigation", { name: "Contents" })).toBeInTheDocument();
  });

  it("omits the table of contents for fewer than two headings", () => {
    const { container } = render(
      <SheetView
        title="Short"
        date="2026-09-25"
        back={{ href: "/t/", label: "../" }}
        toc={toc.slice(0, 1)}
      >
        <p />
      </SheetView>,
    );
    expect(container.querySelector(".toc")).toBeNull();
  });
});

describe("Graph", () => {
  it("draws one path per curve with distinct colours, axes, ticks and a legend", () => {
    const { container } = render(
      <Graph
        title="shifts"
        curves={[{ fn: "square" }, { fn: "square", k: 2, label: "f(x) + 2" }]}
        small
      />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Graph of shifts");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    const paths = svg.querySelectorAll("path.graph-curve");
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute("d")).toMatch(/^M[\d.]+ [\d.]+ L/);
    expect(paths[0]).toHaveClass("graph-curve-0");
    expect(paths[1]).toHaveClass("graph-curve-1");
    expect(paths[1]).not.toHaveAttribute("stroke-dasharray");
    expect(container.querySelectorAll(".graph-swatch.graph-curve-1")).toHaveLength(1);
    expect(svg.querySelectorAll(".graph-axes line").length).toBeGreaterThan(2);
    expect(svg.querySelectorAll("text").length).toBeGreaterThan(2);
    expect(container.querySelector("figure")).toHaveClass("graph-small");
    const legend = [...container.querySelectorAll(".graph-legend")].map((l) => l.textContent);
    expect(legend[0]).toContain("x²");
    expect(legend[1]).toContain("f(x) + 2");
  });

  it("omits the colour swatch when there is only one curve", () => {
    const { container } = render(<Graph title="square" curves={[{ fn: "square" }]} />);
    expect(container.querySelectorAll("path.graph-curve")).toHaveLength(1);
    expect(container.querySelector(".graph-swatch")).toBeNull();
    expect(container.querySelector(".graph-legend")).toHaveTextContent("x²");
    expect(container.querySelector("figcaption b")).toHaveTextContent("square");
  });

  it("renders nothing without curves", () => {
    const { container } = render(<Graph />);
    expect(container.querySelector("figure")).toBeNull();
  });

  it("Graphs wraps small plots in a grid container", () => {
    const { container } = render(
      <Graphs>
        <Graph small fn="sin" />
        <Graph small fn="cos" />
      </Graphs>,
    );
    expect(container.querySelectorAll(".graphs > figure.graph-small")).toHaveLength(2);
  });
});
