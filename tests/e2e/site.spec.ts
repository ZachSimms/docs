/** Playwright end-to-end tests against a production build served on port 3100. */
import { expect, test, type Page } from "@playwright/test";

/**
 * Wait until client components have hydrated (the theme toggle only gets its
 * `data-target` on the client), so global key listeners are attached.
 */
async function hydrated(page: Page) {
  await expect(page.locator(".theme-toggle")).toHaveAttribute("data-target", /./);
}

test.describe("home", () => {
  test("lists the twelve topics, the v link and the Info footer", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Zach");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zach");

    const nav = page.locator("main nav");
    await expect(nav.locator("a")).toHaveCount(12);
    await expect(nav.locator("span").first()).toHaveText("12.");
    await expect(nav.locator("span").last()).toHaveText("01.");
    await expect(nav.locator("a").first()).toHaveText("Maths");
    await expect(nav.locator("a").last()).toHaveText("Design");

    await expect(page.locator("p.v a")).toHaveAttribute("href", "/sheets/");
    await expect(page.locator("footer a").first()).toHaveAttribute("href", "/info/");
    await expect(page.locator("footer a").first()).toHaveText("Info");

    const search = page.getByRole("button", { name: /search/i });
    await expect(search).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(search).toHaveCSS("border-top-width", "0px");
    await expect(search.locator("i")).toHaveCSS("border-bottom-style", "dotted");
  });

  test("uses the original's visual system", async ({ page }) => {
    await page.goto("/");
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe("rgb(242, 242, 242)");

    const link = page.locator("main nav a i").first();
    await expect(link).toHaveCSS("border-bottom-style", "dotted");
    await expect(link).toHaveCSS("border-bottom-width", "1px");

    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toBe("monospace");

    const mainWidth = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
    const chWidth = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.textContent = "0";
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
    expect(mainWidth).toBeLessThanOrEqual(64 * chWidth + 1);
  });
});

test.describe("navigation", () => {
  test("topic page lists its sheets and ../ returns home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Physics" }).click();
    await expect(page).toHaveURL(/\/physics\/$/);
    await expect(page).toHaveTitle("Physics - Zach");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Physics");
    await expect(page.locator("main nav a")).toHaveCount(1);
    await expect(page.locator("main nav span").first()).toHaveText("00.");

    await page.locator("footer a", { hasText: "../" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zach");
  });

  test("sheet page renders MDX in house style and ../ returns to its topic", async ({ page }) => {
    await page.goto("/databases/postgres/");
    await expect(page).toHaveTitle("PostgreSQL - Zach");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PostgreSQL");
    await expect(page.locator("main > p").first()).toHaveText("-");

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
    const links = page.locator("main nav a");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(9);
    await expect(links.first()).toHaveText(/^[a-z-]+(\/[a-z-]+){1,2}$/);
    await expect(page.getByRole("link", { name: "typescript/backend/websockets" })).toHaveAttribute(
      "href",
      "/typescript/backend/websockets/",
    );
    await expect(page.locator("main nav span").first()).toHaveText("00.");
    await expect(page.locator("main nav span").last()).toHaveText(
      `${String(count - 1).padStart(2, "0")}.`,
    );
    await expect(page.locator("footer a").first()).toHaveAttribute("href", "/");
  });

  test("info page links back with ../", async ({ page }) => {
    await page.goto("/info/");
    await expect(page).toHaveTitle("Info - Zach");
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
  test("fenced code is tokenised by Shiki with dual-theme variables; inline code keeps the chip", async ({
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
    await page.getByRole("button", { name: /search/i }).click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("background-color", "rgb(242, 242, 242)");
    await expect(dialog.getByRole("combobox")).toBeFocused();
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

    // Monochrome: the icon takes the text colour of the theme.
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
    await expect(main.locator("h2")).toHaveCount(12);
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
      "/maths/notation/",
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

  test("maths reference sheets render their tables and formulas", async ({ page }) => {
    await page.goto("/maths/math-fundamentals/");
    const main = page.locator("main");
    expect(await main.locator("h2").count()).toBe(25); // 1.1–1.24 + References
    expect(await main.locator("table").count()).toBeGreaterThanOrEqual(25);
    expect(await main.locator(".katex").count()).toBeGreaterThan(300);
    await expect(main.locator('h2[id="11-solving-equations"]')).toHaveText("1.1 Solving equations");
    await expect(main.locator('h2[id="124-math-problems"]')).toHaveText("1.24 Math problems");
    // 1.12 relies on the drawn graphs; the only raster image is the unit circle in 1.15.
    await expect(main.locator("img")).toHaveCount(1);
    await expect(main.getByRole("img", { name: /unit circle/i })).toHaveAttribute("width", "691");

    await page.goto("/maths/notation/");
    await expect(page.locator("main h2")).toHaveText([
      "Math notation",
      "Set notation",
      "Complex numbers notation",
      "Vectors notation",
      "Mechanics notation",
      "Calculus notation",
      "References",
    ]);

    await page.goto("/maths/constants-units-conversions/");
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
    await page.goto("/maths/math-fundamentals/");
    await expect(page.locator("main h2").first()).toHaveCSS("font-weight", "700");
    await expect(page.locator("main h1")).toHaveCSS("font-weight", "400");

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
    await expect(toc.locator('a[aria-current="location"]')).toHaveText("1.16 Trigonometric identities");

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(toc).toBeHidden();
  });

  test("a back link stays pinned at the top-left of the column while scrolling", async ({
    page,
  }) => {
    await page.goto("/maths/math-fundamentals/");
    const pinned = page.locator(".back-rail a");
    await expect(pinned).toHaveText("../");
    await expect(pinned).toHaveAttribute("href", "/maths/");

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
    await expect(page).toHaveURL(/\/maths\/$/);
    await expect(page.locator(".back-rail a")).toHaveAttribute("href", "/");

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

  test("functions reference and transformations show coloured graphs", async ({ page }) => {
    await page.goto("/maths/math-fundamentals/");
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
    await page.goto("/maths/reading-graphs/");
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

  test("the Maths topic exists and is listed first", async ({ page }) => {
    await page.goto("/maths/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maths");
    await expect(page.locator("main nav a")).toHaveCount(5);
    // Frontmatter `order` puts the fundamentals first; numbering runs 00. from the top.
    await expect(page.locator("main nav a").first()).toHaveText("Math fundamentals");
    await expect(page.locator("main nav span").first()).toHaveText("00.");
    await expect(page.locator("main nav span").last()).toHaveText("04.");
    await page.getByRole("link", { name: "Math fundamentals" }).click();
    await expect(page).toHaveURL(/\/maths\/math-fundamentals\/$/);
    const display = page.locator("main .katex-display");
    expect(await display.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator("main .katex-mathml math").first()).toBeAttached();
    // Rendered HTML layer is present; the raw LaTeX only survives inside the hidden MathML annotation.
    expect(await page.locator("main .katex-html").count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator("main .katex-html").first()).toBeVisible();
    // KaTeX glyphs take the theme's text colour.
    await expect(display.first().locator(".katex")).toHaveCSS("color", "rgb(0, 0, 0)");
  });
});

test.describe("typescript topic and directories", () => {
  test("the topic lists its seven directories, then its loose sheet", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "TypeScript" }).click();
    await expect(page).toHaveURL(/\/typescript\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("TypeScript");
    const links = page.locator("main nav a");
    await expect(links).toHaveText([
      "Language/",
      "Design & architecture/",
      "Runtimes & tooling/",
      "Frontend/",
      "React/",
      "Web APIs/",
      "Backend/",
      "Testing",
    ]);
    await expect(links.nth(1)).toHaveAttribute("href", "/typescript/design-architecture/");
    await expect(page.locator("main nav span").last()).toHaveText("07.");
  });

  test("a directory page shows its intro and sheets; ../ returns to the topic", async ({
    page,
  }) => {
    await page.goto("/typescript/language/");
    await expect(page).toHaveTitle("Language - Zach");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Language");
    await expect(page.locator("main > p").nth(1)).toContainText("type system");
    const links = page.locator("main nav a");
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
    await page.getByRole("link", { name: "Array methods" }).click();
    await expect(page).toHaveURL(/\/typescript\/language\/array-methods\/$/);
    await expect(page).toHaveTitle("Array methods - Zach");
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
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/sheets/");
    const hrefs = await page
      .locator(
        'main nav a:is([href^="/typescript/"], [href^="/databases/"], [href^="/infrastructure/"], [href^="/design/principles/"], [href^="/design/css/"])',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs).toHaveLength(61);
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
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search" });
    await dialog.getByRole("combobox").fill("backend websockets");
    await expect(dialog.getByRole("option").first()).toHaveText("typescript/backend/websockets");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/typescript\/backend\/websockets\/$/);
  });
});

test.describe("new topics", () => {
  test("databases and infrastructure are listed after TypeScript", async ({ page }) => {
    await page.goto("/");
    const links = page.locator("main nav a");
    await expect(links.nth(4)).toHaveText("TypeScript");
    await expect(links.nth(5)).toHaveText("Databases");
    await expect(links.nth(6)).toHaveText("Infrastructure");
    await page.goto("/infrastructure/");
    await expect(page.locator("main nav a")).toHaveText([
      "Linux/",
      "Containers/",
      "Kubernetes/",
      "Grafana",
      "Communication networks",
    ]);
  });

  test("the design showcase is titled Demo", async ({ page }) => {
    await page.goto("/design/");
    await expect(page.locator("main nav a").last()).toHaveText("Demo");
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
      page.locator("main pre:not(.file-tree pre)").first().evaluate((el) => getComputedStyle(el).backgroundColor),
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
    const backTo = (href: string) => expect(page.locator(".back-rail a")).toHaveAttribute("href", href);
    await backTo("/typescript/language/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/typescript\/language\/$/);
    await backTo("/typescript/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/typescript\/$/);
    await backTo("/");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zach");
  });

  test("list pages are menus: arrows and j/k move a > highlight, Enter opens, hover follows", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    const nav = page.locator("main nav");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("j");
    const active = nav.locator("a[data-active]");
    await expect(active).toHaveText("Physics");
    const marker = await nav
      .locator("span[data-active]")
      .evaluate((el) => getComputedStyle(el, "::before").content);
    expect(marker).toBe('">"');
    await expect(active.locator("i")).toHaveCSS("border-bottom-style", "solid");

    await nav.getByRole("link", { name: "Biology" }).hover();
    await page.mouse.move(5, 5); // leaving the row keeps its highlight
    await nav.getByRole("link", { name: "Biology" }).hover();
    await expect(active).toHaveText("Biology");
    await page.keyboard.press("k");
    await expect(active).toHaveText("Physics");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/physics\/$/);
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
    const backTo = (href: string) => expect(page.locator(".back-rail a")).toHaveAttribute("href", href);

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
    await backTo("/");
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
    for (const width of [1240, 1300, 1600]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(toc).toBeVisible();
      const box = await toc.boundingBox();
      expect(box!.x + box!.width, `width ${width}`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1200, height: 800 });
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
    // The band is painted (a gradient ending in the page colour) and reaches below both controls.
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
    for (const topic of ["python", "maths", "physics"]) {
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

  test("maths sheets end with their references", async ({ page }) => {
    await page.goto("/maths/constants-units-conversions/");
    await expect(page.locator("main h2").last()).toHaveText("References");
    await expect(page.locator("main h2").last().locator("~ ul a").first()).toHaveAttribute(
      "href",
      /physics\.nist\.gov/,
    );
  });
});

