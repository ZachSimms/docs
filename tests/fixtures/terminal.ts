/** A small site tree shared by the terminal tests: sections, a topic with a directory, projects. */
import type { SiteTree } from "@/lib/terminal/vfs";

/** A small site: two sections, a topic with a directory, and a project. */
export const TREE: SiteTree = {
  root: {
    name: "",
    title: "Home",
    href: "/",
    kind: "dir",
    children: [
      {
        name: "projects",
        title: "Projects",
        href: "/projects/",
        kind: "dir",
        children: [
          { name: "docs-site", title: "Docs site", href: "/docs/", kind: "link" },
          { name: "repo", title: "Repo", href: "https://github.com/x/y", kind: "link" },
        ],
      },
      {
        name: "docs",
        title: "Docs",
        href: "/docs/",
        kind: "dir",
        children: [
          {
            name: "python",
            title: "Python",
            href: "/python/",
            kind: "dir",
            children: [
              {
                name: "language",
                title: "Language",
                href: "/python/language/",
                kind: "dir",
                children: [
                  {
                    name: "strings",
                    title: "Strings",
                    href: "/python/language/strings/",
                    kind: "page",
                  },
                  { name: "oop", title: "OOP", href: "/python/language/oop/", kind: "page" },
                ],
              },
              {
                name: "overview",
                title: "Overview",
                href: "/python/overview/",
                kind: "page",
                date: "2026-01-01",
                source: "/source/python/overview.md",
              },
              { name: "fastapi", title: "FastAPI", href: "/python/fastapi/", kind: "page" },
            ],
          },
          { name: "physics", title: "Physics", href: "/physics/", kind: "dir", children: [] },
        ],
      },
      { name: "info", title: "Info", href: "/info/", kind: "page" },
    ],
  },
  profile: {
    name: "Z",
    fullName: "Z Z",
    role: "Engineer",
    bio: "Hi",
    links: [{ label: "GitHub", href: "https://github.com/z" }],
  },
};
