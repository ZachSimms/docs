/**
 * @file Loads the math problem generator (`content/math/practice.mdx`) in the browser only.
 *
 * Client component: `next/dynamic` with `ssr: false` must live in a client component. Its state
 * comes from `localStorage`, and its code stays out of every other sheet's bundle this way.
 */

"use client";

import dynamic from "next/dynamic";

const MathPractice = dynamic(() => import("./MathPractice").then((m) => m.MathPractice), {
  ssr: false,
  loading: () => (
    <p className="dim" role="status">
      Loading the problem generator…
    </p>
  ),
});

/** The math problem generator, client-side only. */
export function MathPracticeLoader() {
  return <MathPractice />;
}
