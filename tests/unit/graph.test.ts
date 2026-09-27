/** Unit tests for `lib/graph.ts`: transforms, sampling with asymptote breaks, projection, paths, ticks. */
import { describe, expect, it } from "bun:test";
import {
  FUNCTIONS,
  curveLabel,
  evaluate,
  project,
  sampleCurve,
  ticks,
  toPath,
  type Point,
} from "@/lib/graph";

describe("evaluate", () => {
  it("applies a·f(b(x − h)) + k", () => {
    expect(evaluate({ fn: "square" }, 3)).toBe(9);
    expect(evaluate({ fn: "square", k: 2 }, 3)).toBe(11);
    expect(evaluate({ fn: "square", h: 2 }, 3)).toBe(1);
    expect(evaluate({ fn: "square", a: -1 }, 3)).toBe(-9);
    expect(evaluate({ fn: "sqrt", b: -1 }, -4)).toBe(2);
  });

  it("labels curves with the catalog formula unless overridden", () => {
    expect(curveLabel({ fn: "exp" })).toBe(FUNCTIONS.exp.formula);
    expect(curveLabel({ fn: "exp", label: "custom" })).toBe("custom");
  });
});

describe("growth-rate functions (Big-O)", () => {
  it("evaluates log₂ n, n log₂ n and 2ⁿ", () => {
    expect(evaluate({ fn: "log2" }, 8)).toBe(3);
    expect(evaluate({ fn: "nlogn" }, 8)).toBe(24);
    expect(evaluate({ fn: "pow2" }, 10)).toBe(1024);
  });

  it("is undefined where log n is (n ≤ 0), so sampling skips it", () => {
    expect(Number.isFinite(evaluate({ fn: "log2" }, 0))).toBe(false);
    expect(Number.isNaN(evaluate({ fn: "nlogn" }, -1))).toBe(true);
    const segments = sampleCurve({ fn: "nlogn" }, [-2, 4], [-1, 10]);
    expect(segments.flat().every(([x]) => x > 0)).toBe(true);
  });

  it("has Big-O legends and windows that start at n = 0", () => {
    expect(curveLabel({ fn: "log2" })).toBe("log₂ n");
    expect(curveLabel({ fn: "nlogn" })).toBe("n log₂ n");
    expect(curveLabel({ fn: "pow2" })).toBe("2ⁿ");
    for (const fn of ["log2", "nlogn", "pow2"] as const) {
      expect(FUNCTIONS[fn].domain[0]).toBe(0);
    }
  });
});

describe("sampleCurve", () => {
  it("returns one continuous segment for a smooth function", () => {
    const segments = sampleCurve({ fn: "square" }, [-3, 3], [-1, 9]);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.length).toBeGreaterThan(200);
  });

  it("breaks tan into separate branches at its asymptotes", () => {
    const segments = sampleCurve({ fn: "tan" }, [-Math.PI, Math.PI], [-4, 4]);
    expect(segments.length).toBeGreaterThanOrEqual(3);
    for (const seg of segments) {
      for (const [, y] of seg) expect(Math.abs(y)).toBeLessThanOrEqual(6);
    }
  });

  it("splits 1/x into two branches and keeps 1/x² finite away from zero", () => {
    const recip = sampleCurve({ fn: "recip" }, [-4, 4], [-4, 4]);
    expect(recip).toHaveLength(2);
    expect(recip[0]!.every(([x]) => x < 0)).toBe(true);
    expect(recip[1]!.every(([x]) => x > 0)).toBe(true);
    expect(evaluate({ fn: "cube" }, 2)).toBe(8);
    expect(evaluate({ fn: "recip2" }, 2)).toBe(0.25);
  });

  it("skips undefined values such as sqrt of negatives and ln of zero", () => {
    const segments = sampleCurve({ fn: "sqrt" }, [-2, 4], [-1, 3]);
    expect(segments).toHaveLength(1);
    expect(segments[0]![0]![0]).toBeGreaterThanOrEqual(0);
    const ln = sampleCurve({ fn: "ln" }, [0, 8], [-3, 3]);
    expect(ln.every((seg) => seg.every(([x]) => x > 0))).toBe(true);
  });
});

describe("project and toPath", () => {
  const frame = { width: 100, height: 60, pad: 10 };
  const px = project(frame, [0, 10], [0, 5]);

  it("maps the window corners to the padded frame", () => {
    expect(px([0, 0])).toEqual([10, 50]);
    expect(px([10, 5])).toEqual([90, 10]);
    expect(px([5, 2.5])).toEqual([50, 30]);
  });

  it("writes M/L path data with one decimal, one M per segment", () => {
    const segs: Point[][] = [
      [
        [10, 50],
        [20.04, 40.96],
      ],
      [
        [30, 30],
        [40, 20],
      ],
    ];
    expect(toPath(segs)).toBe("M10 50 L20 41 M30 30 L40 20");
  });
});

describe("ticks", () => {
  it("lists integers in the window, skipping zero and thinning long axes", () => {
    expect(ticks([-3, 3]).map((t) => t.label)).toEqual(["-3", "-2", "-1", "1", "2", "3"]);
    expect(ticks([-10, 10]).map((t) => t.at)).toEqual([-10, -8, -6, -4, -2, 2, 4, 6, 8, 10]);
  });

  it("keeps tall axes to about ten ticks on round multiples", () => {
    expect(ticks([0, 70]).map((t) => t.at)).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(ticks([0, 100]).map((t) => t.at)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(ticks([0, 16]).map((t) => t.at)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(ticks([0, 40]).map((t) => t.at)).toEqual([5, 10, 15, 20, 25, 30, 35, 40]);
  });

  it("labels multiples of pi", () => {
    expect(ticks([-2 * Math.PI, 2 * Math.PI], "pi").map((t) => t.label)).toEqual([
      "-2π",
      "-π",
      "π",
      "2π",
    ]);
  });
});
