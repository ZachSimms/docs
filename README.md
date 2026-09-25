# Zach — references & cheatsheets

A Next.js 16 site styled after [williamjansson.com](https://williamjansson.com/) (see
[Credits](#credits)), serving references and cheatsheets instead of blog posts. Plain monospace,
every page prerendered at build time; the only client-side code is search, the theme toggle, the
keyboard navigation and the table-of-contents tracking.

## Requirements

- [Bun](https://bun.sh) 1.3+ (package manager, script runner, unit test runner, dev runtime)
- Node.js 24 (used under the hood by `next build`, `next start` and Playwright; see "Runtime notes")

## Commands

| Command                              | What it does                                               |
| ------------------------------------ | ---------------------------------------------------------- |
| `bun install`                        | install dependencies                                       |
| `bun run dev`                        | dev server on the Bun runtime, http://localhost:3000       |
| `bun run build`                      | production build (static)                                  |
| `bun run start`                      | serve the production build                                 |
| `bun test`                           | unit tests (Bun test runner + happy-dom + Testing Library) |
| `bun run test:coverage`              | unit tests with coverage (80% threshold)                   |
| `bun run test:e2e`                   | Playwright end-to-end tests (builds, serves on :3100)      |
| `bun run lint` / `bun run typecheck` | ESLint / `tsc --noEmit`                                    |
| `bun run format`                     | Prettier                                                   |

## Adding a cheatsheet

Drop an `.mdx` file into `content/<topic>/`. The file name becomes the URL slug.

```
content/python/list-comprehensions.mdx  ->  /python/list-comprehensions/
```

Frontmatter is required and validated at build time (`lib/schema.ts`):

```mdx
---
title: List comprehensions
date: 2026-09-04
---

Body in Markdown/MDX. Fenced code blocks, tables, lists, links and inline `code` all render in the house style.
```

To group sheets, make a directory inside the topic with an `index.mdx` (same frontmatter; its body is an
optional intro shown above the list). One level of directories is supported:

```
content/typescript/language/index.mdx          ->  /typescript/language/   (lists the directory)
content/typescript/language/objects.mdx        ->  /typescript/language/objects/
```

A topic page lists its directories (shown as `Name/`) and loose sheets together, in the same order rules.
Directory names must be lowercase kebab-case (`design-architecture`; the display name comes from
`index.mdx`). A directory without `index.mdx`, a badly named directory, a directory inside a directory, an
`index.mdx` directly in a topic, or a directory and a sheet with the same name fail the build with a message
naming the path. `_`- and `.`-prefixed files and folders are ignored (drafts, partials).

Sheets are numbered from the top down (`00.`, `01.`, …). Add an optional `order: 1` to the frontmatter to
pin a sheet's position: ordered sheets come first (smallest `order` first), then the rest newest first.

Everything a sheet can contain is demonstrated on `/design/overview/` (`content/design/overview.mdx`):
Markdown text styles, links and heading anchors, lists and task lists, blockquotes, the built-in `<Note>`
component, highlighted code in any language, aligned tables, images, `<details>`, footnotes, horizontal rules, KaTeX maths,
and build-time JavaScript expressions (`export const meta = …` then `{meta.updated}`).
Topics live in `lib/topics.ts`; add one there and create its `content/<slug>/` folder.

## Features

- **Dark mode**: follows the OS preference. The moon / sun button at the top, on the right edge of the content column, overrides it
  (the icon shows the mode you would switch to) and the choice is remembered in `localStorage`.
  Light mode uses the original site's exact colours.
- **Search**: press `⌘K` / `Ctrl+K` (or `/`, or click `Search` in the footer). The palette is a page of
  the site laid over the current one: type to filter, `↑`/`↓` to move, `Enter` to open, `Esc` to close.
  The index (`/search-index.json`) is generated at build time from titles, headings and body text.
- **Syntax highlighting**: fenced code blocks are tokenised at build time by Shiki (GitHub light/dark
  themes, switched by CSS). Add a language after the opening fence: ` ```python `.
- **Maths**: LaTeX between `$…$` (inline) or `$$…$$` (display) is typeset at build time by KaTeX,
  with MathML alongside for screen readers. No client JavaScript.
- **Table of contents**: on wide viewports every sheet with two or more `##`/`###` headings gets a
  contents list in the right margin; the section on screen is underlined solid.
- **Images**: put files under `public/images/<topic>/` and reference them as
  `![alt](/images/<topic>/name.png)`. Dimensions are read at build time and rendered through `next/image`;
  remote URLs fall back to a lazy plain `<img>`.

## Authoring components

Available in every sheet without an import. All are rendered in the site's own idiom (no Fumadocs UI).

| Syntax                                                                  | Renders                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ` ```python title="x.py" {2,4-5} showLineNumbers `                      | titled code box, highlighted lines, line numbers                 |
| `<Note kind="tip">…</Note>`                                             | aside with a dotted rule and a label                             |
| `<Callout type="warn" title="…">…</Callout>`                            | same, `info` / `warn` / `error`; warn and error get a solid rule |
| `<Tabs items={["a","b"]} persist="key"><Tab>…</Tab><Tab>…</Tab></Tabs>` | switchable panels; `persist` syncs and remembers                 |
| `<Steps><Step title="…">…</Step></Steps>`                               | `01.` `02.` numbered procedure                                   |
| `<Cards><Card title href description /></Cards>`                        | `> title` links with descriptions                                |
| ` ```tree title="…" ` fence with a 2-space outline                       | directory tree with guide lines (`dir/` bold, `# comment` dim)  |
| `import X from "./_partial.mdx"` then `<X />`                           | include another file; `_`-prefixed files never become pages      |
| `##` / `###` headings                                                   | table of contents in the right margin (wide viewports)           |

## Keyboard

| Key | Where | Does |
| --- | ----- | ---- |
| `⌘K` / `/` | anywhere | open search |
| `d` | anywhere | toggle light/dark theme |
| `Esc` / `←` / `h` | any page but home | go up a level (`../`); `Esc` closes search first; the parent list highlights the row you left |
| `↑` `↓` / `j` `k` | list pages | move the `>` highlight (hover works too) |
| `Enter` / `→` / `l` | list pages | open the highlighted row: into a directory or a sheet |

## Site map

| Route                    | Content                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `/`                      | the twelve topics, numbered, plus `v` to all sheets          |
| `/sheets/`               | every sheet across topics, newest first, as `NN. topic/slug` |
| `/<topic>/`              | that topic's directories and sheets                          |
| `/<topic>/<slug>/`       | one sheet, or a directory's intro and sheets                 |
| `/<topic>/<dir>/<slug>/` | one sheet inside a directory                                 |
| `/info/`                 | about                                                        |

## Layout

- `app/` routes and `globals.css` (the original's CSS, reproduced verbatim plus table/blockquote rules)
- `components/` `Page` (shell), `NumberedList`, `DottedLink` (the `<a><i>…</i></a>` link idiom)
- `lib/` topics, content loader (`gray-matter` + Zod), formatting helpers
- `content/` the MDX cheatsheets
- Client components: `SearchPalette.tsx`, `SearchLink.tsx`, `ThemeToggle.tsx`, `NumberedList.tsx` (list pages as
  keyboard/mouse menus), `ParentLink.tsx` (pinned `../`, Esc/←/h), `Toc.tsx`, `Tabs.tsx`
- `components/FileTree.tsx` + `lib/file-tree.ts` + `lib/remark-file-tree.ts` (```` ```tree ```` fences)
- `lib/search.ts` (index builder), `lib/search-rank.ts` (isomorphic ranking), `lib/theme.ts`, `lib/images.ts`,
  `lib/keys.ts` (keyboard shortcuts), `lib/toc.ts`
- `mdx-components.tsx` maps MDX `a` and `img` to the house style; inline code is styled by CSS
- `tests/unit`, `tests/e2e`, `tests/fixtures`

## Runtime notes

`bun --bun next build` and `bun --bun next start` currently fail with Bun 1.3.10 and Next 16.3.4
(`Expected CommonJS module to have a function wrapper` while loading Next's compiled server runtime).
Those two scripts therefore run Next's binary on Node, launched by Bun. `next dev` works on the Bun runtime.

## Credits

- **Design:** the look (layout, typography, colours and link style) and the base stylesheet in
  `app/globals.css` are reproduced from [williamjansson.com](https://williamjansson.com/) by William
  Jansson. They remain his work; this repository only adapts them (colour variables, dark mode, tables,
  code blocks and other additions).
- **Unit circle image:** `public/images/unit_circle.jpg`, source: google images
- **Reference material:** the sheets are original summaries. Sources are linked in each sheet's
  "References" section, with MDN as the primary source for web-platform topics.

## License

The code is released under the [MIT License](LICENSE). The cheatsheet content in `content/` and the images
in `public/images/` are not covered by it: all rights reserved, except for the third-party material listed
under [Credits](#credits), which stays under its owners' terms. See [LICENSE](LICENSE) for details.
