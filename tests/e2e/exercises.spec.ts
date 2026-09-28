/**
 * The exercise generators end to end, on the production build: the playground's exercise mode
 * and the math practice sheet. The model is stubbed (`page.route`
 * on `/api/exercises/*`); everything else is real: the self-check, the sandboxed test runs, the
 * local answer checking, the sanitizer and storage. JavaScript exercises run with no download;
 * the Python one needs `E2E_NETWORK=1` (Pyodide comes from jsDelivr).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  BUGGY_LINKED_LIST,
  LINKED_LIST_EXERCISE,
  PASSING_REVIEW,
  QUADRATIC_PROBLEM,
  SIGN_SLIP_VERDICT,
  STACK_EXERCISE,
} from "../fixtures/exercises";

/** Answer one exercise API path with JSON. */
async function stubApi(page: Page, path: string, body: unknown, status = 200) {
  await page.route(`**${path}`, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

/** Open the playground in exercise mode, past the first-visit welcome. */
async function openExercises(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem("playground:v1:prefs")) {
        localStorage.setItem("playground:v1:prefs", JSON.stringify({ welcomed: true }));
      }
    } catch {
      // sandboxed frames have no storage
    }
  });
  await page.goto("/playground/?mode=exercise");
  await expect(page.getByLabel("What do you want to practice?")).toBeVisible();
}

/** The editor's contents area. */
const editor = (page: Page) => page.locator(".pg-code .cm-content");

/** The results pane's heading bar ("Tests  3/4 passed"). */
const testsBar = (page: Page) => page.locator(".pg-results .pg-bar");

/** Replace the editor's contents. */
async function setCode(page: Page, code: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(code);
}

test.describe("playground exercises", () => {
  test("are a mode of the playground, which the old /exercises/ address opens", async ({
    page,
  }) => {
    await page.goto("/exercises/");
    await expect(page).toHaveURL(/\/playground\/\?mode=exercise$/);
    await expect(page.getByRole("button", { name: "Exercises" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("navigation", { name: "Exercise" })).toBeVisible();

    // The first visit explains the mode; once dismissed, the card stays away.
    const intro = page.getByRole("region", { name: "How exercises work" });
    await expect(intro).toBeVisible();
    await intro.getByRole("button", { name: "got it" }).click();
    await expect(intro).toHaveCount(0);

    // Switching back to projects shows the file tree and drops the query; the choice is kept.
    await page.getByRole("button", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/playground\/$/);
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
    await page.getByRole("button", { name: "Exercises" }).click();
    await expect(page).toHaveURL(/\?mode=exercise$/);
    await page.waitForTimeout(700); // preferences are saved after a short debounce
    await page.goto("/playground/");
    await expect(page.getByRole("button", { name: "Exercises" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(intro).toHaveCount(0);
  });

  test("without a gateway key, the API says how to set it up", async ({ request }) => {
    test.skip(Boolean(process.env.AI_GATEWAY_API_KEY), "a key is configured");
    // With the site's Origin, as the page's fetch sends it: a bare script is refused (403).
    const origin = new URL(test.info().project.use.baseURL ?? "http://localhost").origin;
    const response = await request.post("/api/exercises/code/", {
      data: { language: "python" },
      headers: { origin },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ code: "config" });
  });

  test("a JavaScript exercise: self-check, failing and passing runs, review", async ({ page }) => {
    const brief = `${STACK_EXERCISE.brief}\n\nSee [MDN](https://developer.mozilla.org/) and [this](javascript:alert(1)).\n\ntext <img src=x onerror="window.pwned=1">`;
    await stubApi(page, "/api/exercises/code/", { ...STACK_EXERCISE, brief });
    await stubApi(page, "/api/exercises/code/review/", PASSING_REVIEW);
    await openExercises(page);
    await page.getByLabel("What do you want to practice?").fill("stacks");
    await page.getByLabel("Language").selectOption("javascript");
    await page.getByRole("button", { name: /Generate exercise/ }).click();

    await expect(page.getByRole("heading", { name: "Undo stack" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("✓ tests verified against a reference solution")).toBeVisible();

    // Model Markdown is sanitized in the browser: links open in a new tab, script URLs and raw HTML go.
    const article = page.locator(".ex-exercise");
    await expect(article.getByRole("link", { name: "MDN" })).toHaveAttribute("target", "_blank");
    await expect(article.getByRole("link", { name: "MDN" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await expect(article.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(article.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => "pwned" in window)).toBe(false);

    // The starter code, run with ⌘↵ from the editor, fails every test.
    await expect(editor(page)).toContainText('throw new Error("not implemented")');
    await editor(page).click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(testsBar(page)).toContainText("0/4 passed", { timeout: 30_000 });
    await expect(page.locator(".pg-results .ex-checks")).toContainText("Error: not implemented");

    await setCode(page, STACK_EXERCISE.solution);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Passed ✓")).toBeVisible({ timeout: 30_000 });
    await expect(testsBar(page)).toContainText("4/4 passed");

    // The exercise, the code and the progress are still there after a reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Undo stack/ })).toBeVisible();
    await expect(editor(page)).toContainText("#items = []");
    await expect(page.locator(".ex-recent")).toContainText("✓ passed");
  });

  test("a test that disagrees with the reference solution is sent back for repair", async ({
    page,
  }) => {
    const broken = {
      ...STACK_EXERCISE,
      tests: STACK_EXERCISE.tests.map((t, i) =>
        i === 2 ? { ...t, code: t.code.replace("3);", "4);") } : t,
      ),
    };
    let failures = "";
    await stubApi(page, "/api/exercises/code/", broken);
    await page.route("**/api/exercises/code/repair/", async (route) => {
      failures = (route.request().postDataJSON() as { failures: string }).failures;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(STACK_EXERCISE),
      });
    });
    await openExercises(page);
    await page.getByLabel("Language").selectOption("javascript");
    await page.getByRole("button", { name: /Generate exercise/ }).click();
    await expect(page.getByText("✓ tests verified against a reference solution")).toBeVisible({
      timeout: 30_000,
    });
    expect(failures).toContain('FAILED "size counts values": expected 4, got 3');
  });

  test("a Python exercise runs in Pyodide (network)", async ({ page }) => {
    test.skip(!process.env.E2E_NETWORK, "set E2E_NETWORK=1 to download Pyodide from jsDelivr");
    test.setTimeout(180_000);
    await stubApi(page, "/api/exercises/code/", LINKED_LIST_EXERCISE);
    await openExercises(page);
    await page.getByRole("button", { name: /Generate exercise/ }).click();
    await page.getByRole("button", { name: "download and generate" }).click();
    await expect(page.getByText("✓ tests verified against a reference solution")).toBeVisible({
      timeout: 150_000,
    });
    await setCode(page, BUGGY_LINKED_LIST);
    await page.getByRole("button", { name: /Run tests/ }).click();
    await expect(testsBar(page)).toContainText("7/9 passed", { timeout: 60_000 });
  });
});

test.describe("math practice", () => {
  test("is the first sheet of the Math topic, and checks answers", async ({ page }) => {
    await stubApi(page, "/api/exercises/math/", QUADRATIC_PROBLEM);
    await stubApi(page, "/api/exercises/math/check/", SIGN_SLIP_VERDICT);
    await page.goto("/math/");
    await page.getByRole("link", { name: "Practice problems" }).first().click();
    await expect(page).toHaveURL(/\/math\/practice\/$/);

    await page.getByRole("button", { name: /Generate problem/ }).click();
    await expect(page.getByRole("heading", { name: QUADRATIC_PROBLEM.title })).toBeVisible();
    await expect(page.locator(".ex-exercise .katex-display")).toHaveCount(1);

    const answer = page.getByLabel(/Your answer/);
    await answer.fill("x = 3, x = 2");
    await expect(page.getByText("reads as 3, 2")).toBeVisible();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText("Not quite")).toBeVisible();
    await page.getByRole("button", { name: "explain my mistake" }).click();
    await expect(page.getByText(/changes its sign/)).toBeVisible();

    await answer.fill("2, -3");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText("Correct ✓")).toBeVisible();
    await expect(page.locator(".ex-recent")).toContainText("✓ solved");
  });
});
