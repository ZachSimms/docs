/** Playwright tests for `/playground/` on phones (Pixel 7 on Chromium, iPhone 14 on WebKit). */
import { expect, test } from "@playwright/test";
import { openPlayground, output, run } from "./playground-helpers";

test.describe("playground on a phone", () => {
  test("never scrolls sideways at 360 and 390px", async ({ page }) => {
    await openPlayground(page, "typescript");
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 780 });
      for (const pane of ["Code", "Files", "Output", "Refs"]) {
        await page.getByRole("tab", { name: pane }).click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${pane} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("shows one pane at a time; Run jumps to Output", async ({ page }) => {
    await openPlayground(page, "typescript");
    await expect(page.locator(".cm-editor")).toBeVisible();
    await expect(page.getByLabel("Program output")).toBeHidden();
    await run(page);
    await expect(page.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(output(page)).toContainText("Hello, playground!");
    await expect(page.locator(".cm-editor")).toBeHidden();
    await page.getByRole("tab", { name: "Files" }).click();
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
    await page.locator('[role="treeitem"][data-path="lib/math.ts"]').click();
    await expect(page.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".pg-tab[data-active]")).toContainText("math.ts");
  });

  test("the symbol row types into the editor without closing the keyboard", async ({ page }) => {
    await openPlayground(page, "typescript");
    await page.locator(".cm-content").tap();
    const row = page.getByRole("toolbar", { name: "Coding symbols" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "{" }).tap();
    await expect(page.locator(".cm-content")).toContainText("{");
    expect(await page.evaluate(() => document.activeElement?.closest(".cm-editor") !== null)).toBe(
      true,
    );
  });

  test("the ⓘ key shows the hover for the name at the cursor", async ({ page }) => {
    await openPlayground(page, "cpp");
    await page.locator(".cm-content").tap();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText("\nstd::sort");
    const row = page.getByRole("toolbar", { name: "Coding symbols" });
    await expect(async () => {
      await row.getByRole("button", { name: "Info at cursor" }).tap();
      await expect(page.locator(".cm-tooltip-hover")).toContainText("Sorts the elements", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
  });

  test("Refs keeps the open sheet across pane switches", async ({ page }) => {
    await openPlayground(page, "react");
    await page.getByRole("tab", { name: "Refs" }).click();
    await page.getByRole("listbox", { name: "Sheets" }).getByRole("option").first().click();
    const frame = page.locator(".pg-refs-frame");
    const src = await frame.getAttribute("src");
    expect(src).toMatch(/^\//);
    await page.getByRole("tab", { name: "Files" }).click();
    await expect(frame).toBeHidden();
    await page.getByRole("tab", { name: "Code" }).click();
    await page.getByRole("tab", { name: "Refs" }).click();
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("src", src!);
  });

  test("zen mode: the bar sits above the code, and the editor fills the pane", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          "playground:v1:prefs",
          JSON.stringify({ language: "react", welcomed: true, zen: true }),
        );
      } catch {
        // frames without storage
      }
    });
    await page.goto("/playground/");
    const bar = (await page.getByRole("toolbar", { name: "Zen mode" }).boundingBox())!;
    const line = (await page.locator(".cm-line").first().boundingBox())!;
    expect(line.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    const editor = (await page.locator(".pg-code").boundingBox())!;
    const tabs = (await page.locator(".pg-panes").boundingBox())!;
    expect(tabs.y - (editor.y + editor.height)).toBeLessThan(8);
  });

  test("the credit line has room above the tab bar, even on a short screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 });
    await openPlayground(page, "react");
    await page.getByRole("tab", { name: "Output" }).click();
    // The console scrolls when it's short (here the first-visit card is in it too): the credit is reachable,
    // and once scrolled to it sits above the tab bar, where it is what's on screen (nothing covers it).
    const credit = page.locator(".pg-credit");
    await credit.scrollIntoViewIfNeeded();
    const box = (await credit.boundingBox())!;
    const tabs = (await page.locator(".pg-panes").boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(tabs.y + 0.5);
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest(".pg-credit") !== null,
      [box.x + 10, box.y + box.height / 2],
    );
    expect(onTop).toBe(true);
  });

  test("touch targets are at least 44px", async ({ page }) => {
    await openPlayground(page, "typescript");
    const targets = [
      page.getByRole("button", { name: /Run/ }),
      page.getByRole("button", { name: "Reset" }),
      page.getByRole("tab", { name: "Output" }),
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
    }
    await page.getByRole("tab", { name: "Files" }).click();
    const rowBox = await page.locator('[role="treeitem"]').first().boundingBox();
    expect(rowBox!.height).toBeGreaterThanOrEqual(43.5);
  });

  test("a double tap at the screen edge doesn't navigate away", async ({ page }) => {
    await openPlayground(page, "typescript");
    const { height } = page.viewportSize()!;
    for (const x of [4, 4]) await page.touchscreen.tap(x, height / 2);
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/playground\/$/);
  });

  test("an edit is saved when the page is hidden, even straight after typing", async ({ page }) => {
    await openPlayground(page, "javascript");
    await page.locator(".cm-content").tap();
    await page.keyboard.insertText("// saved on pagehide\n");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    await page.reload();
    await expect(page.locator(".cm-content")).toContainText("// saved on pagehide");
  });
});
