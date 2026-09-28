/** @file Markdown snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Document skeleton",
    note: "A title, an intro, sections: the hello world of a README.",
    file: "README.md",
    keywords: "hello world readme headings title document boilerplate starter",
    code: `# Project name

One or two sentences on what this is and who it's for.

## Getting started

1. Install it.
2. Run it.

## Usage

Explain the common case first, then the rest.

## License

MIT
`,
  },
  {
    id: "text",
    title: "Text, links & images",
    note: "Emphasis, inline code, links, images, line breaks, rules.",
    keywords: "bold italic strikethrough code link image url autolink line break horizontal rule",
    code: `Text can be **bold**, *italic*, ***both***, ~~struck through~~ or \`inline code\`.

A [link](https://example.com "optional title"), an autolink https://example.com,
and a [reference link][docs].

[docs]: https://developer.mozilla.org/

![Alt text for the image](https://picsum.photos/200/100)

End a line with two spaces
to break it without a new paragraph.

---

A backslash shows a character literally: \\*not italic\\*.
`,
  },
  {
    id: "lists",
    title: "Lists & task lists",
    note: "Bulleted, numbered, nested, and GitHub-style checkboxes.",
    keywords: "list bullet numbered ordered unordered nested task checkbox todo",
    code: `- A bullet
- Another
  - Nested (indent two spaces)
  - Again

1. First
2. Second
3. Third

- [x] A finished task
- [ ] An open task
`,
  },
  {
    id: "code",
    title: "Code blocks",
    note: "Fenced code with a language for highlighting.",
    keywords: "code block fence fenced syntax highlighting backticks",
    code: `Inline: run \`npm install\`.

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"Hello, {name}!"
\`\`\`
`,
  },
  {
    id: "table",
    title: "Tables",
    note: "Pipes and dashes; colons set the alignment.",
    keywords: "table columns rows alignment pipe gfm",
    code: `| Left      | Center | Right |
| :-------- | :----: | ----: |
| apples    |   3    | $1.20 |
| pears     |   12   | $4.80 |
`,
  },
  {
    id: "quotes",
    title: "Quotes & footnotes",
    note: "Blockquotes (nested too) and GitHub-style footnotes.",
    keywords: "blockquote quote footnote note citation",
    code: `> A blockquote.
>
> > Nested inside it.

Here is a claim that needs a source.[^1]

[^1]: The footnote text appears at the end of the document.
`,
  },
];
