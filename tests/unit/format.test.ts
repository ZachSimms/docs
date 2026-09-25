/** Unit tests for `lib/format.ts`. */
import { describe, expect, it } from "bun:test";
import { formatDate, padNumber } from "@/lib/format";

describe("padNumber", () => {
  it("zero-pads single digits to two characters", () => {
    expect(padNumber(0)).toBe("00");
    expect(padNumber(9)).toBe("09");
  });

  it("leaves two or more digits untouched", () => {
    expect(padNumber(46)).toBe("46");
    expect(padNumber(123)).toBe("123");
  });

  it("rejects negative or non-integer input", () => {
    expect(() => padNumber(-1)).toThrow();
    expect(() => padNumber(1.5)).toThrow();
  });
});

describe("formatDate", () => {
  it("formats a Date as YYYY-MM-DD in UTC", () => {
    expect(formatDate(new Date(Date.UTC(2025, 11, 6)))).toBe("2025-12-06");
    expect(formatDate(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01-01");
  });
});
