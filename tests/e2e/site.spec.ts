/** Playwright end-to-end tests against a production build served on port 3100. */
import { expect, test, type Page } from "@playwright/test";
import { PROFILE } from "../../lib/profile";
import { SITE_TITLE } from "../../lib/site";

/**
 * Wait until client components have hydrated (the theme toggle only gets its
 * `data-target` on the client), so global key listeners are attached.
 */
async function hydrated(page: Page) {
  await expect(page.locator(".theme-toggle")).toHaveAttribute("data-target", /./);
}

/**
 * Wait until React has run the passive effects of the page just rendered
 * (a frame, then a task): after a client-side navigation the new page's DOM
 * appears before its effects add the key listeners, and a key pressed in
 * between is lost.
 */
async function effectsFlushed(page: Page) {
  await page.evaluate(
    () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done, 0))),
  );
}

/**
 * A topic page's own entries in order: its directories' heading links and its loose
 * sheets, without the sheets unfolded under each directory.
 */
function topicEntries(page: Page) {
  return page.locator("main nav[data-menu] :is(.topic-folders h2 a, .topic-loose > a)");
}

/** The topic cards' names on `/docs/`, in order. */
function topicCards(page: Page) {
  return page.locator("main nav[data-menu] .card-head i");
}

/** YouTube player and thumbnail hosts: stubbed so the suite never hits the network for video. */
const YOUTUBE = /^https:\/\/(?:(?:www\.)?youtube(?:-nocookie)?\.com|i\.ytimg\.com)\//;

test.beforeEach(async ({ context }) => {
  await context.route(YOUTUBE, (route) => route.fulfill({ body: "stub" }));
});

test.describe("home", () => {
  test("is one column: name, introduction and sections, beside tonight's moon", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(SITE_TITLE);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zach Simms");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-weight", "400");
    await expect(page.locator("main > p").nth(0)).toHaveText("-");
    await expect(page.locator("main > p").nth(1)).toHaveText(PROFILE.bio);
    // No side navigation on the home page; the content column is the original 90ch.
    await expect(page.locator(".site-nav")).toHaveCount(0);

    // Beside the text: tonight's moon, dithered on a canvas, with its phase; d brings the sun.
    const sky = page.locator("figure.sky");
    await expect(sky).toBeVisible();
    const caption = sky.locator("figcaption");
    await expect(caption).toHaveText(
      /^(new moon|waxing crescent|first quarter|waxing gibbous|full moon|waning gibbous|last quarter|waning crescent), \d+%\s*tonight's moon; d for the sun$/,
    );
    const inked = () =>
      sky.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
        let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count++;
        return count;
      });
    expect(await inked()).toBeGreaterThan(0);
    // Floated to the right of the text, flush with the column's right edge, level with the name.
    const [skyBox, mainBox, nameBox] = await Promise.all([
      sky.boundingBox(),
      page.locator("main").boundingBox(),
      page.getByRole("heading", { level: 1 }).boundingBox(),
    ]);
    expect(skyBox!.x).toBeGreaterThan(mainBox!.x + mainBox!.width / 2);
    expect(Math.abs(skyBox!.x + skyBox!.width - (mainBox!.x + mainBox!.width))).toBeLessThanOrEqual(
      2,
    );
    expect(Math.abs(skyBox!.y - nameBox!.y)).toBeLessThan(20);

    await hydrated(page);
    await page.keyboard.press("d");
    await expect(caption).toHaveText(
      /(equinox|solstice) (today|tomorrow|in \d+ days)\s*today's sun; d for the moon$/,
    );
    expect(await inked()).toBeGreaterThan(0);
    await page.keyboard.press("d");

    const rows = page.locator(".home-keys p");
    await expect(rows.locator("kbd")).toHaveText(["p", "r", "b", "g"]);
    await expect(rows.locator("a")).toHaveText(["Projects", "Resume", "Blog", "Docs"]);
    await expect(rows).toHaveText(["pProjects", "rResume", "bBlog", "gDocs"]);

    await expect(page.locator("footer a").first()).toHaveAttribute("href", "/info/");
    await expect(page.locator("footer a").first()).toHaveText("Info");

    const search = page.locator("footer").getByRole("button", { name: /search/i });
    await expect(search).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(search).toHaveCSS("border-top-width", "0px");
    await expect(search.locator("i")).toHaveCSS("border-bottom-style", "dotted");
  });

  test("the docs index lists the twenty-two topics as cards and links every sheet", async ({
    page,
  }) => {
    await page.goto("/docs/");
    await expect(page).toHaveTitle(`Docs - ${SITE_TITLE}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Docs");
    await expect(topicCards(page)).toHaveCount(22);
    await expect(topicCards(page).first()).toHaveText("3D graphics");
    await expect(topicCards(page).last()).toHaveText("Writing");
    await expect(page.locator("main nav[data-menu] .card-head .dim").first()).toHaveText("22");
    await expect(page.locator("main nav[data-menu] .card-head .dim").last()).toHaveText("01");
    await expect(page.locator("main a", { hasText: /^All \d+ sheets$/ })).toHaveAttribute(
      "href",
      "/sheets/",
    );
    await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/");
  });

  test("uses the original's visual system", async ({ page }) => {
    await page.goto("/docs/");
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe("rgb(242, 242, 242)");

    const link = topicCards(page).first();
    await expect(link).toHaveCSS("border-bottom-style", "dotted");
    await expect(link).toHaveCSS("border-bottom-width", "1px");

    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toBe("monospace");

    // Beside the navigation, the content column is 72ch (104ch grid minus 24ch + 8ch).
    const mainWidth = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
    const chWidth = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.textContent = "0";
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
    expect(mainWidth).toBeLessThanOrEqual(72 * chWidth + 1);
  });
});

/** Ink in the sky canvas's left and right halves, in canvas pixels. */
function skyHalves(page: Page) {
  return page.locator("figure.sky canvas").evaluate((canvas: HTMLCanvasElement) => {
    const { data, width } = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height);
    const halves = { left: 0, right: 0 };
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! > 0) halves[((i - 3) / 4) % width < width / 2 ? "left" : "right"]++;
    }
    return halves;
  });
}

for (const { timeZone, hemisphere } of [
  { timeZone: "Europe/London", hemisphere: "north" },
  { timeZone: "Australia/Sydney", hemisphere: "south" },
] as const) {
  test.describe(`sky from ${timeZone}`, () => {
    test.use({ timezoneId: timeZone });

    test(`draws the moon and names the season for the ${hemisphere}`, async ({ page }) => {
      // Near first quarter (43% lit): the lit side is on the right from the north.
      await page.clock.setFixedTime(new Date("2026-10-18T02:00:00Z"));
      await page.goto("/");
      await hydrated(page);
      const caption = page.locator("figure.sky figcaption");
      await expect(caption).toHaveText(/^first quarter, 43%/);
      const { left, right } = await skyHalves(page);
      // The shadow is inked densely, so the darker half is the one away from the light.
      if (hemisphere === "north") expect(left).toBeGreaterThan(right * 1.2);
      else expect(right).toBeGreaterThan(left * 1.2);

      await page.keyboard.press("d");
      await expect(caption).toHaveText(
        // The solstice is Dec 21 20:53 UTC: still the 21st in London, the 22nd in Sydney.
        hemisphere === "north" ? /^winter solstice in 64 days/ : /^summer solstice in 65 days/,
      );
      await page.keyboard.press("d");
    });
  });
}

test.describe("navigation", () => {
  test("topic page lists its sheets and ../ returns to the docs", async ({ page }) => {
    await page.goto("/docs/");
    await page.locator("main nav[data-menu] a", { hasText: "Physics" }).click();
    await expect(page).toHaveURL(/\/physics\/$/);
    await expect(page).toHaveTitle(`Physics - ${SITE_TITLE}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Physics");
    await expect(topicEntries(page)).toHaveCount(3); // two sheets + the overview
    await expect(page.locator("main nav[data-menu] span").first()).toHaveText("00.");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText("docs / physics");

    await page.locator("footer a", { hasText: "../" }).click();
    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Docs");
  });

  test("sheet page renders MDX in house style and ../ returns to its topic", async ({ page }) => {
    await page.goto("/databases/postgres/");
    await expect(page).toHaveTitle(`PostgreSQL - ${SITE_TITLE}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PostgreSQL");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
      "docs / databases / postgres",
    );

    expect(await page.locator("main pre").count()).toBeGreaterThan(1);
    await expect(page.locator("main pre").first()).toHaveCSS(
      "background-color",
      "rgb(229, 229, 229)",
    );
    expect(await page.locator("main table").count()).toBeGreaterThan(1);
    await expect(page.locator("main time")).toHaveText("2026-09-25");
    await expect(page.locator("main")).not.toContainText("title:");

    await page.locator("footer a", { hasText: "../" }).click();
    await expect(page).toHaveURL(/\/databases\/$/);
  });

  test("/sheets/ lists every sheet as NN. topic/slug", async ({ page }) => {
    await page.goto("/sheets/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cheatsheets");
    const links = page.locator("main nav[data-menu] a");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(9);
    await expect(links.first()).toHaveText(/^[a-z0-9-]+(\/[a-z0-9-]+){1,2}$/);
    await expect(page.getByRole("link", { name: "typescript/backend/websockets" })).toHaveAttribute(
      "href",
      "/typescript/backend/websockets/",
    );
    await expect(page.locator("main nav[data-menu] span").first()).toHaveText("00.");
    await expect(page.locator("main nav[data-menu] span").last()).toHaveText(
      `${String(count - 1).padStart(2, "0")}.`,
    );
    await expect(page.locator("footer a").first()).toHaveAttribute("href", "/docs/");
  });

  test("info page links back with ../", async ({ page }) => {
    await page.goto("/info/");
    await expect(page).toHaveTitle(`Info - ${SITE_TITLE}`);
    await expect(page.getByRole("link", { name: "Sheet List" })).toHaveAttribute(
      "href",
      "/sheets/",
    );
    await expect(page.locator("footer a").first()).toHaveText("../");
  });

  test("unknown routes render the house-style 404", async ({ page }) => {
    const response = await page.goto("/nope/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
    await expect(page.locator("footer a").first()).toHaveAttribute("href", "/");
  });
});

test.describe("syntax highlighting", () => {
  test("fenced code is tokenized by Shiki with dual-theme variables; inline code keeps the chip", async ({
    page,
  }) => {
    await page.goto("/databases/postgres/");
    const tokens = page.locator("main pre code span[style*='--shiki-light']");
    expect(await tokens.count()).toBeGreaterThan(0);
    await expect(page.locator("main pre").first()).toHaveCSS(
      "background-color",
      "rgb(229, 229, 229)",
    );
    const inline = page.locator("main table code").first();
    await expect(inline).toHaveCSS("background-color", "rgb(221, 221, 221)");
  });
});

test.describe("search palette", () => {
  test("opens with cmd+k, filters, navigates on Enter, closes on Escape", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Search");
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();

    await input.fill("python/overview");
    const links = dialog.getByRole("option");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText("python/overview");
    await expect(dialog.locator(".results > span > span").first()).toHaveText("00.");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/python\/overview\/$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("footer Search link opens it and the overlay matches the page background", async ({
    page,
  }) => {
    await page.goto("/info/");
    await page
      .locator("footer")
      .getByRole("button", { name: /search/i })
      .click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("background-color", "rgb(242, 242, 242)");
    await expect(dialog.getByRole("combobox")).toBeFocused();
  });
});

test.describe("terminal", () => {
  /** Type a command at the prompt and run it. */
  async function run(page: Page, command: string) {
    const input = page.getByRole("textbox", { name: "Command" });
    await input.fill(command);
    await input.press("Enter");
  }

  test("` opens it; cd, ls, toc and cat walk the site; the prompt follows the page", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    await page.keyboard.press("`");
    const terminal = page.getByRole("region", { name: "Terminal" });
    await expect(terminal).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Command" })).toBeFocused();
    const log = terminal.getByRole("log");

    await run(page, "ls");
    await expect(log.getByRole("link", { name: "docs/" })).toHaveAttribute("href", "/docs/");

    await run(page, "cd docs/python/overview");
    await expect(page).toHaveURL(/\/python\/overview\/$/);
    await expect(terminal).toContainText("terminal · ~/docs/python/overview");

    await run(page, "cat");
    await expect(log).toContainText("# Overview");

    // Tab completes; a page's name alone goes there.
    const input = page.getByRole("textbox", { name: "Command" });
    await input.fill("cd ../fas");
    await input.press("Tab");
    await expect(input).toHaveValue("cd ../fastapi ");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/python\/fastapi\/$/);

    await run(page, "toc");
    await expect(log).toContainText(/fastapi\$ toc00\. /);
    await run(page, "cd 0");
    await expect(page).toHaveURL(/\/python\/fastapi\/#.+$/);

    // Leaving by a link moves the prompt too, and Esc hides the terminal.
    await page.getByRole("textbox", { name: "Command" }).press("Escape");
    await expect(terminal).toHaveCount(0);
    await page.goto("/docs/");
    await hydrated(page);
    await page.locator("footer").getByRole("button", { name: /terminal/i }).click();
    await expect(page.getByRole("region", { name: "Terminal" })).toContainText("terminal · ~/docs");
  });

  test("md splits the terminal, rendered or raw, follows cd, and serves the raw file", async ({
    page,
  }) => {
    await page.goto("/python/overview/");
    await hydrated(page);
    const before = (await page.locator("main").boundingBox())!;
    await page.keyboard.press("`");
    await run(page, "md");
    const terminal = page.getByRole("region", { name: "Terminal" });
    const split = terminal.getByRole("region", { name: "Markdown split" });
    await expect(split).toContainText("~/docs/python/overview · follows cd");
    // Rendered by default; --raw for the Markdown.
    await expect(split.locator(".source-rendered h1")).toHaveText("Overview");
    await run(page, "md --raw");
    await expect(split.locator(".src-line").first()).toHaveText("1---");
    await expect(split.locator(".src-heading").first()).toContainText("## ");

    // The split is inside the terminal: the shell on the left, the page untouched above.
    const shellBox = (await terminal.locator(".terminal-screen").boundingBox())!;
    const splitBox = (await split.boundingBox())!;
    const termBox = (await terminal.boundingBox())!;
    expect(shellBox.x + shellBox.width).toBeLessThanOrEqual(splitBox.x + 1);
    expect(splitBox.y).toBeGreaterThanOrEqual(termBox.y);
    expect((await page.locator("main").boundingBox())!.width).toBe(before.width);

    await run(page, "md -R");
    await expect(split.locator(".source-rendered h1")).toHaveText("Overview");
    await expect(split.getByRole("button", { name: "rendered" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await run(page, "cd ../fastapi");
    await expect(page).toHaveURL(/\/python\/fastapi\/$/);
    await expect(split).toContainText("~/docs/python/fastapi");
    await expect(split.locator(".source-rendered h1")).toHaveText("FastAPI");
    await split.getByRole("button", { name: "raw" }).click();
    await expect(split).toContainText("title: FastAPI");

    const raw = await page.request.get("/source/python/fastapi.md");
    expect(raw.headers()["content-type"]).toContain("text/markdown");
    expect(await raw.text()).toContain("title: FastAPI");
    expect((await page.request.get("/source/python/_nope.md")).status()).toBe(404);

    await run(page, "md -c");
    await expect(split).toHaveCount(0);
  });

  test("/terminal/ opens it full screen, by URL or by the link on /info/, and cd keeps it so", async ({
    page,
  }) => {
    await page.goto("/terminal/");
    const terminal = page.getByRole("region", { name: "Terminal" });
    await expect(terminal).toHaveAttribute("data-size", "max");
    await expect(page.getByRole("textbox", { name: "Command" })).toBeFocused();
    await expect(terminal).toContainText("terminal · ~");

    await run(page, "cd docs");
    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(terminal).toHaveAttribute("data-size", "max");
    await expect(terminal).toContainText("terminal · ~/docs");

    // Esc on /terminal/ shows the page beneath, which reopens it.
    await page.goto("/terminal/");
    await page.getByRole("textbox", { name: "Command" }).press("Escape");
    await expect(page.getByRole("region", { name: "Terminal" })).toHaveCount(0);
    await page.getByRole("button", { name: /open the terminal/i }).click();
    await expect(page.getByRole("region", { name: "Terminal" })).toHaveAttribute("data-size", "max");

    // Arriving by a link (a client-side navigation) opens it full screen too.
    await page.getByRole("textbox", { name: "Command" }).press("Escape");
    await page.goto("/info/");
    await hydrated(page);
    await page.getByRole("link", { name: "Terminal" }).click();
    await expect(page).toHaveURL(/\/terminal\/$/);
    await expect(page.getByRole("region", { name: "Terminal" })).toHaveAttribute("data-size", "max");
  });
});

test.describe("dark mode", () => {
  test("toggle switches the palette, persists across reload, and switches back", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /toggle theme/i });
    await expect(toggle).toHaveAttribute("data-target", "dark");
    await expect(toggle.locator("svg")).toHaveAttribute("data-icon", "moon");

    // Sits at the top, flush with the right edge of the content column (not the viewport).
    const [box, mainBox] = await Promise.all([
      toggle.boundingBox(),
      page.locator("main").boundingBox(),
    ]);
    expect(box!.y).toBeLessThan(60);
    const buttonPadding = 13 * 0.25;
    expect(
      Math.abs(box!.x + box!.width - buttonPadding - (mainBox!.x + mainBox!.width)),
    ).toBeLessThanOrEqual(2);

    // Monochrome: the icon takes the text color of the theme.
    await expect(toggle.locator("svg")).toHaveCSS("color", "rgb(0, 0, 0)");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(22, 22, 22)");
    await expect(toggle).toHaveAttribute("data-target", "light");
    await expect(toggle.locator("svg")).toHaveAttribute("data-icon", "sun");
    await expect(toggle.locator("svg")).toHaveCSS("color", "rgb(230, 230, 230)");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(22, 22, 22)");

    await page.getByRole("button", { name: /toggle theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(242, 242, 242)");
  });

  test("follows the OS preference when nothing is stored", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/databases/postgres/");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(22, 22, 22)");
    await expect(page.locator("main pre").first()).toHaveCSS("background-color", "rgb(31, 31, 31)");
    await expect(page.getByRole("button", { name: /toggle theme/i })).toHaveAttribute(
      "data-target",
      "light",
    );
  });
});

test.describe("images", () => {
  test("MDX images under public/ get real dimensions and stay inside the column", async ({
    page,
  }) => {
    await page.goto("/design/overview/");
    const img = page.getByRole("img", { name: "Spacing scale swatch" });
    await expect(img).toHaveAttribute("width", "320");
    await expect(img).toHaveAttribute("height", "120");
    const [imgWidth, mainWidth] = await Promise.all([
      img.evaluate((el) => el.getBoundingClientRect().width),
      page.locator("main").evaluate((el) => el.getBoundingClientRect().width),
    ]);
    expect(imgWidth).toBeLessThanOrEqual(mainWidth + 1);
    expect(imgWidth).toBeGreaterThan(0);
  });
});

test.describe("mdx showcase", () => {
  test("/design/overview/ renders every supported construct", async ({ page }) => {
    await page.goto("/design/overview/");
    const main = page.locator("main");
    await expect(main.locator("h2")).toHaveCount(13);
    await expect(main.locator("h3#third-level-heading")).toHaveCount(1);
    await expect(main.locator("strong")).toHaveCount(2);
    await expect(main.locator("del")).toHaveText("struck");
    await expect(main.locator("kbd")).toHaveCount(2);
    await expect(main.locator("ul.contains-task-list input[type=checkbox]")).toHaveCount(2);
    await expect(main.locator("blockquote")).toHaveCount(1);
    await expect(main.locator("aside.note")).toHaveCount(3);
    await expect(main.locator('aside.note[data-kind="tip"]')).toContainText("tip:");
    expect(
      await main.locator("figure[data-rehype-pretty-code-figure]").count(),
    ).toBeGreaterThanOrEqual(8);
    await expect(main.locator("table th")).toHaveCount(3);
    await expect(main.locator("table td").nth(1)).toHaveCSS("text-align", "right");
    await expect(main.getByRole("img", { name: "Spacing scale swatch" })).toBeVisible();
    await expect(main.locator("details summary")).toHaveText("Collapsed by default");
    await expect(main.locator("hr")).toHaveCount(1);
    await expect(main.locator("section.footnotes li")).toHaveCount(1);
    await expect(main).toContainText("last updated 2026-09-04 by Zach");
    await expect(main).toContainText("4 × 6 = 24");
    await expect(main.locator(".katex-display")).toHaveCount(1);
    await expect(main.locator("p .katex:not(.katex-display .katex)")).toHaveCount(1);
    await expect(main).not.toContainText("{meta.");
  });

  test("code blocks support titles, highlighted lines and line numbers", async ({ page }) => {
    await page.goto("/design/overview/");
    const figure = page.locator("figure[data-rehype-pretty-code-figure]", {
      hasText: "spacing.py",
    });
    await expect(figure.locator("figcaption")).toHaveText("spacing.py");
    await expect(figure.locator("figcaption + pre")).toHaveCount(1);
    await expect(figure.locator("code[data-line-numbers]")).toHaveCount(1);
    await expect(figure.locator("[data-line]")).toHaveCount(7);
    await expect(figure.locator("[data-highlighted-line]")).toHaveCount(3);
    await expect(figure.locator("[data-highlighted-line]").first()).toHaveCSS(
      "background-color",
      "rgb(221, 221, 221)",
    );
    await expect(figure.locator("pre")).toHaveCSS("background-color", "rgb(229, 229, 229)");
    const numbered = await figure
      .locator("[data-line]")
      .nth(1)
      .evaluate((el) => getComputedStyle(el, "::before").content);
    expect(numbered).toBe("counter(line)");
  });

  test("tabs switch by mouse and keyboard and persist across groups and reloads", async ({
    page,
  }) => {
    await page.goto("/design/overview/");
    const lists = page.getByRole("tablist");
    await expect(lists).toHaveCount(2);
    const first = lists.nth(0);
    const second = lists.nth(1);
    await expect(first.getByRole("tab", { name: "bun" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Runs on Node in development.")).toBeHidden();

    await first.getByRole("tab", { name: "npm" }).click();
    await expect(second.getByRole("tab", { name: "npm" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Runs on Node in development.")).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("tablist").nth(1).getByRole("tab", { name: "npm" }),
    ).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tablist").nth(0).getByRole("tab", { name: "npm" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByRole("tablist").nth(0).getByRole("tab", { name: "bun" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tablist").nth(0).getByRole("tab", { name: "bun" })).toBeFocused();
  });

  test("steps, callouts, cards and included partials render", async ({ page }) => {
    await page.goto("/design/overview/");
    const main = page.locator("main");
    await expect(main.locator("ol.steps > li")).toHaveCount(3);
    const marker = await main
      .locator("ol.steps > li")
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").content);
    expect(marker).toContain("counter(step, decimal-leading-zero)");

    const warn = main.locator('aside.note[data-kind="warning"]', { hasText: "Mind the fences" });
    await expect(warn).toHaveCount(1);
    await expect(warn).toHaveCSS("border-left-style", "solid");
    await expect(warn.locator(".note-title")).toHaveText("warning: Mind the fences");

    await expect(main.locator("nav.cards .card")).toHaveCount(3);
    await expect(main.getByRole("link", { name: "Notation" })).toHaveAttribute(
      "href",
      "/math/notation/",
    );

    await expect(main).toContainText("This paragraph lives in _shared-snippet.mdx");
    const res = await page.goto("/design/_shared-snippet/");
    expect(res?.status()).toBe(404);
  });

  test("footnote reference and backlink point at each other and scroll", async ({ page }) => {
    await page.goto("/design/overview/");
    const ref = page.locator("sup a#user-content-fnref-1");
    await expect(ref).toHaveAttribute("href", "#user-content-fn-1");
    await ref.click();
    await expect(page).toHaveURL(/#user-content-fn-1$/);
    await expect(page.locator("li#user-content-fn-1")).toBeInViewport();

    const back = page.locator("a.data-footnote-backref");
    await expect(back).toHaveAttribute("href", "#user-content-fnref-1");
    await expect(back).toHaveAttribute("aria-label", "Back to reference 1");
    await back.click();
    await expect(page).toHaveURL(/#user-content-fnref-1$/);
    await expect(ref).toBeInViewport();
  });

  test("math reference sheets render their tables and formulas", async ({ page }) => {
    await page.goto("/math/math-fundamentals/");
    const main = page.locator("main");
    expect(await main.locator("h2").count()).toBe(25); // 1.1–1.24 + References
    expect(await main.locator("table").count()).toBeGreaterThanOrEqual(25);
    expect(await main.locator(".katex").count()).toBeGreaterThan(300);
    await expect(main.locator('h2[id="11-solving-equations"]')).toHaveText("1.1 Solving equations");
    await expect(main.locator('h2[id="124-math-problems"]')).toHaveText("1.24 Math problems");
    // 1.12 relies on the drawn graphs; the only raster image is the unit circle in 1.15.
    await expect(main.locator("img")).toHaveCount(1);
    await expect(main.getByRole("img", { name: /unit circle/i })).toHaveAttribute("width", "691");

    await page.goto("/math/notation/");
    await expect(page.locator("main h2")).toHaveText([
      "Math notation",
      "Set notation",
      "Complex numbers notation",
      "Vectors notation",
      "Mechanics notation",
      "Calculus notation",
      "References",
    ]);

    await page.goto("/math/constants-units-conversions/");
    await expect(page.locator("main h2")).toHaveText([
      "Fundamental constants of Nature",
      "Units",
      "Other units and conversions",
      "References",
    ]);
    await expect(page.locator("main")).toContainText("2.997");
    await expect(page.locator("main")).toContainText("exact");
  });

  test("section headings are bold and a table of contents sits in the right margin", async ({
    page,
  }) => {
    await page.goto("/math/math-fundamentals/");
    await expect(page.locator("main h2").first()).toHaveCSS("font-weight", "700");
    await expect(page.locator("main h1")).toHaveCSS("font-weight", "700");

    const toc = page.getByRole("navigation", { name: "Contents" });
    await expect(toc).toBeVisible();
    await expect(toc.locator("a")).toHaveCount(25);
    await expect(toc.locator("a").first()).toHaveAttribute("href", "#11-solving-equations");

    const [tocBox, mainBox] = await Promise.all([
      toc.boundingBox(),
      page.locator("main").boundingBox(),
    ]);
    expect(tocBox!.x).toBeGreaterThan(mainBox!.x + mainBox!.width);
    expect(Math.abs(tocBox!.y - mainBox!.y)).toBeLessThanOrEqual(4);

    await toc.locator("a", { hasText: "1.16 Trigonometric identities" }).click();
    await expect(page).toHaveURL(/#116-trigonometric-identities$/);
    await expect(page.locator('h2[id="116-trigonometric-identities"]')).toBeInViewport();
    await expect(toc.locator('a[aria-current="location"]')).toHaveText(
      "1.16 Trigonometric identities",
    );

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(toc).toBeHidden();
  });

  test("a back link stays pinned at the top-left of the column while scrolling", async ({
    page,
  }) => {
    await page.goto("/math/math-fundamentals/");
    // The toggle's icon (and so its box) is only final once hydrated: measure after that.
    await hydrated(page);
    const pinned = page.locator(".back-rail a");
    await expect(pinned).toHaveText("../");
    await expect(pinned).toHaveAttribute("href", "/math/");

    await page.mouse.wheel(0, 3000);
    await expect(pinned).toBeInViewport();
    const [box, mainBox, toggleBox] = await Promise.all([
      pinned.boundingBox(),
      page.locator("main").boundingBox(),
      page.getByRole("button", { name: /toggle theme/i }).boundingBox(),
    ]);
    expect(Math.abs(box!.x - mainBox!.x)).toBeLessThanOrEqual(4);
    expect(box!.y).toBeLessThan(60);
    expect(
      Math.abs(box!.y + box!.height / 2 - (toggleBox!.y + toggleBox!.height / 2)),
    ).toBeLessThanOrEqual(6);

    await pinned.click();
    await expect(page).toHaveURL(/\/math\/$/);
    await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/docs/");

    await page.goto("/");
    await expect(page.locator(".back-rail")).toHaveCount(0);
  });

  test("sheets with a single heading get no table of contents", async ({ page }) => {
    await page.goto("/databases/postgres/");
    await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(1);
    await page.goto("/python/overview/");
    await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(0);
    await page.goto("/info/");
    await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(0);
  });

  test("functions reference and transformations show colored graphs", async ({ page }) => {
    await page.goto("/math/math-fundamentals/");
    const main = page.locator("main");
    const graphs = main.locator("figure.graph");
    expect(await graphs.count()).toBeGreaterThanOrEqual(15);
    await expect(main.locator("figure.graph-small")).toHaveCount(10);
    await expect(
      main.locator("figure.graph", { hasText: "tangent" }).locator("path.graph-curve"),
    ).toHaveCount(1);

    const shifts = main.locator("figure.graph", { hasText: "shifts" });
    await expect(shifts.locator("path.graph-curve")).toHaveCount(3);
    await expect(shifts.locator("figcaption")).toContainText("f(x − 2)");
    await expect(shifts.locator("path.graph-curve").nth(0)).toHaveCSS(
      "stroke",
      "rgb(31, 111, 235)",
    );
    await expect(shifts.locator("path.graph-curve").nth(1)).toHaveCSS("stroke", "rgb(207, 34, 46)");
    await expect(shifts.locator("path.graph-curve").nth(2)).toHaveCSS("stroke", "rgb(26, 127, 55)");
    await expect(shifts.locator(".graph-swatch").nth(1)).toHaveCSS("color", "rgb(207, 34, 46)");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(
      page.locator("figure.graph", { hasText: "shifts" }).locator("path.graph-curve").nth(0),
    ).toHaveCSS("stroke", "rgb(88, 166, 255)");
    await page.emulateMedia({ colorScheme: "light" });

    const [a, b] = await Promise.all([
      main.locator("figure.graph-small").nth(0).boundingBox(),
      main.locator("figure.graph-small").nth(1).boundingBox(),
    ]);
    expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(2); // side by side
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  });

  test("the graph-reading sheet plots every operation with several constants", async ({ page }) => {
    await page.goto("/math/reading-graphs/");
    const main = page.locator("main");
    await expect(main.locator("h2")).toHaveCount(11); // ten sections + References
    expect(await main.locator("figure.graph").count()).toBeGreaterThanOrEqual(20);
    const powers = main.locator("figure.graph", { hasText: "y = cˣ" });
    await expect(powers.locator("path.graph-curve")).toHaveCount(4);
    await expect(powers.locator(".graph-legend")).toHaveText([
      "── eˣ",
      "── 2ˣ",
      "── 1.5ˣ",
      "── 0.5ˣ",
    ]);
    const recip = main.locator("figure.graph", { hasText: "y = c / x" });
    // 1/x is two branches: one path, two "M" moves
    const d = await recip.locator("path.graph-curve").first().getAttribute("d");
    expect((d?.match(/M/g) ?? []).length).toBe(2);
    await expect(main.locator("table")).toHaveCount(8);

    // Paired plots stay inside the column: no figure wider than its half-column cell.
    const mainBox = await main.boundingBox();
    const boxes = await main
      .locator(".graphs > figure.graph")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    for (const right of boxes) expect(right).toBeLessThanOrEqual(mainBox!.x + mainBox!.width + 1);
  });

  test("the Math topic exists", async ({ page }) => {
    await page.goto("/math/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Math");
    await expect(topicEntries(page)).toHaveCount(5);
    // Frontmatter `order` puts the fundamentals first; numbering runs 00. from the top.
    await expect(topicEntries(page).first()).toHaveText("Math fundamentals");
    await expect(page.locator("main nav[data-menu] span").first()).toHaveText("00.");
    await expect(page.locator("main nav[data-menu] span").last()).toHaveText("04.");
    await topicEntries(page).first().click();
    await expect(page).toHaveURL(/\/math\/math-fundamentals\/$/);
    const display = page.locator("main .katex-display");
    expect(await display.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator("main .katex-mathml math").first()).toBeAttached();
    // Rendered HTML layer is present; the raw LaTeX only survives inside the hidden MathML annotation.
    expect(await page.locator("main .katex-html").count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator("main .katex-html").first()).toBeVisible();
    // KaTeX glyphs take the theme's text color.
    await expect(display.first().locator(".katex")).toHaveCSS("color", "rgb(0, 0, 0)");
  });
});

test.describe("typescript topic and directories", () => {
  test("the topic lists its ten directories, then its loose sheet", async ({ page }) => {
    await page.goto("/docs/");
    await page.locator("main nav[data-menu] a", { hasText: "TypeScript" }).click();
    await expect(page).toHaveURL(/\/typescript\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("TypeScript");
    const links = topicEntries(page);
    await expect(links).toHaveText([
      "Language/",
      "Design & architecture/",
      "Runtimes & tooling/",
      "Frontend/",
      "React/",
      "Web APIs/",
      "Backend/",
      "Realtime/",
      "Three.js/",
      "WebAssembly/",
      "Testing",
    ]);
    await expect(links.nth(1)).toHaveAttribute("href", "/typescript/design-architecture/");
    await expect(links.nth(7)).toHaveAttribute("href", "/typescript/realtime/");
    await expect(links.nth(8)).toHaveAttribute("href", "/typescript/three-js/");
    await expect(page.locator("main nav[data-menu] span").last()).toHaveText("10.");
    // Every directory is unfolded: its sheets are listed under its heading.
    await expect(
      page.locator(".topic-folder", { has: page.locator('h2 a[href="/typescript/language/"]') }),
    ).toContainText("Array methods");
  });

  test("a directory page shows its intro and sheets; ../ returns to the topic", async ({
    page,
  }) => {
    await page.goto("/typescript/language/");
    await expect(page).toHaveTitle(`Language - ${SITE_TITLE}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Language");
    await expect(page.locator("main > p").first()).toContainText("type system");
    const links = page.locator("main nav[data-menu] a");
    await expect(links).toHaveCount(6);
    await expect(links.first()).toHaveText("Fundamentals");
    await expect(links.first()).toHaveAttribute("href", "/typescript/language/fundamentals/");
    await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/typescript/");

    await page.locator("footer a", { hasText: "../" }).click();
    await expect(page).toHaveURL(/\/typescript\/$/);
  });

  test("a sheet inside a directory renders its contents; ../ returns to the directory", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/typescript/language/");
    await page.locator("main nav[data-menu]").getByRole("link", { name: "Array methods" }).click();
    await expect(page).toHaveURL(/\/typescript\/language\/array-methods\/$/);
    await expect(page).toHaveTitle(`Array methods - ${SITE_TITLE}`);
    expect(await page.locator("main h2").count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
    await expect(page.locator("main pre code[data-theme]").first()).toBeVisible();
    await expect(page.locator("main time")).toHaveText("2026-09-25");

    await page.locator("footer a", { hasText: "../" }).click();
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
  });

  test("every reference sheet renders with a table of contents that fits its rail", async ({
    page,
  }) => {
    // Visits every sheet in turn (177 of them); slow when the whole suite runs in parallel.
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/sheets/");
    const hrefs = await page
      .locator(
        'main nav[data-menu] a:is([href^="/typescript/"], [href^="/databases/"], [href^="/infrastructure/"], [href^="/design/principles/"], [href^="/design/css/"], [href^="/python/"], [href^="/ml-ai/"], [href^="/physics/"], [href^="/game-dev/"], [href^="/economics/"], [href^="/cpp/"], [href^="/design/html/"], [href^="/finance/"], [href^="/thinking/"], [href^="/leadership/"], [href^="/startups/"], [href^="/writing/"], [href^="/aviation/"]):not([href$="/overview/"])',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs).toHaveLength(177);
    for (const href of hrefs) {
      await page.goto(href);
      const toc = page.getByRole("navigation", { name: "Contents" });
      await expect(toc).toBeVisible();
      // Long (sub-)headings ellipsise rather than giving the rail a horizontal scrollbar.
      const [scrollWidth, clientWidth] = await toc.evaluate((el) => [
        el.scrollWidth,
        el.clientWidth,
      ]);
      expect(scrollWidth, href).toBeLessThanOrEqual(clientWidth);
      expect(await page.locator("main h2").count()).toBeGreaterThanOrEqual(6);
    }
  });

  test("search finds a nested sheet and opens its url", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await dialog.getByRole("combobox").fill("backend websockets");
    await expect(dialog.getByRole("option").first()).toHaveText("typescript/backend/websockets");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/typescript\/backend\/websockets\/$/);
  });
});

test.describe("new topics", () => {
  test("databases and infrastructure are listed alphabetically", async ({ page }) => {
    await page.goto("/docs/");
    const links = topicCards(page);
    await expect(links.nth(4)).toHaveText("Databases");
    await expect(links.nth(6)).toHaveText("DS&A");
    await expect(links.nth(11)).toHaveText("Infrastructure");
    await expect(links.nth(20)).toHaveText("TypeScript");
    await page.goto("/infrastructure/");
    await expect(topicEntries(page)).toHaveText([
      "Linux/",
      "Containers/",
      "Kubernetes/",
      "Ansible",
      "Grafana",
      "Communication networks",
      "System design",
    ]);
  });

  test("game dev is listed alphabetically and holds the Godot and game design directories", async ({
    page,
  }) => {
    await page.goto("/docs/");
    const links = topicCards(page);
    await expect(links.nth(0)).toHaveText("3D graphics");
    await expect(links.nth(3)).toHaveText("C++");
    await expect(links.nth(10)).toHaveText("Game dev");
    await links.nth(10).click();
    await expect(page).toHaveURL(/\/game-dev\/$/);
    await expect(topicEntries(page)).toHaveText(["Godot/", "Game design/"]);
    await page.goto("/game-dev/design/");
    await expect(page.locator("main nav[data-menu] a")).toHaveText(["Open-world design"]);
    await page.goto("/game-dev/godot/");
    await expect(page.locator("main nav[data-menu] a")).toHaveText([
      "GDScript",
      "Nodes, scenes & signals",
      "Input & physics",
      "UI, animation & audio",
      "Shaders",
      "Resources, saving & export",
    ]);
    await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/game-dev/");
  });

  test("the design showcase is titled Demo", async ({ page }) => {
    await page.goto("/design/");
    await expect(topicEntries(page).last()).toHaveText("Demo");
    await page.goto("/design/overview/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo");
  });
});

test.describe("file trees", () => {
  test("a FileTree draws guide lines inside a code box", async ({ page }) => {
    await page.goto("/design/overview/");
    const tree = page.locator("main figure.file-tree").first();
    await expect(tree.locator("figcaption")).toHaveText("monorepo");
    await expect(tree.locator("[data-line]").nth(1)).toHaveText("├── apps/");
    await expect(tree.locator(".ft-dir").first()).toHaveCSS("font-weight", "700");
    const [treeBg, preBg] = await Promise.all([
      tree.locator("pre").evaluate((el) => getComputedStyle(el).backgroundColor),
      page
        .locator("main pre:not(.file-tree pre)")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    expect(treeBg).toBe(preBg);
  });

  test("the monorepo section of modules-packages uses a file tree", async ({ page }) => {
    await page.goto("/typescript/design-architecture/modules-packages/");
    expect(await page.locator("main figure.file-tree").count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("keyboard", () => {
  test("d toggles the theme, but not while typing in search", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await hydrated(page);
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? null);
    await page.keyboard.press("d");
    expect(await theme()).toBe("dark");
    await page.keyboard.press("d");
    expect(await theme()).toBe("light");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox").pressSequentially("dd");
    expect(await theme()).toBe("light");
  });

  test("Esc goes up one level at a time and closes search first", async ({ page }) => {
    await page.goto("/typescript/language/oop/");
    await hydrated(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/typescript\/language\/oop\/$/);

    // After each step, wait for the new page's pinned ../ (the Esc handler) before pressing again.
    const backTo = async (href: string) => {
      await expect(page.locator(".back-rail a")).toHaveAttribute("href", href);
      await effectsFlushed(page);
    };
    await backTo("/typescript/language/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
    await backTo("/typescript/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/typescript\/$/);
    await backTo("/docs/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/docs\/$/);
    await backTo("/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zach Simms");
  });

  test("list pages are menus: arrows and j/k move a > highlight, Enter opens, hover follows", async ({
    page,
  }) => {
    await page.goto("/typescript/language/");
    await hydrated(page);
    const nav = page.locator("main nav[data-menu]");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("j");
    const active = nav.locator("a[data-active]");
    await expect(active).toHaveText("Objects");
    const marker = await nav
      .locator("span[data-active]")
      .evaluate((el) => getComputedStyle(el, "::before").content);
    expect(marker).toBe('">"');
    await expect(active.locator("i")).toHaveCSS("border-bottom-style", "solid");

    await nav.getByRole("link", { name: "String methods" }).hover();
    await page.mouse.move(5, 5); // leaving the row keeps its highlight
    await nav.getByRole("link", { name: "String methods" }).hover();
    await expect(active).toHaveText("String methods");
    await page.keyboard.press("k");
    await expect(active).toHaveText("Array methods");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/typescript\/language\/array-methods\/$/);
  });

  test("the topic cards on /docs/ are a menu, and coming back highlights the topic left", async ({
    page,
  }) => {
    await page.goto("/docs/");
    await hydrated(page);
    const active = page.locator("main nav[data-menu] a[data-active]");
    await page.keyboard.press("ArrowDown");
    await expect(active.locator(".card-head i")).toHaveText("3D graphics");
    await page.keyboard.press("j");
    await expect(active.locator(".card-head i")).toHaveText("Aviation");
    await expect(active).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/aviation\/$/);
    await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/docs/");
    await effectsFlushed(page);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(active.locator(".card-head i")).toHaveText("Aviation");
  });

  test("a topic's menu runs through its directories' sheets without opening them", async ({
    page,
  }) => {
    await page.goto("/python/");
    await hydrated(page);
    const active = page.locator("main nav[data-menu] a[data-active]");
    await page.keyboard.press("ArrowDown");
    await expect(active).toHaveText("Language/");
    await page.keyboard.press("j");
    await expect(active).toHaveText("Fundamentals");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/python\/language\/fundamentals\/$/);
  });
});

test.describe("arrow keys move in and out of levels", () => {
  test("→ enters the highlighted directory or sheet, ← comes back to the same row", async ({
    page,
  }) => {
    await page.goto("/typescript/");
    await hydrated(page);
    const active = page.locator("main nav a[data-active]");
    // Wait for each new page's pinned ../ before pressing keys, so its handlers are mounted.
    const backTo = async (href: string) => {
      await expect(page.locator(".back-rail a")).toHaveAttribute("href", href);
      await effectsFlushed(page);
    };

    await page.keyboard.press("ArrowDown");
    await expect(active).toHaveText("Language/");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
    await backTo("/typescript/");

    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await expect(active).toHaveText("Objects");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/typescript\/language\/objects\/$/);
    await backTo("/typescript/language/");

    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
    await expect(active).toHaveText("Objects");
    await backTo("/typescript/");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/typescript\/$/);
    await expect(active).toHaveText("Language/");
    await backTo("/docs/");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
  });

  test("← leaves tabs alone: arrows still switch tabs when a tab has focus", async ({ page }) => {
    await page.goto("/design/overview/");
    await hydrated(page);
    const tab = page.getByRole("tab").first();
    await tab.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/design\/overview\/$/);
  });
});

test.describe("table of contents highlight", () => {
  test("marks the section being read, its parent, and the last section at the bottom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto("/typescript/language/async-promises/");
    await hydrated(page);
    const toc = page.getByRole("navigation", { name: "Contents" });
    const current = toc.locator('a[aria-current="location"]');
    await expect(current).toHaveText("Event loop");
    await expect(current).toHaveCSS("font-weight", "700");

    await page.locator("h3#limited-concurrency-pool").scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      document.getElementById("limited-concurrency-pool")?.scrollIntoView({ block: "start" }),
    );
    await expect(current).toHaveText("Limited-concurrency pool");
    await expect(toc.locator("a[data-parent-active]")).toHaveText("Concurrency patterns");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current).toHaveText("References");
    // The rail scrolled itself so the current entry is visible inside it.
    const [link, rail] = await Promise.all([current.boundingBox(), toc.boundingBox()]);
    expect(link!.y).toBeGreaterThanOrEqual(rail!.y - 1);
    expect(link!.y + link!.height).toBeLessThanOrEqual(rail!.y + rail!.height + 1);
  });
});

test.describe("table of contents fit", () => {
  test("the rail is either fully inside the viewport or hidden", async ({ page }) => {
    await page.goto("/typescript/language/oop/");
    const toc = page.getByRole("navigation", { name: "Contents" });
    for (const width of [1280, 1300, 1600]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(toc).toBeVisible();
      const box = await toc.boundingBox();
      expect(box!.x + box!.width, `width ${width}`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1279, height: 800 });
    await expect(toc).toBeHidden();
  });

  test("a long contents list has no scrollbar; ^ / v show and scroll the hidden entries", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto("/typescript/runtime-tooling/bun/");
    await hydrated(page);
    const toc = page.getByRole("navigation", { name: "Contents" });
    const up = page.getByRole("button", { name: "Scroll contents up" });
    const down = page.getByRole("button", { name: "Scroll contents down" });

    const [scrollbar, gutter] = await toc.evaluate((el: HTMLElement) => [
      getComputedStyle(el).scrollbarWidth,
      el.offsetWidth - el.clientWidth,
    ]);
    expect(scrollbar).toBe("none");
    expect(gutter).toBe(0);
    await expect(toc).toHaveAttribute("data-more-down", "");
    await expect(down).toBeVisible();
    await expect(up).toHaveCount(0);

    await down.click();
    await expect(up).toBeVisible();
    await expect(toc).toHaveAttribute("data-more-up", "");
    await up.click();
    await expect(up).toHaveCount(0);
    await expect(down).toBeVisible();
  });

  test("clicking a short last section keeps it highlighted", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto("/typescript/language/oop/");
    await hydrated(page);
    const toc = page.getByRole("navigation", { name: "Contents" });
    await toc.locator("a", { hasText: "Recipes" }).click();
    await expect(toc.locator('a[aria-current="location"]')).toHaveText("Recipes");
  });
});

test.describe("top bar", () => {
  test("a solid band keeps scrolled content from showing behind ../ and the theme toggle", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto("/typescript/language/async-promises/");
    await hydrated(page);
    await page.evaluate(() => window.scrollTo(0, 3000));

    const band = await page.locator(".theme-toggle-rail").evaluate((el) => {
      const style = getComputedStyle(el);
      return { bottom: el.getBoundingClientRect().bottom, image: style.backgroundImage };
    });
    const [back, toggle] = await Promise.all([
      page.locator(".back-rail a").boundingBox(),
      page.locator(".theme-toggle").boundingBox(),
    ]);
    // The band is painted (a gradient ending in the page color) and reaches below both controls.
    expect(band.image).toContain("gradient");
    expect(band.bottom).toBeGreaterThan(back!.y + back!.height);
    expect(band.bottom).toBeGreaterThan(toggle!.y + toggle!.height);
  });

  test("jumping to a section leaves its heading below the band", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto("/typescript/language/async-promises/");
    await hydrated(page);
    await page.getByRole("navigation", { name: "Contents" }).getByText("Combinators").click();
    const bandBottom = await page
      .locator(".theme-toggle-rail")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const heading = await page.locator("h2#combinators").boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(bandBottom - 1);
  });
});

test.describe("coming-soon pages", () => {
  test("an unwritten topic overview shows a Coming soon heading and the meme", async ({ page }) => {
    for (const topic of ["python", "math", "physics"]) {
      await page.goto(`/${topic}/overview/`);
      const main = page.locator("main");
      await expect(main.locator("h2")).toHaveText(["Coming soon"]);
      const meme = main.getByRole("img", { name: /under construction/i });
      await expect(meme).toBeVisible();
      await expect(meme).toHaveAttribute("width", "800");
      expect(await meme.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      await expect(main).not.toContainText("Replace this stub");
    }
  });

  test("math sheets end with their references", async ({ page }) => {
    await page.goto("/math/constants-units-conversions/");
    await expect(page.locator("main h2").last()).toHaveText("References");
    await expect(page.locator("main h2").last().locator("~ ul a").first()).toHaveAttribute(
      "href",
      /physics\.nist\.gov/,
    );
  });
});

test.describe("visuals", () => {
  test("swatches, a tonal scale and a contrast pair render real colors", async ({ page }) => {
    await page.goto("/design/overview/");
    const bar = page.locator(".swatch-bar span");
    await expect(bar).toHaveCount(3);
    await expect(bar.first()).toHaveCSS("background-color", "rgb(244, 241, 234)");
    const ratio = await bar.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(ratio[0]! / ratio[2]!).toBeCloseTo(6, 0);
    await expect(page.getByRole("list", { name: "Blue, hue 250" }).locator("li")).toHaveCount(11);
    await expect(page.locator(".contrast figcaption")).toContainText("4.54:1");
  });

  test("an html demo fence renders live in a sandboxed frame that follows the theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/design/overview/");
    await hydrated(page);
    const frameEl = page.getByTitle("Live demo: flex.html");
    await frameEl.scrollIntoViewIfNeeded();
    await expect(frameEl).toHaveAttribute("sandbox", "");
    const frame = page.frameLocator('iframe[title="Live demo: flex.html"]');
    await expect(frame.locator(".row > div")).toHaveCount(3);
    await expect(frame.locator(".row")).toHaveCSS("display", "flex");
    await expect(frame.locator("body")).toHaveCSS("background-color", "rgb(242, 242, 242)");
    await page.keyboard.press("d");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(frame.locator("body")).toHaveCSS("background-color", "rgb(22, 22, 22)");
  });

  test("tailwind demos apply real compiled utilities and follow the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/design/css/tailwind/");
    await hydrated(page);
    const frameEl = page.getByTitle("Live demo: placement.html");
    await frameEl.scrollIntoViewIfNeeded();
    await expect(frameEl).toHaveAttribute("sandbox", "");
    const frame = frameEl.contentFrame();
    const grid = frame.locator(".grid-cols-4");
    await expect(grid).toHaveCSS("display", "grid");
    const tracks = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(tracks).toBe(4);
    // col-span-full stretches across all four tracks.
    const [gridWidth, fullWidth] = await Promise.all([
      grid.evaluate((el) => el.getBoundingClientRect().width),
      frame.locator(".col-span-full").evaluate((el) => el.getBoundingClientRect().width),
    ]);
    expect(fullWidth).toBeGreaterThan(gridWidth - 30);
    await page.keyboard.press("d");
    await expect(frame.locator("html")).toHaveAttribute("data-theme", "dark");

    const flex = page.getByTitle("Live demo: justify.html");
    await flex.scrollIntoViewIfNeeded();
    const row = flex.contentFrame().locator(".justify-between");
    await expect(row).toHaveCSS("justify-content", "space-between");
  });

  test("clicking a link inside a demo leaves the demo in place", async ({ page }) => {
    await page.goto("/design/principles/color-theory/");
    const frameEl = page.locator("iframe[title*='light-dark']").first();
    await frameEl.scrollIntoViewIfNeeded();
    const frame = frameEl.contentFrame();
    await expect(frame.locator(".card")).toHaveCount(2);
    await frame.locator(".card a").first().click();
    await page.waitForTimeout(500);
    await expect(frame.locator(".card")).toHaveCount(2);
    await expect(frame.locator("main h2")).toHaveCount(0);
    await expect(page).toHaveURL(/\/design\/principles\/color-theory\/$/);
  });

  test("diagram labels keep the font size the SVG asks for", async ({ page }) => {
    await page.goto("/design/principles/ux-ui/");
    const small = page.locator("figure.diagram text", { hasText: "box beats spacing" });
    const big = page.locator("figure.diagram text", { hasText: "common region" });
    await small.scrollIntoViewIfNeeded();
    const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    expect(await small.evaluate(size)).toBeLessThan(await big.evaluate(size));
  });

  test("swatch labels line up under their chips", async ({ page }) => {
    await page.goto("/design/css/tailwind/");
    const item = page.locator("figure.swatches li").first();
    await item.scrollIntoViewIfNeeded();
    const [chipLeft, labelLeft] = await item.evaluate((li) => [
      li.querySelector(".swatch-chip")!.getBoundingClientRect().left,
      li.querySelector(".swatch-value")!.getBoundingClientRect().left,
    ]);
    expect(labelLeft).toBeGreaterThanOrEqual(chipLeft - 0.5);
  });

  test("diagrams are inline SVG colored by the theme palette", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/design/overview/");
    const diagram = page.getByRole("img", { name: /box model/i });
    await expect(diagram.locator("svg")).toBeVisible();
    await expect(diagram.locator("rect.d-fill-0")).toHaveCSS("fill", "rgb(31, 111, 235)");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(diagram.locator("rect.d-fill-0")).toHaveCSS("fill", "rgb(88, 166, 255)");
  });

  test("the design sheets use color chips, live demos and diagrams", async ({ page }) => {
    for (const href of ["/design/principles/color-theory/", "/design/css/css/"]) {
      await page.goto(href);
      const visuals = page.locator("main :is(.swatches, .contrast, .demo, .diagram)");
      expect(await visuals.count(), href).toBeGreaterThanOrEqual(3);
    }
  });

  test("react-hooks shows the hook flow chart with its credit", async ({ page }) => {
    await page.goto("/typescript/react/react-hooks/");
    await expect(page.locator("main h2", { hasText: "Lifecycle flow" })).toBeVisible();
    const chart = page.getByRole("img", { name: /React Hook Flow Diagram/ });
    await chart.scrollIntoViewIfNeeded();
    await expect(chart).toBeVisible();
    await expect
      .poll(() => chart.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      page.locator("main a[href='https://github.com/donavon/hook-flow']").first(),
    ).toBeVisible();
  });
});

test.describe("python, physics and ml-ai", () => {
  test("python lists its directories, FastAPI, then the overview", async ({ page }) => {
    await page.goto("/python/");
    const hrefs = await topicEntries(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual([
      "/python/language/",
      "/python/engineering/",
      "/python/data/",
      "/python/fastapi/",
      "/python/overview/",
    ]);
    // A line's space between the directories' columns and the loose sheets' heading.
    const [folders, loose] = await Promise.all([
      page.locator(".topic-folders").boundingBox(),
      page.locator(".topic-loose h2").boundingBox(),
    ]);
    expect(loose!.y - (folders!.y + folders!.height)).toBeGreaterThanOrEqual(0);
    const lastRow = await page
      .locator(".topic-folders .topic-folder")
      .evaluateAll((sections) =>
        Math.max(...sections.map((s) => s.lastElementChild!.getBoundingClientRect().bottom)),
      );
    expect(loose!.y - lastRow).toBeGreaterThan(16);
  });

  test("physics and ml-ai list their sheets before the overview", async ({ page }) => {
    for (const [topic, first] of [
      ["physics", "/physics/fundamentals/"],
      ["ml-ai", "/ml-ai/scikit-learn/"],
    ] as const) {
      await page.goto(`/${topic}/`);
      const links = topicEntries(page);
      await expect(links.first()).toHaveAttribute("href", first);
      await expect(links.last()).toHaveAttribute("href", `/${topic}/overview/`);
    }
  });
});

test.describe("fitness", () => {
  test("the topic lists its three directories in order", async ({ page }) => {
    await page.goto("/fitness/");
    const hrefs = await topicEntries(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual([
      "/fitness/training/",
      "/fitness/nutrition/",
      "/fitness/recovery-mobility/",
    ]);
  });

  test("a directory intro carries the not-medical-advice note", async ({ page }) => {
    await page.goto("/fitness/nutrition/");
    await expect(page.locator("main aside.note")).toContainText("not medical advice");
    await expect(page.locator("main nav[data-menu] a").first()).toHaveAttribute(
      "href",
      "/fitness/nutrition/nutrition-hydration/",
    );
  });

  test("videos load on play at 16:9 inside the column, with a watch link", async ({ page }) => {
    await page.goto("/fitness/recovery-mobility/running-warmup-drills/");
    const video = page.locator("main figure.video").first();
    await expect(page.locator("main figure.video iframe")).toHaveCount(0);
    await video.scrollIntoViewIfNeeded();
    const poster = await video.locator(".video-frame").boundingBox();
    expect(Math.abs((poster?.width ?? 0) / (poster?.height ?? 1) - 16 / 9)).toBeLessThan(0.05);
    await video.getByRole("link", { name: /^Play video: / }).click();
    const iframe = video.locator("iframe");
    await expect(iframe).toHaveAttribute(
      "src",
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?(?:start=\d+&)?autoplay=1$/,
    );
    await expect(iframe).toHaveAttribute("title", /^YouTube video: /);
    await expect(page).toHaveURL(/running-warmup-drills\/$/);
    const frame = await video.locator(".video-frame").boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(frame && main).toBeTruthy();
    expect(Math.abs((frame?.width ?? 0) / (frame?.height ?? 1) - 16 / 9)).toBeLessThan(0.05);
    expect((frame?.x ?? 0) + (frame?.width ?? 0)).toBeLessThanOrEqual(
      (main?.x ?? 0) + (main?.width ?? 0) + 1,
    );
    await expect(video.locator("figcaption a")).toHaveAttribute(
      "href",
      /^https:\/\/www\.youtube\.com\/watch\?v=/,
    );
  });

  test("the training sheets draw their diagrams", async ({ page }) => {
    for (const url of ["/fitness/training/energy-systems/", "/fitness/training/training-plans/"]) {
      await page.goto(url);
      await expect(page.locator("main figure.diagram svg").first()).toBeVisible();
    }
  });
});

test.describe("economics and C++", () => {
  test("economics lists microeconomics then macroeconomics", async ({ page }) => {
    await page.goto("/economics/");
    const hrefs = await topicEntries(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual(["/economics/microeconomics/", "/economics/macroeconomics/"]);
  });

  test("the economics sheets draw their diagrams and typeset their math", async ({ page }) => {
    for (const [url, diagrams] of [
      ["/economics/microeconomics/", 3],
      ["/economics/macroeconomics/", 2],
    ] as const) {
      await page.goto(url);
      await expect(page.locator("main figure.diagram svg")).toHaveCount(diagrams);
      await expect(page.locator("main .katex").first()).toBeVisible();
      await expect(page.locator("main .katex-error")).toHaveCount(0);
    }
  });

  test("C++ has the fundamentals sheet and no coming-soon overview", async ({ page }) => {
    await page.goto("/cpp/");
    const hrefs = await topicEntries(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual(["/cpp/fundamentals/"]);
    const response = await page.goto("/cpp/overview/");
    expect(response?.status()).toBe(404);
    await page.goto("/cpp/fundamentals/");
    await expect(page.locator("main h2").last()).toHaveText("References");
    await expect(page.locator("main pre code").first()).toBeVisible();
  });
});

test.describe("DS&A and 3D graphics", () => {
  test("DS&A lists its ten sheets, Big-O first and system design last", async ({ page }) => {
    await page.goto("/dsa/");
    const hrefs = await topicEntries(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toHaveLength(10);
    expect(hrefs[0]).toBe("/dsa/big-o/");
    expect(hrefs.at(-1)).toBe("/dsa/system-design-interviews/");
  });

  test("picking Python switches every DS&A code block and is remembered on the next sheet", async ({
    page,
  }) => {
    await page.goto("/dsa/big-o/");
    await hydrated(page);
    await expect(page.locator("main figure svg").first()).toBeVisible();
    const lists = page.getByRole("tablist");
    expect(await lists.count()).toBeGreaterThanOrEqual(2);
    await expect(lists.nth(0).getByRole("tab", { name: "TypeScript" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await lists.nth(0).getByRole("tab", { name: "Python" }).click();
    for (const list of await lists.all()) {
      await expect(list.getByRole("tab", { name: "Python" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }

    await page.goto("/dsa/trees-graphs/");
    await hydrated(page);
    await expect(
      page.getByRole("tablist").first().getByRole("tab", { name: "Python" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("DS&A code comes in TypeScript, JavaScript and Python, and JavaScript is remembered too", async ({
    page,
  }) => {
    await page.goto("/dsa/sorting-searching/");
    await hydrated(page);
    const lists = page.getByRole("tablist");
    await expect(lists.first().getByRole("tab")).toHaveText(["TypeScript", "JavaScript", "Python"]);

    await lists.first().getByRole("tab", { name: "JavaScript" }).click();
    for (const list of await lists.all()) {
      await expect(list.getByRole("tab", { name: "JavaScript" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }
    await expect(
      page.locator("main [role=tabpanel]:visible code[data-language=js]").first(),
    ).toBeVisible();

    await page.goto("/dsa/graph-algorithms/");
    await hydrated(page);
    await expect(
      page.getByRole("tablist").first().getByRole("tab", { name: "JavaScript" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("3D graphics has its four directories in order and draws its concepts", async ({ page }) => {
    await page.goto("/3d/");
    const hrefs = await topicEntries(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")),
    );
    expect(hrefs).toEqual([
      "/3d/fundamentals/",
      "/3d/blender/",
      "/3d/ai-workflows/",
      "/3d/export/",
    ]);

    await page.goto("/3d/fundamentals/core-concepts/");
    expect(await page.locator("main figure.diagram svg").count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator("main h2").last()).toHaveText("References");
  });
});

test.describe("finance, thinking, leadership, startups and writing", () => {
  test("the new topics are listed alphabetically", async ({ page }) => {
    await page.goto("/docs/");
    const links = topicCards(page);
    await expect(links.nth(7)).toHaveText("Economics");
    await expect(links.nth(8)).toHaveText("Finance");
    await expect(links.nth(12)).toHaveText("Leadership");
    await expect(links.nth(14)).toHaveText("ML/AI");
    await expect(links.nth(18)).toHaveText("Startups");
    await expect(links.nth(19)).toHaveText("Thinking");
    await expect(links.nth(21)).toHaveText("Writing");
  });

  test("each new topic lists its directories and sheets in order", async ({ page }) => {
    for (const [url, entries] of [
      [
        "/thinking/",
        ["First principles thinking", "Systems thinking", "Game theory", "Mental models/"],
      ],
      ["/startups/", ["Idea to MVP/", "Advice/"]],
      ["/writing/", ["Nonfiction/", "Fiction/", "Worldbuilding/"]],
      ["/design/", ["Principles/", "HTML/", "CSS/", "Demo"]],
    ] as const) {
      await page.goto(url);
      await expect(topicEntries(page)).toHaveText([...entries]);
    }
    await page.goto("/finance/");
    await expect(topicEntries(page)).toHaveText(["Personal finance/", "Business finance/"]);
    await page.goto("/finance/business/");
    await expect(page.locator("main nav[data-menu] a")).toHaveCount(5);
    await page.goto("/leadership/");
    await expect(topicEntries(page)).toHaveCount(6);
    await page.goto("/startups/idea-to-mvp/");
    await expect(page.locator("main nav[data-menu] a").first()).toHaveText("Playbook");
  });

  test("writing no longer has a coming-soon overview", async ({ page }) => {
    const response = await page.goto("/writing/overview/");
    expect(response?.status()).toBe(404);
  });

  test("HTML sheets run their live demos and money stays text, not math", async ({ page }) => {
    await page.goto("/design/html/semantic-elements/");
    expect(await page.locator('main iframe[title^="Live demo"]').count()).toBeGreaterThanOrEqual(2);
    await page.goto("/finance/personal/banking/");
    await expect(page.locator("main")).toContainText("$250,000");
    await expect(page.locator("main .katex-error")).toHaveCount(0);
  });
});

/** Phone and tablet sizes checked by the responsive tests. */
const SIZES = [
  { name: "small phone", width: 360, height: 740 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "large tablet", width: 1024, height: 1366 },
] as const;

/** Sheets with wide tables, math, code, demos, diagrams and swatches. */
const HEAVY_SHEETS = [
  "/databases/postgres/",
  "/math/math-fundamentals/",
  "/python/language/fundamentals/",
  "/design/css/css/",
  "/design/principles/color-theory/",
  "/fitness/recovery-mobility/running-warmup-drills/",
  "/fitness/nutrition/vitamins-minerals/",
  "/economics/microeconomics/",
  "/cpp/fundamentals/",
];

/** Height of the transparent fade at the bottom of the top bar (1em). */
const BAND_FADE = 16;

/** Bottom edge of the opaque part of the top bar. */
async function bandBottom(page: Page): Promise<number> {
  const band = await page.locator(".theme-toggle-rail").boundingBox();
  return (band?.y ?? 0) + (band?.height ?? 0) - BAND_FADE;
}

/** Whether the element's center is the topmost thing there (nothing covers it). */
async function uncovered(page: Page, selector: string): Promise<boolean> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && (hit === el || el.contains(hit));
    });
}

for (const size of SIZES) {
  test.describe(`responsive: ${size.name} ${size.width}px`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: size.width < 800,
      hasTouch: true,
    });

    test("no page is wider than the screen", async ({ page }) => {
      test.setTimeout(300_000);
      await page.goto("/sheets/");
      const all = await page
        .locator("main nav[data-menu] a")
        .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
      // Every page on the two extreme sizes; the heavy ones elsewhere.
      const full = size.width === 360 || size.width === 768;
      const urls = full
        ? [
            "/",
            "/docs/",
            "/projects/",
            "/resume/",
            "/blog/",
            "/typescript/",
            "/typescript/language/",
            "/info/",
            "/sheets/",
            ...all,
          ]
        : ["/", "/docs/", "/resume/", "/info/", ...HEAVY_SHEETS];
      for (const url of urls) {
        await page.goto(url);
        const [scroll, client] = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.clientWidth,
        ]);
        expect(scroll, url).toBeLessThanOrEqual(client);
      }
    });

    test("numbered rows keep long paths beside their number", async ({ page }) => {
      await page.goto("/sheets/");
      const misplaced = await page.locator("main nav[data-menu]").evaluate((nav) =>
        [...nav.querySelectorAll("a")]
          .filter((a) => {
            // Compare first text lines, not boxes (the link's box includes its padding).
            const firstLine = (node: Node) => {
              const range = document.createRange();
              range.selectNodeContents(node);
              return range.getClientRects()[0]!.top;
            };
            return Math.abs(firstLine(a) - firstLine(a.previousElementSibling!)) > 2;
          })
          .map((a) => a.textContent),
      );
      expect(misplaced).toEqual([]);
    });

    test("content has equal gutters and code boxes span the column", async ({ page }) => {
      for (const url of HEAVY_SHEETS) {
        await page.goto(url);
        const m = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const main = document.querySelector("main")!.getBoundingClientRect();
          const blocks = [...document.querySelectorAll("main > *")].map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, left: r.left, right: r.right };
          });
          const codes = [...document.querySelectorAll("main pre")].map(
            (el) => el.getBoundingClientRect().width,
          );
          return { vw, left: main.left, right: main.right, width: main.width, blocks, codes };
        });
        if (size.width < 800)
          expect(Math.abs(m.left - (m.vw - m.right)), url).toBeLessThanOrEqual(1);
        for (const b of m.blocks) {
          expect(b.left, `${url} ${b.tag}`).toBeGreaterThanOrEqual(m.left - 1);
          expect(b.right, `${url} ${b.tag}`).toBeLessThanOrEqual(m.right + 1);
        }
        for (const w of m.codes) expect(Math.abs(w - m.width), url).toBeLessThanOrEqual(1);
      }
    });

    test("../ and the theme toggle are on screen and clickable; the heading clears the top bar", async ({
      page,
    }) => {
      await page.goto("/databases/postgres/");
      await hydrated(page);
      const vw = size.width;
      for (const sel of [".back-rail a", ".theme-toggle", ".toc-menu-button"]) {
        const box = await page.locator(sel).boundingBox();
        expect(box, sel).not.toBeNull();
        expect(box!.x, sel).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, sel).toBeLessThanOrEqual(vw);
        expect(await uncovered(page, sel), sel).toBe(true);
      }
      // The menu button sits at the right end of the bar, the theme toggle just left of it.
      const toggle = (await page.locator(".theme-toggle").boundingBox())!;
      const menu = (await page.locator(".toc-menu-button").boundingBox())!;
      const main = (await page.locator("main").boundingBox())!;
      expect(toggle.x + toggle.width).toBeLessThanOrEqual(menu.x);
      expect(Math.abs(menu.x + menu.width - (main.x + main.width))).toBeLessThanOrEqual(8);
      expect(Math.abs(toggle.y - menu.y)).toBeLessThanOrEqual(4);

      const h1 = await page.locator("main h1").boundingBox();
      expect(h1!.y).toBeGreaterThanOrEqual(await bandBottom(page));
      await page.locator(".back-rail a").click();
      await expect(page).toHaveURL(/\/databases\/$/);
    });

    test("diagrams stay legible: drawn at 85%+ of their size, scrolling inside the figure", async ({
      page,
    }) => {
      await page.goto("/design/css/css/");
      const figures = page.locator("figure.diagram");
      for (let i = 0; i < (await figures.count()); i++) {
        const svg = figures.nth(i).locator("svg");
        await svg.scrollIntoViewIfNeeded();
        const scale = await svg.evaluate(
          (el: SVGSVGElement) => el.getBoundingClientRect().width / el.viewBox.baseVal.width,
        );
        expect(scale).toBeGreaterThanOrEqual(0.85);
      }
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll).toBeLessThanOrEqual(client);
    });

    test("search's esc is reachable without scrolling", async ({ page }) => {
      await page.goto("/typescript/");
      await hydrated(page);
      await page.keyboard.press("/");
      await page.keyboard.type("a");
      const esc = page.getByRole("button", { name: "Close search" });
      await expect(esc).toBeInViewport();
      if (size.width <= 600) {
        // Phones: pinned top-left, where ../ sits on other pages, above the title.
        const box = (await esc.boundingBox())!;
        const title = (await page.locator(".search h1").boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(title.y);
        expect(box.x).toBeLessThanOrEqual(title.x + 2);
      }
      // Still pinned after the results scroll.
      await page.locator(".search").evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(esc).toBeInViewport();
      await esc.click();
      await expect(page.locator(".search")).toHaveCount(0);
    });

    test("the contents menu opens, jumps to a section and closes", async ({ page }) => {
      await page.goto("/databases/postgres/");
      await hydrated(page);
      await expect(page.locator(".toc-rail nav")).toBeHidden();
      const button = page.getByRole("button", { name: "Table of contents" });
      await button.click();
      const panel = page.locator("#toc-menu-panel");
      await expect(panel).toBeVisible();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const box = await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);

      const entry = panel.locator("a").nth(3);
      const hash = await entry.getAttribute("href");
      await entry.click();
      await expect(panel).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
      const heading = page.locator(`[id="${hash!.slice(1)}"]`);
      await expect(heading).toBeInViewport();
      expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual((await bandBottom(page)) - 1);

      await button.click();
      await expect(panel).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(page).toHaveURL(/\/databases\/postgres\//); // Esc didn't go up a level
    });
  });
}

test.describe("responsive: desktop", () => {
  test("inline code in tables keeps identifiers whole", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/design/css/css/");
    // Breaks at hyphens and punctuation are normal; a break between two letters is the bug.
    // Inline code is highlighted into token spans, so walk every text node inside it.
    const split = await page.locator("main table code").evaluateAll((codes) =>
      codes.flatMap((c) => {
        if (c.getClientRects().length < 2) return [];
        const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
        const chars: { ch: string; top: number }[] = [];
        const range = document.createRange();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n as Text;
          for (let i = 0; i < t.data.length; i++) {
            range.setStart(t, i);
            range.setEnd(t, i + 1);
            chars.push({ ch: t.data[i]!, top: range.getBoundingClientRect().top });
          }
        }
        const midWord = chars.some(
          (x, i) =>
            i > 0 &&
            /\w/.test(chars[i - 1]!.ch) &&
            /\w/.test(x.ch) &&
            Math.abs(x.top - chars[i - 1]!.top) > 2,
        );
        return midWord ? [c.textContent] : [];
      }),
    );
    expect(split).toEqual([]);
  });

  test("numbered lists keep the original row rhythm", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/sheets/");
    const tops = await page
      .locator("main nav[data-menu] a")
      .evaluateAll((links) => links.slice(0, 3).map((a) => a.getBoundingClientRect().top));
    expect(tops[1]! - tops[0]!).toBeGreaterThanOrEqual(23);
  });

  test("wide screens show the contents rail and no menu button", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/databases/postgres/");
    await expect(page.locator(".toc-rail nav")).toBeVisible();
    await expect(page.getByRole("button", { name: "Table of contents" })).toBeHidden();
  });
});

test.describe("touch edge gestures", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  /** Two quick taps at `(x, y)`. */
  async function doubleTap(page: Page, x: number, y = 600) {
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  }

  test("left edge goes up a level; right edge re-enters the row you left", async ({ page }) => {
    await page.goto("/typescript/language/oop/");
    await hydrated(page);
    // The flash lasts 400ms: start waiting for it before tapping, not after the navigation.
    const flash = page.waitForSelector(".tap-flash-left");
    await doubleTap(page, 12);
    await flash;
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
    await expect(page.locator("main nav[data-menu] a[data-active]")).toHaveAttribute(
      "href",
      "/typescript/language/oop/",
    );
    await doubleTap(page, 378);
    await expect(page).toHaveURL(/\/typescript\/language\/oop\/$/);
  });

  test("single taps, the middle of the screen and a right edge with no highlight do nothing", async ({
    page,
  }) => {
    await page.goto("/typescript/language/oop/");
    await hydrated(page);
    await page.touchscreen.tap(12, 600);
    await doubleTap(page, 195);
    await doubleTap(page, 378);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/typescript\/language\/oop\/$/);
    await expect(page.locator(".tap-flash")).toHaveCount(0);
  });

  test("a double tap that closes the contents menu doesn't also go up", async ({ page }) => {
    await page.goto("/typescript/language/oop/");
    await hydrated(page);
    await page.getByRole("button", { name: "Table of contents" }).click();
    await expect(page.locator("#toc-menu-panel")).toBeVisible();
    await doubleTap(page, 20, 800);
    await expect(page.locator("#toc-menu-panel")).toBeHidden();
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/typescript\/language\/oop\/$/);
  });

  test("a double tap on a link just follows the link", async ({ page }) => {
    await page.goto("/typescript/language/");
    await hydrated(page);
    const link = page.locator("main nav[data-menu] a").first();
    const box = (await link.boundingBox())!;
    await doubleTap(page, box.x + 4, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/typescript\/language\/fundamentals\/$/);
  });
});

test.describe("mouse", () => {
  test("double-clicking a screen edge does not navigate", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/typescript/language/oop/");
    await hydrated(page);
    await page.mouse.dblclick(10, 600);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/typescript\/language\/oop\/$/);
  });
});

test.describe("external links", () => {
  test("reference links open in a new tab; links within the site don't", async ({ page }) => {
    await page.goto("/typescript/web-apis/fetch-api/");
    const refs = page.locator("h2#references ~ ul a");
    expect(await refs.count()).toBeGreaterThan(3);
    for (const target of await refs.evaluateAll((els) =>
      els.map((a) => a.getAttribute("target")),
    )) {
      expect(target).toBe("_blank");
    }
    const internal = page.locator('main a[href^="/"]');
    expect(await internal.count()).toBeGreaterThan(0);
    for (const target of await internal.evaluateAll((els) =>
      els.map((a) => a.getAttribute("target")),
    )) {
      expect(target).toBeNull();
    }

    // Clicking one opens a new tab and leaves this page where it was.
    // Stub other sites for every tab in this context, so the popup never hits the network.
    await page
      .context()
      .route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ body: "stub" }));
    const popup = page.context().waitForEvent("page");
    await refs.first().click();
    await (await popup).close();
    await expect(page).toHaveURL(/\/typescript\/web-apis\/fetch-api\/$/);
  });
});

test.describe("links in lists", () => {
  test("a link's text starts at the link, not over the bullet or the words before it", async ({
    page,
  }) => {
    for (const url of ["/typescript/web-apis/fetch-api/", "/info/"]) {
      await page.goto(url);
      const shifted = await page.locator("main ul li a").evaluateAll((links) =>
        links
          .filter((a) => {
            const text = a.querySelector("i") ?? a;
            return text.getBoundingClientRect().left < a.getBoundingClientRect().left - 0.5;
          })
          .map((a) => a.textContent),
      );
      expect(shifted, url).toEqual([]);
    }
  });
});

test.describe("split layout", () => {
  test("a sheet unfolds the docs tree down to itself and marks it", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/typescript/language/array-methods/");
    const nav = page.getByRole("complementary", { name: "Site" });
    await expect(nav).toBeVisible();
    const current = nav.locator('a[aria-current="page"]');
    await expect(current).toHaveText("Array methods");
    await expect(current).toHaveCSS("font-weight", "700");
    // Its parents are bold too, but only the page itself gets the `>`.
    await expect(nav.locator('li[data-mark="path"] > a')).toHaveText([
      "Docs",
      "TypeScript",
      "Language/",
    ]);
    await expect(nav.locator("li[data-mark]")).toHaveCount(4);
    // Other topics stay folded.
    await expect(nav.locator('a[href="/python/language/"]')).toHaveCount(0);
    const [aside, main] = await Promise.all([
      nav.boundingBox(),
      page.locator("main").boundingBox(),
    ]);
    expect(aside!.x + aside!.width).toBeLessThan(main!.x);
  });

  test("outside the docs the tree is folded and the section is marked", async ({ page }) => {
    for (const [url, label] of [
      ["/projects/", "Projects"],
      ["/resume/", "Resume"],
      ["/blog/", "Blog"],
      ["/info/", "Info"],
    ] as const) {
      await page.goto(url);
      const nav = page.getByRole("complementary", { name: "Site" });
      await expect(nav.locator('a[aria-current="page"]')).toHaveText(label);
      await expect(nav.locator(".nav-tree")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/");
    }
  });

  test("projects and resume list the projects; the resume has its sections", async ({ page }) => {
    await page.goto("/projects/");
    await expect(page.locator("main .project-card h3")).toHaveText([
      /^Zach's Docs/,
      /^Playground/,
      "3D Algorithm Visualizer",
    ]);
    await expect(page.locator("main .project-card").first()).toContainText(
      /\d+ cheatsheets across 22 topics/,
    );
    await expect(
      page
        .locator("main .project-card")
        .nth(2)
        .getByRole("link", { name: /source/ }),
    ).toHaveAttribute("href", "https://github.com/ZachSimms/Pathfinding-Algorithm-Visualizer");
    await page.goto("/resume/");
    await expect(page.locator("main h2")).toHaveText([
      "Education",
      "Experience",
      "Projects",
      "University activities",
      "Skills",
    ]);
    await expect(page.locator("main")).toContainText(
      "Science Applications International Corporation",
    );
    await expect(page.locator("main")).not.toContainText("[");
    await expect(page.locator("main")).toContainText("ensured monitoring with Splunk");
    // No PDF is published for now, so there is no download link and the old file is gone.
    await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
    const response = await page.request.get("/docs/ZachSimms_Resume_Updated.pdf");
    expect(response.status()).toBe(404);
    await expect(page.locator('main a[href="mailto:zachsimms97@gmail.com"]')).toHaveText(
      "zachsimms97@gmail.com",
    );
    await expect(page.locator('.site-nav a[href="mailto:zachsimms97@gmail.com"]')).toHaveText(
      "Email",
    );
  });

  test("phones get the sections as one line above the page, without the tree", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/python/fastapi/");
    const sections = page.locator(".nav-sections > li > a");
    await expect(sections.first()).toBeVisible();
    await expect(page.locator(".nav-tree")).toBeHidden();
    // Each section link stays on one line.
    for (const link of await sections.all()) {
      const lines = await link.evaluate((el) => el.getClientRects().length);
      expect(lines).toBe(1);
    }
    const [nav, heading] = await Promise.all([
      page.locator(".nav-sections").boundingBox(),
      page.getByRole("heading", { level: 1 }).boundingBox(),
    ]);
    expect(heading!.y - (nav!.y + nav!.height)).toBeLessThan(120);
  });

  test("framed in the playground's reference panel, a sheet shows without the navigation", async ({
    page,
  }) => {
    await page.goto("/info/");
    await page.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.src = "/python/fastapi/";
      frame.style.width = "1200px";
      frame.style.height = "800px";
      document.body.append(frame);
    });
    const frame = page.frameLocator("iframe");
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("FastAPI");
    await expect(frame.locator(".site-nav")).toBeHidden();
    await expect(frame.locator(".crumbs")).toBeHidden();
  });
});

test.describe("aviation cockpit images", () => {
  test("aircraft sheets show their cockpit images, loaded and within a phone's width", async ({
    page,
  }) => {
    // Ten page loads, each optimizing up to 13 images on first request.
    test.setTimeout(120_000);
    for (const slug of [
      "cessna-172",
      "cessna-172-classic",
      "cirrus-sr22",
      "vision-jet",
      "longitude",
    ]) {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/aviation/msfs-2024/${slug}/`);
        const images = page.locator(`main img[src*="aviation"]`);
        expect(await images.count(), slug).toBeGreaterThanOrEqual(4);
        const problems = await images.evaluateAll(async (imgs) => {
          const out: string[] = [];
          const all = imgs as HTMLImageElement[];
          for (const img of all) img.loading = "eager";
          await Promise.all(all.map((img) => img.decode().catch(() => undefined)));
          for (const img of all) {
            if (img.naturalWidth === 0) out.push(`${img.currentSrc} did not load`);
            if (img.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
              out.push(`${img.currentSrc} overflows`);
            if ((img.alt ?? "").length <= 10) out.push(`${img.currentSrc} has no alt text`);
          }
          return out;
        });
        expect(problems, `${slug} at ${width}px`).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${slug} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe("home keys and zen mode", () => {
  test("zen mode widens the sheet to 88ch and loosens its lines, without overlap or overflow", async ({
    page,
  }) => {
    /** Main's width in ch, its paragraph line-height in px, and the TOC's right edge. */
    const measure = () =>
      page.evaluate(() => {
        const main = document.querySelector("main")!;
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;width:1ch";
        main.append(probe);
        const ch = probe.getBoundingClientRect().width;
        probe.remove();
        const box = main.getBoundingClientRect();
        const toc = document.querySelector(".toc-frame")?.getBoundingClientRect();
        const root = document.documentElement;
        return {
          widthCh: box.width / ch,
          left: box.left,
          lineHeight: parseFloat(getComputedStyle(main.querySelector("p")!).lineHeight),
          codeLineHeight: parseFloat(
            getComputedStyle(main.querySelector("pre") ?? main).lineHeight,
          ),
          fontSize: parseFloat(getComputedStyle(main).fontSize),
          tocRight: toc && toc.width > 0 ? toc.right : null,
          overflow: root.scrollWidth - root.clientWidth,
        };
      });

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/typescript/realtime/chat-rooms/");
    await hydrated(page);
    const off = await measure();
    expect(off.widthCh).toBeCloseTo(72, 0);
    expect(off.lineHeight / off.fontSize).toBeCloseTo(1.5, 2);

    await page.keyboard.press("z");
    await expect(page.getByRole("button", { name: "zen" })).toHaveAttribute("aria-pressed", "true");
    const on = await measure();
    expect(on.widthCh).toBeCloseTo(88, 0);
    expect(on.lineHeight / on.fontSize).toBeCloseTo(1.65, 2);
    expect(on.codeLineHeight).toBeCloseTo(off.codeLineHeight, 1);
    expect(on.tocRight).not.toBeNull();
    expect(on.tocRight!).toBeLessThanOrEqual(on.left);

    // Narrower windows: the column shrinks with the viewport; nothing overlaps or scrolls sideways.
    for (const width of [900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const m = await measure();
      expect(m.overflow, `${width}px`).toBeLessThanOrEqual(0);
      expect(m.widthCh, `${width}px`).toBeGreaterThanOrEqual(72);
      if (m.tocRight !== null) expect(m.tocRight, `${width}px`).toBeLessThanOrEqual(m.left);
    }

    // Phones: zen is already full width, and lines stay at 1.5.
    await page.setViewportSize({ width: 390, height: 800 });
    const phone = await measure();
    expect(phone.overflow).toBeLessThanOrEqual(0);
    expect(phone.lineHeight / phone.fontSize).toBeCloseTo(1.5, 2);

    await page.keyboard.press("z");
  });

  test("p, r, b and g open the sections from the home page", async ({ page }) => {
    for (const [key, url] of [
      ["p", /\/projects\/$/],
      ["r", /\/resume\/$/],
      ["b", /\/blog\/$/],
      ["g", /\/docs\/$/],
    ] as const) {
      await page.goto("/");
      await hydrated(page);
      await effectsFlushed(page);
      await page.keyboard.press(key);
      await expect(page).toHaveURL(url);
    }
  });

  test("zen mode leaves only the sheet, with its contents on the left, and is remembered", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto("/python/fastapi/");
    await hydrated(page);
    const zen = page.getByRole("button", { name: "zen" });
    await expect(zen).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".site-nav")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Contents" })).toBeHidden();

    await page.keyboard.press("z");
    await expect(zen).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".site-nav")).toBeHidden();
    await expect(page.locator(".crumbs")).toBeHidden();
    await expect(page.locator("footer")).toBeHidden();
    const toc = page.getByRole("navigation", { name: "Contents" });
    await expect(toc).toBeVisible();
    const [tocBox, mainBox] = await Promise.all([
      toc.boundingBox(),
      page.locator("main").boundingBox(),
    ]);
    expect(tocBox!.x + tocBox!.width).toBeLessThan(mainBox!.x);

    // Remembered across pages; the home page has no zen switch and keeps its layout.
    await page.goto("/typescript/language/objects/");
    await expect(page.locator(".site-nav")).toBeHidden();
    await page.goto("/python/");
    await expect(page.locator(".site-nav")).toBeVisible();

    await page.goto("/python/fastapi/");
    await hydrated(page);
    await page.getByRole("button", { name: "zen" }).click();
    await expect(page.locator(".site-nav")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("zen"))).toBeNull();
  });
});
