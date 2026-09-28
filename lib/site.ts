/**
 * @file Site-wide constants: the title used for the home page `<h1>` and the
 * `<title>` template, the docs' own name, the description used for
 * `<meta name="description">`, and the terminal's page.
 */

/** Site name; shown as the home page heading and appended to every page title. */
export const SITE_TITLE = "Zach";

/** The references and cheatsheets under `/docs/`, as a project of their own. */
export const DOCS_TITLE = "Zach's Docs";

/** One-line description for search engines and link previews. */
export const SITE_DESCRIPTION =
  "Zach's projects, writing and resume, and his references and cheatsheets: physics, biology, economics, finance, thinking tools, leadership, startups, ML/AI, Python, C++, robotics, writing and design.";

/**
 * The terminal's own page: opens the terminal full screen, on arrival and after a reload,
 * so the site can be bookmarked as a shell.
 */
export const TERMINAL_PATH = "/terminal/";
