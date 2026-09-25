/** Unit tests for `rankSearch` ordering and matching rules. */
import { describe, expect, it } from "bun:test";
import { docPath, rankSearch, type SearchDoc } from "@/lib/search-rank";

const doc = (partial: Partial<SearchDoc> & Pick<SearchDoc, "slug">): SearchDoc => ({
  topic: "physics",
  title: partial.slug,
  url: `/${partial.topic ?? "physics"}/${partial.slug}/`,
  headings: [],
  text: "",
  ...partial,
});

const docs: SearchDoc[] = [
  doc({ slug: "kinematics", title: "Kinematics", text: "velocity and acceleration" }),
  doc({ slug: "waves", title: "Waves", headings: ["Velocity"], text: "period frequency" }),
  doc({ slug: "energy", title: "Velocity of energy", text: "work" }),
  doc({ slug: "py", topic: "python", title: "Lists", text: "velocity list" }),
];

describe("rankSearch", () => {
  it("returns nothing for an empty or whitespace query", () => {
    expect(rankSearch(docs, "")).toEqual([]);
    expect(rankSearch(docs, "   ")).toEqual([]);
  });

  it("requires every token to match somewhere", () => {
    const hits = rankSearch(docs, "velocity python");
    expect(hits.map((h) => h.doc.slug)).toEqual(["py"]);
  });

  it("ranks title over heading over body, case-insensitively", () => {
    const hits = rankSearch(docs, "VELOCITY");
    expect(hits.map((h) => h.doc.slug)).toEqual(["energy", "waves", "kinematics", "py"]);
  });

  it("matches directory names in nested urls as part of the path", () => {
    const nested = doc({
      topic: "typescript",
      slug: "websockets",
      title: "WebSockets",
      url: "/typescript/backend/websockets/",
    });
    const hits = rankSearch([...docs, nested], "backend");
    expect(hits.map((h) => h.doc.slug)).toEqual(["websockets"]);
    expect(hits[0]?.score).toBe(2);
  });

  it("respects the limit", () => {
    expect(rankSearch(docs, "velocity", 2)).toHaveLength(2);
  });

  it("does not mutate the input", () => {
    const copy = [...docs];
    rankSearch(docs, "velocity");
    expect(docs).toEqual(copy);
  });
});

describe("docPath", () => {
  it("is the url without its outer slashes", () => {
    expect(docPath({ url: "/python/overview/" })).toBe("python/overview");
    expect(docPath({ url: "/typescript/backend/websockets/" })).toBe(
      "typescript/backend/websockets",
    );
  });
});
