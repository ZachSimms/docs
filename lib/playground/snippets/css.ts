/** @file CSS outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "base",
    title: "Base styles & variables",
    keywords: "reset box-sizing custom properties variables var root dark mode hello boilerplate",
    code: `*,
*::before,
*::after {
  box-sizing: border-box;
}

:root {
  --color-name: /* value */;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-name: /* dark value */;
  }
}

body {
  margin: 0;
  /* ... */
}
`,
  },
  {
    id: "rule",
    title: "Rule",
    keywords: "selector rule class id property declaration",
    code: `.class-name {
  /* property: value; */
}
`,
  },
  {
    id: "flex",
    title: "Flexbox",
    keywords: "flex flexbox center align justify gap wrap row column",
    code: `.container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
`,
  },
  {
    id: "grid",
    title: "Grid",
    keywords: "grid template columns areas auto-fit minmax fr gap layout",
    code: `.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
}
`,
  },
  {
    id: "media",
    title: "Media query",
    keywords: "media query responsive breakpoint",
    code: `@media (min-width: 48rem) {
  .class-name {
    /* ... */
  }
}
`,
  },
  {
    id: "container",
    title: "Container query",
    keywords: "container query responsive",
    code: `.parent {
  container-type: inline-size;
}

@container (min-width: 30rem) {
  .child {
    /* ... */
  }
}
`,
  },
  {
    id: "states",
    title: "States",
    keywords: "hover focus focus-visible active disabled pseudo class nesting",
    code: `.class-name {
  &:hover {
    /* ... */
  }

  &:focus-visible {
    /* ... */
  }

  &:disabled {
    /* ... */
  }
}
`,
  },
  {
    id: "transition",
    title: "Transition",
    keywords: "transition hover animate",
    code: `.class-name {
  transition: property 150ms ease;
}
`,
  },
  {
    id: "animation",
    title: "Keyframe animation",
    keywords: "animation keyframes",
    code: `@keyframes animation-name {
  from {
    /* ... */
  }
  to {
    /* ... */
  }
}

.class-name {
  animation: animation-name 300ms ease-out;
}
`,
  },
];
