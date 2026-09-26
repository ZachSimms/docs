/** Playwright tests for `/playground/` on desktop: runners, files, reference panel and the sandbox's security. */
import { expect, test } from "@playwright/test";
import { fixture, openPlayground, output, run, setCode, stubJson } from "./playground-helpers";

test.describe("playground: running code", () => {
  test("the home page links to the playground", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer a", { hasText: "Playground" }).click();
    await expect(page).toHaveURL(/\/playground\/$/);
    await expect(page.locator(".cm-editor")).toBeVisible();
  });

  test("TypeScript runs across files, with imports from lib/", async ({ page }) => {
    await openPlayground(page, "typescript");
    await run(page);
    await expect(output(page)).toContainText("Hello, playground!");
    await expect(output(page)).toContainText("2 + 3 = 5");
    await expect(output(page)).toContainText("{ count: 4, mean: 2.5 }");
    await expect(page.locator(".pg-console .pg-status")).toContainText("exit 0");
  });

  test("files can be created, imported, renamed and deleted", async ({ page }) => {
    await openPlayground(page, "javascript");
    await page.getByRole("button", { name: "+ file" }).click();
    const name = page.getByRole("textbox", { name: "New file name" });
    await name.fill("extra.js");
    await name.press("Enter");
    await expect(page.locator(".pg-tab[data-active]")).toContainText("extra.js");
    await setCode(page, "export const extra = 42;");
    await page.getByRole("button", { name: "main.js", exact: true }).click();
    await setCode(page, 'import { extra } from "./extra.js";\nconsole.log("extra", extra);');
    await run(page);
    await expect(output(page)).toContainText("extra 42");

    const row = page.locator('[role="treeitem"][data-path="extra.js"]');
    await row.focus();
    await page.keyboard.press("F2");
    const rename = page.getByRole("textbox", { name: "Rename extra.js" });
    await rename.fill("more.js");
    await rename.press("Enter");
    await expect(page.locator('[role="treeitem"][data-path="more.js"]')).toBeVisible();

    await page.getByRole("button", { name: "Actions for more.js" }).click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByRole("button", { name: "yes" }).click();
    await expect(page.locator('[role="treeitem"][data-path="more.js"]')).toHaveCount(0);
    await run(page);
    await expect(output(page)).toContainText('Cannot find "./extra.js" imported from main.js');
  });

  test("the web preview updates as you type and forwards its console", async ({ page }) => {
    await openPlayground(page, "web");
    const preview = page.frameLocator(".pg-preview-frame");
    await preview.getByRole("button", { name: "B" }).click();
    await expect(preview.locator("#out")).toHaveText("You clicked B");
    await expect(output(page)).toContainText("clicked B");
    await page
      .getByRole("button", { name: "util.js", exact: true })
      .or(page.locator('[role="treeitem"][data-path="js/util.js"]'))
      .first()
      .click();
    await setCode(page, "export const label = (el) => `Pressed ${el.textContent}`;");
    await expect(async () => {
      await preview.getByRole("button", { name: "C" }).click();
      await expect(preview.locator("#out")).toHaveText("Pressed C", { timeout: 500 });
    }).toPass({ timeout: 5000 });
  });

  test("C++ builds with CMake on Compiler Explorer, and falls back to Wandbox", async ({
    page,
  }) => {
    await openPlayground(page, "cpp");
    await stubJson(
      page,
      "https://godbolt.org/api/compiler/g162/cmake",
      fixture("ce-cmake-ok.json"),
    );
    await run(page);
    await expect(output(page)).toHaveText("5 7");
    await expect(page.getByText(/logged for 32 days/)).toBeVisible();

    await page.unroute("https://godbolt.org/api/compiler/g162/cmake");
    await stubJson(page, "https://godbolt.org/api/compiler/g162/cmake", {}, 503);
    await stubJson(page, "https://wandbox.org/api/compile.json", fixture("wandbox-ok.json"));
    await page.waitForTimeout(3100); // the cooldown between remote runs
    await run(page);
    await expect(output(page)).toContainText(
      "Compiler Explorer is unavailable (HTTP 503); trying Wandbox",
    );
    await expect(output(page)).toContainText("42");
  });

  test("Rust modules are inlined and compiler positions point at the module file", async ({
    page,
  }) => {
    await openPlayground(page, "rust");
    let sent = "";
    await page.route("https://godbolt.org/api/compiler/r1980/compile", async (route) => {
      if (route.request().method() === "POST")
        sent = JSON.parse(route.request().postData() ?? "{}").source;
      await route.fulfill({
        status: route.request().method() === "OPTIONS" ? 204 : 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type, accept",
        },
        contentType: "application/json",
        body: JSON.stringify({
          code: -1,
          didExecute: false,
          stdout: [],
          stderr: [{ text: "Build failed" }],
          buildResult: { code: 1, stderr: [{ text: "error: x --> <source>:2:5" }] },
        }),
      });
    });
    await run(page);
    expect(sent).toContain("mod geometry {");
    expect(sent).toContain("pub mod shapes {");
    await expect(output(page)).toContainText("src/geometry.rs:1:5");
  });

  test("GDScript runs on the self-hosted Godot build, with preload across files", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openPlayground(page, "gdscript");
    await run(page, 90_000);
    await expect(output(page)).toContainText("Hello from Godot 4.7");
    await expect(output(page)).toContainText("5! = 120");
    await expect(
      page.getByRole("region", { name: "Godot view" }).locator("iframe"),
    ).toHaveAttribute("sandbox", "allow-scripts");
  });

  test("Python runs with Pyodide (network)", async ({ page }) => {
    test.skip(!process.env.E2E_NETWORK, "set E2E_NETWORK=1 to download Pyodide from jsDelivr");
    test.setTimeout(120_000);
    await openPlayground(page, "python");
    await page.getByRole("button", { name: /Run/ }).click();
    await page.getByRole("button", { name: "download and run" }).click();
    await expect(page.locator(".pg-console .pg-status")).toHaveText(/ran in/, { timeout: 90_000 });
    await expect(output(page)).toContainText("area of r=2.0: 12.566");
    await expect(output(page)).toContainText("hello world");
  });

  test("the draft survives a reload", async ({ page }) => {
    await openPlayground(page, "javascript");
    await setCode(page, 'console.log("kept");');
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator(".cm-content")).toContainText('console.log("kept");');
  });
});

test.describe("playground: reference panel", () => {
  test("searches sheets and shows one beside the code, without site chrome, in the page's theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openPlayground(page, "web");
    await page.getByRole("button", { name: /Refs/ }).click();
    const panel = page.getByRole("complementary", { name: "Reference sheets" });
    await expect(panel.getByRole("option").first()).toContainText("design/css/css");
    await page.getByRole("combobox", { name: "Search reference sheets" }).fill("flexbox");
    await expect(panel.getByRole("option").first()).toContainText("design/css");
    await page.getByRole("combobox", { name: "Search reference sheets" }).press("Enter");
    const sheet = page.frameLocator(".pg-refs-frame");
    await expect(sheet.locator("html")).toHaveAttribute("data-embed", "");
    await expect(sheet.locator(".theme-toggle-rail")).toBeHidden();
    await expect(sheet.locator("footer")).toBeHidden();
    await expect(sheet.locator("main h1")).toBeVisible();
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(sheet.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("⌘K opens the chosen sheet in the panel instead of leaving the code", async ({ page }) => {
    await openPlayground(page, "gdscript");
    await page.locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox", { name: "Search cheatsheets" }).fill("gdscript signals");
    await page.getByRole("combobox", { name: "Search cheatsheets" }).press("Enter");
    await expect(page).toHaveURL(/\/playground\/$/);
    await expect(page.locator(".pg-refs-frame")).toHaveAttribute("src", /\/game-dev\/godot\//);
  });
});

test.describe("playground: official docs", () => {
  const HOSTILE_MAP = [
    "<h1>Array.prototype.map()</h1>",
    "<p>The <code>map()</code> method creates a new array.</p>",
    "<script>window.top.pwned = 'script'</script>",
    `<img src="x.png" onerror="window.top.pwned = 'onerror'">`,
    `<form action="https://evil.test"><input name="q"></form>`,
    `<p><a href="../array">Array</a> · <a href="#syntax">Syntax</a> · <a href="https://tc39.es/">spec</a></p>`,
    `<h2 id="syntax">Syntax</h2>`,
  ].join("");

  test("searches DevDocs, renders a sanitized MDN page with attribution, and follows its links", async ({
    page,
  }) => {
    await page.route("https://documents.devdocs.io/**", (route) => {
      const url = new URL(route.request().url());
      const json = (entries: unknown[]) => route.fulfill({ json: { entries } });
      if (url.pathname === "/javascript/index.json")
        return json([
          { name: "Array.prototype.map()", path: "global_objects/array/map", type: "Array" },
          { name: "Array", path: "global_objects/array", type: "Array" },
        ]);
      if (url.pathname.endsWith("/index.json")) return json([]);
      if (url.pathname === "/javascript/global_objects/array/map.html")
        return route.fulfill({ body: HOSTILE_MAP, contentType: "text/html" });
      if (url.pathname === "/javascript/global_objects/array.html")
        return route.fulfill({ body: "<h1>Array</h1>", contentType: "text/html" });
      return route.fulfill({ status: 404 });
    });
    await openPlayground(page, "web");
    await page.getByRole("button", { name: /Refs/ }).click();
    await page.getByRole("tab", { name: "Docs" }).click();
    const box = page.getByRole("combobox", { name: "Search the official docs" });
    await box.fill("map");
    const results = page.getByRole("listbox", { name: "Docs" });
    await expect(results.getByRole("option").first()).toContainText("Array.prototype.map()");
    await box.press("Enter");

    const doc = page.frameLocator(".pg-docs-frame");
    await expect(doc.locator("h1")).toHaveText("Array.prototype.map()");
    await expect(doc.locator(".pg-doc-footer")).toContainText("MDN contributors");
    await expect(doc.locator(".pg-doc-footer")).toContainText("via DevDocs");
    await expect(doc.locator("script, form, input, [onerror]")).toHaveCount(0);
    expect(await page.evaluate(() => (window as { pwned?: string }).pwned)).toBeUndefined();
    await expect(page.getByRole("link", { name: /official/ })).toHaveAttribute(
      "href",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/global_objects/array/map",
    );

    await page.context().route("https://tc39.es/**", (route) => route.fulfill({ body: "spec" }));
    const popup = page.waitForEvent("popup");
    await doc.getByRole("link", { name: "spec" }).click();
    await (await popup).waitForURL("https://tc39.es/");

    await doc.getByRole("link", { name: "Array", exact: true }).click();
    await expect(doc.locator("h1")).toHaveText("Array");
    await page.getByRole("button", { name: "← back" }).click();
    await expect(doc.locator("h1")).toHaveText("Array.prototype.map()");
  });
});

test.describe("playground: security", () => {
  test("user code runs at an opaque origin, without the site's storage", async ({ page }) => {
    await openPlayground(page, "javascript");
    await setCode(page, 'console.log("origin", self.origin, typeof localStorage);');
    await run(page);
    await expect(output(page)).toContainText("origin null undefined");
    const frame = await page.locator('iframe[title="Code runner"]').elementHandle();
    expect(await (await frame!.contentFrame())!.evaluate(() => self.origin)).toBe("null");
  });

  test("the preview is sandboxed: no storage, and alert() doesn't block", async ({ page }) => {
    await openPlayground(page, "web");
    await page.locator('[role="treeitem"][data-path="js/main.js"]').click();
    await setCode(
      page,
      'console.log("origin", window.origin);\ntry { localStorage.length; console.log("storage open"); } catch { console.log("storage blocked"); }\nalert("hi");\nconsole.log("after alert");',
    );
    await expect(output(page)).toContainText("origin null", { timeout: 5000 });
    await expect(output(page)).toContainText("storage blocked");
    await expect(output(page)).toContainText("after alert");
  });

  test("messages that don't come from the sandbox frame are ignored", async ({ page }) => {
    await openPlayground(page, "typescript");
    await run(page);
    await page.evaluate(() => {
      for (const token of ["", "guess"]) {
        window.postMessage({ type: "out", token, stream: "stdout", text: "FORGED" }, "*");
      }
    });
    await page.waitForTimeout(300);
    await expect(output(page)).not.toContainText("FORGED");
  });

  test("an endless loop is stopped by the time limit and the page stays responsive", async ({
    page,
  }) => {
    test.setTimeout(40_000);
    await openPlayground(page, "javascript");
    await setCode(page, "while (true) {}");
    await page.getByRole("button", { name: /Run/ }).click();
    await page.getByRole("button", { name: /Refs/ }).click();
    await expect(page.getByRole("complementary", { name: "Reference sheets" })).toBeVisible();
    await expect(output(page)).toContainText("Stopped: the program took longer than 10 s.", {
      timeout: 15_000,
    });
    await setCode(page, 'console.log("again");');
    await run(page);
    await expect(output(page)).toContainText("again");
  });

  test("Stop ends a run at once", async ({ page }) => {
    await openPlayground(page, "javascript");
    await setCode(page, "while (true) {}");
    await page.getByRole("button", { name: /Run/ }).click();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.locator(".pg-console .pg-status")).toHaveText("stopped");
  });

  test("a program that fakes 'done' still can't outlive the time limit", async ({ page }) => {
    test.setTimeout(40_000);
    await openPlayground(page, "javascript");
    await setCode(
      page,
      'self.postMessage({ type: "done", exitCode: 0 });\nself.postMessage({ type: "progress", text: "running" });\nsetInterval(() => console.log("tick"), 250);',
    );
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(page.locator(".pg-console .pg-status")).toContainText("ran in");
    await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(11_000); // past the 10 s cap from the start of the run
    const ticks = (await output(page).innerText()).split("tick").length;
    await page.waitForTimeout(1_000);
    expect((await output(page).innerText()).split("tick").length).toBe(ticks);
  });

  test("Stop also ends timers left running after a run finished", async ({ page }) => {
    await openPlayground(page, "javascript");
    await setCode(page, 'setInterval(() => console.log("tick"), 100);');
    await run(page);
    await page.getByRole("button", { name: "Stop" }).click();
    const ticks = (await output(page).innerText()).split("tick").length;
    await page.waitForTimeout(600);
    expect((await output(page).innerText()).split("tick").length).toBe(ticks);
  });

  test("the Godot runner page is sandboxed however it is opened", async ({ request }) => {
    const response = await request.get("/playground/godot/index.html");
    expect(response.headers()["content-security-policy"]).toContain("sandbox allow-scripts");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  });

  test("site pages may only be framed by the site itself", async ({ request }) => {
    const response = await request.get("/design/css/tailwind/");
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  });
});

test.describe("playground: layout, zen, menu, help", () => {
  test("every pane edge resizes, and the sizes survive a reload", async ({ page }) => {
    await openPlayground(page, "web");
    const tree = page.getByRole("separator", { name: "Resize file tree width" });
    await tree.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(tree).toHaveAttribute("aria-valuenow", "336");
    const output = page.getByRole("separator", { name: "Resize output height" });
    const box = (await output.boundingBox())!;
    await page.mouse.move(box.x + 200, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y - 100, { steps: 4 });
    await page.mouse.up();
    const height = Number(await output.getAttribute("aria-valuenow"));
    expect(height).toBeGreaterThan(350);
    await expect(page.getByRole("separator", { name: "Resize preview width" })).toBeVisible();
    await page.getByRole("button", { name: /Refs/ }).click();
    await expect(
      page.getByRole("separator", { name: "Resize reference panel width" }),
    ).toBeVisible();
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.getByRole("separator", { name: "Resize file tree width" })).toHaveAttribute(
      "aria-valuenow",
      "336",
    );
    await expect(page.getByRole("separator", { name: "Resize output height" })).toHaveAttribute(
      "aria-valuenow",
      String(height),
    );
  });

  test("zen mode (⌘⌥Z / Ctrl+Alt+Z) keeps only the code, output and Refs; Esc leaves it", async ({
    page,
  }) => {
    await openPlayground(page, "typescript");
    await page.keyboard.press("Control+Alt+z");
    await expect(page.locator(".playground")).toHaveAttribute("data-zen", "on");
    await expect(page.getByRole("tree", { name: "Project files" })).toBeHidden();
    await expect(page.locator(".pg-toolbar")).toHaveCount(0);
    await expect(page.locator(".cm-editor")).toBeVisible();
    await expect(page.getByLabel("Program output")).toBeVisible();
    await page
      .getByRole("toolbar", { name: "Zen mode" })
      .getByRole("button", { name: "Refs" })
      .click();
    await expect(page.getByRole("complementary", { name: "Reference sheets" })).toBeVisible();
    await page
      .getByRole("toolbar", { name: "Zen mode" })
      .getByRole("button", { name: /Run/ })
      .click();
    await expect(page.getByLabel("Program output")).toContainText("Hello, playground!");
    await page.locator("body").press("Escape");
    await expect(page.locator(".playground")).toHaveAttribute("data-zen", "off");
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
  });

  test("right-clicking a file offers rename, delete and set as entry", async ({ page }) => {
    await openPlayground(page, "javascript");
    await page.locator('[role="treeitem"][data-path="lib/greet.js"]').click({ button: "right" });
    const menu = page.getByRole("menu", { name: "Actions for lib/greet.js" });
    await menu.getByRole("menuitem", { name: /Set as entry/ }).click();
    await expect(page.locator('[data-path="lib/greet.js"] .pg-tree-entry')).toBeVisible();
    await page.locator('[role="treeitem"][data-path="lib/greet.js"]').click({ button: "right" });
    await page.getByRole("menuitem", { name: /Rename/ }).click();
    const rename = page.getByRole("textbox", { name: "Rename lib/greet.js" });
    await rename.fill("hello.js");
    await rename.press("Enter");
    await expect(page.locator('[data-path="lib/hello.js"]')).toBeVisible();
    await page.locator('[role="treeitem"][data-path="lib/math.js"]').click({ button: "right" });
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByRole("button", { name: "yes" }).click();
    await expect(page.locator('[data-path="lib/math.js"]')).toHaveCount(0);
  });

  test("help opens with F1 and the tour walks through every step", async ({ page }) => {
    await openPlayground(page, "typescript");
    await page.locator("body").press("F1");
    const help = page.getByRole("dialog", { name: "Playground help" });
    await expect(help).toBeVisible();
    await help.getByRole("button", { name: "take the 1-minute tour" }).click();
    const card = page.locator(".pg-tour-card");
    await expect(card).toContainText("Pick a project");
    for (let i = 0; i < 7; i++) await card.getByRole("button", { name: /next|done/ }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator(".pg-welcome")).toHaveCount(0); // taking the tour dismisses the welcome card
  });
});

test.describe("playground: project types", () => {
  test("React renders from esm.sh and state updates on click", async ({ page }) => {
    test.skip(!process.env.E2E_NETWORK, "React loads from esm.sh (set E2E_NETWORK=1)");
    await openPlayground(page, "react");
    const preview = page.frameLocator(".pg-preview-frame");
    await preview.getByRole("button", { name: /Clicked 1 time/ }).click({ timeout: 15_000 });
    await expect(preview.getByRole("button", { name: /Clicked 2 times/ })).toBeVisible();
  });

  test("HTML/CSS/TS runs TypeScript modules in the preview", async ({ page }) => {
    await openPlayground(page, "web-ts");
    const preview = page.frameLocator(".pg-preview-frame");
    await preview.locator("#inc").click();
    await preview.locator("#inc").click();
    await expect(preview.locator("#count")).toHaveText("2");
    await expect(output(page)).toContainText("count is 2");
  });

  test("Bun (emulated) serves requests from the HTTP panel and reads project files", async ({
    page,
  }) => {
    await openPlayground(page, "bun");
    await run(page);
    await expect(output(page)).toContainText('config: { name: "bun-playground", version: 1 }');
    await expect(output(page)).toContainText("Hi! Listening on http://localhost:3000/");
    const http = page.getByRole("region", { name: "HTTP requests" });
    await http.getByRole("button", { name: "POST /echo", exact: true }).click();
    await expect(http.locator(".pg-http-response")).toContainText('"youSent"');
    await http.getByLabel("Path").fill("/nope");
    await http.getByRole("button", { name: "send" }).click();
    await expect(http.locator(".pg-http-response")).toContainText("404");
  });

  test("Bun + Hono routes, sub-apps and middleware", async ({ page }) => {
    test.skip(!process.env.E2E_NETWORK, "Hono loads from esm.sh (set E2E_NETWORK=1)");
    await openPlayground(page, "hono");
    await run(page);
    const http = page.getByRole("region", { name: "HTTP requests" });
    await http.getByRole("button", { name: "POST /users", exact: true }).click();
    await expect(http.locator(".pg-http-response")).toContainText("201");
    await expect(http.locator(".pg-http-response")).toContainText('"Grace"');
    await expect(output(page)).toContainText("POST /users → 201");
  });

  test("Markdown previews safely beside the editor", async ({ page }) => {
    await openPlayground(page, "markdown");
    const preview = page.frameLocator(".pg-md-preview iframe");
    await expect(preview.locator("h1")).toHaveText("Notes");
    await expect(preview.locator("table td").first()).toBeVisible();
    await setCode(
      page,
      "# Hi\n\n<script>parent.document.title='pwned'</script>\n\n| a |\n| - |\n| 1 |",
    );
    await expect(preview.locator("h1")).toHaveText("Hi");
    await expect(preview.locator("body")).toContainText("<script>");
    await expect(page).not.toHaveTitle("pwned");
    await expect(page.locator(".pg-md-preview iframe")).toHaveAttribute("sandbox", "");
  });
});
