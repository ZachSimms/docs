/**
 * The exercise generators in the browser: storage, the Markdown/math sanitizer, the API client,
 * the playground's exercise mode (its panel, results and session, with a stand-in editor) and
 * the math sheet, with `fetch` stubbed and the sandbox runner replaced: the real ones are
 * covered by the harness tests and the e2e suite.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { useState, type ChangeEvent } from "react";
import { parseHarnessOutput, resultMark, type HarnessReport } from "@/lib/exercises/harness";
import {
  EMPTY_CODE_STORE,
  EMPTY_MATH_STORE,
  MAX_KEPT,
  STORE_KEYS,
  codeStore,
  forget,
  loadStore,
  omitKeys,
  remember,
  saveStore,
} from "@/lib/exercises/storage";
import type { TestCase } from "@/lib/exercises/schema";
import type { PlaygroundRun } from "@/components/playground/usePlaygroundRun";
import {
  PASSING_REVIEW,
  QUADRATIC_PROBLEM,
  SIGN_SLIP_VERDICT,
  STACK_EXERCISE,
} from "../fixtures/exercises";

/** Reports the fake runner gives, by the code it is asked to run. */
const reports = new Map<string, (tests: readonly TestCase[]) => HarnessReport>();
const runs: string[] = [];

/** A report where test `i` passes when `ok(i)`. */
function reportOf(tests: readonly TestCase[], ok: (i: number) => boolean): HarnessReport {
  const mark = resultMark("t");
  const lines = tests.map(
    (_, i) =>
      `${mark}${JSON.stringify({ i, ok: ok(i), message: ok(i) ? undefined : "expected 2, got 1" })}`,
  );
  return parseHarnessOutput([...lines, `${mark}{"done": true}`].join("\n"), "t", tests);
}

mock.module("@/components/exercises/useTestRunner", () => ({
  useTestRunner: () => ({
    runTests: async (_language: string, code: string, tests: readonly TestCase[]) => {
      runs.push(code);
      return (reports.get(code) ?? ((t: readonly TestCase[]) => reportOf(t, () => false)))(tests);
    },
    stop: () => undefined,
    status: "",
    running: false,
  }),
}));

const { useExerciseSession } = await import("@/components/exercises/useExerciseSession");
const { ExercisePanel } = await import("@/components/exercises/ExercisePanel");
const { ExerciseResults } = await import("@/components/exercises/ExerciseResults");

/** Tours started from the intro card. */
const tours: string[] = [];

/** Whether Python's download counts as approved, and what was approved during a test. */
let pythonApproved = true;
const approvals: string[] = [];

/**
 * The playground's exercise mode without the playground: the panel, a textarea for the editor,
 * the toolbar's Run tests and Submit, and the results pane, over one session.
 */
function ExerciseMode({ intro: initialIntro = false }: { intro?: boolean }) {
  const [intro, setIntro] = useState(initialIntro);
  const session = useExerciseSession({} as PlaygroundRun, {
    approved: (id) => id !== "python" || pythonApproved,
    approve: (id) => void approvals.push(id),
  });
  return (
    <>
      <ExercisePanel
        session={session}
        onHide={() => undefined}
        intro={intro}
        onIntro={setIntro}
        onTour={() => void tours.push("exercise")}
      />
      {session.exercise && (
        <textarea
          aria-label="Code editor"
          value={session.code}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            session.setCode(event.target.value)
          }
        />
      )}
      <button type="button" onClick={session.runTests} disabled={session.working}>
        Run tests
      </button>
      <button type="button" onClick={session.submit} disabled={session.working}>
        Submit
      </button>
      <ExerciseResults session={session} />
    </>
  );
}
const { MathPractice } = await import("@/components/exercises/MathPractice");
const { renderRichText, displayMathBlocks } = await import("@/components/exercises/RichText");
const client = await import("@/lib/exercises/client");

/** Stubbed API: path → responder. */
let api: Record<string, (body: unknown) => { status?: number; body: unknown }> = {};
const posted: { path: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  tours.length = 0;
  pythonApproved = true;
  approvals.length = 0;
  localStorage.clear();
  reports.clear();
  runs.length = 0;
  posted.length = 0;
  api = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    posted.push({ path, body });
    const handler = api[path];
    if (!handler) throw new TypeError("offline");
    const answer = handler(body);
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("storage", () => {
  it("forgets items and keeps a sensible current one", () => {
    const items = ["a", "b", "c", "d"].map((id) => ({ id }));
    expect(forget(items, "b", ["b"])).toEqual({
      items: [{ id: "a" }, { id: "c" }, { id: "d" }],
      currentId: "c", // the next one takes its place
      removed: ["b"],
    });
    expect(forget(items, "d", ["d"]).currentId).toBe("c"); // at the end: the one before
    expect(forget(items, "b", ["a"]).currentId).toBe("b"); // untouched
    expect(forget(items, "b", ["b", "c", "d"]).currentId).toBe("a");
    expect(forget(items, "a", "all")).toEqual({
      items: [],
      currentId: null,
      removed: ["a", "b", "c", "d"],
    });
    expect(forget(items, null, ["x"]).removed).toEqual([]);
  });

  it("falls back to the empty store for missing, broken or invalid data", () => {
    expect(loadStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE)).toBe(EMPTY_CODE_STORE);
    localStorage.setItem(STORE_KEYS.code, "{not json");
    expect(loadStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE)).toBe(EMPTY_CODE_STORE);
    localStorage.setItem(
      STORE_KEYS.code,
      JSON.stringify({ ...EMPTY_CODE_STORE, form: { language: "cobol" } }),
    );
    expect(loadStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE)).toBe(EMPTY_CODE_STORE);
  });

  it("round-trips a valid store", () => {
    const store = {
      ...EMPTY_CODE_STORE,
      currentId: STACK_EXERCISE.id,
      exercises: [STACK_EXERCISE],
    };
    saveStore(STORE_KEYS.code, store);
    expect(loadStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE)).toEqual(store);
  });

  it("keeps the newest items and reports the ones dropped", () => {
    let items: { id: string }[] = [];
    for (let i = 0; i < MAX_KEPT; i++) items = remember(items, { id: `${i}` }).items;
    const { items: next, dropped } = remember(items, { id: "new" });
    expect(next).toHaveLength(MAX_KEPT);
    expect(next[0].id).toBe("new");
    expect(dropped).toEqual(["0"]);
    expect(
      remember(next, { id: "5" })
        .items.map((i) => i.id)
        .slice(0, 2),
    ).toEqual(["5", "new"]);
    expect(omitKeys({ a: 1, b: 2 }, ["a"])).toEqual({ b: 2 });
  });
});

describe("renderRichText", () => {
  it("renders Markdown and math", () => {
    const html = renderRichText("**bold** and $x^2$\n\n| a |\n| - |\n| 1 |");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('class="katex"');
    expect(html).toContain("<table>");
  });

  // micromark's escaping is the first layer. DOMPurify (the second, and the new-tab links) does
  // nothing under happy-dom, so it is checked in a real browser by tests/e2e/exercises.spec.ts.
  it("escapes raw HTML and drops dangerous links", () => {
    const html = renderRichText(
      '<script>alert(1)</script>\n\ntext <img src=x onerror="alert(1)">\n\n[x](javascript:alert(1)) and [ok](https://example.com)',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/href="javascript:/);
    expect(html).toContain('href="https://example.com"');
  });

  it("puts one-line display math on its own lines, outside code fences only", () => {
    expect(displayMathBlocks("$$a$$")).toBe("$$\na\n$$");
    expect(displayMathBlocks("```\n$$a$$\n```")).toBe("```\n$$a$$\n```");
    expect(displayMathBlocks("text $$a$$ text")).toBe("text $$a$$ text");
    expect(renderRichText("$$x^2$$")).toContain("katex-display");
  });
});

describe("API client", () => {
  it("validates answers and passes the server's message on", async () => {
    api["/api/exercises/math/"] = () => ({ body: QUADRATIC_PROBLEM });
    const request = {
      request: "",
      area: "any" as const,
      difficulty: "beginner" as const,
      avoid: [],
    };
    expect(await client.generateMathProblem(request)).toEqual(QUADRATIC_PROBLEM);

    api["/api/exercises/math/"] = () => ({
      status: 429,
      body: { error: "The free model is busy.", code: "busy" },
    });
    await expect(client.generateMathProblem(request)).rejects.toMatchObject({
      message: "The free model is busy.",
      code: "busy",
    });

    api["/api/exercises/math/"] = () => ({ body: { title: 1 } });
    await expect(client.generateMathProblem(request)).rejects.toMatchObject({ code: "model" });

    delete api["/api/exercises/math/"];
    await expect(client.generateMathProblem(request)).rejects.toMatchObject({ code: "network" });
  });

  it("sends only what a review needs", async () => {
    api["/api/exercises/code/review/"] = () => ({ body: PASSING_REVIEW });
    await client.reviewCode(STACK_EXERCISE, "code", [
      { name: "a", ok: false, message: "x".repeat(2000) },
    ]);
    const body = posted[0].body as {
      exercise: Record<string, unknown>;
      tests: { message: string }[];
    };
    expect(Object.keys(body.exercise).sort()).toEqual([
      "brief",
      "difficulty",
      "language",
      "requirements",
      "title",
    ]);
    expect(body.tests[0].message).toHaveLength(1000);
  });
});

describe("the playground's exercise mode", () => {
  it("generates, verifies, runs the learner's tests and reviews", async () => {
    api["/api/exercises/code/"] = () => ({ body: STACK_EXERCISE });
    api["/api/exercises/code/review/"] = () => ({ body: PASSING_REVIEW });
    reports.set(STACK_EXERCISE.solution, (t) => reportOf(t, () => true));
    render(<ExerciseMode />);

    fireEvent.change(screen.getByLabelText("What do you want to practice?"), {
      target: { value: "stacks" },
    });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "javascript" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    await screen.findByRole("heading", { name: "Undo stack" });
    expect(posted[0].body).toMatchObject({ request: "stacks", language: "javascript", avoid: [] });
    expect(runs).toEqual([STACK_EXERCISE.solution]); // the self-check
    expect(screen.getByText("✓ tests verified against a reference solution")).toBeInTheDocument();

    // The starter code fails every test.
    fireEvent.click(screen.getByRole("button", { name: "Run tests" }));
    await screen.findByText("0/4 passed");
    expect(screen.getAllByText(/expected 2, got 1/)).toHaveLength(4);

    // The solution passes, and the review passes it.
    fireEvent.change(screen.getByLabelText("Code editor"), {
      target: { value: STACK_EXERCISE.solution },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Passed ✓");
    expect(screen.getByText("4/4 passed")).toBeInTheDocument();
    const review = posted.find((p) => p.path === "/api/exercises/code/review/")?.body as {
      tests: { ok: boolean }[];
    };
    expect(review.tests.every((t) => t.ok)).toBe(true);
    await waitFor(() => expect(screen.getByText("✓ passed")).toBeInTheDocument());

    // Progress and code survive a remount.
    await act(() => new Promise((r) => setTimeout(r, 350)));
    const saved = loadStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE);
    expect(saved.progress[STACK_EXERCISE.id]).toEqual({
      passed: true,
      best: "4/4",
      verified: true,
    });
    expect(saved.drafts[STACK_EXERCISE.id]).toBe(STACK_EXERCISE.solution);
  });

  it("asks for a repair when the reference solution fails its own tests", async () => {
    const broken = { ...STACK_EXERCISE, solution: "// broken\n" };
    api["/api/exercises/code/"] = () => ({ body: broken });
    api["/api/exercises/code/repair/"] = () => ({ body: STACK_EXERCISE });
    reports.set(broken.solution, (t) => reportOf(t, (i) => i !== 1));
    reports.set(STACK_EXERCISE.solution, (t) => reportOf(t, () => true));
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    await screen.findByText("✓ tests verified against a reference solution");
    const repair = posted.find((p) => p.path === "/api/exercises/code/repair/")?.body as {
      failures: string;
    };
    expect(repair.failures).toContain('FAILED "peek leaves the value"');
  });

  it("flags an exercise whose repair doesn't help", async () => {
    const broken = { ...STACK_EXERCISE, solution: "// broken\n" };
    api["/api/exercises/code/"] = () => ({ body: broken });
    api["/api/exercises/code/repair/"] = () => ({
      status: 502,
      body: { error: "no", code: "model" },
    });
    reports.set(broken.solution, (t) => reportOf(t, (i) => i !== 1));
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    await screen.findByText("Some tests may be wrong");
  });

  it("neither repairs nor flags when the runner couldn't start", async () => {
    api["/api/exercises/code/"] = () => ({ body: STACK_EXERCISE });
    reports.set(STACK_EXERCISE.solution, (t) =>
      parseHarnessOutput("Failed to fetch dynamically imported module", "t", t),
    );
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    await screen.findByText("tests not checked");
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't be checked");
    expect(posted.some((p) => p.path.includes("repair"))).toBe(false);
  });

  it("repairs a reference solution that doesn't compile", async () => {
    const broken = { ...STACK_EXERCISE, solution: "export class Stack {\n" };
    api["/api/exercises/code/"] = () => ({ body: broken });
    api["/api/exercises/code/repair/"] = () => ({ body: STACK_EXERCISE });
    reports.set(broken.solution, (t) =>
      parseHarnessOutput("solution.js: Unexpected token (2:0)", "t", t),
    );
    reports.set(STACK_EXERCISE.solution, (t) => reportOf(t, () => true));
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    await screen.findByText("✓ tests verified against a reference solution");
    const repair = posted.find((p) => p.path === "/api/exercises/code/repair/")?.body as {
      failures: string;
    };
    expect(repair.failures).toContain("solution.js: Unexpected token");
  });

  it("shows the server's error", async () => {
    api["/api/exercises/code/"] = () => ({
      status: 503,
      body: { error: "Add AI_GATEWAY_API_KEY.", code: "config" },
    });
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add AI_GATEWAY_API_KEY.");
  });

  it("asks before Python's first download, then generates", async () => {
    pythonApproved = false;
    api["/api/exercises/code/"] = () => ({ body: STACK_EXERCISE });
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: /Generate exercise/ }));
    expect(screen.getByRole("group", { name: "Download Python" })).toBeInTheDocument();
    expect(posted).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "download and generate" }));
    await screen.findByRole("heading", { name: "Undo stack" });
    expect(approvals).toEqual(["python"]);
  });

  it("folds the form away while an exercise is open, and switches between recent ones", async () => {
    const other = { ...STACK_EXERCISE, id: "other", title: "Another one" };
    saveStore(STORE_KEYS.code, {
      ...EMPTY_CODE_STORE,
      currentId: STACK_EXERCISE.id,
      exercises: [STACK_EXERCISE, other],
      drafts: { other: "// my other draft" },
    });
    render(<ExerciseMode />);
    expect(screen.getByText("new exercise")).toBeInTheDocument();
    expect(screen.getByLabelText("Code editor")).toHaveValue(STACK_EXERCISE.starterCode);
    fireEvent.click(screen.getByRole("button", { name: "Another one" }));
    expect(screen.getByRole("heading", { name: "Another one" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code editor")).toHaveValue("// my other draft");
  });

  it("groups the themes, hides the ones the language lacks, and falls back to Any", () => {
    render(<ExerciseMode />);
    const theme = screen.getByLabelText("Theme") as HTMLSelectElement;
    const groups = [...theme.querySelectorAll("optgroup")].map((g) => g.label);
    expect(groups).toEqual([
      "Practical programs",
      "Language skills",
      "Algorithms and data structures",
    ]);
    const labels = () => [...theme.options].map((o) => o.textContent);
    expect(labels()).not.toContain("Async code and promises"); // Python by default
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "typescript" } });
    expect(labels()).toContain("Async code and promises");
    expect(labels()).toContain("TypeScript types (generics, unions)");
    fireEvent.change(theme, { target: { value: "types" } });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "javascript" } });
    expect(theme.value).toBe("any");
  });

  it("suggests a few varied requests", () => {
    render(<ExerciseMode />);
    const suggestions = [...document.querySelectorAll(".ex-examples button")].map(
      (b) => b.textContent,
    );
    expect(suggestions).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: suggestions[0]! }));
    expect(screen.getByLabelText("What do you want to practice?")).toHaveValue(suggestions[0]);
  });

  it("removes one exercise with its work, opening the next", () => {
    const other = { ...STACK_EXERCISE, id: "other", title: "Another one" };
    saveStore(STORE_KEYS.code, {
      ...EMPTY_CODE_STORE,
      currentId: STACK_EXERCISE.id,
      exercises: [STACK_EXERCISE, other],
      drafts: { [STACK_EXERCISE.id]: "// mine" },
      progress: { [STACK_EXERCISE.id]: { passed: true } },
    });
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Undo stack" }));
    expect(screen.getByRole("heading", { name: "Another one" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo stack" })).toBeNull();
  });

  it("clears every exercise after a confirmation", async () => {
    saveStore(STORE_KEYS.code, {
      ...EMPTY_CODE_STORE,
      currentId: STACK_EXERCISE.id,
      exercises: [STACK_EXERCISE, { ...STACK_EXERCISE, id: "b", title: "B" }],
    });
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: "clear all" }));
    const confirm = screen.getByRole("group", { name: "Clear all exercises" });
    expect(confirm).toHaveTextContent("remove all 2 exercises");
    fireEvent.click(within(confirm).getByRole("button", { name: "no" }));
    expect(screen.getByRole("heading", { name: "Recent" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "clear all" }));
    fireEvent.click(screen.getByRole("button", { name: "yes" }));
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Undo stack" })).toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 350)));
    const saved = loadStore(STORE_KEYS.code, codeStore, EMPTY_CODE_STORE);
    expect(saved).toMatchObject({ exercises: [], currentId: null, drafts: {}, progress: {} });
  });

  it("explains how exercises work, on request, with a way into the tour", () => {
    render(<ExerciseMode intro />);
    const card = screen.getByRole("region", { name: "How exercises work" });
    expect(card).toHaveTextContent("Run tests");
    fireEvent.click(within(card).getByRole("button", { name: "take the tour" }));
    expect(tours).toEqual(["exercise"]);
    fireEvent.click(within(card).getByRole("button", { name: "got it" }));
    expect(screen.queryByRole("region", { name: "How exercises work" })).toBeNull();
    // Back from the panel's bar, or from the empty state.
    fireEvent.click(screen.getAllByRole("button", { name: "how it works" })[0]!);
    expect(screen.getByRole("region", { name: "How exercises work" })).toBeInTheDocument();
  });

  it("reveals hints one at a time and the solution after a confirmation", async () => {
    saveStore(STORE_KEYS.code, {
      ...EMPTY_CODE_STORE,
      currentId: STACK_EXERCISE.id,
      exercises: [STACK_EXERCISE],
    });
    render(<ExerciseMode />);
    fireEvent.click(screen.getByRole("button", { name: "Hint (0/1)" }));
    expect(screen.getByText(STACK_EXERCISE.hints[0])).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hint (1/1)" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Solution" }));
    fireEvent.click(screen.getByRole("button", { name: "show it" }));
    expect(screen.getByRole("heading", { name: "Reference solution" })).toBeInTheDocument();
  });
});

describe("MathPractice", () => {
  it("generates a problem, checks numeric answers locally and asks the model to explain", async () => {
    api["/api/exercises/math/"] = () => ({ body: QUADRATIC_PROBLEM });
    api["/api/exercises/math/check/"] = () => ({ body: SIGN_SLIP_VERDICT });
    render(<MathPractice />);
    fireEvent.change(screen.getByLabelText("Area"), { target: { value: "equations" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate problem/ }));
    await screen.findByRole("heading", { name: QUADRATIC_PROBLEM.title });
    expect(posted[0].body).toMatchObject({ area: "equations", difficulty: "beginner" });

    const answer = screen.getByLabelText(/Your answer/);
    fireEvent.change(answer, { target: { value: "x = 3, x = 2" } });
    expect(screen.getByText("reads as 3, 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(posted).toHaveLength(1); // checked locally

    fireEvent.click(screen.getByRole("button", { name: "Add working (optional)" }));
    fireEvent.change(screen.getByLabelText(/Your working/), {
      target: { value: "x + 3 = 0 so x = 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "explain my mistake" }));
    expect(await screen.findByText(/changes its sign/)).toBeInTheDocument();
    expect(posted[1].body).toMatchObject({ answer: "x = 3, x = 2", working: "x + 3 = 0 so x = 3" });

    fireEvent.change(answer, { target: { value: "-3, 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Correct ✓")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("✓ solved")).toBeInTheDocument());
  });

  it("sends unreadable answers to the model", async () => {
    saveStore(STORE_KEYS.math, {
      ...EMPTY_MATH_STORE,
      currentId: QUADRATIC_PROBLEM.id,
      problems: [QUADRATIC_PROBLEM],
    });
    api["/api/exercises/math/check/"] = () => ({
      body: { correct: true, feedback: "Equivalent." },
    });
    render(<MathPractice />);
    fireEvent.change(screen.getByLabelText(/Your answer/), {
      target: { value: "the roots of (x+3)(x-2)" },
    });
    expect(screen.getByText(/checked by the model/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Equivalent.")).toBeInTheDocument();
  });

  it("removes problems one by one or all at once, and explains answer formats", () => {
    const other = { ...QUADRATIC_PROBLEM, id: "other", title: "Other problem" };
    saveStore(STORE_KEYS.math, {
      ...EMPTY_MATH_STORE,
      currentId: QUADRATIC_PROBLEM.id,
      problems: [QUADRATIC_PROBLEM, other],
      progress: { [QUADRATIC_PROBLEM.id]: { solved: true, attempts: 1 } },
    });
    render(<MathPractice />);
    expect(screen.getByText("how to type answers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Remove ${QUADRATIC_PROBLEM.title}` }));
    expect(screen.getByRole("heading", { name: "Other problem" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "clear all" }));
    expect(screen.getByRole("group", { name: "Clear all problems" })).toHaveTextContent(
      "remove all 1 problem and",
    );
    fireEvent.click(screen.getByRole("button", { name: "yes" }));
    expect(screen.queryByRole("heading", { name: "Other problem" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
  });

  it("shows hints and the worked solution", () => {
    saveStore(STORE_KEYS.math, {
      ...EMPTY_MATH_STORE,
      currentId: QUADRATIC_PROBLEM.id,
      problems: [QUADRATIC_PROBLEM],
    });
    render(<MathPractice />);
    fireEvent.click(screen.getByRole("button", { name: "Hint (0/2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint (1/2)" }));
    expect(screen.getByRole("button", { name: "Hint (2/2)" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Solution" }));
    expect(screen.getByRole("heading", { name: "Worked solution" })).toBeInTheDocument();
  });
});
