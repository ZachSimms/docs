/**
 * @file Next.js configuration.
 *
 * MDX is compiled by `@next/mdx`. Because the build runs on Turbopack, every
 * remark/rehype plugin is referenced by package name with JSON-serialisable
 * options (functions cannot cross into Rust). `trailingSlash` mirrors the
 * original site's URLs.
 *
 * Code blocks go through `rehype-pretty-code` (Shiki underneath): fences accept
 * `title="…"`, `{1,3-5}` line ranges and `showLineNumbers`; the dual theme is
 * emitted as `--shiki-light` / `--shiki-dark` variables that the CSS switches.
 */
import path from "node:path";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  trailingSlash: true,
};

/** Absolute path of the local remark plugin (Next runs with the project root as cwd). */
const REMARK_FILE_TREE = path.join(process.cwd(), "lib", "remark-file-tree.ts");

// Plugin names are strings (and options plain data) so the config stays serializable for Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [
      // Local plugin: ```tree fences → <FileTree>. Absolute, because @next/mdx
      // resolves plugin names from each MDX file's own directory.
      REMARK_FILE_TREE,
      "remark-gfm",
      "remark-frontmatter",
      "remark-mdx-frontmatter",
      "remark-math",
    ],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-katex", { output: "htmlAndMathml" }],
      [
        "rehype-pretty-code",
        {
          theme: { light: "github-light", dark: "github-dark" },
          keepBackground: false,
          defaultLang: "text",
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
