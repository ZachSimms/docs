/**
 * The exercise test harness: the project it builds, the report it parses, and real runs of
 * the generated harness (JavaScript and TypeScript under Bun, Python under `python3` when the
 * machine has it) against the fixtures' reference solutions and a buggy attempt.
 */
import { afterAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  JS_HARNESS,
  PYTHON_HARNESS,
  PYTHON_TESTS,
  buildHarness,
  parseHarnessOutput,
  resultMark,
  summarizeReport,
} from "@/lib/exercises/harness";
import type { CodeLanguage } from "@/lib/exercises/options";
import type { TestCase } from "@/lib/exercises/schema";
import {
  BROKEN_LINKED_LIST_EXERCISE,
  BUGGY_LINKED_LIST,
  LINKED_LIST_EXERCISE,
  STACK_EXERCISE,
} from "../fixtures/exercises";

const TESTS: TestCase[] = [
  { name: "one", code: "a" },
  { name: "two", code: "b" },
  { name: "three", code: "c" },
];

describe("buildHarness", () => {
  it("writes the solution, the tests as data and a Python entry", () => {
    const project = buildHarness("python", "x = 1\n", TESTS, "abc");
    expect(project.entry).toBe(PYTHON_HARNESS);
    expect(project.files["solution.py"]).toBe("x = 1\n");
    expect(JSON.parse(project.files[PYTHON_TESTS])).toEqual(TESTS);
    expect(project.files[PYTHON_HARNESS]).toContain(JSON.stringify(resultMark("abc")));
    expect(project.files[PYTHON_HARNESS]).not.toMatch(/__[A-Z_]+__/);
  });

  it("inlines the tests into a JS entry that imports the solution", () => {
    for (const language of ["javascript", "typescript"] as const) {
      const project = buildHarness(language, "export const x = 1;", TESTS, "abc");
      expect(project.entry).toBe(JS_HARNESS);
      expect(Object.keys(project.files).sort()).toEqual(
        [JS_HARNESS, language === "javascript" ? "solution.js" : "solution.ts"].sort(),
      );
      expect(project.files[JS_HARNESS]).toContain('from "./solution"');
      expect(project.files[JS_HARNESS]).not.toMatch(/__[A-Z_]+__/);
    }
  });

  it("inserts generated text literally: $& and placeholder names stay as written", () => {
    const tricky = [{ name: "t", code: "assertEqual(`${1}$&`, '1$&'); // __TIMEOUT__ __MARK__" }];
    const source = buildHarness("javascript", "", tricky, "n").files[JS_HARNESS];
    expect(source).toContain(JSON.stringify(tricky[0].code).slice(1, -1));
    expect(source).toMatch(/const TIMEOUT = \d+;/);
  });
});

describe("parseHarnessOutput", () => {
  const mark = resultMark("n0nce");

  it("reads results in order, whatever else was printed", () => {
    const output = [
      "noise before",
      `${mark}{"i": 1, "ok": false, "message": "expected 2, got 3", "ms": 1.5, "output": "hi"}`,
      `prefix${mark}{"i": 0, "ok": true, "ms": 0.2, "output": ""}`,
      `${mark}{"done": true}`,
    ].join("\n");
    const report = parseHarnessOutput(output, "n0nce", TESTS);
    expect(report.done).toBe(true);
    expect(report.results[0]).toEqual({
      name: "one",
      ok: true,
      ms: 0.2,
      message: undefined,
      output: undefined,
    });
    expect(report.results[1]).toMatchObject({
      name: "two",
      ok: false,
      message: "expected 2, got 3",
      output: "hi",
    });
    expect(report.results[2]).toBeNull();
    expect(report.other).toBe("noise before\nprefix");
  });

  it("ignores other nonces, bad JSON and out-of-range indexes", () => {
    const output = [
      `${resultMark("other")}{"i": 0, "ok": true}`,
      `${mark}{not json`,
      `${mark}{"i": 7, "ok": true}`,
      `${mark}{"i": -1, "ok": true}`,
      `${mark}{"i": 0.5, "ok": true}`,
      `${mark}null`,
    ].join("\n");
    const report = parseHarnessOutput(output, "n0nce", TESTS);
    expect(report.results).toEqual([null, null, null]);
    expect(report.done).toBe(false);
  });

  it("reports a load error", () => {
    const report = parseHarnessOutput(
      `${mark}{"load": "SyntaxError: bad"}\n${mark}{"done": true}`,
      "n0nce",
      TESTS,
    );
    expect(report.loadError).toBe("SyntaxError: bad");
    const summary = summarizeReport(report, TESTS);
    expect(summary.allPassed).toBe(false);
    expect(summary.text).toContain("failed to load");
  });
});

describe("summarizeReport", () => {
  it("counts passes and describes each failure with its test code", () => {
    const mark = resultMark("n");
    const output = `${mark}{"i": 0, "ok": true}\n${mark}{"i": 1, "ok": false, "message": "boom"}`;
    const summary = summarizeReport(parseHarnessOutput(output, "n", TESTS), TESTS);
    expect(summary).toMatchObject({ passed: 1, total: 3, allPassed: false });
    expect(summary.text).toContain('FAILED "two": boom');
    expect(summary.text).toContain("    b");
    expect(summary.text).toContain('FAILED "three": did not report');
  });

  it("is all passed only when every test passed", () => {
    const mark = resultMark("n");
    const output = TESTS.map((_, i) => `${mark}{"i": ${i}, "ok": true}`).join("\n");
    expect(summarizeReport(parseHarnessOutput(output, "n", TESTS), TESTS).allPassed).toBe(true);
  });
});

/** Temporary directories to remove after the suite. */
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** Write a harness project to disk and run it with `command`. */
function runHarness(
  command: string,
  language: CodeLanguage,
  code: string,
  tests: readonly TestCase[],
) {
  const dir = mkdtempSync(path.join(tmpdir(), "exercise-"));
  dirs.push(dir);
  const project = buildHarness(language, code, tests, "live");
  for (const [file, content] of Object.entries(project.files)) {
    writeFileSync(path.join(dir, file), content);
  }
  const result = spawnSync(command, [project.entry], {
    cwd: dir,
    encoding: "utf8",
    timeout: 30_000,
  });
  return parseHarnessOutput(`${result.stdout}${result.stderr}`, "live", tests);
}

describe("the JavaScript harness, run for real", () => {
  const bun = process.execPath;

  it("passes the reference solution", () => {
    const report = runHarness(bun, "javascript", STACK_EXERCISE.solution, STACK_EXERCISE.tests);
    expect(report.done).toBe(true);
    expect(report.results.every((r) => r?.ok)).toBe(true);
  });

  it("fails the starter code, one test at a time", () => {
    const report = runHarness(bun, "javascript", STACK_EXERCISE.starterCode, STACK_EXERCISE.tests);
    expect(report.done).toBe(true);
    expect(report.results.map((r) => r?.ok)).toEqual([false, false, false, false]);
    expect(report.results[0]?.message).toContain("Error: not implemented");
    // A plain Error isn't the RangeError the test asks for.
    expect(report.results[3]?.message).toContain("expected RangeError, got Error");
  });

  it("runs TypeScript solutions, captures prints and times out hung tests", () => {
    const tests: TestCase[] = [
      { name: "typed", code: "assertEqual(double(2), 4);" },
      { name: "prints", code: "console.log('seen', { a: 1 }); assertTrue(true);" },
      { name: "hangs", code: "await new Promise(() => {});" },
      { name: "missing export", code: "hidden();" },
      { name: "syntax error", code: "const = ;" },
      {
        name: "deep equality",
        code: "assertEqual(new Map([[1, [2]]]), new Map([[1, [2]]])); assertEqual([1], [2]);",
      },
    ];
    const code = "export const double = (n: number): number => n * 2;\nconst hidden = () => 1;\n";
    const report = runHarness(bun, "typescript", code, tests);
    const [typed, prints, hangs, missing, syntax, deep] = report.results;
    expect(typed?.ok).toBe(true);
    expect(prints?.output).toBe('seen {"a":1}');
    expect(hangs?.message).toContain("did not finish within 3 s");
    expect(missing?.message).toContain("is it exported from the solution file?");
    expect(syntax?.ok).toBe(false);
    expect(deep?.message).toBe("expected [2], got [1]");
    expect(report.done).toBe(true);
  }, 20_000);
});

const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe.skipIf(!hasPython)("the Python harness, run for real (python3)", () => {
  it("passes the reference solution and fails the buggy attempt on exactly two tests", () => {
    const good = runHarness(
      "python3",
      "python",
      LINKED_LIST_EXERCISE.solution,
      LINKED_LIST_EXERCISE.tests,
    );
    expect(good.results.every((r) => r?.ok)).toBe(true);
    const buggy = runHarness("python3", "python", BUGGY_LINKED_LIST, LINKED_LIST_EXERCISE.tests);
    const failed = buggy.results.filter((r) => !r?.ok).map((r) => r?.name);
    expect(failed).toEqual(["remove the head", "reverse in place"]);
    expect(buggy.results[4]?.message).toMatch(/^AttributeError: .*\(solution\.py, line \d+\)$/);
    expect(buggy.results[7]?.message).toBe("expected [4, 3, 2, 1], got [1]");
  });

  it("catches a test whose expected value is wrong", () => {
    const report = runHarness(
      "python3",
      "python",
      BROKEN_LINKED_LIST_EXERCISE.solution,
      BROKEN_LINKED_LIST_EXERCISE.tests,
    );
    expect(summarizeReport(report, BROKEN_LINKED_LIST_EXERCISE.tests).passed).toBe(8);
  });

  it("explains bare asserts, missing names, syntax errors and load failures", () => {
    const tests: TestCase[] = [
      { name: "bare", code: "x = 1\nassert x == 2" },
      { name: "missing", code: "Queue()" },
      { name: "syntax", code: "x = = 1" },
      { name: "prints", code: "print('hi')" },
    ];
    const report = runHarness("python3", "python", "value = 1\n", tests);
    expect(report.results[0]?.message).toBe("assertion failed: assert x == 2");
    expect(report.results[1]?.message).toContain("is it defined at the top level of solution.py?");
    expect(report.results[2]?.message).toStartWith("SyntaxError");
    expect(report.results[3]).toMatchObject({ ok: true, output: "hi\n" });
    const broken = runHarness("python3", "python", "def f(:\n  pass\n", tests);
    expect(broken.loadError).toContain("SyntaxError");
    expect(broken.done).toBe(true);
  });
});
