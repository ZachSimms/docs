/**
 * @file Tailwind CSS outlines (see `./index.ts`), for Tailwind 4's browser build.
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
    note: "A page with Tailwind's browser build. In a React project, add just the script tag to index.html.",
    file: "index.html",
    keywords: "hello world setup install cdn script browser boilerplate starter page",
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Title</title>
    <!-- Compiles the page's classes as it runs: fine for prototypes. Real sites build their
         CSS ahead of time with the Tailwind CLI or the Vite plugin. -->
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  </head>
  <body class="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <main class="mx-auto max-w-3xl p-6">
      <!-- ... -->
    </main>
  </body>
</html>
`,
  },
  {
    id: "flex",
    title: "Flex row",
    keywords: "flex row center items justify between gap navbar layout",
    code: `<div class="flex items-center justify-between gap-4">
  <!-- items -->
</div>
`,
  },
  {
    id: "grid",
    title: "Responsive grid",
    note: "1 column, 2 from sm, 3 from lg.",
    keywords: "grid columns responsive cards layout gap",
    code: `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <!-- items -->
</div>
`,
  },
  {
    id: "responsive",
    title: "Breakpoints & container queries",
    note: "Mobile first: unprefixed classes apply everywhere, md: from that width up.",
    keywords: "responsive breakpoint mobile sm md lg container query @container hidden",
    code: `<div class="flex flex-col gap-4 md:flex-row">
  <!-- stacked on phones, side by side from md -->
</div>

<div class="@container">
  <div class="grid grid-cols-1 @md:grid-cols-2">
    <!-- follows the parent's width, not the window's -->
  </div>
</div>
`,
  },
  {
    id: "states",
    title: "Hover, focus & disabled",
    keywords: "hover focus focus-visible active disabled group peer variant state",
    code: `<button
  class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
         disabled:opacity-50"
>
  Label
</button>

<!-- group: style children when the parent is hovered -->
<a href="#" class="group">
  <span class="group-hover:underline"><!-- ... --></span>
</a>
`,
  },
  {
    id: "dark",
    title: "Dark mode toggle",
    note: "Without the style block, dark: follows the system setting.",
    keywords: "dark mode theme toggle custom-variant class",
    code: `<style type="text/tailwindcss">
  @custom-variant dark (&:where(.dark, .dark *));
</style>

<button onclick="document.documentElement.classList.toggle('dark')">Toggle dark mode</button>

<div class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
  <!-- ... -->
</div>
`,
  },
  {
    id: "card",
    title: "Card",
    keywords: "card component image shadow rounded",
    code: `<article class="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5">
  <img src="path/to/image.jpg" alt="Describe the image" class="h-40 w-full object-cover">
  <div class="space-y-2 p-5">
    <h3 class="text-lg font-semibold"><!-- title --></h3>
    <p class="text-sm text-gray-600"><!-- text --></p>
  </div>
</article>
`,
  },
  {
    id: "button",
    title: "Button",
    keywords: "button primary secondary outline variant",
    code: `<button class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
  Label
</button>
`,
  },
  {
    id: "form",
    title: "Form field",
    keywords: "form input label focus ring invalid user-invalid",
    code: `<label class="block">
  <span class="text-sm font-medium text-gray-700">Label</span>
  <input
    name="field"
    class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2
           focus:border-blue-500 focus:ring-3 focus:ring-blue-500/30 focus:outline-none
           user-invalid:border-red-500"
  >
</label>
`,
  },
  {
    id: "theme",
    title: "Theme & custom utility",
    note: "@theme variables become utilities: --color-brand gives bg-brand, text-brand, ...",
    keywords: "theme @theme custom colors font variables @utility @apply @layer components",
    code: `<style type="text/tailwindcss">
  @theme {
    --color-brand: oklch(0.6 0.2 250);
    --font-display: Georgia, serif;
  }

  /* A utility of your own (an empty one is an error): */
  @utility content-auto {
    content-visibility: auto;
  }

  @layer components {
    .component-name {
      @apply rounded-lg bg-brand px-4 py-2 text-white;
    }
  }
</style>
`,
  },
  {
    id: "react",
    title: "In React",
    note: "className instead of class; keep whole class names so real builds find them.",
    file: "src/App.tsx",
    mode: "tsx",
    keywords: "react jsx tsx classname component variants conditional",
    code: `const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
} as const;

export default function ComponentName({ variant = "primary" }: { variant?: keyof typeof variants }) {
  return <div className={\`rounded-lg p-4 \${variants[variant]}\`}>{/* ... */}</div>;
}
`,
  },
];
