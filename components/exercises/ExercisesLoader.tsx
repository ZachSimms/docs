/**
 * @file Loads the exercise generators in the browser only.
 *
 * Client component: `next/dynamic` with `ssr: false` must live in a client component.
 * Their state comes from `localStorage`, and the editor and sandbox runner stay out of every
 * other page's bundle this way (like the playground's `PlaygroundLoader`).
 */

"use client";

import dynamic from "next/dynamic";

/** Shown while the code downloads. */
function Loading({ what }: { what: string }) {
  return (
    <p className="dim" role="status">
      Loading the {what}…
    </p>
  );
}

const CodeExercises = dynamic(() => import("./CodeExercises").then((m) => m.CodeExercises), {
  ssr: false,
  loading: () => <Loading what="exercise generator" />,
});

const MathPractice = dynamic(() => import("./MathPractice").then((m) => m.MathPractice), {
  ssr: false,
  loading: () => <Loading what="problem generator" />,
});

/** The coding exercise generator, client-side only. */
export function CodeExercisesLoader() {
  return <CodeExercises />;
}

/** The math problem generator, client-side only. */
export function MathPracticeLoader() {
  return <MathPractice />;
}
