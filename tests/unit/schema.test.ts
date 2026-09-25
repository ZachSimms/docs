/** Unit tests for the frontmatter schema. */
import { describe, expect, it } from "bun:test";
import { frontmatterSchema } from "@/lib/schema";

describe("frontmatterSchema", () => {
  it("accepts a YAML Date and normalises it to YYYY-MM-DD", () => {
    const parsed = frontmatterSchema.parse({ title: "T", date: new Date(Date.UTC(2026, 8, 4)) });
    expect(parsed.date).toBe("2026-09-04");
  });

  it("accepts an ISO date string untouched", () => {
    expect(frontmatterSchema.parse({ title: "T", date: "2025-03-03" }).date).toBe("2025-03-03");
  });

  it("accepts an optional non-negative integer `order` and rejects anything else", () => {
    expect(frontmatterSchema.parse({ title: "T", date: "2025-03-03" }).order).toBeUndefined();
    expect(frontmatterSchema.parse({ title: "T", date: "2025-03-03", order: 0 }).order).toBe(0);
    expect(frontmatterSchema.parse({ title: "T", date: "2025-03-03", order: 7 }).order).toBe(7);
    expect(() => frontmatterSchema.parse({ title: "T", date: "2025-03-03", order: -1 })).toThrow();
    expect(() => frontmatterSchema.parse({ title: "T", date: "2025-03-03", order: 1.5 })).toThrow();
    expect(() => frontmatterSchema.parse({ title: "T", date: "2025-03-03", order: "1" })).toThrow();
  });

  it("rejects free-form date strings, missing dates and blank titles", () => {
    expect(() => frontmatterSchema.parse({ title: "T", date: "May 5 2026" })).toThrow();
    expect(() => frontmatterSchema.parse({ title: "T" })).toThrow();
    expect(() => frontmatterSchema.parse({ title: "  ", date: "2025-03-03" })).toThrow();
  });
});
