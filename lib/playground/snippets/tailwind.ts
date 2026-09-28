/**
 * @file Tailwind CSS snippets (see `./index.ts`), for Tailwind 4's browser build.
 *
 * The browser build (the Setup snippet's script tag) compiles the classes it
 * finds in the page, including ones scripts and React add later, and reads
 * `<style type="text/tailwindcss">` blocks for `@theme`, `@utility` and
 * `@custom-variant`. Use Tailwind 4 names: `shadow-sm`, `ring-3`, `bg-black/50`.
 */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Setup",
    note: "A whole page with Tailwind's browser build. In a React project, add just the script tag to index.html.",
    file: "index.html",
    keywords: "hello world setup install cdn script browser boilerplate starter page",
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hello, Tailwind</title>
    <!-- Compiles the classes on this page as it runs. Fine for prototypes; real sites build
         their CSS ahead of time with the Tailwind CLI or the Vite plugin. -->
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  </head>
  <body class="bg-gray-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
    <main class="mx-auto max-w-2xl p-8">
      <h1 class="text-3xl font-bold tracking-tight text-blue-600">Hello, world!</h1>
      <p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
        Utility classes style everything: no stylesheet needed.
      </p>
    </main>
  </body>
</html>
`,
  },
  {
    id: "layout",
    title: "Layout: flex & grid",
    note: "A centered page column, a nav bar, a card grid and a sidebar layout.",
    keywords: "layout flex grid container center mx-auto gap justify items columns navbar sidebar",
    code: `<!-- A centered column with side padding -->
<div class="mx-auto max-w-5xl px-4">

  <!-- Nav bar: logo left, links right -->
  <nav class="flex items-center justify-between border-b border-gray-200 py-4">
    <a href="#" class="text-lg font-semibold">Brand</a>
    <ul class="flex gap-6 text-sm">
      <li><a href="#" class="hover:text-blue-600">Docs</a></li>
      <li><a href="#" class="hover:text-blue-600">Blog</a></li>
    </ul>
  </nav>

  <!-- Center anything, both ways -->
  <div class="flex h-32 items-center justify-center rounded-lg bg-gray-100">Centered</div>

  <!-- Cards: 1 column, 2 from sm, 3 from lg -->
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div class="rounded-lg bg-white p-4 shadow-sm">One</div>
    <div class="rounded-lg bg-white p-4 shadow-sm">Two</div>
    <div class="rounded-lg bg-white p-4 shadow-sm">Three</div>
  </div>

  <!-- Sidebar + content: the sidebar keeps its width, the content takes the rest -->
  <div class="mt-6 flex gap-4">
    <aside class="w-48 shrink-0 rounded-lg bg-gray-100 p-4">Sidebar</aside>
    <section class="min-w-0 flex-1 rounded-lg bg-gray-100 p-4">Content</section>
  </div>
</div>
`,
  },
  {
    id: "responsive",
    title: "Responsive design",
    note: "Mobile first: unprefixed classes apply everywhere, sm: md: lg: from that width up.",
    keywords: "responsive breakpoint mobile sm md lg xl container query @container hidden",
    code: `<!-- Stacked on phones, side by side from md (48rem) -->
<div class="flex flex-col gap-4 p-4 md:flex-row">
  <img
    src="https://picsum.photos/400/300"
    alt="A random landscape"
    class="w-full rounded-lg object-cover md:w-48"
  >
  <div>
    <h2 class="text-xl font-bold md:text-2xl lg:text-3xl">Grows with the screen</h2>
    <p class="text-sm md:text-base">Smaller text on phones, larger from md.</p>
    <p class="hidden text-gray-500 lg:block">Only shown from lg (64rem) up.</p>
  </div>
</div>

<!-- Container queries: react to the parent's width instead of the window's -->
<div class="@container max-w-xl resize-x overflow-auto rounded-lg border border-gray-300 p-4">
  <div class="grid grid-cols-1 gap-2 @md:grid-cols-2">
    <div class="rounded bg-blue-100 p-2">Drag the corner</div>
    <div class="rounded bg-blue-100 p-2">to resize me</div>
  </div>
</div>
`,
  },
  {
    id: "states",
    title: "Hover, focus & other states",
    note: "Variants style an element's states, its parent's (group) or a sibling's (peer).",
    keywords:
      "hover focus focus-visible active disabled group peer invalid variant state transition",
    code: `<!-- Hover, active, keyboard focus and disabled -->
<button
  class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors
         hover:bg-blue-700 active:scale-95
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
         disabled:cursor-not-allowed disabled:opacity-50"
>
  Save
</button>
<button class="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled>
  Disabled
</button>

<!-- group: style children when the parent is hovered -->
<a href="#" class="group mt-4 block rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
  <span class="font-semibold group-hover:text-blue-600">Read more</span>
  <span class="inline-block transition-transform group-hover:translate-x-1">→</span>
</a>

<!-- peer: style a sibling from the input's state -->
<label class="mt-4 block">
  <span class="text-sm">Email</span>
  <input type="email" required placeholder="you@example.com"
         class="peer mt-1 block w-full rounded border border-gray-300 px-3 py-2">
  <span class="invisible text-sm text-red-600 peer-user-invalid:visible">
    Please enter a valid email.
  </span>
</label>
`,
  },
  {
    id: "dark",
    title: "Dark mode",
    note: "dark: follows the system setting; one line switches it to a class you toggle.",
    keywords: "dark mode theme toggle prefers-color-scheme custom-variant class",
    code: `<!-- Without this block, dark: follows the system's light/dark setting.
     With it, dark: applies inside an element with class="dark". -->
<style type="text/tailwindcss">
  @custom-variant dark (&:where(.dark, .dark *));
</style>

<div class="min-h-40 rounded-xl bg-white p-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
  <h2 class="text-xl font-bold">Light or dark</h2>
  <p class="text-gray-600 dark:text-gray-400">Every color gets a dark: partner.</p>
  <button
    class="mt-4 rounded-lg border border-gray-300 px-3 py-1 dark:border-gray-700"
    onclick="document.documentElement.classList.toggle('dark')"
  >
    Toggle dark mode
  </button>
</div>
`,
  },
  {
    id: "card",
    title: "Card",
    note: "An image, a badge, text and actions: a common component built from utilities.",
    keywords: "card component image badge shadow rounded overflow line-clamp",
    code: `<article class="max-w-sm overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5">
  <img src="https://picsum.photos/600/300" alt="A random landscape" class="h-40 w-full object-cover">
  <div class="space-y-3 p-5">
    <span class="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      New
    </span>
    <h3 class="text-lg font-semibold text-gray-900">Card title</h3>
    <p class="line-clamp-2 text-sm text-gray-600">
      A short description that is cut off after two lines, however long it gets, so every card
      in a grid stays the same height and the layout doesn't jump around.
    </p>
    <div class="flex items-center justify-between pt-2">
      <span class="text-lg font-bold">$24</span>
      <button class="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700">
        Add to cart
      </button>
    </div>
  </div>
</article>
`,
  },
  {
    id: "buttons",
    title: "Buttons",
    note: "Primary, secondary, outline and ghost styles, in three sizes, plus an icon button.",
    keywords: "button variants primary secondary outline ghost size icon rounded",
    code: `<div class="flex flex-wrap items-center gap-3">
  <button class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Primary</button>
  <button class="rounded-lg bg-gray-100 px-4 py-2 text-gray-900 hover:bg-gray-200">Secondary</button>
  <button class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50">
    Outline
  </button>
  <button class="rounded-lg px-4 py-2 text-blue-600 hover:bg-blue-50">Ghost</button>
  <button class="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">Delete</button>
</div>

<div class="mt-4 flex flex-wrap items-center gap-3">
  <button class="rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white">Small</button>
  <button class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Medium</button>
  <button class="rounded-xl bg-blue-600 px-6 py-3 text-lg text-white">Large</button>
  <button class="rounded-full bg-blue-600 px-6 py-2 text-white shadow-lg shadow-blue-600/30">Pill</button>
  <button aria-label="Add" class="grid size-10 place-items-center rounded-full bg-blue-600 text-xl text-white">
    +
  </button>
</div>
`,
  },
  {
    id: "form",
    title: "Form",
    note: "Inputs with focus rings, a select, a checkbox, and errors shown only after the reader types.",
    keywords: "form input label select textarea checkbox focus ring invalid user-invalid accent",
    code: `<form class="max-w-md space-y-4 rounded-xl bg-white p-6 shadow-sm">
  <label class="block">
    <span class="text-sm font-medium text-gray-700">Name</span>
    <input
      name="name" required minlength="2"
      class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm
             focus:border-blue-500 focus:ring-3 focus:ring-blue-500/30 focus:outline-none
             user-invalid:border-red-500"
    >
  </label>

  <label class="block">
    <span class="text-sm font-medium text-gray-700">Plan</span>
    <select class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2">
      <option>Free</option>
      <option>Pro</option>
    </select>
  </label>

  <label class="block">
    <span class="text-sm font-medium text-gray-700">Message</span>
    <textarea rows="3" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"></textarea>
  </label>

  <label class="flex items-center gap-2 text-sm">
    <input type="checkbox" class="size-4 accent-blue-600"> Send me updates
  </label>

  <button class="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700">
    Submit
  </button>
</form>
`,
  },
  {
    id: "theme",
    title: "Theme, custom utilities & arbitrary values",
    note: "@theme adds colors and fonts as utilities; @utility and @apply make your own; [ ] for one-offs.",
    keywords:
      "theme @theme custom colors font variables @utility @apply @layer components arbitrary values config",
    code: `<style type="text/tailwindcss">
  /* Each variable becomes utilities: --color-brand-500 gives bg-brand-500, text-brand-500, ... */
  @theme {
    --color-brand-50: oklch(0.97 0.02 250);
    --color-brand-500: oklch(0.6 0.2 250);
    --color-brand-700: oklch(0.45 0.18 250);
    --font-display: Georgia, "Times New Roman", serif;
  }

  /* A utility of your own (works with variants: hover:text-shadow-soft) */
  @utility text-shadow-soft {
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  }

  /* A component class made of utilities */
  @layer components {
    .btn-brand {
      @apply rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-700;
    }
  }
</style>

<h1 class="font-display text-4xl text-brand-700 text-shadow-soft">Custom theme</h1>
<p class="mt-2 rounded-lg bg-brand-50 p-4">Theme colors and fonts work like the built-in ones.</p>
<button class="btn-brand mt-4">Brand button</button>

<!-- Arbitrary values in [ ] (underscores are spaces), CSS variables in ( ) -->
<div class="mt-4 grid w-[32rem] max-w-full grid-cols-[120px_1fr] gap-2">
  <span class="bg-[#bada55] p-2">120px</span>
  <span class="bg-(--color-brand-50) p-2">the rest</span>
</div>
`,
  },
  {
    id: "react",
    title: "In React",
    note: "className instead of class; keep whole class names in the code so real builds find them.",
    file: "src/App.tsx",
    mode: "tsx",
    keywords: "react jsx tsx classname component variants conditional classes state",
    code: `// index.html needs the Tailwind script tag (see Setup); it styles the classes React renders.
import { useState, type ComponentProps } from "react";

// Map a prop to whole class names: build tools only find classes written out in full
const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
} as const;

type ButtonProps = ComponentProps<"button"> & { variant?: keyof typeof variants };

function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={\`rounded-lg px-4 py-2 font-medium transition-colors \${variants[variant]} \${className}\`}
      {...props}
    />
  );
}

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Tailwind in React</h1>
      <div className="flex gap-2">
        <Button onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"} details</Button>
        <Button variant="secondary">Cancel</Button>
      </div>
      <p
        className={
          open
            ? "rounded-lg border border-gray-200 p-4 opacity-100 transition-opacity"
            : "rounded-lg border border-gray-200 p-4 opacity-0 transition-opacity"
        }
      >
        Switch between whole class strings with state.
      </p>
    </main>
  );
}
`,
  },
];
