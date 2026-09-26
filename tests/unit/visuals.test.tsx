/** Unit tests for the visual authoring components: Swatches, Scale, Contrast, Demo and Diagram. */
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";
import { Contrast, Scale, Swatches } from "@/components/Swatches";
import { Demo } from "@/components/Demo";
import { buildSrcDoc, DEFAULT_DEMO_HEIGHT } from "@/lib/demo";
import { Diagram } from "@/components/Diagram";
import { readDiagram } from "@/lib/diagram";

describe("Swatches", () => {
  it("renders one chip per color with its name and value", () => {
    render(
      <Swatches
        title="Brand"
        colors={["#1f6feb", { name: "accent", value: "oklch(0.7 0.15 55)" }]}
      />,
    );
    const list = screen.getByRole("list", { name: "Brand" });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("#1f6feb");
    expect(items[1]).toHaveTextContent("accent");
    expect(items[1]).toHaveTextContent("oklch(0.7 0.15 55)");
    const chip = items[0]!.querySelector<HTMLElement>(".swatch-chip");
    expect(chip?.style.background).toContain("#1f6feb");
  });

  it("draws a proportion bar when weights are given", () => {
    const { container } = render(
      <Swatches colors={["#eee", "#333", "#f60"]} weights={[60, 30, 10]} />,
    );
    const parts = container.querySelectorAll<HTMLElement>(".swatch-bar > span");
    expect([...parts].map((p) => p.style.flexGrow)).toEqual(["60", "30", "10"]);
    expect(container).toHaveTextContent("60%");
    expect(container).toHaveTextContent("10%");
  });

  it("rejects bad weights and unreadable colors at build time", () => {
    expect(() => render(<Swatches colors={["#eee"]} weights={[1, 2]} />)).toThrow(/weights/);
    expect(() => render(<Swatches colors={["#eee", "#000"]} weights={[0, 0]} />)).toThrow(
      /positive total/,
    );
    expect(() => render(<Swatches colors={["#eee", "#000"]} weights={[2, -1]} />)).toThrow(
      /non-negative/,
    );
    expect(() => render(<Swatches colors={["not-a-color"]} />)).toThrow(/Unsupported color/);
  });
});

describe("Scale", () => {
  it("renders the eleven tonal steps with their hex values", () => {
    render(<Scale hue={250} chroma={0.12} title="Blue" />);
    const items = screen.getByRole("list", { name: "Blue" }).querySelectorAll("li");
    expect(items).toHaveLength(11);
    expect(items[0]).toHaveTextContent("50");
    expect(items[10]).toHaveTextContent("950");
    expect(items[5]?.textContent).toMatch(/#[0-9a-f]{6}/);
  });
});

describe("Contrast", () => {
  it("shows the sample on the background with its ratio and WCAG grades", () => {
    const { container } = render(<Contrast fg="#767676" bg="#ffffff" />);
    const sample = container.querySelector<HTMLElement>(".contrast-sample");
    expect(sample?.style.color).toBeTruthy();
    expect(sample?.style.background).toBeTruthy();
    expect(container).toHaveTextContent("4.54:1");
    expect(container).toHaveTextContent("text AA · large AAA");
  });

  it("uses the children as the sample text and marks failures", () => {
    const { container } = render(
      <Contrast fg="#aaa" bg="#fff">
        Pale
      </Contrast>,
    );
    expect(container.querySelector(".contrast-sample")).toHaveTextContent("Pale");
    expect(container).toHaveTextContent("text fail · large fail");
  });
});

describe("Demo", () => {
  beforeEach(() => localStorage.clear());

  it("renders a sandboxed iframe whose document contains the snippet", () => {
    render(<Demo html='<div class="box">hi</div>' title="flex.html" height="120" />);
    const frame = screen.getByTitle("Live demo: flex.html");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("height", "120");
    expect(frame.getAttribute("srcdoc")).toContain('<div class="box">hi</div>');
  });

  it("falls back to the default height and a generic title", () => {
    render(<Demo html="<p>x</p>" />);
    const frame = screen.getByTitle("Live demo");
    expect(frame).toHaveAttribute("height", String(DEFAULT_DEMO_HEIGHT));
  });

  it("wraps the snippet in a document with the base tokens, following the OS by default", () => {
    const doc = buildSrcDoc("<p>x</p>");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("color-scheme: light dark;");
    expect(doc).toContain("--graph-0");
    expect(doc.indexOf("<p>x</p>")).toBeGreaterThan(doc.indexOf("<body>"));
    expect(buildSrcDoc("<p>x</p>", "dark")).toContain("color-scheme: dark;");
  });

  it("adds extra CSS after the base styles and marks the theme on <html>", () => {
    const doc = buildSrcDoc("<p>x</p>", "dark", ".grid{display:grid}");
    expect(doc).toContain('<html data-theme="dark">');
    expect(doc).toContain("<style>.grid{display:grid}</style>");
    expect(doc.indexOf(".grid{display:grid}")).toBeGreaterThan(doc.indexOf("--graph-0"));
    expect(doc.indexOf(".grid{display:grid}")).toBeLessThan(doc.indexOf("<body>"));
    expect(buildSrcDoc("<p>x</p>")).toContain("<html>");
  });

  it("keeps a closing style tag inside extra CSS from ending the style block", () => {
    const doc = buildSrcDoc("<p>x</p>", null, "a{} </style><script>x</script>");
    expect(doc).not.toContain("</style><script>");
  });

  it("points every link at a new window, which the sandbox blocks", () => {
    const doc = buildSrcDoc('<a href="#">x</a>');
    expect(doc).toContain('<base target="_blank">');
    expect(doc.indexOf("<base")).toBeLessThan(doc.indexOf("<body>"));
  });

  it("writes the site theme into the frame, since srcdoc frames ignore the page's scheme", () => {
    localStorage.setItem("theme", "dark");
    render(<Demo html="<p>x</p>" />);
    expect(screen.getByTitle("Live demo").getAttribute("srcdoc")).toContain("color-scheme: dark;");
  });
});

describe("readDiagram", () => {
  const root = path.join(__dirname, "..", "fixtures", "diagrams-public");

  it("returns the SVG markup without the XML prolog", () => {
    const svg = readDiagram("/images/diagrams/ok.svg", root);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="currentColor"');
  });

  it("only reads .svg files inside /images/diagrams/", () => {
    expect(() => readDiagram("/images/other/outside.svg", root)).toThrow(/images\/diagrams/);
    expect(() => readDiagram("/images/diagrams/../other/outside.svg", root)).toThrow();
    expect(() => readDiagram("/images/diagrams/ok.png", root)).toThrow(/\.svg/);
    expect(() => readDiagram("/images/diagrams/missing.svg", root)).toThrow(/Cannot read/);
  });

  it("refuses scripts, handlers, javascript: URLs, embedded HTML, styles and stray ids", () => {
    for (const name of [
      "script",
      "handler",
      "handler-slash",
      "handler-quote",
      "js-url",
      "js-entity",
      "foreign",
      "style",
    ]) {
      expect(() => readDiagram(`/images/diagrams/${name}.svg`, root)).toThrow(/unsafe/);
    }
    expect(() => readDiagram("/images/diagrams/plain.svg", root)).toThrow(/not an SVG/);
    expect(() => readDiagram("/images/diagrams/stray-id.svg", root)).toThrow(
      /"stray-id-" prefix: g/,
    );
  });

  it("allows prefixed ids and harmless text that mentions handlers or javascript:", () => {
    expect(readDiagram("/images/diagrams/prefixed.svg", root)).toContain('id="prefixed-arrow"');
  });
});

describe("Diagram", () => {
  it("inlines a site diagram as a labeled image with a caption", () => {
    render(
      <Diagram
        src="/images/diagrams/box-model.svg"
        label="The CSS box model"
        caption="Box model"
      />,
    );
    const img = screen.getByRole("img", { name: "The CSS box model" });
    expect(img.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Box model").tagName).toBe("FIGCAPTION");
  });
});
