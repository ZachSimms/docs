/** Unit tests for `lib/posts.ts` against `tests/fixtures/posts`. */
import path from "node:path";
import { describe, expect, it } from "bun:test";
import {
  getPost,
  listPosts,
  postHref,
  postsByYear,
  readPostBody,
  readingMinutes,
} from "@/lib/posts";

const fixtures = path.join(__dirname, "..", "fixtures");
const root = path.join(fixtures, "posts");

describe("listPosts", () => {
  it("lists published posts newest first, same-day posts by slug, drafts and other files left out", () => {
    expect(listPosts(root).map((post) => post.slug)).toEqual(["hello-world", "same-day", "older"]);
  });

  it("normalizes frontmatter: dates as YYYY-MM-DD, tags default to none", () => {
    const [hello, sameDay, older] = listPosts(root);
    expect(hello).toMatchObject({
      title: "Hello world",
      date: "2026-01-02",
      summary: "The first post.",
      tags: ["meta", "notes"],
      minutes: 1,
    });
    expect(sameDay?.date).toBe("2026-01-02");
    expect(older?.tags).toEqual([]);
    expect(older).not.toHaveProperty("summary");
  });

  it("means no posts when the folder is missing", () => {
    expect(listPosts(path.join(fixtures, "no-such-folder"))).toEqual([]);
  });

  it("fails on invalid frontmatter, naming the file", () => {
    expect(() => listPosts(path.join(fixtures, "bad-posts", "frontmatter"))).toThrow(
      /Invalid frontmatter in .*broken\.mdx: title/,
    );
  });

  it("fails on a file name that is not kebab-case", () => {
    expect(() => listPosts(path.join(fixtures, "bad-posts", "name"))).toThrow(
      /Bad_Name\.mdx" must be lowercase kebab-case/,
    );
  });
});

describe("getPost and readPostBody", () => {
  it("finds a post by slug and rejects unknown or unsafe slugs", () => {
    expect(getPost("older", root)?.title).toBe("An older post");
    expect(getPost("missing", root)).toBeUndefined();
    expect(getPost("../posts/older", root)).toBeUndefined();
    expect(getPost("_draft", root)).toBeUndefined();
  });

  it("returns the body without frontmatter and refuses unsafe slugs", () => {
    expect(readPostBody("hello-world", root)).toContain("## A heading");
    expect(readPostBody("hello-world", root)).not.toContain("title:");
    expect(() => readPostBody("../x", root)).toThrow(/Invalid post slug/);
  });
});

describe("helpers", () => {
  it("estimates reading time at 200 words a minute, at least one", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("word ".repeat(200))).toBe(1);
    expect(readingMinutes("word ".repeat(700))).toBe(4);
  });

  it("groups posts by year, newest year first, keeping order", () => {
    const years = postsByYear(listPosts(root));
    expect(years.map((y) => y.year)).toEqual(["2026", "2025"]);
    expect(years[0]?.posts.map((p) => p.slug)).toEqual(["hello-world", "same-day"]);
    expect(postsByYear([])).toEqual([]);
  });

  it("builds post URLs with the trailing slash", () => {
    expect(postHref({ slug: "hello-world" })).toBe("/blog/hello-world/");
  });
});
