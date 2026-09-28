/** @file HTML snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Page boilerplate",
    note: "A complete HTML5 page: the hello world of the web.",
    file: "index.html",
    keywords: "hello world doctype head body meta viewport charset boilerplate starter template",
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hello, world</title>
    <link rel="stylesheet" href="css/style.css">
    <script type="module" src="js/main.js"></script>
  </head>
  <body>
    <main>
      <h1>Hello, world!</h1>
      <p>Edit this page and the preview updates as you type.</p>
    </main>
  </body>
</html>
`,
  },
  {
    id: "layout",
    title: "Semantic layout",
    note: "header, nav, main, article, aside and footer instead of a pile of divs.",
    keywords: "semantic header nav main article section aside footer landmark layout accessibility",
    code: `<header>
  <a href="#">Site name</a>
  <nav aria-label="Main">
    <ul>
      <li><a href="#" aria-current="page">Home</a></li>
      <li><a href="#">Blog</a></li>
      <li><a href="#">About</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Article title</h1>
    <p><time datetime="2026-09-28">September 28, 2026</time></p>
    <section>
      <h2>A section</h2>
      <p>Paragraphs, <strong>strong importance</strong>, <em>emphasis</em> and <code>code</code>.</p>
    </section>
  </article>

  <aside>
    <h2>Related</h2>
    <p>Content beside the main flow.</p>
  </aside>
</main>

<footer>
  <p>&copy; 2026 Your name</p>
</footer>
`,
  },
  {
    id: "form",
    title: "Form",
    note: "Labeled inputs with built-in validation; the browser checks them before submitting.",
    keywords: "form input label select textarea button checkbox radio required validation fieldset",
    code: `<form id="signup">
  <label>
    Name
    <input name="name" required minlength="2" autocomplete="name">
  </label>

  <label>
    Email
    <input name="email" type="email" required autocomplete="email">
  </label>

  <label>
    Plan
    <select name="plan">
      <option value="free">Free</option>
      <option value="pro" selected>Pro</option>
    </select>
  </label>

  <fieldset>
    <legend>Contact me by</legend>
    <label><input type="radio" name="contact" value="email" checked> Email</label>
    <label><input type="radio" name="contact" value="phone"> Phone</label>
  </fieldset>

  <label>
    Message
    <textarea name="message" rows="3"></textarea>
  </label>

  <label><input type="checkbox" name="terms" required> I agree to the terms</label>

  <button type="submit">Sign up</button>
</form>
`,
  },
  {
    id: "table",
    title: "Table",
    note: "A data table with a caption, header cells and a footer row.",
    keywords: "table thead tbody tfoot tr th td caption scope data",
    code: `<table>
  <caption>Quarterly sales</caption>
  <thead>
    <tr>
      <th scope="col">Quarter</th>
      <th scope="col">Units</th>
      <th scope="col">Revenue</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Q1</th>
      <td>120</td>
      <td>$2,400</td>
    </tr>
    <tr>
      <th scope="row">Q2</th>
      <td>180</td>
      <td>$3,600</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <th scope="row">Total</th>
      <td>300</td>
      <td>$6,000</td>
    </tr>
  </tfoot>
</table>
`,
  },
  {
    id: "media",
    title: "Images & media",
    note: "Images with alt text and captions, responsive sources, video.",
    keywords: "img image alt figure figcaption picture source srcset video audio svg media",
    code: `<!-- alt describes the image; use alt="" for purely decorative ones -->
<img src="https://picsum.photos/400/200" alt="A random landscape" width="400" height="200">

<figure>
  <img src="https://picsum.photos/300/150" alt="Another landscape" width="300" height="150">
  <figcaption>A figure with a caption.</figcaption>
</figure>

<!-- The browser picks the first source that matches -->
<picture>
  <source media="(min-width: 800px)" srcset="https://picsum.photos/800/300">
  <img src="https://picsum.photos/400/300" alt="A responsive image" width="400" height="300">
</picture>

<video controls width="400" preload="metadata">
  <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm" type="video/webm">
  Your browser doesn't play this video.
</video>

<!-- Inline SVG -->
<svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label="A circle">
  <circle cx="40" cy="40" r="30" fill="tomato" />
</svg>
`,
  },
  {
    id: "interactive",
    title: "Details & dialog",
    note: "Disclosure and modal dialogs that work with little or no JavaScript.",
    keywords: "details summary dialog modal popover accordion disclosure interactive",
    code: `<details>
  <summary>Click to expand</summary>
  <p>Hidden until opened. No JavaScript needed.</p>
</details>

<!-- A popover: the button toggles it, no JavaScript -->
<button popovertarget="tip">Show tip</button>
<div id="tip" popover>Press Esc or click outside to close me.</div>

<!-- A modal dialog: showModal() opens it, a form with method="dialog" closes it -->
<button onclick="document.getElementById('confirm').showModal()">Delete…</button>
<dialog id="confirm">
  <form method="dialog">
    <p>Delete this item?</p>
    <button value="cancel">Cancel</button>
    <button value="ok">Delete</button>
  </form>
</dialog>
`,
  },
];
