/** Unit tests for `lib/playground/webcontainer.ts`: Node projects in a WebContainer. */
import { describe, expect, it } from "bun:test";
import {
  fileChanges,
  needsInstall,
  nodeSupport,
  stackblitzFields,
  terminalText,
  toFileTree,
} from "@/lib/playground/webcontainer";
import { TEMPLATES } from "@/lib/playground/templates";

describe("toFileTree", () => {
  it("nests files into directories", () => {
    expect(
      toFileTree({ "package.json": "{}", "app/page.tsx": "p", "app/api/hello/route.ts": "r" }),
    ).toEqual({
      "package.json": { file: { contents: "{}" } },
      app: {
        directory: {
          "page.tsx": { file: { contents: "p" } },
          api: { directory: { hello: { directory: { "route.ts": { file: { contents: "r" } } } } } },
        },
      },
    });
  });

  it("refuses a path that is both a file and a folder", () => {
    expect(() => toFileTree({ a: "x", "a/b": "y" })).toThrow("both a file and a folder");
  });
});

describe("keeping the container in sync", () => {
  it("writes changed files and removes deleted ones", () => {
    expect(fileChanges({ a: "1", b: "2", c: "3" }, { a: "1", b: "two", d: "4" })).toEqual({
      write: [
        ["b", "two"],
        ["d", "4"],
      ],
      remove: ["c"],
    });
  });

  it("installs again only when dependencies change", () => {
    const pkg = (deps: object, name = "x") => JSON.stringify({ name, dependencies: deps });
    expect(needsInstall(undefined, pkg({}))).toBe(true);
    expect(needsInstall(pkg({ next: "16" }), pkg({ next: "16" }, "renamed"))).toBe(false);
    expect(needsInstall(pkg({ next: "16" }), pkg({ next: "16", zod: "4" }))).toBe(true);
  });
});

describe("terminalText", () => {
  it("drops colors, spinner frames and overwritten progress", () => {
    expect(terminalText("\u001b[32m✓\u001b[39m Ready in 2.1s\n")).toBe("✓ Ready in 2.1s\n");
    expect(terminalText("⠙")).toBe("");
    expect(terminalText("\\|/-\\|")).toBe("");
    expect(terminalText("-\u001b[1Gnpm error code ETARGET\n")).toBe("npm error code ETARGET\n");
    expect(terminalText("added 1 package\r\u001b[Kadded 20 packages\n")).toBe(
      "added 20 packages\n",
    );
  });
});

describe("nodeSupport", () => {
  const desktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0";
  it("needs cross-origin isolation, and never runs on iOS", () => {
    expect(
      nodeSupport({ crossOriginIsolated: true, userAgent: desktop, maxTouchPoints: 0 }),
    ).toBeNull();
    expect(nodeSupport({ crossOriginIsolated: false, userAgent: desktop, maxTouchPoints: 0 })).toBe(
      "not-isolated",
    );
    expect(
      nodeSupport({ crossOriginIsolated: true, userAgent: "iPhone OS 18", maxTouchPoints: 5 }),
    ).toBe("ios");
    // iPadOS reports a Mac user agent, but has touch points.
    expect(nodeSupport({ crossOriginIsolated: true, userAgent: desktop, maxTouchPoints: 5 })).toBe(
      "ios",
    );
  });
});

describe("stackblitzFields", () => {
  it("posts every file of the project", () => {
    const fields = new Map(stackblitzFields(TEMPLATES.nextjs, "Next.js playground"));
    expect(fields.get("project[template]")).toBe("node");
    expect(fields.get("project[files][app/page.tsx]")).toBe(TEMPLATES.nextjs.files["app/page.tsx"]);
    expect(fields.get("project[files][package.json]")).toContain('"next"');
  });
});
