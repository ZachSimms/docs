/** Unit tests for `readImageDimensions` and its path confinement. */
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { readImageDimensions } from "@/lib/images";

const publicRoot = path.join(__dirname, "..", "fixtures", "images");

describe("readImageDimensions", () => {
  it("reads width and height of a public PNG", () => {
    expect(readImageDimensions("/tiny.png", publicRoot)).toEqual({ width: 4, height: 3 });
  });

  it("returns undefined for missing files, relative paths and traversal", () => {
    expect(readImageDimensions("/missing.png", publicRoot)).toBeUndefined();
    expect(readImageDimensions("tiny.png", publicRoot)).toBeUndefined();
    expect(readImageDimensions("/../images/tiny.png", publicRoot)).toBeUndefined();
    expect(readImageDimensions("https://example.com/x.png", publicRoot)).toBeUndefined();
  });

  it("returns undefined for files that are not images", () => {
    const contentRoot = path.join(__dirname, "..", "fixtures", "content");
    expect(readImageDimensions("/beta/notes.txt", contentRoot)).toBeUndefined();
  });

  it("returns undefined for directories", () => {
    const contentRoot = path.join(__dirname, "..", "fixtures", "content");
    expect(readImageDimensions("/beta", contentRoot)).toBeUndefined();
  });
});
