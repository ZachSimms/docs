/**
 * @file The choices the exercise generators offer: languages, themes, difficulties, sizes
 * and math areas.
 *
 * Shared by the forms (labels) and the API (validation and prompt wording), so a
 * value the form can send is always one the server knows how to describe.
 */

/** Languages an exercise can be written in: the ones the playground runs in the browser. */
export const CODE_LANGUAGES = [
  { id: "python", label: "Python", file: "solution.py" },
  { id: "javascript", label: "JavaScript", file: "solution.js" },
  { id: "typescript", label: "TypeScript", file: "solution.ts" },
] as const;

/** A language id from {@link CODE_LANGUAGES}. */
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

/** The ids of {@link CODE_LANGUAGES}, for `z.enum`. */
export const CODE_LANGUAGE_IDS = CODE_LANGUAGES.map((l) => l.id) as [
  CodeLanguage,
  ...CodeLanguage[],
];

/** How hard an exercise or problem should be; `prompt` is what the model is told. */
export const DIFFICULTIES = [
  {
    id: "beginner",
    label: "Beginner",
    prompt:
      "beginner: one idea at a time, small inputs, no tricky edge cases beyond empty input; someone who learned the basics last month should finish in 10-20 minutes",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    prompt:
      "intermediate: combines two or three ideas, includes the usual edge cases (empty, one element, duplicates, negatives); 20-40 minutes for someone comfortable with the language",
  },
  {
    id: "advanced",
    label: "Advanced",
    prompt:
      "advanced: needs a non-obvious approach or data structure and attention to complexity, with demanding edge cases; interview-hard, 40-90 minutes",
  },
] as const;

/** A difficulty id from {@link DIFFICULTIES}. */
export type Difficulty = (typeof DIFFICULTIES)[number]["id"];

/** The ids of {@link DIFFICULTIES}, for `z.enum`. */
export const DIFFICULTY_IDS = DIFFICULTIES.map((d) => d.id) as [Difficulty, ...Difficulty[]];

/** Coding themes: what the exercise practices. `any` lets the free-text request decide. */
export const CODE_THEMES = [
  { id: "any", label: "Any" },
  { id: "basics", label: "Variables, loops and conditionals" },
  { id: "functions", label: "Functions and scope" },
  { id: "strings", label: "Strings and text processing" },
  { id: "arrays-hashing", label: "Arrays, lists and hash maps" },
  { id: "classes", label: "Classes and object-oriented design" },
  { id: "linked-lists", label: "Linked lists" },
  { id: "stacks-queues", label: "Stacks and queues" },
  { id: "trees", label: "Trees and binary search trees" },
  { id: "graphs", label: "Graphs (BFS, DFS, shortest paths)" },
  { id: "recursion", label: "Recursion and backtracking" },
  { id: "sorting-searching", label: "Sorting and searching" },
  { id: "dynamic-programming", label: "Dynamic programming" },
  { id: "higher-order", label: "Closures and higher-order functions" },
  { id: "iterators", label: "Iterators and generators" },
  { id: "errors", label: "Error handling and validation" },
  { id: "parsing", label: "Parsing and state machines" },
] as const;

/** A theme id from {@link CODE_THEMES}. */
export type CodeTheme = (typeof CODE_THEMES)[number]["id"];

/** The ids of {@link CODE_THEMES}, for `z.enum`. */
export const CODE_THEME_IDS = CODE_THEMES.map((t) => t.id) as [CodeTheme, ...CodeTheme[]];

/** An exercise is one focused task; a mini-project is several parts that build on each other. */
export const SIZES = [
  { id: "exercise", label: "Exercise" },
  { id: "project", label: "Mini-project" },
] as const;

/** A size id from {@link SIZES}. */
export type Size = (typeof SIZES)[number]["id"];

/** The ids of {@link SIZES}, for `z.enum`. */
export const SIZE_IDS = SIZES.map((s) => s.id) as [Size, ...Size[]];

/** Math areas for the practice sheet. `any` lets the free-text request decide. */
export const MATH_AREAS = [
  { id: "any", label: "Any" },
  { id: "arithmetic", label: "Arithmetic, fractions and percentages" },
  { id: "algebra", label: "Algebraic manipulation" },
  { id: "equations", label: "Equations and inequalities" },
  { id: "functions", label: "Functions and graphs" },
  { id: "exponents-logs", label: "Exponents and logarithms" },
  { id: "geometry", label: "Geometry" },
  { id: "trigonometry", label: "Trigonometry" },
  { id: "sequences", label: "Sequences and series" },
  { id: "probability", label: "Probability and counting" },
  { id: "statistics", label: "Statistics" },
  { id: "derivatives", label: "Calculus: derivatives" },
  { id: "integrals", label: "Calculus: integrals" },
  { id: "linear-algebra", label: "Vectors and matrices" },
  { id: "number-theory", label: "Number theory" },
  { id: "word-problems", label: "Word problems" },
] as const;

/** A math area id from {@link MATH_AREAS}. */
export type MathArea = (typeof MATH_AREAS)[number]["id"];

/** The ids of {@link MATH_AREAS}, for `z.enum`. */
export const MATH_AREA_IDS = MATH_AREAS.map((a) => a.id) as [MathArea, ...MathArea[]];

/**
 * The human label for an option id.
 *
 * @param options - One of the lists above.
 * @param id - The id to look up.
 * @returns The label, or the id itself when it is unknown.
 */
export function optionLabel(
  options: readonly { readonly id: string; readonly label: string }[],
  id: string,
): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

/**
 * The file the learner's code lives in for a language (`solution.py`, …).
 *
 * @param language - A language from {@link CODE_LANGUAGES}.
 */
export function solutionFile(language: CodeLanguage): string {
  return CODE_LANGUAGES.find((l) => l.id === language)?.file ?? "solution.py";
}
