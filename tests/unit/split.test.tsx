/**
 * Unit tests for the split layout: the section list, the profile data, recent sheets,
 * the left navigation (`SiteNav`), breadcrumbs, and the grid menus (`TopicCards`,
 * `TopicIndex`) built on `useMenu`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { Page } from "@/components/Page";
import { SiteNav } from "@/components/SiteNav";
import { TopicCards } from "@/components/TopicCards";
import { TopicIndex, type TopicIndexEntry } from "@/components/TopicIndex";
import { listAllSheets, recentSheets } from "@/lib/content";
import { forgetCameFrom, rememberCameFrom } from "@/lib/keys";
import { PROFILE, RESUME, docsStats, listProjects } from "@/lib/profile";
import { SECTIONS, sectionNumber } from "@/lib/sections";
import { TOPICS } from "@/lib/topics";

const fixtures = path.join(__dirname, "..", "fixtures", "content");

/** Text of the highlighted menu rows. */
const active = () =>
  [...document.querySelectorAll("nav[data-menu] a[data-active]")].map((a) => a.textContent);

afterEach(() => forgetCameFrom());

describe("sections", () => {
  it("lists the seven sections, numbered down from 07.", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual([
      "Home",
      "Projects",
      "Blog",
      "Resume",
      "Docs",
      "Playground",
      "Info",
    ]);
    expect(SECTIONS.every((s) => s.href.startsWith("/") && s.href.endsWith("/"))).toBe(true);
    expect(sectionNumber("home")).toBe(7);
    expect(sectionNumber("info")).toBe(1);
  });
});

describe("profile", () => {
  it("describes the docs with live counts", () => {
    const stats = docsStats();
    expect(stats.sheets).toBe(listAllSheets().length);
    expect(stats.topics).toBe(TOPICS.length);
    const [docs] = listProjects();
    expect(docs?.description).toContain(
      `${stats.sheets} cheatsheets across ${stats.topics} topics`,
    );
  });

  it("links the site's projects, gives each project a stack, and adds the resume's", () => {
    const projects = listProjects();
    for (const project of projects) {
      if (project.href) expect(project.href).toMatch(/^\/|^https:\/\//);
      if (project.year) expect(project.year).toMatch(/^\d{4}$/);
      expect(project.stack.length).toBeGreaterThan(0);
    }
    expect(projects.map((p) => p.name)).toEqual([
      "Zach's Docs",
      "Playground",
      "3D Algorithm Visualizer",
    ]);
  });

  it("points GitHub at the repository owner and the resume at its PDF in public/", () => {
    expect(PROFILE.github).toBe("https://github.com/ZachSimms");
    expect(RESUME.pdf).toBe("/docs/ZachSimms_Resume_Updated.pdf");
    expect(existsSync(path.join(process.cwd(), "public", RESUME.pdf))).toBe(true);
  });

  it("has no placeholders left in the resume", () => {
    expect(JSON.stringify({ PROFILE, RESUME })).not.toMatch(/\[[A-Za-z][^\]]*\]/);
  });
});

describe("recentSheets", () => {
  it("returns the newest sheets first, same-day sheets in display order", () => {
    const recent = recentSheets(3, ["alpha", "delta"], fixtures);
    expect(recent.map((s) => `${s.topic}/${s.slug}`)).toEqual([
      "delta/also-unordered",
      "delta/unordered",
      "alpha/newest",
    ]);
  });
});

describe("SiteNav", () => {
  it("marks the section and folds the tree outside a topic", () => {
    const { container } = render(<SiteNav section="projects" />);
    const current = container.querySelector('a[aria-current="page"]');
    expect(current).toHaveTextContent("Projects");
    expect(container.querySelector(".nav-tree")).toBeNull();
    expect(container.querySelectorAll(".nav-sections > li")).toHaveLength(SECTIONS.length);
  });

  it("unfolds the docs down to a sheet inside a directory and marks the path", () => {
    const { container } = render(
      <SiteNav
        section="docs"
        docs={{ topic: "typescript", group: "language", sheet: "objects" }}
      />,
    );
    expect(container.querySelector('a[aria-current="page"]')).toHaveTextContent("Objects");
    const path = [...container.querySelectorAll('li[data-mark="path"] > a')].map(
      (a) => a.textContent,
    );
    expect(path).toEqual(["Docs", "TypeScript", "Language/"]);
    // Every topic is listed; only the current one is unfolded.
    expect(container.querySelectorAll(".nav-tree > li")).toHaveLength(TOPICS.length);
    expect(container.querySelector('a[href="/python/language/"]')).toBeNull();
    expect(container.querySelector('a[href="/typescript/react/"]')).not.toBeNull();
  });

  it("marks Docs as a parent below /docs/ even without a topic", () => {
    const { container } = render(<SiteNav section="docs" docs={{}} />);
    expect(container.querySelector('a[aria-current="page"]')).toBeNull();
    expect(container.querySelector('li[data-mark="path"] > a')).toHaveTextContent("Docs");
  });

  it("links the unfolded topic's directories and loose sheets", () => {
    render(<SiteNav section="docs" docs={{ topic: "python" }} />);
    expect(screen.getByRole("link", { name: "Language/" })).toHaveAttribute(
      "href",
      "/python/language/",
    );
    expect(screen.getByRole("link", { name: "FastAPI" })).toHaveAttribute(
      "href",
      "/python/fastapi/",
    );
  });
});

describe("Page breadcrumbs", () => {
  it("links every step but the current page", () => {
    render(
      <Page
        title="FastAPI"
        footer={{ href: "/python/", label: "../" }}
        crumbs={[
          { label: "docs", href: "/docs/" },
          { label: "python", href: "/python/" },
          { label: "fastapi" },
        ]}
      >
        <p />
      </Page>,
    );
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumbs).toHaveTextContent("docs / python / fastapi");
    expect(
      within(crumbs)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/docs/", "/python/"]);
    expect(within(crumbs).getByText("fastapi")).toHaveAttribute("aria-current", "page");
  });
});

describe("TopicCards", () => {
  const cards = [
    { href: "/a/", name: "Alpha", number: 3, count: 1 },
    { href: "/b/", name: "Beta", number: 2, count: 4 },
    { href: "/c/", name: "Gamma", number: 1, count: 0 },
  ];

  it("shows each topic's number and sheet count", () => {
    render(<TopicCards cards={cards} />);
    const alpha = screen.getByRole("link", { name: /Alpha/ });
    expect(alpha).toHaveTextContent("Alpha031 sheet");
    expect(screen.getByRole("link", { name: /Beta/ })).toHaveTextContent("4 sheets");
  });

  it("is a menu: j/k move between the cards", () => {
    render(<TopicCards cards={cards} />);
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "j" });
    expect(active()).toEqual(["Beta02" + "4 sheets"]);
  });

  it("starts on the card of the topic just left", () => {
    rememberCameFrom("/c/");
    render(<TopicCards cards={cards} />);
    expect(active()).toEqual(["Gamma010 sheets"]);
  });
});

describe("TopicIndex", () => {
  const entries: TopicIndexEntry[] = [
    { kind: "sheet", sheet: { number: 0, href: "/t/first/", label: "First" } },
    {
      kind: "folder",
      folder: {
        heading: { number: 1, href: "/t/dir/", label: "Dir/" },
        sheets: [
          { number: 0, href: "/t/dir/a/", label: "A" },
          { number: 1, href: "/t/dir/b/", label: "B" },
        ],
      },
    },
    {
      kind: "folder",
      folder: { heading: { number: 2, href: "/t/empty/", label: "Empty/" }, sheets: [] },
    },
    { kind: "sheet", sheet: { number: 3, href: "/t/last/", label: "Last" } },
  ];

  it("keeps the topic's order: loose sheets, then the directories' columns, then loose sheets", () => {
    const { container } = render(<TopicIndex entries={entries} />);
    const blocks = [...container.querySelectorAll("nav[data-menu] > *")].map((el) => el.className);
    expect(blocks).toEqual([
      "topic-folder topic-loose",
      "topic-folders",
      "topic-folder topic-loose",
    ]);
    const rows = [...container.querySelectorAll("a[data-row]")].map((a) => a.textContent);
    expect(rows).toEqual(["First", "Dir/", "A", "B", "Empty/", "Last"]);
    // Folder headings carry their sheet count; loose runs are headed "Sheets" beside directories.
    expect(container.querySelector(".topic-folders h2")).toHaveTextContent("01. Dir/2");
    expect(container.querySelector(".topic-loose h2")).toHaveTextContent("Sheets1");
  });

  it("is one menu across headings and the sheets under them", () => {
    render(<TopicIndex entries={entries} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "j" });
    expect(active()).toEqual(["Dir/"]);
    fireEvent.keyDown(window, { key: "j" });
    expect(active()).toEqual(["A"]);
    expect(document.querySelector("span[data-active]")?.textContent).toBe("00.");
  });

  it("has no Sheets heading when the topic has no directories", () => {
    const { container } = render(
      <TopicIndex entries={[{ kind: "sheet", sheet: { number: 0, href: "/t/x/", label: "X" } }]} />,
    );
    expect(container.querySelector("h2")).toBeNull();
  });
});
