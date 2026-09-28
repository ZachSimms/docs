/** @file Browser (DOM) snippets (see `./index.ts`). Each builds the elements it uses, so it runs on any page. */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello, DOM",
    note: "Find elements, change their text, classes and styles.",
    keywords: "hello world queryselector textcontent classlist style attribute element",
    code: `const heading = document.createElement("h1");
heading.textContent = "Hello, world!";
document.body.append(heading);

// Find elements with CSS selectors
const first = document.querySelector("h1"); // the first match, or null
const all = document.querySelectorAll("h1"); // every match
console.log(first?.textContent, all.length);

// Classes, styles and attributes
heading.classList.add("big");
heading.classList.toggle("highlight");
heading.style.color = "tomato";
heading.setAttribute("title", "I'm a heading");
heading.dataset.count = "1"; // data-count="1"
console.log(heading.outerHTML);
`,
  },
  {
    id: "events",
    title: "Events",
    note: "Click and input listeners, keyboard shortcuts, event delegation.",
    keywords: "event addeventlistener click input keydown delegation target listener handler",
    code: `const button = document.createElement("button");
button.textContent = "Clicked 0 times";
const input = document.createElement("input");
input.placeholder = "Type here";
const echo = document.createElement("p");
const list = document.createElement("ul");
list.innerHTML = "<li>one</li><li>two</li><li>three</li>";
document.body.append(button, input, echo, list);

let clicks = 0;
button.addEventListener("click", () => {
  clicks += 1;
  button.textContent = \`Clicked \${clicks} times\`;
});

input.addEventListener("input", () => {
  echo.textContent = input.value;
});

// Keyboard shortcuts
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") input.value = "";
});

// Delegation: one listener on the parent handles every child, even ones added later
list.addEventListener("click", (event) => {
  const item = event.target instanceof Element ? event.target.closest("li") : null;
  if (item) console.log("clicked", item.textContent);
});
`,
  },
  {
    id: "create",
    title: "Create elements from data",
    note: "Build a list from an array, safely (textContent never runs HTML).",
    keywords:
      "createelement append render list template innerhtml textcontent remove replacechildren",
    code: `const todos = [
  { title: "Learn the DOM", done: true },
  { title: "Build something", done: false },
];

const list = document.createElement("ul");
document.body.append(list);

function render() {
  const items = todos.map((todo, index) => {
    const li = document.createElement("li");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = todo.done;
    box.addEventListener("change", () => {
      todos[index].done = box.checked;
      render();
    });
    const label = document.createElement("span");
    label.textContent = \` \${todo.title}\`; // textContent: safe for any string
    if (todo.done) label.style.textDecoration = "line-through";
    li.append(box, label);
    return li;
  });
  list.replaceChildren(...items); // swap in the new items
}

render();
`,
  },
  {
    id: "form",
    title: "Handle a form",
    note: "Stop the page reload, read the fields with FormData.",
    keywords: "form submit preventdefault formdata input validation",
    code: `const form = document.createElement("form");
form.innerHTML = \`
  <label>Name <input name="name" required></label>
  <label>Age <input name="age" type="number" min="0"></label>
  <button>Save</button>
\`;
const result = document.createElement("pre");
document.body.append(form, result);

form.addEventListener("submit", (event) => {
  event.preventDefault(); // stay on the page
  const data = new FormData(form);
  const person = {
    name: String(data.get("name")),
    age: Number(data.get("age")),
  };
  result.textContent = JSON.stringify(person, null, 2);
  form.reset();
});
`,
  },
  {
    id: "fetch",
    title: "Fetch JSON",
    note: "Load data over HTTP with async/await and handle failures.",
    keywords: "fetch http request api json async await response error network",
    code: `const status = document.createElement("p");
document.body.append(status);

async function loadTodo(id = 1) {
  const response = await fetch(\`https://jsonplaceholder.typicode.com/todos/\${id}\`);
  if (!response.ok) throw new Error(\`HTTP \${response.status}\`); // fetch only rejects on network errors
  return response.json();
}

status.textContent = "Loading…";
try {
  const todo = await loadTodo(1);
  status.textContent = \`Loaded: \${todo.title}\`;
} catch (error) {
  status.textContent = \`Failed: \${error instanceof Error ? error.message : error}\`;
}
`,
  },
  {
    id: "timers",
    title: "Timers & animation frames",
    note: "setTimeout, setInterval, and requestAnimationFrame for smooth animation.",
    keywords: "settimeout setinterval requestanimationframe animation timer clock loop",
    code: `const clock = document.createElement("p");
const box = document.createElement("div");
box.style.cssText = "width:40px;height:40px;background:tomato;position:relative";
document.body.append(clock, box);

// Once, after a delay
setTimeout(() => console.log("one second later"), 1000);

// Repeatedly (clearInterval stops it)
const tick = () => (clock.textContent = new Date().toLocaleTimeString());
tick();
const timer = setInterval(tick, 1000);
setTimeout(() => clearInterval(timer), 10_000);

// Animation: runs before each repaint, about 60 times a second
function frame() {
  const time = performance.now();
  box.style.left = \`\${100 + Math.sin(time / 300) * 100}px\`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
`,
  },
];
