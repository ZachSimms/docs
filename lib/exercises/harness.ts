/**
 * @file The test harness: turn an exercise's tests and the learner's code into a
 * playground project, and read the results back out of its output.
 *
 * The project is two files (three for Python): the learner's `solution.*` and a harness
 * entry that imports it and runs each generated test on its own, catching everything, with
 * the test's own prints captured. After each test the harness prints one line,
 * `<mark>{json}`, where the mark carries a fresh nonce per run, so ordinary output can't
 * be mistaken for a result. The project runs in the playground's sandbox like any other,
 * so the learner's code never touches the site's origin.
 *
 * Tests are snippets, not files: Python tests are `exec`'d in a copy of the solution
 * module's namespace, JS/TS tests become async functions whose parameters are the
 * solution's exports. A syntax error in one test fails only that test.
 */

import { solutionFile, type CodeLanguage } from "./options";
import type { TestCase } from "./schema";

/** The harness entry for Python (the playground runs it as `__main__`). */
export const PYTHON_HARNESS = "__exercise_tests__.py";
/** The tests, as data, beside the Python harness. */
export const PYTHON_TESTS = "__exercise_tests__.json";
/** The harness entry for JavaScript and TypeScript. */
export const JS_HARNESS = "__exercise_tests__.js";

/** Longest captured output kept per test. */
export const MAX_TEST_OUTPUT = 2000;
/** An async JS test that hasn't settled after this long fails. */
export const JS_TEST_TIMEOUT_MS = 3000;

/** A project the playground's runner can run. */
export interface HarnessProject {
  readonly files: Record<string, string>;
  readonly entry: string;
}

/**
 * The marker that starts each result line.
 *
 * @param nonce - A fresh random string per run.
 */
export function resultMark(nonce: string): string {
  return `@@exercise:${nonce}@@`;
}

/** The assertion helpers every Python test can use (named in the model's instructions). */
export const PYTHON_HELPERS = ["assert_equal", "assert_true", "assert_close", "assert_raises"];
/** The assertion helpers every JS/TS test can use (named in the model's instructions). */
export const JS_HELPERS = ["assertEqual", "assertTrue", "assertClose", "assertThrows"];

/** Python side: import the solution quietly, then exec each test in a fresh namespace. */
const PYTHON_SOURCE = String.raw`import contextlib as _cl
import io as _io
import json as _json
import os as _os
import sys as _sys
import time as _time
import traceback as _tb

_MARK = __MARK__
_OUT = _sys.stdout


def _emit(record):
    _OUT.write(_MARK + _json.dumps(record) + "\n")
    _OUT.flush()


def _label(message):
    return message + ": " if message else ""


def assert_equal(actual, expected, message=""):
    if actual != expected:
        raise AssertionError(_label(message) + "expected " + repr(expected) + ", got " + repr(actual))


def assert_true(condition, message="expected a true value"):
    if not condition:
        raise AssertionError(message)


def assert_close(actual, expected, tolerance=1e-9, message=""):
    if not abs(actual - expected) <= tolerance:
        raise AssertionError(_label(message) + "expected " + repr(expected) + " (within " + repr(tolerance) + "), got " + repr(actual))


def assert_raises(exception, fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
    except exception:
        return
    except BaseException as error:
        raise AssertionError("expected " + exception.__name__ + ", got " + type(error).__name__ + ": " + str(error))
    raise AssertionError("expected " + exception.__name__ + " to be raised")


_HELPERS = {
    "assert_equal": assert_equal,
    "assert_true": assert_true,
    "assert_close": assert_close,
    "assert_raises": assert_raises,
}


def _describe(error, source, names):
    frames = _tb.extract_tb(error.__traceback__)
    if isinstance(error, AssertionError):
        if str(error):
            return str(error)
        line = next((f.lineno for f in reversed(frames) if f.filename == "<test>"), None)
        lines = source.splitlines()
        if line and 0 < line <= len(lines):
            return "assertion failed: " + lines[line - 1].strip()
        return "assertion failed"
    text = type(error).__name__ + (": " + str(error) if str(error) else "")
    where = next((f for f in reversed(frames) if f.filename.endswith("solution.py")), None)
    if where:
        text += " (solution.py, line " + str(where.lineno) + ")"
    if isinstance(error, NameError) and getattr(error, "name", None) and error.name not in names:
        text += " - is it defined at the top level of solution.py?"
    return text


try:
    with _cl.redirect_stdout(_io.StringIO()), _cl.redirect_stderr(_io.StringIO()):
        import solution as _solution
except BaseException as _error:
    _emit({"load": "".join(_tb.format_exception(type(_error), _error, _error.__traceback__)[-3:]).strip()})
else:
    with open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "__exercise_tests__.json")) as _file:
        _tests = _json.load(_file)
    _names = set(vars(_solution))
    for _i, _test in enumerate(_tests):
        _env = dict(vars(_solution))
        _env.update(_HELPERS)
        _env["__name__"] = "__exercise_test__"
        _buffer = _io.StringIO()
        _start = _time.perf_counter()
        try:
            _code = compile(_test["code"], "<test>", "exec")
            with _cl.redirect_stdout(_buffer), _cl.redirect_stderr(_buffer):
                exec(_code, _env)
            _record = {"i": _i, "ok": True}
        except BaseException as _error:
            _record = {"i": _i, "ok": False, "message": _describe(_error, _test["code"], _names)}
        _record["ms"] = round((_time.perf_counter() - _start) * 1000, 1)
        _record["output"] = _buffer.getvalue()[-__MAX_OUTPUT__:]
        _emit(_record)
_emit({"done": True})
`;

/** JS side: every test is an async function of the solution's exports and the helpers. */
const JS_SOURCE = String.raw`import * as __solution from "./solution";

const MARK = __MARK__;
const TESTS = __TESTS__;
const TIMEOUT = __TIMEOUT__;
const MAX_OUTPUT = __MAX_OUTPUT__;
const realConsole = { ...console };
const emit = (record) => realConsole.log(MARK + JSON.stringify(record));

class AssertionError extends Error {
  name = "AssertionError";
}

function show(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return value + "n";
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return String(value);
  if (value instanceof Map) return "Map(" + show([...value]) + ")";
  if (value instanceof Set) return "Set(" + show([...value]) + ")";
  try {
    const json = JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v + "n" : v));
    return json === undefined ? String(value) : json.length > 300 ? json.slice(0, 300) + "…" : json;
  } catch {
    return String(value);
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

const label = (message) => (message ? message + ": " : "");

function assertEqual(actual, expected, message) {
  if (!deepEqual(actual, expected))
    throw new AssertionError(label(message) + "expected " + show(expected) + ", got " + show(actual));
}

function assertTrue(condition, message = "expected a true value") {
  if (!condition) throw new AssertionError(message);
}

function assertClose(actual, expected, tolerance = 1e-9, message) {
  if (!(Math.abs(actual - expected) <= tolerance))
    throw new AssertionError(
      label(message) + "expected " + show(expected) + " (within " + tolerance + "), got " + show(actual),
    );
}

function assertThrows(fn, expected, message) {
  const check = (error) => {
    if (expected && !(error instanceof expected))
      throw new AssertionError(
        label(message) + "expected " + expected.name + ", got " + (error?.name ?? typeof error) + ": " + (error?.message ?? String(error)),
      );
  };
  const missing = () => new AssertionError(label(message) + "expected " + (expected?.name ?? "an error") + " to be thrown");
  let result;
  try {
    result = fn();
  } catch (error) {
    check(error);
    return;
  }
  if (result && typeof result.then === "function")
    return result.then(
      () => {
        throw missing();
      },
      (error) => check(error),
    );
  throw missing();
}

const HELPERS = [assertEqual, assertTrue, assertClose, assertThrows];
const HELPER_NAMES = ["assertEqual", "assertTrue", "assertClose", "assertThrows"];
const AsyncFunction = (async () => {}).constructor;
const names = Object.keys(__solution).filter((n) => n !== "default" && /^[A-Za-z_$][\w$]*$/.test(n));
const values = names.map((n) => __solution[n]);

function describe(error) {
  if (error instanceof AssertionError) return error.message;
  if (!(error instanceof Error)) return "threw " + show(error);
  let text = error.message ? error.name + ": " + error.message : error.name;
  const frame = String(error.stack ?? "")
    .split("\n")
    .find((line) => /solution\.[jt]s/.test(line));
  const where = frame && /solution\.[jt]s:(\d+)/.exec(frame);
  if (where) text += " (line " + where[1] + ")";
  if (error instanceof ReferenceError) {
    const name = /^(\S+) is not defined/.exec(error.message)?.[1];
    if (name && !names.includes(name)) text += " - is it exported from the solution file?";
  }
  return text;
}

function withTimeout(promise) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("the test did not finish within " + TIMEOUT / 1000 + " s")), TIMEOUT);
    }),
  ]).finally(() => clearTimeout(timer));
}

for (const [i, test] of TESTS.entries()) {
  const output = [];
  const capture = (...args) => output.push(args.map((a) => (typeof a === "string" ? a : show(a))).join(" "));
  for (const method of ["log", "info", "warn", "error", "debug"]) console[method] = capture;
  const start = performance.now();
  let record;
  try {
    const run = new AsyncFunction(...names, ...HELPER_NAMES, '"use strict";\n' + test.code);
    await withTimeout(run(...values, ...HELPERS));
    record = { i, ok: true };
  } catch (error) {
    record = { i, ok: false, message: describe(error) };
  } finally {
    Object.assign(console, realConsole);
  }
  record.ms = Math.round((performance.now() - start) * 10) / 10;
  record.output = output.join("\n").slice(-MAX_OUTPUT);
  emit(record);
}
emit({ done: true });
`;

/**
 * Replace the `__NAME__` placeholders in one pass: inserted text (generated tests) is never
 * scanned again, and a function replacement keeps `$&` or `$1` in it literal.
 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/__[A-Z_]+__/g, (key) => values[key] ?? key);
}

/**
 * Build the project that runs `tests` against `code`.
 *
 * @param language - The exercise's language.
 * @param code - The learner's code (or the reference solution, to validate the tests).
 * @param tests - The exercise's tests; for TypeScript, already stripped of types.
 * @param nonce - A fresh random string per run (see {@link resultMark}).
 */
export function buildHarness(
  language: CodeLanguage,
  code: string,
  tests: readonly TestCase[],
  nonce: string,
): HarnessProject {
  const mark = JSON.stringify(resultMark(nonce));
  if (language === "python") {
    return {
      files: {
        [solutionFile(language)]: code,
        [PYTHON_TESTS]: JSON.stringify(tests.map(({ name, code }) => ({ name, code }))),
        [PYTHON_HARNESS]: fill(PYTHON_SOURCE, {
          __MARK__: mark,
          __MAX_OUTPUT__: String(MAX_TEST_OUTPUT),
        }),
      },
      entry: PYTHON_HARNESS,
    };
  }
  const source = fill(JS_SOURCE, {
    __MARK__: mark,
    __TESTS__: JSON.stringify(tests.map(({ name, code }) => ({ name, code }))),
    __TIMEOUT__: String(JS_TEST_TIMEOUT_MS),
    __MAX_OUTPUT__: String(MAX_TEST_OUTPUT),
  });
  return { files: { [solutionFile(language)]: code, [JS_HARNESS]: source }, entry: JS_HARNESS };
}

/** One test's result. */
export interface TestResult {
  readonly name: string;
  readonly ok: boolean;
  /** Why it failed. */
  readonly message?: string;
  /** What the test printed (the learner's `print`/`console.log`). */
  readonly output?: string;
  readonly ms?: number;
}

/** Everything a run reported. */
export interface HarnessReport {
  /** One entry per test, in order; `null` for tests that never reported (a crash or a time limit). */
  readonly results: readonly (TestResult | null)[];
  /** The solution failed to load (syntax error, error at import time). */
  readonly loadError?: string;
  /** The harness got to the end. */
  readonly done: boolean;
  /** Output that wasn't a result line: errors from the runner, prints outside tests. */
  readonly other: string;
}

/**
 * Read the results out of a run's output.
 *
 * @param output - Everything the run printed, all streams in order.
 * @param nonce - The run's nonce.
 * @param tests - The tests that were run (for their names).
 */
export function parseHarnessOutput(
  output: string,
  nonce: string,
  tests: readonly TestCase[],
): HarnessReport {
  const mark = resultMark(nonce);
  const results: (TestResult | null)[] = tests.map(() => null);
  let loadError: string | undefined;
  let done = false;
  const other: string[] = [];
  for (const line of output.split("\n")) {
    const at = line.indexOf(mark);
    if (at === -1) {
      other.push(line);
      continue;
    }
    if (at > 0) other.push(line.slice(0, at));
    let record: unknown;
    try {
      record = JSON.parse(line.slice(at + mark.length));
    } catch {
      continue;
    }
    if (typeof record !== "object" || record === null) continue;
    const r = record as Record<string, unknown>;
    if (r.done === true) done = true;
    else if (typeof r.load === "string") loadError = r.load;
    else if (typeof r.i === "number" && Number.isInteger(r.i) && r.i >= 0 && r.i < tests.length) {
      results[r.i] = {
        name: tests[r.i].name,
        ok: r.ok === true,
        message: typeof r.message === "string" ? r.message : undefined,
        output: typeof r.output === "string" && r.output !== "" ? r.output : undefined,
        ms: typeof r.ms === "number" ? r.ms : undefined,
      };
    }
  }
  return { results, loadError, done, other: other.join("\n").trim() };
}

/**
 * Sum up a report: how many passed, and a text version for the model (a repair or a review).
 *
 * @param report - A parsed run.
 * @param tests - The tests that were run.
 */
export function summarizeReport(report: HarnessReport, tests: readonly TestCase[]) {
  const passed = report.results.filter((r) => r?.ok).length;
  const lines: string[] = [];
  if (report.loadError) lines.push(`The solution failed to load:\n${report.loadError}`);
  report.results.forEach((result, i) => {
    if (result?.ok) return;
    const why = result ? (result.message ?? "failed") : "did not report (crashed or timed out)";
    lines.push(`FAILED "${tests[i].name}": ${why}\n  test code:\n${indent(tests[i].code)}`);
  });
  if (!report.done && !report.loadError && report.other)
    lines.push(`Runner output:\n${report.other.slice(-1500)}`);
  return {
    passed,
    total: tests.length,
    allPassed: passed === tests.length && !report.loadError,
    text: lines.join("\n\n"),
  };
}

/** Indent every line by four spaces. */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
