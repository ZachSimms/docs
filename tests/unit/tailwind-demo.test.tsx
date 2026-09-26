/** Unit tests for `lib/tailwind-demo.ts` and `<TailwindDemo>`: real Tailwind CSS compiled for a demo snippet. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { TailwindDemo } from "@/components/TailwindDemo";
import { compileTailwindDemo, extractCandidates, splitDemoStyles } from "@/lib/tailwind-demo";

describe("splitDemoStyles", () => {
  it("moves every <style> block out of the markup", () => {
    const { markup, css } = splitDemoStyles(
      '<style>@theme { --color-brand: red; }</style><div class="p-2">x</div><style>.a{}</style>',
    );
    expect(markup).toBe('<div class="p-2">x</div>');
    expect(css).toBe("@theme { --color-brand: red; }\n.a{}");
  });

  it("returns the markup unchanged when there is no style block", () => {
    expect(splitDemoStyles("<p>x</p>")).toEqual({ markup: "<p>x</p>", css: "" });
  });
});

describe("extractCandidates", () => {
  it("returns each class-like token once, including variants and arbitrary values", () => {
    const candidates = extractCandidates(
      "<div class=\"grid grid-cols-3 md:gap-4 grid\">\n<i class='dark:bg-sky-500 grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]'></i></div>",
    );
    expect(candidates).toContain("grid");
    expect(candidates).toContain("grid-cols-3");
    expect(candidates).toContain("md:gap-4");
    expect(candidates).toContain("dark:bg-sky-500");
    expect(candidates).toContain("grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]");
    expect(candidates.filter((c) => c === "grid")).toHaveLength(1);
  });
});

describe("compileTailwindDemo", () => {
  it("compiles only the utilities the snippet uses", async () => {
    const { markup, css } = await compileTailwindDemo(
      '<div class="grid grid-cols-3 not-a-utility">x</div>',
    );
    expect(markup).toBe('<div class="grid grid-cols-3 not-a-utility">x</div>');
    expect(css).toContain(".grid-cols-3");
    expect(css).toContain("repeat(3, minmax(0, 1fr))");
    expect(css).not.toContain(".flex {");
  });

  it("doesn't leak one demo's utilities into the next (build() is incremental per compiler)", async () => {
    await compileTailwindDemo('<div class="grid-cols-7"></div>');
    const { css } = await compileTailwindDemo('<div class="grid-cols-5"></div>');
    expect(css).toContain(".grid-cols-5");
    expect(css).not.toContain(".grid-cols-7");
  });

  it("keys dark: off the frame's data-theme attribute, not the OS preference", async () => {
    const { css } = await compileTailwindDemo('<div class="dark:bg-sky-500"></div>');
    expect(css).toContain("[data-theme=dark]");
    expect(css).not.toContain("prefers-color-scheme: dark");
  });

  it("feeds the snippet's own <style> (custom @theme keyframes) into the compile", async () => {
    const html =
      "<style>@theme { --animate-wiggle: wiggle 1s infinite; @keyframes wiggle { 50% { rotate: 3deg; } } }</style>" +
      '<div class="animate-wiggle"></div>';
    const { markup, css } = await compileTailwindDemo(html);
    expect(markup).toBe('<div class="animate-wiggle"></div>');
    expect(css).toContain(".animate-wiggle");
    expect(css).toContain("@keyframes wiggle");
  });
});

describe("TailwindDemo", () => {
  it("renders a scriptless sandboxed frame whose document carries the compiled CSS", async () => {
    render(await TailwindDemo({ html: '<div class="flex gap-2">x</div>', title: "flex.html" }));
    const frame = screen.getByTitle("Live demo: flex.html");
    expect(frame).toHaveAttribute("sandbox", "");
    const doc = frame.getAttribute("srcdoc") ?? "";
    expect(doc).toContain(".gap-2");
    expect(doc).toContain('<div class="flex gap-2">x</div>');
  });
});
