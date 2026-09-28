/** @file Markdown outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "README outline",
    file: "README.md",
    keywords: "hello world readme headings title document boilerplate starter",
    code: `# Project name

<!-- one or two sentences: what it is -->

## Getting started

## Usage

## License
`,
  },
  {
    id: "text",
    title: "Links & images",
    keywords: "link image url bold italic code",
    code: `[link text](https://example.com)

![alt text](path/to/image.png)
`,
  },
  {
    id: "lists",
    title: "Lists & task list",
    keywords: "list bullet numbered nested task checkbox todo",
    code: `- item
  - nested item

1. step
2. step

- [ ] task
- [x] done
`,
  },
  {
    id: "code",
    title: "Code block",
    keywords: "code block fence fenced syntax highlighting",
    code: `\`\`\`language
code
\`\`\`
`,
  },
  {
    id: "table",
    title: "Table",
    keywords: "table columns rows alignment",
    code: `| Column | Column |
| ------ | -----: |
| cell   |   cell |
`,
  },
  {
    id: "quotes",
    title: "Quote & footnote",
    keywords: "blockquote quote footnote",
    code: `> quote

text[^1]

[^1]: footnote
`,
  },
];
