/** @file Browser (DOM) outlines (see `./index.ts`). Valid JavaScript and TypeScript. */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Select & change an element",
    keywords: "hello queryselector textcontent classlist style attribute element",
    code: `const element = document.querySelector(".selector");
if (element) {
  element.textContent = "text";
  element.classList.add("class-name");
}
`,
  },
  {
    id: "events",
    title: "Event listener",
    keywords: "event addeventlistener click input keydown listener handler",
    code: `document.querySelector("button")?.addEventListener("click", (event) => {
  // ...
});
`,
  },
  {
    id: "delegation",
    title: "Event delegation",
    note: "One listener on the parent handles every child, even ones added later.",
    keywords: "event delegation closest target parent children",
    code: `document.querySelector(".parent")?.addEventListener("click", (event) => {
  const item = event.target instanceof Element ? event.target.closest(".child") : null;
  if (!item) return;
  // ...
});
`,
  },
  {
    id: "create",
    title: "Create an element",
    keywords: "createelement append element render textcontent",
    code: `const element = document.createElement("div");
element.textContent = "text";
document.body.append(element);
`,
  },
  {
    id: "form",
    title: "Form submit",
    keywords: "form submit preventdefault formdata",
    code: `const form = document.querySelector("form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  // data.get("field-name")
});
`,
  },
  {
    id: "fetch",
    title: "Fetch JSON",
    keywords: "fetch http request api json async await response error",
    code: `try {
  const response = await fetch("https://example.com/api");
  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
  const data = await response.json();
  // ...
} catch (error) {
  // network failure or bad status
}
`,
  },
  {
    id: "timers",
    title: "Timers & animation frame",
    keywords: "settimeout setinterval requestanimationframe timer animation",
    code: `const timeout = setTimeout(() => {
  // once, after 1 second
}, 1000);

const interval = setInterval(() => {
  // every second (clearInterval(interval) stops it)
}, 1000);

function frame() {
  // before each repaint
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
`,
  },
];
