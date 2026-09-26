/** Keeps the project in American English: no British spellings in content, UI text, comments or docs. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { files, rewrite } from "../../scripts/us-english";
import { toUs } from "../../scripts/us-english-rules";

const ROOT = path.join(__dirname, "..", "..");

describe("American English", () => {
  it("has no British spellings left (run `bun scripts/us-english.ts` to see and fix them)", () => {
    const found = files().flatMap((file) =>
      rewrite(readFileSync(path.join(ROOT, file), "utf8")).changes.map(
        (c) => `${file}: ${c.from} → ${c.to}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("maps British forms to US ones, keeping capitalization", () => {
    expect(toUs("Colour")).toBe("Color");
    expect(toUs("optimisation")).toBe("optimization");
    expect(toUs("cancelled")).toBe("canceled");
    expect(toUs("CENTRE")).toBe("CENTER");
    expect(toUs("analysis")).toBeNull(); // already American
    expect(toUs("fulfill")).toBeNull();
  });

  it("leaves real API names and external URLs alone", () => {
    const text = "except asyncio.CancelledError: t.cancelled() see https://example.co.uk/colour";
    expect(rewrite(text).changes).toEqual([]);
  });
});
