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

/**
 * How hard an exercise or problem should be. `prompt` is what the model is told for a coding
 * exercise, `math` for a math problem.
 */
export const DIFFICULTIES = [
  {
    id: "beginner",
    label: "Beginner",
    prompt:
      "beginner: one idea at a time, a handful of inputs and simple rules; someone who learned the basics last month should finish in 10-20 minutes",
    math: "beginner: a routine one- or two-step problem with friendly numbers",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    prompt:
      "intermediate: combines two or three ideas, with the usual edge cases (empty or missing input, boundaries, invalid values); 20-40 minutes for someone comfortable with the language",
    math: "intermediate: a multi-step problem that combines two ideas",
  },
  {
    id: "advanced",
    label: "Advanced",
    prompt:
      "advanced: several interacting parts or a non-obvious approach, with careful edge cases and attention to design (and to efficiency where it matters); 40-90 minutes",
    math: "advanced: a competition-style or multi-concept problem that needs an insight",
  },
] as const;

/** A difficulty id from {@link DIFFICULTIES}. */
export type Difficulty = (typeof DIFFICULTIES)[number]["id"];

/** The ids of {@link DIFFICULTIES}, for `z.enum`. */
export const DIFFICULTY_IDS = DIFFICULTIES.map((d) => d.id) as [Difficulty, ...Difficulty[]];

/** How the themes are grouped in the form, and how often each group is drawn for "Any". */
export const THEME_GROUPS = [
  { id: "practical", label: "Practical programs", weight: 0.5 },
  { id: "language", label: "Language skills", weight: 0.3 },
  { id: "dsa", label: "Algorithms and data structures", weight: 0.2 },
] as const;

/** A group id from {@link THEME_GROUPS}. */
export type ThemeGroup = (typeof THEME_GROUPS)[number]["id"];

/** One coding theme: what the exercise practices, and the kind of task the model should write. */
interface ThemeSpec {
  readonly id: string;
  readonly label: string;
  /** `null` for "Any". */
  readonly group: ThemeGroup | null;
  /** What to build, for the model: a sentence with example scenarios. */
  readonly prompt: string;
  /** Languages the theme makes sense in (all when absent). */
  readonly languages?: readonly ("python" | "javascript" | "typescript")[];
}

/**
 * Coding themes. `any` lets the free-text request decide, or picks a theme at random (see
 * {@link pickTheme}). Ids are stored with each exercise, so they are only ever added, never
 * renamed or removed.
 */
export const CODE_THEMES = [
  { id: "any", label: "Any", group: null, prompt: "" },
  // Practical programs.
  {
    id: "data-wrangling",
    label: "Data wrangling (records, CSV, JSON)",
    group: "practical",
    prompt:
      "clean, group, aggregate or reshape a collection of records into a summary or report (sales rows, log entries, survey answers, bank transactions)",
  },
  {
    id: "parsing",
    label: "Parsing text formats",
    group: "practical",
    prompt:
      "parse a small text format into data and reject malformed input (a log line, an INI or CSV file, a query string, a duration like 1h30m, a simple arithmetic expression)",
  },
  {
    id: "domain-modeling",
    label: "Modeling a domain (carts, bookings, accounts)",
    group: "practical",
    prompt:
      "model a small real-world domain with its business rules (a shopping cart with discounts and tax, a library checkout with due dates, a booking calendar without overlaps, a bank account with overdraft limits)",
  },
  {
    id: "state-machines",
    label: "State machines and game logic",
    group: "practical",
    prompt:
      "the rules engine of a game or a device as a state machine (tic-tac-toe, a vending machine, a traffic light, bowling or tennis scoring, a turnstile)",
  },
  {
    id: "simulations",
    label: "Simulations",
    group: "practical",
    prompt:
      "step a small deterministic simulation (Conway's Game of Life, an elevator, a checkout queue, a robot moving on a grid, a bank of inventory over days)",
  },
  {
    id: "text-output",
    label: "Formatting output (tables, receipts, reports)",
    group: "practical",
    prompt:
      "produce exactly formatted text (align a table, wrap paragraphs to a width, render a receipt or a month calendar, format durations and currencies)",
  },
  {
    id: "utilities",
    label: "Small utilities (templating, caching, CLI args)",
    group: "practical",
    prompt:
      "a reusable utility other code would import (a string template engine, a cache with expiry using an injected clock, a rate limiter, a command-line argument parser, a version-number comparator)",
  },
  {
    id: "design-patterns",
    label: "Design patterns (observer, strategy, …)",
    group: "practical",
    prompt:
      "apply a classic design pattern to a concrete problem (an event emitter with once and off, pricing strategies, an undo history with commands, a plugin registry)",
  },
  // Language skills.
  {
    id: "basics",
    label: "Variables, loops and conditionals",
    group: "language",
    prompt: "loops, conditionals and simple arithmetic on a concrete everyday task",
  },
  {
    id: "functions",
    label: "Functions and scope",
    group: "language",
    prompt: "small, well-named functions with parameters, defaults and return values",
  },
  {
    id: "strings",
    label: "Strings and text",
    group: "language",
    prompt: "string manipulation on realistic text (names, addresses, messages, file paths)",
  },
  {
    id: "classes",
    label: "Classes and object-oriented design",
    group: "language",
    prompt:
      "classes with encapsulated state, methods and, where it helps, inheritance or composition",
  },
  {
    id: "higher-order",
    label: "Closures and higher-order functions",
    group: "language",
    prompt:
      "functions that take or return functions (memoize, debounce with an injected clock, compose, a pipeline of transforms)",
  },
  {
    id: "iterators",
    label: "Iterators and generators",
    group: "language",
    prompt:
      "lazy sequences with iterators or generators (paginating results, windows over a stream, chunking, infinite sequences taken lazily)",
  },
  {
    id: "errors",
    label: "Error handling and validation",
    group: "language",
    prompt:
      "validate input and signal problems with specific error types and messages (a sign-up form, a config file, a money transfer)",
  },
  {
    id: "async",
    label: "Async code and promises",
    group: "language",
    prompt:
      "async functions and promises (retry with backoff, a timeout, a concurrency limit, running tasks in order); the code receives the functions that wait or fetch as parameters, so tests never use real timers or the network",
    languages: ["javascript", "typescript"],
  },
  {
    id: "types",
    label: "TypeScript types (generics, unions)",
    group: "language",
    prompt:
      "lean on the type system: generics, discriminated unions with exhaustive switches, and type guards; tests check the runtime behavior and the requirements name the type-level design",
    languages: ["typescript"],
  },
  // Algorithms and data structures.
  {
    id: "arrays-hashing",
    label: "Arrays, lists and hash maps",
    group: "dsa",
    prompt: "an algorithmic problem solved with arrays and hash maps",
  },
  {
    id: "linked-lists",
    label: "Linked lists",
    group: "dsa",
    prompt: "implement or use a linked list",
  },
  {
    id: "stacks-queues",
    label: "Stacks and queues",
    group: "dsa",
    prompt: "a problem solved with a stack or a queue",
  },
  {
    id: "trees",
    label: "Trees and binary search trees",
    group: "dsa",
    prompt: "build or traverse a tree or a binary search tree",
  },
  {
    id: "graphs",
    label: "Graphs (BFS, DFS, shortest paths)",
    group: "dsa",
    prompt: "a graph problem (reachability, BFS or DFS, shortest paths)",
  },
  {
    id: "recursion",
    label: "Recursion and backtracking",
    group: "dsa",
    prompt: "a problem with a natural recursive or backtracking solution",
  },
  {
    id: "sorting-searching",
    label: "Sorting and searching",
    group: "dsa",
    prompt: "implement or apply sorting or searching (binary search, custom orderings)",
  },
  {
    id: "dynamic-programming",
    label: "Dynamic programming",
    group: "dsa",
    prompt: "a problem with overlapping subproblems, solved with dynamic programming",
  },
] as const satisfies readonly ThemeSpec[];

/** A theme id from {@link CODE_THEMES}. */
export type CodeTheme = (typeof CODE_THEMES)[number]["id"];

/** The ids of {@link CODE_THEMES}, for `z.enum`. */
export const CODE_THEME_IDS = CODE_THEMES.map((t) => t.id) as [CodeTheme, ...CodeTheme[]];

/** A theme's full entry. */
export function themeSpec(id: CodeTheme): ThemeSpec {
  return CODE_THEMES.find((t) => t.id === id) ?? CODE_THEMES[0];
}

/**
 * Whether a theme makes sense in a language (async and TypeScript types don't in Python).
 *
 * @param theme - A theme id.
 * @param language - A language id.
 */
export function themeFitsLanguage(theme: CodeTheme, language: CodeLanguage): boolean {
  const languages = (themeSpec(theme) as ThemeSpec).languages;
  return !languages || languages.includes(language);
}

/**
 * A theme for an "Any" request with nothing written: a group by weight (practical programs
 * most often, so exercises aren't all data-structure drills), then a theme in it that fits the
 * language, uniformly.
 *
 * @param language - The exercise's language.
 * @param random - A source of numbers in [0, 1) (injectable for tests).
 */
export function pickTheme(language: CodeLanguage, random: () => number = Math.random): CodeTheme {
  let roll = random();
  let group: ThemeGroup = THEME_GROUPS[0].id;
  for (const g of THEME_GROUPS) {
    group = g.id;
    if (roll < g.weight) break;
    roll -= g.weight;
  }
  const themes = CODE_THEMES.filter(
    (t) => (t as ThemeSpec).group === group && themeFitsLanguage(t.id, language),
  );
  return themes[Math.min(themes.length - 1, Math.floor(random() * themes.length))].id;
}

/** Requests to suggest in the form: varied on purpose; a few are shown at a time. */
export const EXAMPLE_REQUESTS = [
  "summarize a web server log: requests and errors per hour",
  "a shopping cart with discount codes and tax",
  "tic-tac-toe: whose turn, legal moves, who won",
  "split shared expenses between friends",
  "Conway's Game of Life on a small grid",
  "validate and normalize a sign-up form",
  "format a receipt with aligned columns",
  "a vending machine as a state machine",
  "an event emitter with on, off and once",
  "parse durations like 1h30m15s",
  "I want an exercise for classes",
  "I need to practice linked lists",
] as const;

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
