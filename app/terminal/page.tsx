/**
 * @file `/terminal/`: the site as a shell, full screen. The terminal itself lives in the
 * root layout and opens over this page, on arrival and after a reload, so the page can
 * be bookmarked. What shows beneath it (after `Esc` or `max`) says what it is and how
 * to bring it back.
 */
import type { Metadata } from "next";
import { Fragment } from "react";
import { Page } from "@/components/Page";
import { OpenTerminalOnArrival, TerminalLink } from "@/components/TerminalLink";
import { TERMINAL_KEY } from "@/lib/keys";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = {
  title: "Terminal",
  description: "Every page of the site as a path in a shell: ls, cd, cat, grep and more.",
};

/** A first few commands, `[command, what it does]`; `help` in the terminal lists them all. */
const FIRST_COMMANDS: readonly (readonly [string, string])[] = [
  ["ls", "what is here"],
  ["cd docs/python", "go to a page"],
  ["tree", "the pages below"],
  ["toc", "a page's sections"],
  ["cat", "a page as text"],
  ["grep <words>", "search every sheet"],
  ["help", "everything else"],
];

/** Column the descriptions start at, on the monospace grid. */
const COMMAND_WIDTH = 16;

/** Terminal page. */
export default function TerminalPage() {
  return (
    <Page
      title="Terminal"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
    >
      <OpenTerminalOnArrival />
      <p>
        The whole site as a shell: every page is a path, <code>~</code> is home and{" "}
        <code>~/docs/python</code> a topic. This page opens it full screen; bookmark it to start
        there.
      </p>
      <p>
        {">"} <TerminalLink label="Open the terminal" max />
        <span className="dim">
          {" "}
          or press <kbd>{TERMINAL_KEY}</kbd> on any page
        </span>
      </p>
      <p>-</p>
      <p className="keys">
        {FIRST_COMMANDS.map(([command, action]) => (
          <Fragment key={command}>
            <kbd>{command}</kbd>
            {" ".repeat(COMMAND_WIDTH - command.length)}
            {action}
            <br />
          </Fragment>
        ))}
      </p>
    </Page>
  );
}
