/**
 * @file Next.js configuration.
 *
 * MDX is compiled by `@next/mdx`. Because the build runs on Turbopack, every
 * remark/rehype plugin is referenced by package name with JSON-serializable
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
  async redirects() {
    // The topic was renamed from "Maths" (US English): keep old links working.
    return [
      { source: "/maths/", destination: "/math/", permanent: true },
      { source: "/maths/:path*", destination: "/math/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Only this site may frame its pages (the playground's reference panel does):
        // no clickjacking from other origins.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // The Godot runner loads its engine files from inside an opaque-origin sandbox,
        // which makes those fetches cross-origin.
        source: "/playground/godot/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          // The runner page is only meant for the playground's sandboxed frame; this keeps it at an
          // opaque origin however it is opened. (Same key as above: the later rule wins, so the
          // frame-ancestors directive is repeated.)
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; sandbox allow-scripts",
          },
        ],
      },
      {
        // The Next.js playground boots a WebContainer, which needs SharedArrayBuffer, so a
        // cross-origin-isolated page. `credentialless` (not `require-corp`) still lets the
        // reference panel frame the site's own sheets and show DevDocs images.
        source: "/playground/node/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

/** Absolute path of the local remark plugin (Next runs with the project root as cwd). */
const REMARK_FILE_TREE = path.join(process.cwd(), "lib", "remark-file-tree.ts");
/** Absolute path of the ```html demo plugin (see `lib/remark-demo.ts`). */
const REMARK_DEMO = path.join(process.cwd(), "lib", "remark-demo.ts");

// Plugin names are strings (and options plain data) so the config stays serializable for Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [
      // Local plugin: ```tree fences → <FileTree>. Absolute, because @next/mdx
      // resolves plugin names from each MDX file's own directory.
      REMARK_FILE_TREE,
      // Local plugin: ```html demo fences keep their code and gain a live <Demo>.
      REMARK_DEMO,
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
