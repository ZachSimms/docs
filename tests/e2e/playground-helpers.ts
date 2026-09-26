/** Shared helpers for the playground e2e specs. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/** A recorded service response from `tests/fixtures/playground/`. */
export function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(path.join(__dirname, "..", "fixtures", "playground", name), "utf8"),
  );
}

/** Open the playground with a language (and approved downloads) preset in storage. */
export async function openPlayground(page: Page, language = "typescript") {
  await page.addInitScript((lang) => {
    try {
      if (!localStorage.getItem("playground:v1:prefs")) {
        localStorage.setItem(
          "playground:v1:prefs",
          JSON.stringify({ language: lang, approvedDownloads: ["gdscript"] }),
        );
      }
    } catch {
      // sandboxed frames have no storage
    }
  }, language);
  await page.goto("/playground/");
  await expect(page.locator(".cm-editor")).toBeVisible();
}

/** Replace the open file's contents through the editor. */
export async function setCode(page: Page, code: string) {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(code);
}

/** Press Run and wait for the run to finish (or stop). */
export async function run(page: Page, timeout = 30_000) {
  await page.getByRole("button", { name: /Run/ }).click();
  await expect(page.locator(".pg-console .pg-status")).toHaveText(/ran in|stopped|failed/, {
    timeout,
  });
}

/** The console's text. */
export const output = (page: Page) => page.getByLabel("Program output");

/** Answer a cross-origin POST (and its CORS preflight) with JSON. */
export async function stubJson(page: Page, url: string | RegExp, body: unknown, status = 200) {
  await page.route(url, (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, accept",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
      },
      body: route.request().method() === "OPTIONS" ? "" : JSON.stringify(body),
    }),
  );
}
