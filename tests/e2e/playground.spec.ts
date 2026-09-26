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
    await page.getByRole("button", { name: "delete" }).click();
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
