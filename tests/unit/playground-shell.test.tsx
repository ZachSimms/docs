/** Unit tests for the playground shell: file menu, splitters, layout, shortcuts, help and tour. */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { FileMenu } from "@/components/playground/FileMenu";
import { FileTree, type TreeCommand } from "@/components/playground/FileTree";
import { HelpPanel } from "@/components/playground/HelpPanel";
import { sizeForKey, Splitter } from "@/components/playground/Splitter";
import { placeCard, Tour } from "@/components/playground/Tour";
import { getLanguage } from "@/lib/playground/languages";
import {
  clampSize,
  DEFAULT_LAYOUT,
  LAYOUT_BOUNDS,
  layoutStyle,
  resize,
} from "@/lib/playground/layout";
import {
  isHelpShortcut,
  isZenShortcut,
  PLAYGROUND_SHORTCUTS,
  TOUR_STEPS,
} from "@/lib/playground/shortcuts";
import { TEMPLATES } from "@/lib/playground/templates";

describe("layout", () => {
  it("clamps sizes into their bounds and resizes immutably", () => {
    expect(clampSize("tree", 10)).toBe(LAYOUT_BOUNDS.tree.min);
    expect(clampSize("tree", 99_999)).toBe(LAYOUT_BOUNDS.tree.max);
    expect(clampSize("tree", Number.NaN)).toBe(LAYOUT_BOUNDS.tree.initial);
    const next = resize(DEFAULT_LAYOUT, "refs", 500.4);
    expect(next.refs).toBe(500);
    expect(DEFAULT_LAYOUT.refs).toBe(LAYOUT_BOUNDS.refs.initial);
    expect(layoutStyle(next)["--pg-refs"]).toBe("500px");
  });
});

describe("Splitter", () => {
  it("maps keys to sizes: arrows by edge, Shift for big steps, Home/End/Enter", () => {
    expect(sizeForKey("tree", 300, "right", "ArrowRight", false)).toBe(316);
    expect(sizeForKey("tree", 300, "right", "ArrowLeft", true)).toBe(236);
    expect(sizeForKey("refs", 400, "left", "ArrowLeft", false)).toBe(416); // grows leftwards
    expect(sizeForKey("output", 300, "top", "ArrowUp", false)).toBe(316); // grows upwards
    expect(sizeForKey("output", 300, "top", "ArrowLeft", false)).toBeNull(); // wrong axis
    expect(sizeForKey("tree", 300, "right", "Home", false)).toBe(LAYOUT_BOUNDS.tree.min);
    expect(sizeForKey("tree", 300, "right", "End", false)).toBe(LAYOUT_BOUNDS.tree.max);
    expect(sizeForKey("tree", 300, "right", "Enter", false)).toBe(LAYOUT_BOUNDS.tree.initial);
  });

  it("is a labeled separator that reports its size and resets on double-click", () => {
    const sizes: number[] = [];
    render(<Splitter part="output" edge="top" size={300} onSize={(n) => sizes.push(n)} />);
    const handle = screen.getByRole("separator", { name: "Resize output height" });
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
    expect(handle).toHaveAttribute("aria-valuenow", "300");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.doubleClick(handle);
    expect(sizes).toEqual([284, LAYOUT_BOUNDS.output.initial]);
  });
});

describe("FileMenu", () => {
  it("moves with the arrow keys, runs items with Enter and closes on Escape", () => {
    const ran: string[] = [];
    let closed = 0;
    render(
      <FileMenu
        label="Actions for a.ts"
        x={10}
        y={10}
        onClose={() => closed++}
        items={[
          { id: "a", label: "Rename", hint: "F2", run: () => ran.push("rename") },
          { id: "b", label: "Delete", run: () => ran.push("delete") },
        ]}
      />,
    );
    const menu = screen.getByRole("menu", { name: "Actions for a.ts" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1]!, { key: "Enter" });
    expect(ran).toEqual(["delete"]);
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(closed).toBeGreaterThanOrEqual(2);
  });
});

describe("FileTree menu", () => {
  function setup() {
    const commands: TreeCommand[] = [];
    render(
      <FileTree
        project={TEMPLATES.python}
        onOpen={() => undefined}
        onCommand={(c) => (commands.push(c), null)}
      />,
    );
    return commands;
  }

  it("opens on right-click with rename, delete, set as entry and new file/folder", () => {
    setup();
    const row = document.querySelector('[data-path="shapes/circle.py"]')!;
    fireEvent.contextMenu(row, { clientX: 40, clientY: 50 });
    const menu = screen.getByRole("menu", { name: "Actions for shapes/circle.py" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.querySelector("span")?.textContent),
    ).toEqual([
      "Rename",
      "Delete",
      "Set as entry",
      "New file here",
      "New folder here",
      "Copy path",
      "Download",
    ]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Rename/ }));
    expect(screen.getByRole("textbox", { name: "Rename shapes/circle.py" })).toBeInTheDocument();
  });

  it("opens from the keyboard with Shift+F10, and offers new file/folder on empty space", () => {
    setup();
    const row = document.querySelector<HTMLElement>('[data-path="main.py"]')!;
    act(() => row.focus());
    fireEvent.keyDown(row, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu", { name: "Actions for main.py" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.contextMenu(screen.getByRole("tree"), { clientX: 5, clientY: 5 });
    const rootMenu = screen.getByRole("menu", { name: "Project files" });
    expect(
      within(rootMenu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["New file", "New folder", "Download project (.zip)"]);
  });
});

describe("shortcuts", () => {
  it("recognizes zen (code-based, so ⌥ on macOS works) and help", () => {
    expect(
      isZenShortcut({ key: "Ω", code: "KeyZ", metaKey: true, ctrlKey: false, altKey: true }),
    ).toBe(true);
    expect(
      isZenShortcut({ key: "z", code: "KeyZ", metaKey: false, ctrlKey: true, altKey: true }),
    ).toBe(true);
    expect(
      isZenShortcut({ key: "z", code: "KeyZ", metaKey: true, ctrlKey: false, altKey: false }),
    ).toBe(false);
    expect(isHelpShortcut({ key: "F1", metaKey: false, ctrlKey: false, altKey: false })).toBe(true);
    expect(isHelpShortcut({ key: "/", metaKey: true, ctrlKey: false, altKey: false })).toBe(true);
    expect(isHelpShortcut({ key: "/", metaKey: false, ctrlKey: false, altKey: false })).toBe(false);
  });
});

describe("HelpPanel", () => {
  it("lists the quickstart, the project's notes and every shortcut, and starts the tour", () => {
    let toured = 0;
    render(
      <HelpPanel
        open
        spec={getLanguage("python")}
        onClose={() => undefined}
        onTour={() => toured++}
      />,
    );
    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Python" })).toBeInTheDocument();
    for (const s of PLAYGROUND_SHORTCUTS) expect(screen.getByText(s.does)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "take the 1-minute tour" }));
    expect(toured).toBe(1);
  });
});

describe("Tour", () => {
  it("steps through every step with the keyboard, switching panes, and ends", () => {
    const panes: string[] = [];
    let done = 0;
    render(<Tour onPane={(p) => panes.push(p)} onDone={() => done++} />);
    const card = () => screen.getByRole("dialog");
    expect(card()).toHaveTextContent(TOUR_STEPS[0]!.title);
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      fireEvent.keyDown(card(), { key: "ArrowRight" });
      expect(card()).toHaveTextContent(TOUR_STEPS[i]!.title);
    }
    fireEvent.keyDown(card(), { key: "ArrowLeft" });
    expect(card()).toHaveTextContent(TOUR_STEPS.at(-2)!.title);
    fireEvent.keyDown(card(), { key: "Escape" });
    expect(done).toBe(1);
    expect(panes).toContain("files");
    expect(panes).toContain("refs");
  });
});

describe("placeCard", () => {
  const card = { width: 300, height: 200 };
  const viewport = { width: 1440, height: 900 };
  it("goes below, above, beside, or centered, and stays on screen", () => {
    expect(placeCard({ top: 10, bottom: 40, left: 100, right: 200 }, card, viewport)).toEqual({
      left: 100,
      top: 52,
    });
    expect(placeCard({ top: 800, bottom: 850, left: 1400, right: 1430 }, card, viewport)).toEqual({
      left: 1132,
      top: 588,
    });
    // A tall target (the file tree) gets the card beside it.
    expect(placeCard({ top: 40, bottom: 900, left: 0, right: 272 }, card, viewport)).toEqual({
      left: 284,
      top: 52,
    });
    // No room anywhere: centered.
    expect(placeCard({ top: 0, bottom: 900, left: 0, right: 1440 }, card, viewport)).toEqual({
      left: 570,
      top: 350,
    });
  });
});
