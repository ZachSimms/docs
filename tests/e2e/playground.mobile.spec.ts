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
