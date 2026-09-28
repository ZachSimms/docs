/** @file CSS snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "base",
    title: "Base styles & variables",
    note: "A small reset, custom properties, and a dark theme that follows the system.",
    keywords:
      "reset box-sizing custom properties variables var root dark mode color-scheme hello boilerplate",
    code: `*,
*::before,
*::after {
  box-sizing: border-box;
}

:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --accent: #2563eb;
  --space: 1rem;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --fg: #eaeaea;
    --accent: #60a5fa;
  }
}

body {
  margin: 0;
  padding: var(--space);
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.5 system-ui, sans-serif;
}

img {
  max-width: 100%;
  height: auto;
}

a {
  color: var(--accent);
}
`,
  },
  {
    id: "flex",
    title: "Flexbox",
    note: "Centering, a nav bar with space between, wrapping rows.",
    keywords: "flex flexbox center align justify gap wrap row column navbar",
    code: `/* Center anything, both ways */
.center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

/* A bar: logo on the left, links on the right */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.navbar ul {
  display: flex;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Items that wrap onto new lines and share the space */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chips > * {
  flex: 1 1 8rem; /* grow, shrink, start at 8rem */
}
`,
  },
  {
    id: "grid",
    title: "Grid",
    note: "Responsive cards without media queries, and a page layout with named areas.",
    keywords: "grid template columns areas auto-fit minmax fr gap layout responsive cards",
    code: `/* As many 12rem+ columns as fit */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem;
}

/* A page layout with named areas */
.page {
  display: grid;
  grid-template:
    "header header" auto
    "sidebar main" 1fr
    "footer footer" auto
    / 14rem 1fr;
  min-height: 100vh;
}

.page > header { grid-area: header; }
.page > aside { grid-area: sidebar; }
.page > main { grid-area: main; }
.page > footer { grid-area: footer; }
`,
  },
  {
    id: "responsive",
    title: "Media & container queries",
    note: "Adapt to the viewport, or to the size of the element's container.",
    keywords: "media query container query responsive breakpoint mobile clamp",
    code: `/* Fluid type: at least 1.5rem, at most 3rem */
h1 {
  font-size: clamp(1.5rem, 4vw + 1rem, 3rem);
}

/* One column on phones, two from 48rem up */
.layout {
  display: grid;
  gap: 1rem;
}

@media (min-width: 48rem) {
  .layout {
    grid-template-columns: 2fr 1fr;
  }
}

/* Container queries: react to the parent's width, not the window's */
.card-wrap {
  container-type: inline-size;
}

@container (min-width: 30rem) {
  .card {
    display: flex;
    gap: 1rem;
  }
}

/* Less motion for readers who ask for it */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
`,
  },
  {
    id: "animation",
    title: "Transitions & animations",
    note: "Smooth state changes and keyframe animations.",
    keywords: "transition animation keyframes transform hover spin fade",
    code: `/* Transition: animate between two states */
.button {
  transition: transform 150ms ease, background-color 150ms ease;
}

.button:hover {
  transform: translateY(-2px);
}

/* Keyframes: an animation that runs on its own */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}

.appear {
  animation: fade-in 300ms ease-out both;
}
`,
  },
  {
    id: "button",
    title: "Button states",
    note: "Hover, active, keyboard focus and disabled states; nested with native CSS nesting.",
    keywords: "button hover focus focus-visible active disabled nesting & states",
    code: `.btn {
  padding: 0.5em 1em;
  border: 0;
  border-radius: 0.375rem;
  background: #2563eb;
  color: white;
  font: inherit;
  cursor: pointer;

  &:hover {
    background: #1d4ed8;
  }

  &:active {
    transform: scale(0.98);
  }

  /* A ring for keyboard users, not for mouse clicks */
  &:focus-visible {
    outline: 3px solid #93c5fd;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
`,
  },
];
