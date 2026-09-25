/** Unit tests for `lib/content.ts` against `tests/fixtures/content`. */
import path from "node:path";
import { describe, expect, it } from "bun:test";
import {
  getGroupMeta,
  getGroupSheetMeta,
  getSheetMeta,
  groupHref,
  isPartial,
  isValidSegment,
  listAllGroups,
  listAllSheets,
  listGroupSheets,
  listSheets,
  listTopicEntries,
  readSheetBody,
  sheetHref,
} from "@/lib/content";

const root = path.join(__dirname, "..", "fixtures", "content");
const badRoot = path.join(__dirname, "..", "fixtures", "bad");
const badGroupsRoot = path.join(__dirname, "..", "fixtures", "bad-groups");
const topics = ["alpha", "beta"] as const;

describe("listSheets", () => {
  it("returns unordered sheets newest first, numbered 0 from the top down", () => {
    const sheets = listSheets("alpha", root);
    expect(sheets.map((s) => s.slug)).toEqual(["newest", "oldest", "rich"]);
    expect(sheets.map((s) => s.number)).toEqual([0, 1, 2]);
  });

  it("puts sheets with an `order` first, ascending, then the rest newest first", () => {
    const sheets = listSheets("delta", root);
    expect(sheets.map((s) => s.slug)).toEqual(["first", "second", "also-unordered", "unordered"]);
    expect(sheets.map((s) => s.number)).toEqual([0, 1, 2, 3]);
    expect(sheets.map((s) => s.order)).toEqual([1, 2, undefined, undefined]);
  });

  it("carries title, topic and a YYYY-MM-DD date string", () => {
    const [newest] = listSheets("alpha", root);
    expect(newest).toMatchObject({
      topic: "alpha",
      slug: "newest",
      title: "Newest sheet",
      date: "2026-05-05",
    });
  });

  it("accepts quoted date strings and ignores non-mdx files", () => {
    const sheets = listSheets("beta", root);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.date).toBe("2025-03-03");
  });

  it("ignores _-prefixed partials without reading them", () => {
    expect(listSheets("alpha", root).map((s) => s.slug)).not.toContain("_partial");
    expect(isPartial("_shared.mdx")).toBe(true);
    expect(isPartial("shared.mdx")).toBe(false);
  });

  it("returns an empty list for a topic with no directory", () => {
    expect(listSheets("gamma", root)).toEqual([]);
  });

  it("throws a descriptive error for invalid frontmatter", () => {
    expect(() => listSheets("alpha", badRoot)).toThrow(/broken\.mdx/);
  });
});

describe("listAllSheets", () => {
  it("merges topics, sorts newest first and numbers globally from the top", () => {
    const all = listAllSheets(topics, root);
    expect(all.map((s) => `${s.topic}/${s.slug}`)).toEqual([
      "alpha/newest",
      "beta/middle",
      "alpha/oldest",
      "alpha/rich",
    ]);
    expect(all.map((s) => s.number)).toEqual([0, 1, 2, 3]);
  });

  it("leads with ordered sheets across topics, then the unordered ones newest first", () => {
    const all = listAllSheets([...topics, "delta"], root);
    expect(all.map((s) => `${s.topic}/${s.slug}`)).toEqual([
      "delta/first",
      "delta/second",
      "delta/also-unordered",
      "delta/unordered",
      "alpha/newest",
      "beta/middle",
      "alpha/oldest",
      "alpha/rich",
    ]);
  });
});

describe("getSheetMeta", () => {
  it("finds a sheet by topic and slug", () => {
    expect(getSheetMeta("beta", "middle", root)?.title).toBe("Middle sheet");
  });

  it("returns undefined when the sheet does not exist", () => {
    expect(getSheetMeta("beta", "missing", root)).toBeUndefined();
    expect(getSheetMeta("gamma", "missing", root)).toBeUndefined();
  });
});

describe("segment validation", () => {
  it("never reads outside the content root for traversal-shaped segments", () => {
    expect(listSheets("../fixtures", root)).toEqual([]);
    expect(listSheets("alpha/../beta", root)).toEqual([]);
    expect(getSheetMeta("alpha", "../oldest", root)).toBeUndefined();
    expect(getSheetMeta("alpha", "Newest", root)).toBeUndefined();
  });

  it("accepts lowercase kebab-case only", () => {
    expect(isValidSegment("ml-ai")).toBe(true);
    expect(isValidSegment("c++")).toBe(false);
    expect(isValidSegment("-lead")).toBe(false);
    expect(isValidSegment("")).toBe(false);
  });
});

describe("directories (groups)", () => {
  it("lists a topic's directories and loose sheets together in display order", () => {
    const entries = listTopicEntries("epsilon", root);
    expect(entries.map((e) => `${e.kind}:${e.slug}`)).toEqual([
      "group:grp",
      "sheet:loose",
      "group:other",
      "group:empty",
    ]);
    expect(entries.map((e) => e.number)).toEqual([0, 1, 2, 3]);
    expect(entries[0]).toMatchObject({ kind: "group", title: "Group", order: 1 });
  });

  it("keeps listSheets to the loose sheets of a topic", () => {
    expect(listSheets("epsilon", root).map((s) => s.slug)).toEqual(["loose"]);
  });

  it("lists a directory's sheets in order, skipping index.mdx, partials and non-mdx files", () => {
    const sheets = listGroupSheets("epsilon", "grp", root);
    expect(sheets.map((s) => s.slug)).toEqual(["b", "a"]);
    expect(sheets.map((s) => s.number)).toEqual([0, 1]);
    expect(sheets.every((s) => s.group === "grp" && s.topic === "epsilon")).toBe(true);
  });

  it("returns no sheets for unknown or unsafe directories", () => {
    expect(listGroupSheets("epsilon", "missing", root)).toEqual([]);
    expect(listGroupSheets("epsilon", "../alpha", root)).toEqual([]);
    expect(listGroupSheets("epsilon", "_drafts", root)).toEqual([]);
    expect(listGroupSheets("epsilon", ".hidden", root)).toEqual([]);
    expect(listGroupSheets("epsilon", "empty", root)).toEqual([]);
  });

  it("reads directory metadata from index.mdx", () => {
    expect(getGroupMeta("epsilon", "other", root)?.number).toBe(2);
    expect(getGroupMeta("epsilon", "grp", root)).toMatchObject({
      topic: "epsilon",
      slug: "grp",
      title: "Group",
      date: "2024-01-01",
    });
    expect(getGroupMeta("epsilon", "loose", root)).toBeUndefined();
    expect(getGroupMeta("epsilon", "../beta", root)).toBeUndefined();
    expect(getGroupMeta("epsilon", "_drafts", root)).toBeUndefined();
  });

  it("finds a sheet inside a directory", () => {
    expect(getGroupSheetMeta("epsilon", "grp", "a", root)?.title).toBe("A sheet");
    expect(getGroupSheetMeta("epsilon", "grp", "index", root)).toBeUndefined();
    expect(getGroupSheetMeta("epsilon", "other", "a", root)).toBeUndefined();
    expect(getGroupSheetMeta("epsilon", "grp", "../loose", root)).toBeUndefined();
  });

  it("includes grouped sheets in listAllSheets and lists every directory", () => {
    const all = listAllSheets(["epsilon"], root);
    expect(all.map(sheetHref)).toEqual([
      "/epsilon/grp/b/",
      "/epsilon/grp/a/",
      "/epsilon/loose/",
      "/epsilon/other/c/",
    ]);
    const groups = listAllGroups(["epsilon", "alpha"], root);
    expect(groups.map(groupHref)).toEqual(["/epsilon/grp/", "/epsilon/other/", "/epsilon/empty/"]);
    // Numbered by position in the topic's mixed list (the loose sheet sits at 1).
    expect(groups.map((g) => g.number)).toEqual([0, 2, 3]);
  });

  it("builds hrefs with and without a directory", () => {
    expect(sheetHref({ topic: "t", slug: "s" })).toBe("/t/s/");
    expect(sheetHref({ topic: "t", group: "g", slug: "s" })).toBe("/t/g/s/");
    expect(groupHref({ topic: "t", slug: "g" })).toBe("/t/g/");
  });

  it("reads the body of loose and grouped sheets", () => {
    expect(readSheetBody({ topic: "epsilon", slug: "loose" }, root)).toContain(
      "directly in the topic",
    );
    expect(readSheetBody({ topic: "epsilon", group: "grp", slug: "a" }, root)).toContain(
      "## Alpha heading",
    );
    expect(() => readSheetBody({ topic: "epsilon", group: "..", slug: "a" }, root)).toThrow(
      /Invalid sheet path/,
    );
  });

  it("fails loudly on a directory without index.mdx", () => {
    expect(() => listTopicEntries("noindex", badGroupsRoot)).toThrow(/noindex\/dir.*index\.mdx/);
  });

  it("fails loudly when a directory and a sheet share a slug", () => {
    expect(() => listTopicEntries("clash", badGroupsRoot)).toThrow(/same.*share a URL/);
  });

  it("fails loudly on directories nested more than one level", () => {
    expect(() => listTopicEntries("deep", badGroupsRoot)).toThrow(/grp\/inner/);
    expect(() => listTopicEntries("badnested", badGroupsRoot)).toThrow(/grp\/Sub_Dir/);
  });

  it("fails loudly on a directory name that is not lowercase kebab-case", () => {
    expect(() => listTopicEntries("badname", badGroupsRoot)).toThrow(/Web_APIs.*kebab-case/);
  });

  it("reserves index.mdx for directories", () => {
    expect(() => listTopicEntries("topicindex", badGroupsRoot)).toThrow(/index\.mdx.*reserved/);
  });

  it("validates index.mdx frontmatter", () => {
    expect(() => listTopicEntries("badindex", badGroupsRoot)).toThrow(/index\.mdx.*title/);
  });
});
