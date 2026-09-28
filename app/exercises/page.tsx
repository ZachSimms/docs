/**
 * @file `/exercises/`: AI-generated coding exercises, checked by hidden tests in the browser
 * and reviewed by a model (see `components/exercises/CodeExercises.tsx`).
 *
 * A static route, so it wins over `app/[topic]`. The page shell is prerendered; the
 * generator itself loads client-side.
 */
import type { Metadata } from "next";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { CodeExercisesLoader } from "@/components/exercises/ExercisesLoader";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = {
  title: "Exercises",
  description:
    "Generate a coding exercise or mini-project on any topic, solve it in the browser, and have hidden tests and an AI review check it.",
};

/** The exercises page. */
export default function ExercisesPage() {
  return (
    <Page
      title="Exercises"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
      section="exercises"
    >
      <p>
        Ask for an exercise or a mini-project in Python, JavaScript or TypeScript. A model writes it
        with hidden tests; your code runs against them in your browser, and a review checks what
        tests can&apos;t (Python runs as Pyodide, about 6 MB on first use). Math problems live in{" "}
        <DottedLink href="/math/practice/" inline>
          math/practice
        </DottedLink>
        .
      </p>
      <CodeExercisesLoader />
    </Page>
  );
}
