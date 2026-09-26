/**
 * @file npm packages for playground projects: `package.json` versions → esm.sh URLs.
 *
 * Bare imports (`import { Hono } from "hono"`) load from esm.sh at the version
 * the project's `package.json` asks for, or the latest when it doesn't list
 * the package. When the project uses React, every other package is built
 * against the same React (`?deps=react@…,react-dom@…`), so one React instance
 * runs. Names and version ranges are validated so a `package.json` can't
 * inject paths or query strings into the URLs; bad entries are skipped with a
 * warning.
 */

/** The CDN that serves npm packages as browser ES modules. */
export const ESM_CDN = "https://esm.sh/";

/** An npm package name (scoped or not), lowercase as npm requires. */
const PACKAGE_NAME = /^(?:@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*$/;
/** A semver version or range: digits, letters, `. ^ ~ < > = | * + -` and spaces only. */
const VERSION_RANGE = /^[\w.^~<>=|*+ -]{1,64}$/;
/** A subpath inside a package (`/client`, `/jsx-runtime`, `/dist/x.css`). */
const SUBPATH = /^(?:\/[\w.@~-]+)*$/;

/** The dependencies a project declares. */
export interface Dependencies {
  /** Package name → version range. */
  readonly versions: ReadonlyMap<string, string>;
  /** Entries that were skipped, phrased for the console. */
  readonly warnings: readonly string[];
}

/** No dependencies. */
export const NO_DEPENDENCIES: Dependencies = { versions: new Map(), warnings: [] };

/**
 * Read `dependencies` and `devDependencies` from the project's `package.json`.
 *
 * @param files - The project's files.
 * @returns Valid entries, plus a warning for each skipped one (or for unreadable JSON).
 */
export function readDependencies(files: Readonly<Record<string, string>>): Dependencies {
  if (!Object.prototype.hasOwnProperty.call(files, "package.json")) return NO_DEPENDENCIES;
  let json: unknown;
  try {
    json = JSON.parse(files["package.json"] ?? "");
  } catch {
    return {
      versions: new Map(),
      warnings: ["package.json isn't valid JSON; using the latest versions."],
    };
  }
  const versions = new Map<string, string>();
  const warnings: string[] = [];
  const record = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
  for (const field of ["dependencies", "devDependencies"]) {
    const deps = record[field];
    if (typeof deps !== "object" || deps === null) continue;
    for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
      if (!PACKAGE_NAME.test(name))
        warnings.push(`package.json: "${name}" isn't a valid package name; skipped.`);
      else if (typeof range !== "string" || !VERSION_RANGE.test(range.trim())) {
        warnings.push(
          `package.json: the version of "${name}" isn't a plain version range; using the latest.`,
        );
      } else versions.set(name, range.trim());
    }
  }
  return { versions, warnings };
}

/**
 * Split a bare specifier into its package name and subpath.
 *
 * @example
 * splitSpecifier("react-dom/client"); // { name: "react-dom", subpath: "/client" }
 * splitSpecifier("@hono/zod-validator"); // { name: "@hono/zod-validator", subpath: "" }
 */
export function splitSpecifier(specifier: string): { name: string; subpath: string } {
  const parts = specifier.split("/");
  const count = specifier.startsWith("@") ? 2 : 1;
  return {
    name: parts.slice(0, count).join("/"),
    subpath: parts.length > count ? `/${parts.slice(count).join("/")}` : "",
  };
}

/** `@range` for a URL (spaces in ranges like `>=1 <2` encoded). */
const at = (range: string | undefined) =>
  range ? `@${encodeURIComponent(range).replace(/%5E/g, "^")}` : "";

/**
 * The esm.sh URL for a bare import.
 *
 * @param specifier - As written, e.g. `hono/cors` or `react-dom/client`.
 * @param deps - The project's dependencies.
 * @returns The URL, or `null` if the specifier isn't a valid package name and subpath.
 */
export function esmUrl(specifier: string, deps: Dependencies): string | null {
  const { name, subpath } = splitSpecifier(specifier);
  if (!PACKAGE_NAME.test(name) || !SUBPATH.test(subpath)) return null;
  const versions = deps.versions;
  const react = versions.get("react");
  const pinReact = react !== undefined && name !== "react" && name !== "react-dom";
  const reactDeps = pinReact
    ? `?deps=react${at(react)}${versions.has("react-dom") ? `,react-dom${at(versions.get("react-dom"))}` : ""}`
    : "";
  return `${ESM_CDN}${name}${at(versions.get(name))}${subpath}${reactDeps}`;
}
