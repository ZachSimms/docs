/**
 * @file The terminal's runtime: the shell's view of the browser ({@link makeHost}), and
 * everything else the terminal needs once it opens.
 *
 * The terminal component imports this module on first open (a dynamic `import()`), so
 * the shell, the filesystem and the page reader add nothing to the JavaScript of a page
 * whose reader never presses `` ` ``.
 */

import { applyTheme, currentTheme } from "@/components/useTheme";
import { openSearch } from "@/components/SearchLink";
import { setZen } from "@/components/ZenToggle";
import { loadSearchIndex } from "../search-index-client";
import { rankSearch } from "../search-rank";
import { ZEN_ATTRIBUTE } from "../theme";
import { loadPageMain } from "./client";
import { pageHeadings, pageText } from "./page-text";
import type { Host, ScrollTo } from "./shell";
import { normalizeHref, type FsNode } from "./vfs";

export { loadFs } from "./client";
export { Shell } from "./shell";
export { complete, nodeForHref, pathOf } from "./vfs";

/** Most results `grep` asks the search index for. */
const SEARCH_LIMIT = 20;

/** The page's own `<main>` (the palette's is only there while it is open, after it). */
function pageMain(): Element | null {
  return document.querySelector("main");
}

/** Whether `node` is the page on screen. */
function isShowing(node: FsNode): boolean {
  return normalizeHref(window.location.pathname) === node.href;
}

/** The `<main>` of `node`'s page: the live one when it is showing, else fetched. */
function mainOf(node: FsNode): Promise<Element | null> {
  return isShowing(node) ? Promise.resolve(pageMain()) : loadPageMain(node.href);
}

/** The heading ids of the page on screen, which Tab completes after `#`. */
export function pageAnchors(): string[] {
  return pageHeadings(pageMain() ?? document).map((heading) => heading.id);
}

/** The router methods the shell uses (`useRouter()` has them). */
export interface HostRouter {
  push(href: string): void;
  back(): void;
  forward(): void;
}

/** What {@link makeHost} needs from the terminal component. */
export interface HostDeps {
  /** The current router; a function, since the component's router can change. */
  router(): HostRouter;
  history(): readonly string[];
  clear(): void;
  close(): void;
  toggleMax(): boolean;
}

/** The shell's view of the browser: router, DOM, theme, zen, search and the component. */
export function makeHost(deps: HostDeps): Host {
  return {
    navigate: (href) => deps.router().push(href),
    openExternal: (href) => {
      window.open(href, "_blank", "noopener,noreferrer");
    },
    back: () => deps.router().back(),
    forward: () => deps.router().forward(),
    showing: isShowing,
    headings: async (node) => {
      const main = await mainOf(node);
      return main ? pageHeadings(main) : null;
    },
    pageText: async (node) => {
      const main = await mainOf(node);
      return main ? pageText(main) : null;
    },
    scrollToHeading: (id) => {
      const heading = document.getElementById(id);
      if (!heading || !pageMain()?.contains(heading)) return false;
      heading.scrollIntoView({ block: "start" });
      // Keep Next's own history state so back and forward still work.
      window.history.replaceState(window.history.state, "", `#${encodeURIComponent(id)}`);
      return true;
    },
    scroll: (to: ScrollTo) => {
      const terminal = document.querySelector(".terminal");
      const visible = window.innerHeight - (terminal?.getBoundingClientRect().height ?? 0);
      const page = Math.max(visible, window.innerHeight / 4) * 0.9;
      if (to === "top") window.scrollTo({ top: 0 });
      else if (to === "bottom") window.scrollTo({ top: document.documentElement.scrollHeight });
      else window.scrollBy({ top: to === "down" ? page : -page });
    },
    theme: currentTheme,
    setTheme: applyTheme,
    zen: () =>
      document.querySelector("[data-zen-able]")
        ? document.documentElement.hasAttribute(ZEN_ATTRIBUTE)
        : null,
    setZen,
    search: async (query) =>
      rankSearch(await loadSearchIndex(), query, SEARCH_LIMIT).map(({ doc }) => ({
        url: doc.url,
        title: doc.title,
      })),
    openSearch,
    history: deps.history,
    clear: deps.clear,
    close: deps.close,
    toggleMax: deps.toggleMax,
  };
}
