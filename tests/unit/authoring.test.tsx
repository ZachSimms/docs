/** Unit tests for the authoring components: Tabs, Steps, Callout, Cards and Note titles. */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";
import { CALLOUT_KIND, Callout } from "@/components/Callout";
import { Card, Cards } from "@/components/Cards";
import { FileTree } from "@/components/FileTree";
import { Note } from "@/components/Note";
import { Step, Steps } from "@/components/Steps";
import { Tab, Tabs } from "@/components/Tabs";

describe("Tabs", () => {
  beforeEach(() => localStorage.clear());

  const render2 = (persist?: string) =>
    render(
      <Tabs items={["bun", "npm"]} persist={persist}>
        <Tab>bun panel</Tab>
        <Tab>npm panel</Tab>
      </Tabs>,
    );

  it("renders a tablist with the first tab selected and the other panel hidden", () => {
    render2();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("bun panel")).toBeVisible();
    expect(screen.getByText("npm panel").closest("[role=tabpanel]")).toHaveAttribute("hidden");
  });

  it("switches on click and with the keyboard", () => {
    render2();
    const [bun, npm] = screen.getAllByRole("tab");
    fireEvent.click(npm!);
    expect(npm).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("bun panel").closest("[role=tabpanel]")).toHaveAttribute("hidden");

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" }); // wraps to bun
    expect(bun).toHaveAttribute("aria-selected", "true");
    expect(bun).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(npm).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "Home" });
    expect(bun).toHaveAttribute("aria-selected", "true");
  });

  it("persists the choice and syncs groups sharing a key", () => {
    render2("pm");
    render2("pm");
    const npmTabs = screen.getAllByRole("tab", { name: "npm" });
    fireEvent.click(npmTabs[0]!);
    expect(localStorage.getItem("tabs:pm")).toBe("npm");
    expect(npmTabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("adopts a stored choice on mount", () => {
    localStorage.setItem("tabs:pm", "npm");
    render2("pm");
    expect(screen.getByRole("tab", { name: "npm" })).toHaveAttribute("aria-selected", "true");
  });

  it("clamps defaultIndex", () => {
    render(
      <Tabs items={["a", "b"]} defaultIndex={7}>
        <Tab>a</Tab>
        <Tab>b</Tab>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "b" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Steps", () => {
  it("renders an ordered list with one item per step and bold titles", () => {
    const { container } = render(
      <Steps>
        <Step title="First">do this</Step>
        <Step>then this</Step>
      </Steps>,
    );
    const items = container.querySelectorAll("ol.steps > li");
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector("b")).toHaveTextContent("First");
    expect(items[1]?.querySelector("b")).toBeNull();
    expect(items[1]).toHaveTextContent("then this");
  });
});

describe("Callout and Note", () => {
  it("maps types to labels and defaults to info", () => {
    expect(CALLOUT_KIND).toEqual({ info: "note", warn: "warning", error: "error" });
    render(<Callout>plain</Callout>);
    expect(screen.getByRole("note")).toHaveAttribute("data-kind", "note");
  });

  it("renders a warning with a title line", () => {
    render(
      <Callout type="warn" title="Careful">
        body
      </Callout>,
    );
    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("data-kind", "warning");
    expect(note.querySelector(".note-title b")).toHaveTextContent("warning: Careful");
    expect(note.querySelector(".note-body")).toHaveTextContent("body");
    expect(note.querySelector(".note-body")).not.toHaveTextContent("warning:");
  });

  it("Note accepts block children without nesting a p inside a p", () => {
    const { container } = render(
      <Note kind="tip">
        <p>para</p>
      </Note>,
    );
    expect(container.querySelector("p p")).toBeNull();
    expect(container.querySelector(".note-body > p")).toHaveTextContent("para");
  });
});

describe("Cards", () => {
  it("renders > links with optional descriptions", () => {
    const { container } = render(
      <Cards>
        <Card title="Docs" href="/maths/notation/" description="symbols" />
        <Card title="KaTeX" href="https://katex.org/" />
      </Cards>,
    );
    const cards = container.querySelectorAll("nav.cards > .card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("> Docs");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/maths/notation/");
    expect(cards[0]?.querySelector(".card-desc")).toHaveTextContent("symbols");
    expect(cards[1]?.querySelector(".card-desc")).toBeNull();
    const katex = screen.getByRole("link", { name: "KaTeX (opens in a new tab)" });
    expect(katex).toHaveAttribute("rel", "noopener noreferrer");
    expect(katex).toHaveAttribute("target", "_blank");
  });
});

describe("FileTree", () => {
  const tree = `
app/
  page.tsx  # route /
  blog/
    [slug]/
`;

  it("renders a titled code figure with one line per entry", () => {
    const { container } = render(<FileTree title="Next.js app" tree={tree} />);
    const figure = container.querySelector("figure.file-tree");
    expect(figure).toHaveAttribute("data-rehype-pretty-code-figure");
    expect(figure?.querySelector("figcaption")).toHaveTextContent("Next.js app");
    const lines = [...(figure?.querySelectorAll("pre code [data-line]") ?? [])];
    expect(lines.map((l) => l.textContent)).toEqual([
      "app/",
      "├── page.tsx  # route /",
      "└── blog/",
      "    └── [slug]/",
    ]);
  });

  it("marks directories, guides and comments for styling", () => {
    const { container } = render(<FileTree tree={tree} />);
    expect(container.querySelector("figcaption")).toBeNull();
    const dirs = [...container.querySelectorAll(".ft-dir")].map((d) => d.textContent);
    expect(dirs).toEqual(["app/", "blog/", "[slug]/"]);
    expect(container.querySelector(".ft-comment")).toHaveTextContent("# route /");
    expect(container.querySelectorAll(".ft-guide")).toHaveLength(3);
  });

  it("labels the diagram for assistive tech", () => {
    const { container } = render(<FileTree title="Layout" tree={tree} />);
    expect(container.querySelector("figure")).toHaveAttribute("aria-label", "File tree: Layout");
    expect(container.querySelector(".ft-guide")).toHaveAttribute("aria-hidden", "true");
  });
});
