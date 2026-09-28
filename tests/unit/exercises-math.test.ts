/** Checking numeric math answers locally: the expression parser, value lists and tolerances. */
import { describe, expect, it } from "bun:test";
import { checkNumeric, evaluate, plainMath, readValues } from "@/lib/exercises/math-answer";
import type { MathAnswer } from "@/lib/exercises/schema";

const close = (actual: number | null, expected: number) => {
  expect(actual).not.toBeNull();
  expect(actual!).toBeCloseTo(expected, 10);
};

describe("evaluate", () => {
  it("does arithmetic with precedence, powers and unary minus", () => {
    expect(evaluate("3/4")).toBe(0.75);
    expect(evaluate("1 + 2 * 3")).toBe(7);
    expect(evaluate("(1+2)*(3+4)")).toBe(21);
    expect(evaluate("-2^2")).toBe(-4);
    expect(evaluate("2^-1")).toBe(0.5);
    expect(evaluate("2^3^2")).toBe(512);
    expect(evaluate("10**2")).toBe(100);
    expect(evaluate("1e3")).toBe(1000);
    expect(evaluate(".5")).toBe(0.5);
    expect(evaluate("75%")).toBe(0.75);
  });

  it("knows constants, functions and implicit multiplication", () => {
    close(evaluate("2pi"), 2 * Math.PI);
    close(evaluate("2π"), 2 * Math.PI);
    close(evaluate("3√2"), 3 * Math.SQRT2);
    close(evaluate("sqrt(2)"), Math.SQRT2);
    close(evaluate("sin(pi/2)^2"), 1);
    close(evaluate("ln(e)"), 1);
    close(evaluate("log(1000)"), 3);
    expect(evaluate("2(3)")).toBe(6);
    expect(evaluate("abs(-3)")).toBe(3);
  });

  it("reads simple LaTeX and Unicode", () => {
    expect(evaluate("\\frac{3}{4}")).toBe(0.75);
    expect(evaluate("\\dfrac{1}{4}")).toBe(0.25);
    close(evaluate("\\frac{\\sqrt{3}}{2}"), Math.sqrt(3) / 2);
    close(evaluate("2\\pi"), 2 * Math.PI);
    expect(evaluate("3 \\cdot 4")).toBe(12);
    expect(evaluate("6 ÷ 3 × 2")).toBe(4);
    expect(evaluate("−5")).toBe(-5);
    expect(evaluate("3²")).toBe(9);
    expect(evaluate("$\\left(2\\right)$")).toBe(2);
    expect(plainMath("\\sqrt{x}")).toBe("sqrt(x)");
  });

  it("refuses anything it can't read, without evaluating code", () => {
    for (const input of [
      "",
      "2x",
      "x",
      "1/0",
      "(1",
      "1)",
      "2 +",
      "alert(1)",
      "sqrt",
      "1..2",
      "2 3",
      "#",
      "0/0",
    ]) {
      expect(evaluate(input)).toBeNull();
    }
  });
});

describe("readValues", () => {
  it("splits lists and strips variable names", () => {
    expect(readValues("x = 2, x = -3", 2)).toEqual([2, -3]);
    expect(readValues("2 or -3", 2)).toEqual([2, -3]);
    expect(readValues("x_1 = 1; x_2 = 4", 2)).toEqual([1, 4]);
    expect(readValues("{1, 2}", 2)).toEqual([1, 2]);
    expect(readValues("(sqrt(4), -1)", 2)).toEqual([2, -1]);
    expect(readValues("1 and 2", 2)).toEqual([1, 2]);
  });

  it("expands ± into both signs", () => {
    expect(readValues("±2", 2)).toEqual([2, -2]);
    expect(readValues("x = \\pm 3", 2)).toEqual([3, -3]);
    expect(readValues("+-1", 2)).toEqual([1, -1]);
  });

  it("reads 1,000 as a thousand when one value is expected", () => {
    expect(readValues("1,000", 1)).toEqual([1000]);
    expect(readValues("1,000", 2)).toEqual([1, 0]);
    expect(readValues("-12,345.5", 1)).toEqual([-12345.5]);
  });

  it("keeps a bracketed expression whole", () => {
    expect(readValues("(1+2)*(3+4)")).toEqual([21]);
  });

  it("gives up on any unreadable part", () => {
    expect(readValues("2, x+1", 2)).toBeNull();
    expect(readValues(" , ", 2)).toBeNull();
  });
});

describe("checkNumeric", () => {
  const roots: MathAnswer = { kind: "numeric", display: "", values: [2, -3], tolerance: 0 };

  it("accepts the values in any order and form", () => {
    expect(checkNumeric("-3, 2", roots).status).toBe("correct");
    expect(checkNumeric("x = 2 or x = -3", roots).status).toBe("correct");
    expect(checkNumeric("\\frac{4}{2}, -3", roots).status).toBe("correct");
  });

  it("rejects wrong values and the wrong number of values", () => {
    expect(checkNumeric("3, 2", roots)).toEqual({ status: "incorrect", values: [3, 2] });
    expect(checkNumeric("2", roots).status).toBe("incorrect");
    expect(checkNumeric("2, -3, 1", roots).status).toBe("incorrect");
  });

  it("uses the problem's tolerance, and a tiny relative one otherwise", () => {
    const rounded: MathAnswer = {
      kind: "numeric",
      display: "",
      values: [Math.PI],
      tolerance: 0.005,
    };
    expect(checkNumeric("3.14", rounded).status).toBe("correct");
    expect(checkNumeric("3.13", rounded).status).toBe("incorrect");
    const exact: MathAnswer = { kind: "numeric", display: "", values: [Math.SQRT2], tolerance: 0 };
    expect(checkNumeric("√2", exact).status).toBe("correct");
    expect(checkNumeric("1.414", exact).status).toBe("incorrect");
    const big: MathAnswer = { kind: "numeric", display: "", values: [1e12 / 3], tolerance: 0 };
    expect(checkNumeric("1e12/3", big).status).toBe("correct");
  });

  it("leaves non-numeric answers and unreadable input to the model", () => {
    expect(checkNumeric("2x+1", roots)).toEqual({ status: "unreadable" });
    const expression: MathAnswer = { kind: "expression", display: "2x", values: [], tolerance: 0 };
    expect(checkNumeric("2", expression)).toEqual({ status: "unreadable" });
    const empty: MathAnswer = { kind: "numeric", display: "", values: [], tolerance: 0 };
    expect(checkNumeric("2", empty)).toEqual({ status: "unreadable" });
  });
});
