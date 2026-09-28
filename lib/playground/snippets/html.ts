/** @file HTML outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Page boilerplate",
    file: "index.html",
    keywords: "hello world doctype head body meta viewport charset boilerplate starter template",
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Title</title>
    <link rel="stylesheet" href="css/style.css">
    <script type="module" src="js/main.js"></script>
  </head>
  <body>
    <!-- ... -->
  </body>
</html>
`,
  },
  {
    id: "layout",
    title: "Semantic layout",
    keywords: "semantic header nav main article section aside footer landmark layout",
    code: `<header>
  <nav aria-label="Main">
    <!-- links -->
  </nav>
</header>

<main>
  <article>
    <h1><!-- title --></h1>
    <section>
      <!-- ... -->
    </section>
  </article>

  <aside>
    <!-- related content -->
  </aside>
</main>

<footer>
  <!-- ... -->
</footer>
`,
  },
  {
    id: "list",
    title: "Lists & links",
    keywords: "list ul ol li link anchor nav",
    code: `<ul>
  <li><a href="#">Link</a></li>
  <li><a href="#">Link</a></li>
</ul>

<ol>
  <li><!-- step --></li>
  <li><!-- step --></li>
</ol>
`,
  },
  {
    id: "form",
    title: "Form",
    keywords: "form input label select textarea button checkbox required validation",
    code: `<form>
  <label>
    Label
    <input name="field" required>
  </label>

  <label>
    Choice
    <select name="choice">
      <option value="a">A</option>
      <option value="b">B</option>
    </select>
  </label>

  <button type="submit">Submit</button>
</form>
`,
  },
  {
    id: "table",
    title: "Table",
    keywords: "table thead tbody tr th td caption",
    code: `<table>
  <caption><!-- what the table shows --></caption>
  <thead>
    <tr>
      <th scope="col">Column</th>
      <th scope="col">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><!-- ... --></td>
      <td><!-- ... --></td>
    </tr>
  </tbody>
</table>
`,
  },
  {
    id: "media",
    title: "Image & figure",
    keywords: "img image alt figure figcaption picture video media",
    code: `<figure>
  <img src="path/to/image.jpg" alt="Describe the image" width="400" height="300">
  <figcaption><!-- caption --></figcaption>
</figure>
`,
  },
  {
    id: "interactive",
    title: "Details & dialog",
    keywords: "details summary dialog modal disclosure accordion",
    code: `<details>
  <summary>Summary</summary>
  <!-- hidden until opened -->
</details>

<dialog id="dialog-id">
  <form method="dialog">
    <!-- ... -->
    <button>Close</button>
  </form>
</dialog>
`,
  },
];
