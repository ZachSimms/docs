/**
 * @file Component map for MDX content (Next.js convention file).
 *
 * `@next/mdx` calls {@link useMDXComponents} for every compiled MDX file, so
 * the mappings here apply to every cheatsheet. Anchors and images are routed
 * through the site's components; the authoring components (`<Note>`, `<Callout>`,
 * `<Tabs>`, `<Steps>`, `<Cards>`, `<FileTree>`) are available without an import.
 * Inline code is styled purely by CSS (`:not(pre) > code`) because Shiki
 * rewrites fenced blocks and a class-based detector would misfire.
 */

import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes } from "react";
import { DottedLink } from "@/components/DottedLink";
import { MdxImage } from "@/components/MdxImage";
import { Callout } from "@/components/Callout";
import { Card, Cards } from "@/components/Cards";
import { Demo } from "@/components/Demo";
import { Diagram } from "@/components/Diagram";
import { FileTree } from "@/components/FileTree";
import { Graph, Graphs } from "@/components/Graph";
import { Note } from "@/components/Note";
import { Step, Steps } from "@/components/Steps";
import { Contrast, Scale, Swatches } from "@/components/Swatches";
import { Tab, Tabs } from "@/components/Tabs";
import { YouTube } from "@/components/YouTube";

/**
 * Render Markdown links as inline {@link DottedLink}s.
 *
 * Every anchor attribute except `title` is forwarded (footnote references rely
 * on `id`, `aria-describedby` and `data-*`); `title` becomes the accessible label.
 */
function MdxAnchor({
  href = "#",
  children,
  title,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <DottedLink href={href} inline ariaLabel={title} {...rest}>
      {children}
    </DottedLink>
  );
}

/**
 * Site-wide defaults: `a`, `img`, and the authoring components available to
 * every sheet without an import: `Note`, `Callout`, `Tabs`/`Tab`,
 * `Steps`/`Step`, `Cards`/`Card`, `FileTree` for directory layouts,
 * `Graph` for function plots, `Swatches`/`Scale`/`Contrast` for colors,
 * `Demo` for live HTML/CSS (inserted by `lib/remark-demo.ts`), `Diagram`
 * for inline SVG diagrams and `YouTube` for embedded videos.
 */
const defaults: MDXComponents = {
  a: MdxAnchor,
  img: MdxImage,
  Note,
  Callout,
  Tabs,
  Tab,
  Steps,
  Step,
  Cards,
  Card,
  FileTree,
  Graph,
  Graphs,
  Swatches,
  Scale,
  Contrast,
  Demo,
  Diagram,
  YouTube,
};

/**
 * Merge the site defaults with any components passed by a caller; caller
 * entries win, so a page can override `a` or `img` locally.
 *
 * @param components - Optional per-usage overrides.
 * @returns The component map handed to the MDX runtime.
 */
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...defaults, ...components };
}
