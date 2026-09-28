# Zach — projects, writing, resume, references & cheatsheets

A Next.js 16 personal site styled after [williamjansson.com](https://williamjansson.com/) (see
[Credits](#credits)): a home page, projects, a blog, a resume, and the references and cheatsheets
under `/docs/`. Plain monospace, every page prerendered at build time; the only client-side code is
search, the theme toggle, the keyboard navigation and the table-of-contents tracking.

The home page is one 90ch column: name, introduction and the sections with their keys (`p` projects,
`r` resume, `b` blog, `g` docs). Every other page but the playground uses the split layout: the site's
sections on the left (with the docs' topic tree unfolded down to the page being read), the page on
the right. Below 900px the sections become one line of links above the page and the tree is left out;
breadcrumbs and `../` remain.

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

To run the end-to-end tests with a Chromium that's already installed (when its
build doesn't match the pinned Playwright), point `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
at it, e.g. `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium bun run test:e2e`.

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
component, highlighted code in any language, aligned tables, images, `<details>`, footnotes, horizontal rules, KaTeX math,
and build-time JavaScript expressions (`export const meta = …` then `{meta.updated}`).
Topics live in `lib/topics.ts`, in alphabetical order by name (a unit test enforces it); add one there and create
its `content/<slug>/` folder.

## Home, projects, resume and blog

Everything personal lives in `lib/profile.ts`: name, bio,
GitHub (and optional email), the projects
(on `/projects/` and the resume), and the resume
(summary, jobs, education, skills, and an optional PDF under `public/`). Strings in `[square brackets]`
are placeholders still to be written; a resume section with no entries is not rendered.

Blog posts are `posts/<slug>.mdx`, published at `/blog/<slug>/` and listed newest first on `/blog/` and
the home page:

```mdx
---
title: A post
date: 2026-09-27
summary: One or two sentences for the excerpt.   # optional
tags: [notes]                                    # optional
---
```

A post renders like a sheet (same components, code, math and table of contents). `_`-prefixed files are
drafts and never published; `posts/_example.mdx` is a template. Invalid frontmatter or a file name that is
not kebab-case fails the build.

## Features

- **Dark mode**: follows the OS preference. The moon / sun button at the top, on the right edge of the content column, overrides it
  (the icon shows the mode you would switch to) and the choice is remembered in `localStorage`.
  Light mode uses the original site's exact colors.
- **Search**: press `⌘K` / `Ctrl+K` (or `/`, or click `Search` in the footer). The palette is a page of
  the site laid over the current one: type to filter, `↑`/`↓` to move, `Enter` to open, `Esc` to close.
  The index (`/search-index.json`) is generated at build time from titles, headings and body text.
- **Syntax highlighting**: fenced code blocks are tokenized at build time by Shiki (GitHub light/dark
  themes, switched by CSS). Add a language after the opening fence: ` ```python `.
- **Math**: LaTeX between `$…$` (inline) or `$$…$$` (display) is typeset at build time by KaTeX,
  with MathML alongside for screen readers. No client JavaScript.
- **Zen mode**: on a sheet or a post, `zen` beside `../` (or `z`) hides the navigation, breadcrumbs
  and footer and puts the table of contents on the left, from 900px up. From 900px up it also widens
  the sheet from 72ch to 88ch and loosens prose to 1.65 line height (code stays at 1.5). It is
  remembered in `localStorage` and restored before first paint.
- **Sky** (home, beside the text): tonight's moon in the light theme, the sun in the dark theme
  (`d` switches), dithered in 3px cells with an 8×8 Bayer matrix and drawn on a canvas in the text
  color (`lib/sky.ts`, `lib/dither.ts`). The moon shows its real phase, worked out in the reader's
  browser (phase name and percent lit, from the mean lunar month); the sun's caption counts the days
  to the next equinox or solstice (Meeus' mean formulas). Both follow the reader's hemisphere, told
  from the browser's time zone with no location prompt (`lib/hemisphere.ts`): from the south the
  moon is drawn upside down and March brings the autumn equinox. On phones it follows the section
  list.
- **Table of contents**: on viewports 1280px and wider every sheet with two or more `##`/`###` headings
  gets a contents list in the right margin; the section on screen is underlined solid. Narrower, the
  same list opens from `≡` in the top bar.
- **Playground** (`/playground/`, in the section list): a browser IDE for C++, Rust, Python,
  JavaScript, TypeScript, HTML/CSS/JS, HTML/CSS/TS, React, Bun, Bun + Hono, GDScript and Markdown. Each
  is a project of files and folders (imports, modules, headers), saved in `localStorage`, with hover
  intellisense. A reference panel (`Refs`, or `⌘K` on that page) shows the site's sheets, the official docs
  (MDN and others) or copy-ready code snippets beside the code. See [Playground](#playground).
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
| `<Swatches colors={[…]} weights={[60,30,10]} />`, `<Scale hue chroma />`, `<Contrast fg bg />` | color chips, tonal scale, WCAG contrast (build-time, `lib/color.ts`) |
| ` ```html demo height=160 ` fence                                      | code box plus the live result in a sandboxed iframe (`<Demo>`)  |
| ` ```html demo tailwind ` fence                                         | same, with the snippet's classes compiled by Tailwind v4 at build time; a `<style>` block may hold `@theme`/`@utility`/`@keyframes`, and `dark:` follows the site theme |
| `<Diagram src="/images/diagrams/x.svg" label="…" caption="…" />`        | inline SVG diagram that follows the theme (`.d-*` accent classes) |
| `<YouTube id="…" title="…" channel="…" start={30} />`                   | click-to-play 16:9 embed (youtube-nocookie), caption link; bad ids fail build  |
| `<Graph title="…" curves={[{ fn: "nlogn", label: "O(n log n)" }]} domain={[0, 16]} range={[0, 70]} />` | SVG function plot from the `lib/graph.ts` catalog (math functions plus `log2`, `nlogn`, `pow2` for Big-O); `a·f(b(x − h)) + k` transforms |
| `import X from "./_partial.mdx"` then `<X />`                           | include another file; `_`-prefixed files never become pages      |
| `##` / `###` headings                                                   | table of contents in the right margin (wide viewports)           |

## Keyboard

| Key | Where | Does |
| --- | ----- | ---- |
| `⌘K` / `/` | anywhere | open search |
| `d` | anywhere | toggle light/dark theme |
| `z` | sheets and posts | zen mode: only the sheet, with its contents on the left |
| `p` `r` `b` `g` | home | open Projects, Resume, Blog, Docs |
| `Esc` / `←` / `h` | any page but home | go up a level (`../`); `Esc` closes search first; the parent list highlights the row you left |
| `↑` `↓` / `j` `k` | list pages | move the `>` highlight (hover works too); on a topic page it runs through every directory's sheets, and on `/docs/` through the topic cards |
| `Enter` / `→` / `l` | list pages | open the highlighted row: into a topic, a directory or a sheet |
| double-tap left edge | touch, any page but home | same as `←`: up a level (the outer quarter of the screen; not on links, code or tables) |
| double-tap right edge | touch, list pages | same as `→`: open the highlighted row; nothing if no row is highlighted |
| `⌘↵` / `Ctrl+↵` | playground editor | run the project |
| `⌘K` | playground | search sheets and open the result in the reference panel |
| `↑` `↓` `←` `→`, `Enter`, `F2`, `Delete` | playground file tree | move, fold/unfold, open, rename, delete (asks first) |
| right-click, `Shift+F10`, Menu key | playground file tree | file menu: rename, delete, set as entry, new file/folder here, copy path, preview, download (a file; a folder or the whole project as `.zip`) |
| `⌘⌥Z` / `Ctrl+Alt+Z` | playground | zen mode (only the code, output and Refs); `Esc` outside the editor leaves it |
| `F1` / `⌘/` | playground | help: getting started, shortcuts, and the 1-minute tour |

## Site map

| Route                    | Content                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `/`                      | introduction, sections with their keys, tonight's moon (or the sun)      |
| `/projects/`             | every project as a card                                                  |
| `/blog/`                 | the latest post as an excerpt, then every post by year                   |
| `/blog/<slug>/`          | one post                                                                 |
| `/resume/`               | experience, projects, education, skills                                  |
| `/docs/`                 | the twenty-two topics as cards (number, sheet count), recently added     |
| `/sheets/`               | every sheet across topics, newest first, as `NN. topic/slug`             |
| `/<topic>/`              | that topic's directories, each unfolded with its sheets, and loose sheets |
| `/<topic>/<slug>/`       | one sheet, or a directory's intro and sheets                             |
| `/<topic>/<dir>/<slug>/` | one sheet inside a directory                                             |
| `/info/`                 | about                                                                    |
| `/playground/`           | the in-browser IDE                                                       |

Sheet URLs did not move when the site gained its other sections: the topic list moved from `/` to
`/docs/`, and `../` from a topic now leads there.

The topic at `/math/` used to live at `/maths/`; old links redirect (`next.config.ts`).

## Layout

- `app/` routes and `globals.css` (the original's CSS, reproduced verbatim plus table/blockquote rules)
- `components/` `Page` (the split shell: `SiteNav` on the left, breadcrumbs, heading, body, footer),
  `NumberedList`, `DottedLink` (the `<a><i>…</i></a>` link idiom), `ProjectCard`
- `lib/` topics, sections (`lib/sections.ts`), content loader (`gray-matter` + Zod), posts loader
  (`lib/posts.ts`), profile and resume data (`lib/profile.ts`), formatting helpers
- `content/` the MDX cheatsheets; `posts/` the MDX blog posts
- Client components: `SearchPalette.tsx`, `SearchLink.tsx`, `ThemeToggle.tsx`, `useMenu.ts` (the keyboard/mouse
  menu behind `NumberedList.tsx`, `TopicCards.tsx` and `TopicIndex.tsx`), `ParentLink.tsx` (pinned `../`,
  Esc/←/h), `NavScroller.tsx` (keeps the current page visible in the navigation), `Toc.tsx`, `Tabs.tsx`
- `components/FileTree.tsx` + `lib/file-tree.ts` + `lib/remark-file-tree.ts` (```` ```tree ```` fences)
- `components/Swatches.tsx` + `lib/color.ts` (color chips), `components/Demo.tsx` + `lib/remark-demo.ts`
  (```` ```html demo ```` fences), `components/Diagram.tsx` + `lib/diagram.ts` (SVGs in `public/images/diagrams/`)
- `lib/search.ts` (index builder), `lib/search-rank.ts` (isomorphic ranking), `lib/theme.ts`, `lib/images.ts`,
  `lib/keys.ts` (keyboard shortcuts), `lib/toc.ts`
- `mdx-components.tsx` maps MDX `a` and `img` to the house style; inline code is styled by CSS
- `lib/tailwind-demo.ts` + `components/TailwindDemo.tsx` (```` ```html demo tailwind ```` fences)
- Playground: `app/playground/` (routes + `playground.css`), `components/playground/` (UI, editor, sandbox frames,
  `intellisense/` workers and editor extensions), `lib/playground/` (project model, languages, linker, runners,
  sandbox runtime, docs, hover data), `playground/godot-runner/` (Godot project behind the GDScript runner),
  `public/playground/` (Godot export, DevDocs manifest, TypeScript lib files, hover docs; basedpyright is copied
  there at `dev`/`build` time and not committed)
- `tests/unit`, `tests/e2e` (`*.mobile.spec.ts` also run on emulated Pixel 7 and iPhone 14), `tests/fixtures`

## Playground

| Language | Runs | Notes |
| -------- | ---- | ----- |
| JavaScript, TypeScript | a Web Worker inside a sandboxed frame | TS types are stripped by Sucrase, not checked; bare imports load from esm.sh |
| HTML/CSS/JS | a sandboxed live preview | stylesheets and module scripts are linked from the project's files |
| Python | Pyodide 314 (CPython 3.14) in a worker inside the sandbox | ≈ 6 MB from jsDelivr on the first run (asked first); numpy/pandas load on import; stdin box |
| C++ | Compiler Explorer (CMake, g++ 16.2, C++23), falling back to Wandbox | code is sent to godbolt.org and logged there for 32 days; stdin box |
| Rust | Compiler Explorer (rustc 1.98, edition 2024), falling back to the Rust Playground | `mod x;` files are inlined into one crate; errors point back at the file |
| GDScript | a self-hosted Godot 4.7 web build in a sandboxed frame | ≈ 10 MB on the first run; `preload("res://…")` works across files, `class_name` globals don't |
| HTML/CSS/TS | the sandboxed live preview | module scripts in TypeScript, types stripped |
| React | the sandboxed live preview, TSX via Sucrase | packages from esm.sh at the `package.json` versions, all on one React (19.3) |
| Bun | a worker with Bun's APIs **emulated** (not real Bun) | `Bun.serve`, `Bun.file`/`write` (in memory), `Bun.env` from `.env`; no `Bun.spawn`, `Bun.$`, `bun:sqlite`; requests come from the HTTP panel and never leave the browser |
| Bun + Hono | the same, with real Hono (4.13) from esm.sh | `export default app` or `Bun.serve({ fetch: app.fetch })` |
| Markdown | nothing runs | GFM preview beside the editor (raw HTML is escaped); `.md` files in any project get the preview too |

- **Intellisense:** hover, completions and diagnostics, loaded when the editor is first focused.
  - JS/TS projects: a TypeScript 6.0 language service in a worker (npm alias `typescript-ls`, so the repo's own
    `tsc` is unchanged), with types for `package.json` dependencies from jsDelivr (`@typescript/ata`) and the
    standard library served from `public/playground/ts-lib/` (`bun scripts/build-ts-lib.ts`). Bun projects see
    types for the emulated `Bun` global.
  - Python: [basedpyright](https://docs.basedpyright.com/) in the browser (experimental), with every project file
    open so imports resolve.
  - Type errors show as warnings, since runs strip types; syntax errors stay errors.
  - C++, Rust, GDScript, HTML and CSS: hovers and completions from the official references, generated from
    DevDocs by `bun scripts/build-hover-docs.ts` into `public/playground/hover/` (committed), each with its
    source's attribution and an **Open docs** button.
  - On touch screens, the `ⓘ` key on the symbol row shows the hover for the name at the cursor.
- **Official docs:** the reference panel's **Docs** tab searches the official references for the current project
  (MDN's HTML, CSS, JavaScript, Web APIs and HTTP; TypeScript; Python 3.14; cppreference; Rust; Godot 4.7; React;
  Bun; Node) through [DevDocs](https://devdocs.io/). Pages are sanitized with DOMPurify and shown in a
  scriptless frame with a `default-src 'none'` CSP, with their license and "via DevDocs"; links inside a
  docset open in the panel. Hono and Tailwind docs are framed from their own sites. `bun scripts/build-docs-manifest.ts` refreshes the committed docset list.
- **Snippets:** the reference panel's **Snippets** tab holds code outlines for the current project: the structure of
  a construct with placeholders (`// ...`, `pass`, `todo!()`, `<!-- ... -->`) for your own logic. JavaScript, TypeScript,
  Python, C++, Rust and GDScript each have hello world (a runnable program), variables, functions, arrow functions
  (lambdas and closures where the language calls them that), if/else, switch or match, loops, collections, classes and
  subclasses, exception handling (try/catch, or `Result` and error codes where the language has no exceptions), async
  and modules; there are sets for HTML, CSS, Tailwind CSS, the DOM, React, Bun, Hono and Markdown too. A project with
  several sets (HTML/CSS/JS, HTML/CSS/TS, React, Bun + Hono) has a picker, and the tab starts on the set written in the
  open file's language. The Tailwind set uses Tailwind 4's browser build (its Setup snippet adds the script tag to
  `index.html`), so it needs no build step. Type to filter (`lambda`, `try`, `await`…; title matches first); **copy**
  puts an outline on the clipboard (or selects it if the clipboard is refused), **insert** puts it at the editor's
  cursor. Every outline parses as pasted. They live in `lib/playground/snippets/`, one module per set, each loaded the
  first time it's shown, and are highlighted with the editor's own parsers.
- **Layout:** every pane edge is a drag handle (keyboard too: arrows, Shift for bigger steps, Home/End, Enter or
  double-click to reset), remembered per browser. Zen mode keeps only the code, the output and Refs.
- **Help:** `?` (or `F1`) opens the getting-started help; a first-visit card offers a 1-minute tour of the
  real controls. Every template has a `README.md` that explains it.

- **Security:** user code never runs on the site's origin. JS, TS and Python run in
  `<iframe sandbox="allow-scripts">` (an opaque origin with no storage, cookies or DOM access) and, inside it, a
  worker that Stop or the time limit (JS 10 s, Python 30 s) kills. The page only accepts messages from its own
  frames carrying the run's token, validates them with Zod and renders output as text. Site pages send
  `frame-ancestors 'self'`, so only the reference panel can frame them. The TypeScript and basedpyright workers
  run on the site's origin but only analyze code; downloaded `.d.ts` files and DevDocs pages are data, never run.
  The HTML preview also allows forms (`allow-forms`), which can only navigate the preview frame itself.
- **Phones:** one pane at a time (`Code`, `Files`, `Output`, `Refs`), a symbol row above the keyboard, 16px text
  and 44px targets; edge double-taps are off on the playground.
- **Rebuilding the GDScript runner:** `brew install --cask godot`, install the single-threaded web export templates
  (`web_nothreads_debug.zip`, `web_nothreads_release.zip`) for the same version, then
  `./scripts/build-godot-runner.sh`. The export (`index.wasm` ≈ 38 MB) is committed.

## Runtime notes

`bun --bun next build` and `bun --bun next start` currently fail with Bun 1.3.10 and Next 16.3.4
(`Expected CommonJS module to have a function wrapper` while loading Next's compiled server runtime).
Those two scripts therefore run Next's binary on Node, launched by Bun. `next dev` works on the Bun runtime.

## Credits

- **Design:** the look (layout, typography, colors and link style) and the base stylesheet in
  `app/globals.css` are reproduced from [williamjansson.com](https://williamjansson.com/) by William
  Jansson. They remain his work; this repository only adapts them (color variables, dark mode, tables,
  code blocks and other additions).
- **Unit circle image:** `public/images/unit_circle.jpg`, source: google images
- **React Hook Flow Diagram:** `public/images/typescript/hook-flow.png`, © 2019 Donavon West,
  from [donavon/hook-flow](https://github.com/donavon/hook-flow), MIT License (full text next to it in
  `hook-flow.LICENSE`).
- **Fitness images** (from Wikimedia Commons, resized; each is also credited under the image in its sheet):
  - `public/images/fitness/energy-systems-mitochondrion.png`: [Animal mitochondrion diagram](https://commons.wikimedia.org/wiki/File:Animal_mitochondrion_diagram_en.svg)
    by Mariana Ruiz Villarreal (LadyofHats), public domain.
  - `public/images/fitness/strength-training-muscles.jpg`: [Anterior and posterior views of muscles](https://commons.wikimedia.org/wiki/File:1105_Anterior_and_Posterior_Views_of_Muscles.jpg)
    by OpenStax, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  - `public/images/fitness/nutrition-hydration-nutrition-facts-label.png`: [Nutrition Facts label (2016)](https://commons.wikimedia.org/wiki/File:FDA_Nutrition_Facts_Label_2016.png)
    by the U.S. Food and Drug Administration, public domain.
  - `public/images/fitness/stretching-recovery-calf-muscles.png`: [Lower leg muscles](https://commons.wikimedia.org/wiki/File:Lower_leg_muscles.svg)
    by InjuryMap, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Godot Engine:** `public/playground/godot/` is a web export of [Godot](https://godotengine.org/) 4.7.2,
  © Godot Engine contributors, MIT License (`GODOT_LICENSE.txt`; third-party notices in `GODOT_COPYRIGHT.txt`).
- **Playground libraries:** [CodeMirror](https://codemirror.net/) (MIT, including `@codemirror/lsp-client`),
  [Sucrase](https://github.com/alangpierce/sucrase) (MIT), [es-module-lexer](https://github.com/guybedford/es-module-lexer)
  (MIT), [micromark](https://github.com/micromark/micromark) (MIT), [DOMPurify](https://github.com/cure53/DOMPurify)
  (MPL-2.0 or Apache-2.0), [TypeScript](https://www.typescriptlang.org/) (Apache-2.0; its `lib.*.d.ts` files are
  in `public/playground/ts-lib/`), `@typescript/vfs` and `@typescript/ata` (MIT),
  [codemirror-ts](https://github.com/val-town/codemirror-ts) (MIT), [Comlink](https://github.com/GoogleChromeLabs/comlink)
  (Apache-2.0), [browser-basedpyright](https://github.com/DetachHead/basedpyright) (MIT) and, loaded at run time,
  [Pyodide](https://pyodide.org/) (MPL-2.0), React, Hono and other npm packages via [esm.sh](https://esm.sh/).
  C++ and Rust run on [Compiler Explorer](https://godbolt.org/), [Wandbox](https://wandbox.org/) and the
  [Rust Playground](https://play.rust-lang.org/).
- **Official docs:** the Docs tab and the hover docs show content from [DevDocs](https://devdocs.io/) (MPL-2.0
  application; content under each source's license): MDN Web Docs (© MDN contributors, CC BY-SA 2.5+),
  cppreference.com (CC BY-SA 3.0), the Python documentation (PSF License), the Rust documentation (MIT/Apache-2.0),
  the Godot documentation (CC BY 3.0), React (CC BY 4.0), TypeScript (Apache-2.0), Bun and Node.js
  (MIT). Each page and hover names its source and license (`public/playground/docs-manifest.json`).
- **Aviation images** (cockpit figures next to the MSFS 2024 procedures; each is also credited under the
  image in its sheet):
  - **Microsoft Flight Simulator content** (`public/images/aviation/longitude/`), from Working Title's *Cessna
    Model 700 Operator's Guide* on flightsimulator.com. Microsoft Flight Simulator © Microsoft Corporation. Zach's
    Docs was created under Microsoft's "Game Content Usage Rules" using assets from Microsoft Flight Simulator, and
    it is not endorsed by or affiliated with Microsoft. See the
    [Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules).
    - `public/images/aviation/longitude/electrical-panel.webp`: ELECTRICAL panel (STBY PWR, generators, BUS TIE, L/R BATT, EXT PWR), Working Title, Cessna Model 700 Operator's Guide fig. 5-3-1, p. 5-4, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/apu-knob.webp`: APU OFF/ON/START knob, Working Title, Cessna Model 700 Operator's Guide fig. 6-2-1, p. 8-2, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/fuel-panel.webp`: FUEL panel (boost pumps, GRAVITY XFLOW, TRANSFER knob), Working Title, Cessna Model 700 Operator's Guide fig. 6-3-1, p. 6-3, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/park-brake-handle.webp`: EMER/PARK BRAKE handle, Working Title, Cessna Model 700 Operator's Guide fig. 14-3-1, p. 14-3, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/throttle-quadrant.webp`: throttle quadrant with ENGINE RUN/STOP and STARTER buttons, Working Title, Cessna Model 700 Operator's Guide fig. 6-3-1, p. 7-3, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/eis-engine-start.webp`: EIS engine start indications with the START PSI box, Working Title, Cessna Model 700 Operator's Guide fig. 6-6-2, p. 7-7, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/ice-protection-panel.webp`: ICE PROTECTION panel (ENGINE, WING, STAB, PITOT/STATIC), Working Title, Cessna Model 700 Operator's Guide fig. 12-3-1, p. 12-3, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/toga-at-buttons.webp`: throttle handle TO/GA, AT DISC and AT arm buttons, Working Title, Cessna Model 700 Operator's Guide fig. 6-4-2, p. 7-4, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/cabin-pressure-page.webp`: GTC Cabin Pressure page with Landing Elevation, Working Title, Cessna Model 700 Operator's Guide fig. 11-4-1, p. 11-4, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/speedbrake-handle.webp`: SPEEDBRAKE handle, Working Title, Cessna Model 700 Operator's Guide fig. 15-4-2, p. 15-4, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/landing-gear-handle.webp`: LANDING GEAR handle, Working Title, Cessna Model 700 Operator's Guide fig. 14-4-1, p. 14-4, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/mfd-gtc.webp`: MFD Garmin touch controller home page, Working Title, Cessna Model 700 Operator's Guide fig. 4-8-1, p. 4-10, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
    - `public/images/aviation/longitude/afcs-status-box.webp`: PFD AFCS status box with callouts, Working Title, Cessna Model 700 Operator's Guide fig. 4-7-1, p. 4-7, Microsoft Flight Simulator © Microsoft Corporation, used under Microsoft's Game Content Usage Rules.
  - **FAA handbooks** (US government works, public domain; drawings are generic, not the exact aircraft):
    - `public/images/aviation/cessna-172/instrument-panel.webp`: generic G1000 Cessna panel with analog counterparts (Garmin wordmark on the MFD bezel removed), FAA Instrument Flying Handbook (FAA-H-8083-15B) fig. 6-21, public domain, via [FAA](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf).
    - `public/images/aviation/cessna-172/fuel-selector.webp`: generic LEFT/BOTH/RIGHT/OFF fuel selector, FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C) fig. 7-31, public domain, via [FAA](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak).
    - `public/images/aviation/cessna-172/stby-batt-master.webp`: STBY BATT switch and split MASTER ALT/BAT rocker, FAA Instrument Flying Handbook (FAA-H-8083-15B) fig. 11-6, public domain, via [FAA](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf).
    - `public/images/aviation/cessna-172/magnetos-key.webp`: ignition key OFF/R/L/BOTH/START (inset), FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C) fig. 7-16, public domain, via [FAA](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak).
    - `public/images/aviation/cessna-172/autopilot-annunciator.webp`: generic PFD autopilot mode strip (active green, armed white), FAA Advanced Avionics Handbook (FAA-H-8083-6) fig. 4-12, public domain, via [govinfo](https://www.govinfo.gov/app/details/GOVPUB-TD4-PURL-gpo46261).
    - `public/images/aviation/cessna-172/autopilot-keys.webp`: generic G1000 bezel autopilot key column, FAA Advanced Avionics Handbook (FAA-H-8083-6) fig. 4-3, public domain, via [govinfo](https://www.govinfo.gov/app/details/GOVPUB-TD4-PURL-gpo46261).
    - `public/images/aviation/cessna-172-classic/six-pack.webp`: generic six-pack with radial-scan arrows, FAA Instrument Flying Handbook (FAA-H-8083-15B) fig. 6-17, public domain, via [FAA](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf).
    - `public/images/aviation/cessna-172-classic/radio-stack.webp`: generic COM/NAV, ADF, GPS and transponder stack, FAA Instrument Flying Handbook (FAA-H-8083-15B) fig. 2-1, public domain, via [FAA](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf).
    - `public/images/aviation/cessna-172-classic/fuel-selector.webp`: generic LEFT/BOTH/RIGHT/OFF fuel selector, FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C) fig. 7-31, public domain, via [FAA](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak).
    - `public/images/aviation/cessna-172-classic/master-and-ignition.webp`: split ALT/BAT master switch and ignition switch from a starting-circuit drawing, FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C) fig. 7-20, public domain, via [FAA](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak).
    - `public/images/aviation/cessna-172-classic/vacuum-ammeter.webp`: combined vacuum gauge and ammeter, FAA Instrument Flying Handbook (FAA-H-8083-15B) fig. 11-4, public domain, via [FAA](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf).
    - `public/images/aviation/cessna-172-classic/master-switch.webp`: split MASTER ALT/BAT rocker, FAA Instrument Flying Handbook (FAA-H-8083-15B) fig. 11-5, public domain, via [FAA](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf).
  - **Cirrus Aircraft manuals** (© Cirrus Aircraft, all rights reserved; tight crops reproduced for reference
    from the SR22 Perspective+ POH/AFM and the Vision SF50 AFM and Pilot's Information Manual; they live in their
    own folders so they can be removed on request):
    - `public/images/aviation/cirrus-sr22/instrument-panel.webp`: SR22 instrument panel and console overview, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-4, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/walk-around.webp`: recommended preflight walk-around sequence, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 4-1, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/switch-panel.webp`: bolster switch panel (BAT, ALT, AVIONICS masters and exterior lights), Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-12, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/engine-controls.webp`: console engine controls (power lever, mixture, friction, fuel pump switch, fuel selector), Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-7, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/pfd.webp`: PFD flight instruments layout, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-5, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/flap-switch.webp`: flap control and position lights at the bottom of the center stack, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-4, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/engine-instruments.webp`: MFD engine instruments (percent power, RPM, MAP, oil, CHT, EGT), Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-7, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/fuel-flow.webp`: MFD fuel-flow gauge, fuel quantity and fuel calculations, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-9, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/fms-keyboard.webp`: Perspective+ FMS keyboard, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-18, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/cirrus-sr22/caps-handle.webp`: CAPS activation handle cover in the cabin ceiling, Cirrus Aircraft SR22 Perspective+ POH/AFM (P/N 13772-006) fig. 7-4, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/instrument-panel.webp`: SF50 instrument panel and ceiling overview with numbered callouts, Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 3-2 (1 of 2), © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/center-console.webp`: center console (AFCS mode controller, thrust lever, fuel selector, pitch trim wheel, friction lock, flap selector), Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 3-2 (2 of 2), © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/fuel-selector.webp`: FUEL CONTROL selector placard (LEFT, AUTO, RIGHT), Cirrus Aircraft, Vision SF50 AFM (P/N 31452-001) fig. 2-19, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/switch-panel.webp`: bolster switch panel (BAT, GEN, lights, oxygen, bleed, probe heat, ice protection), Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 3-1, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/engine-start-controls.webp`: ENGINE START/STOP button and ENGINE knob (OFF, RUN), Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 9-3, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/flap-selector.webp`: flap selector switch (UP, 50%, 100%) with its speed placard, Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 5-2, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/pitch-trim.webp`: manual pitch trim wheel direction placard, Cirrus Aircraft, Vision SF50 AFM (P/N 31452-001) fig. 2-17, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/thrust-lever.webp`: thrust lever positions (TO, MCT, IDLE), Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 9-2, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/gear-handle.webp`: center instrument panel with the landing gear handle and Vlo/Vo placards, Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 3-3, © Cirrus Aircraft, all rights reserved, reproduced for reference.
    - `public/images/aviation/vision-jet/emergency-panel.webp`: overhead emergency panel with engine fire controls, cabin pressure dump, EMER BATT, ELT and CAPS placard, Cirrus Aircraft, Vision SF50 Pilot's Information Manual (P/N 31453-001) fig. 9-4, © Cirrus Aircraft, all rights reserved, reproduced for reference.
- **Videos:** embedded YouTube videos belong to their channels, which are named in each caption.
- **Reference material:** the sheets are original summaries. Sources are linked in each sheet's
  "References" section, with MDN as the primary source for web-platform topics.

## License

The code is released under the [MIT License](LICENSE). The cheatsheet content in `content/` and the images
in `public/images/` are not covered by it: all rights reserved, except for the third-party material listed
under [Credits](#credits), which stays under its owners' terms. See [LICENSE](LICENSE) for details.
