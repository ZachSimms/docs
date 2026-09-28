/**
 * @file Link a multi-file JS/TS (or HTML) project into self-contained modules.
 *
 * Runs in the parent page and only *transforms* code; nothing is evaluated
 * here. Each project file becomes a `data:` URL module whose relative import
 * specifiers are rewritten to the data URLs of the files they name,
 * dependencies first, so the sandboxed runner (an opaque origin that can't see
 * the parent's `blob:` URLs) can `import()` the entry directly.
 *
 * Resolution follows TypeScript's bundler rules closely enough for practice:
 * `./x` tries `x`, `x.ts`, `x.tsx`, `x.js`, … and `x/index.*`, and `./x.js`
 * also finds `x.ts`. Bare specifiers go to esm.sh, absolute URLs are kept,
 * `node:` built-ins are refused. Import cycles are reported (data URLs are
 * content-addressed, so a cycle can't be expressed).
 */

import { init, parse } from "es-module-lexer";
import { esmUrl, readDependencies, type Dependencies } from "./npm";
import { dirname, hasFile, joinPath } from "./project";
import { replaceTags } from "./tags";

/** Compile one file to JavaScript (see `transpile.ts`). */
export type Transpile = (path: string, code: string) => string;

/** A problem linking the project, phrased for the console. */
export class LinkError extends Error {
  override name = "LinkError";
}

/** Where an import specifier points. */
export type Resolution =
  | { kind: "file"; path: string }
  | { kind: "url"; url: string }
  | { kind: "missing"; reason?: string };

/** The linked project: the entry's URL and every linked file's URL, dependencies first. */
export interface LinkedModules {
  readonly entryUrl: string;
  readonly urls: ReadonlyMap<string, string>;
  /** Problems with `package.json` entries that were skipped. */
  readonly warnings: readonly string[];
}

/** Extensions tried, in order, for an extensionless relative import. */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
/** A `./x.js` import may name `x.ts` (TypeScript's ESM convention). */
const JS_TO_TS: Readonly<Record<string, string[]>> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
};
/** Absolute URL schemes kept as they are. */
const URL_SCHEME = /^(?:https?|data|blob):/i;
/** Media types for non-script files a project can reference. */
const MEDIA_TYPES: Readonly<Record<string, string>> = {
  json: "application/json",
  svg: "image/svg+xml",
  txt: "text/plain",
};

/**
 * Encode text as a base64 `data:` URL.
 *
 * @param text - Source text (UTF-8 encoded into the URL).
 * @param mediaType - The URL's media type.
 */
export function toDataUrl(text: string, mediaType = "text/javascript"): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}

/** Decode a base64 `data:` URL made by {@link toDataUrl}. */
export function fromDataUrl(url: string): string {
  const base64 = url.slice(url.indexOf(",") + 1);
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/** Resolve `.`/`..` segments; `null` if the path climbs above the project root. */
function normalize(path: string): string | null {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(segment);
  }
  return out.join("/");
}

/** Candidate files for a relative import, in resolution order. */
function candidates(base: string): string[] {
  const dot = base.lastIndexOf(".");
  const ext = dot > base.lastIndexOf("/") ? base.slice(dot) : "";
  const swapped = (JS_TO_TS[ext] ?? []).map((ts) => base.slice(0, -ext.length) + ts);
  return [
    base,
    ...swapped,
    ...EXTENSIONS.map((e) => base + e),
    ...EXTENSIONS.map((e) => `${base}/index${e}`),
  ];
}

/**
 * Resolve an import specifier written in `from`.
 *
 * @param from - The importing file's path.
 * @param specifier - The specifier as written.
 * @param files - The project's files.
 * @param deps - The project's npm dependencies (read from `package.json` when omitted).
 */
export function resolveSpecifier(
  from: string,
  specifier: string,
  files: Readonly<Record<string, string>>,
  deps: Dependencies = readDependencies(files),
): Resolution {
  if (URL_SCHEME.test(specifier)) return { kind: "url", url: specifier };
  if (specifier.startsWith("node:")) {
    return { kind: "missing", reason: "Node built-ins aren't available in the browser" };
  }
  if (specifier.startsWith("bun:")) {
    return {
      kind: "missing",
      reason: "Bun's built-in modules aren't part of the browser emulation",
    };
  }
  const isRelative =
    specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
  if (!isRelative) {
    const url = esmUrl(specifier, deps);
    return url
      ? { kind: "url", url }
      : { kind: "missing", reason: "it isn't a valid npm package name" };
  }
  const joined = specifier.startsWith("/")
    ? specifier.slice(1)
    : joinPath(dirname(from), specifier);
  const base = normalize(joined);
  if (base === null) return { kind: "missing", reason: "it points outside the project" };
  const found = candidates(base).find((c) => hasFile(files, c));
  return found ? { kind: "file", path: found } : { kind: "missing" };
}

/** A JS module that injects a stylesheet into the document (a no-op in workers). */
function cssModule(path: string, css: string): string {
  return `if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.dataset.file = ${JSON.stringify(path)};
  style.textContent = ${JSON.stringify(css)};
  document.head.append(style);
}
export default ${JSON.stringify(css)};
`;
}

/** Extension of a path, lower-case, without the dot. */
const extOf = (path: string) => path.slice(path.lastIndexOf(".") + 1).toLowerCase();

/** Rewrites linked JavaScript once more (the web preview's loop guards); identity by default. */
export type Instrument = (code: string) => string;

/** A linker bound to one project: links files on demand and remembers their URLs. */
function createLinker(
  files: Readonly<Record<string, string>>,
  transpile: Transpile,
  instrument: Instrument = (code) => code,
) {
  const urls = new Map<string, string>();
  const stack: string[] = [];
  const deps = readDependencies(files);

  /** Resolve a specifier to the URL that should replace it, or throw. */
  function urlFor(from: string, specifier: string): string {
    const resolved = resolveSpecifier(from, specifier, files, deps);
    if (resolved.kind === "url") return resolved.url;
    if (resolved.kind === "file") return visit(resolved.path);
    const why = resolved.reason ? ` (${resolved.reason})` : "";
    throw new LinkError(`Cannot find "${specifier}" imported from ${from}${why}.`);
  }

  /** Rewrite every static import and literal dynamic import in `code`. */
  function rewrite(code: string, from: string): string {
    let imports;
    try {
      [imports] = parse(code, from);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LinkError(`${from}: syntax error (${message}).`);
    }
    let out = code;
    for (const imp of [...imports].sort((a, b) => b.start - a.start)) {
      // import.meta, computed import(x), and template-literal globs (import(`./${x}.js`)) stay as written.
      if (imp.type === "import-meta" || imp.specifier === undefined) continue;
      if (imp.type === "dynamic" && imp.glob) continue;
      const url = urlFor(from, imp.specifier);
      const replacement = imp.type === "dynamic" ? JSON.stringify(url) : url;
      out = out.slice(0, imp.start) + replacement + out.slice(imp.end);
    }
    return out;
  }

  /** The URL of one project file, linking it (and its imports) the first time. */
  function visit(path: string): string {
    const cached = urls.get(path);
    if (cached) return cached;
    if (stack.includes(path)) {
      const cycle = [...stack.slice(stack.indexOf(path)), path].join(" → ");
      throw new LinkError(
        `Import cycle: ${cycle}. Move the shared code into a module both can import.`,
      );
    }
    const text = files[path] ?? "";
    const mediaType = MEDIA_TYPES[extOf(path)];
    let url: string;
    if (extOf(path) === "css") {
      // `import "./styles.css"` (React-style): a module that adds the stylesheet to the page.
      url = toDataUrl(cssModule(path, text));
    } else if (mediaType) {
      url = toDataUrl(text, mediaType);
    } else {
      stack.push(path);
      try {
        url = toDataUrl(instrument(rewrite(transpileOrThrow(path, text), path)));
      } finally {
        stack.pop();
      }
    }
    urls.set(path, url);
    return url;
  }

  /** Transpile, turning compiler errors into link errors. */
  function transpileOrThrow(path: string, text: string): string {
    try {
      return transpile(path, text);
    } catch (error) {
      throw new LinkError(error instanceof Error ? error.message : String(error));
    }
  }

  return { urls, visit, rewrite, warnings: deps.warnings };
}

/**
 * Link a script project from its entry file.
 *
 * @param files - The project's files.
 * @param entry - The entry file.
 * @param transpile - TS/JSX compiler.
 * @returns The entry's URL and every linked file's URL.
 * @throws {LinkError} For a missing module, a cycle or a syntax error.
 */
export async function linkModules(
  files: Readonly<Record<string, string>>,
  entry: string,
  transpile: Transpile,
): Promise<LinkedModules> {
  await init();
  const linker = createLinker(files, transpile);
  const entryUrl = linker.visit(entry);
  return { entryUrl, urls: linker.urls, warnings: linker.warnings };
}

/**
 * Replace linked modules' data URLs in a message (an error's stack, say) with
 * their file paths.
 */
export function replaceModuleUrls(text: string, urls: ReadonlyMap<string, string>): string {
  let out = text;
  for (const [path, url] of [...urls].sort((a, b) => b[1].length - a[1].length)) {
    out = out.split(url).join(path);
  }
  return out;
}

/** `name="value"` pairs of one tag (quoted or bare values). */
const ATTRIBUTE = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

/** A tag's attributes as a lower-cased map. */
function attributesOf(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const m of tag.matchAll(ATTRIBUTE)) {
    attrs.set((m[1] ?? "").toLowerCase(), m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Replace one attribute's value in a tag's source. */
function setAttribute(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  return tag.replace(pattern, (_m, prefix: string) => `${prefix}"${value}"`);
}

/** Whether an HTML reference points at another site (or is a fragment) rather than a project file. */
const isExternal = (ref: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

/**
 * Link a web project: stylesheets are inlined, module scripts (external and
 * inline) are linked like {@link linkModules}, classic scripts and SVG
 * images become `data:` URLs. External URLs are left alone.
 *
 * @param files - The project's files.
 * @param htmlPath - The HTML entry file.
 * @param transpile - TS/JSX compiler for script files.
 * @param instrument - Applied to every script's JavaScript (files and inline) after linking.
 * @returns The HTML to show in the preview, and the linked module URLs.
 * @throws {LinkError} When the page references a file that isn't in the project.
 */
export async function linkWebDocument(
  files: Readonly<Record<string, string>>,
  htmlPath: string,
  transpile: Transpile,
  instrument: Instrument = (code) => code,
): Promise<{ html: string; urls: ReadonlyMap<string, string> }> {
  await init();
  const linker = createLinker(files, transpile, instrument);

  /** The project path an HTML reference names, or `null` for an external URL. */
  const local = (ref: string): string | null => {
    if (isExternal(ref)) return null;
    const clean = ref.split(/[?#]/)[0] ?? "";
    const path = normalize(
      clean.startsWith("/") ? clean.slice(1) : joinPath(dirname(htmlPath), clean),
    );
    if (path === null || !hasFile(files, path)) {
      throw new LinkError(`${htmlPath} references "${ref}", which isn't in the project.`);
    }
    return path;
  };

  let html = files[htmlPath] ?? "";

  // Scanned rather than `html.replace(/<script\b([^>]*)>…/gi)`, which is quadratic on
  // unclosed tags: the reader's HTML is linked on every pause in typing and every load.
  html = replaceTags(
    html,
    /<script\b/i,
    ({ text: whole, attrs: attrText, body }) => {
      const attrs = attributesOf(attrText);
      const type = attrs.get("type")?.trim().toLowerCase() ?? "";
      const isModule = type === "module";
      // JSON, import maps and templates are data, not code.
      const isClassic = type === "" || /^(?:text|application)\/(?:java|ecma)script$/.test(type);
      const src = attrs.get("src");
      if (src !== undefined) {
        const path = local(src);
        if (path === null) return whole;
        const url = isModule
          ? linker.visit(path)
          : toDataUrl(instrument(transpile(path, files[path] ?? "")));
        return setAttribute(whole.slice(0, whole.indexOf(">") + 1), "src", url) + "</script>";
      }
      if (isModule)
        return `<script${attrText}>${instrument(linker.rewrite(body, htmlPath))}</script>`;
      if (isClassic) return `<script${attrText}>${instrument(body)}</script>`;
      return whole;
    },
    /<\/script>/i,
  );

  html = replaceTags(html, /<link\b/i, ({ text: tag }) => {
    const attrs = attributesOf(tag);
    const href = attrs.get("href");
    if (!/\bstylesheet\b/i.test(attrs.get("rel") ?? "") || href === undefined) return tag;
    const path = local(href);
    if (path === null) return tag;
    const css = (files[path] ?? "").replace(/<\/(style)/gi, "<\\/$1");
    return `<style>/* ${path} */\n${css}</style>`;
  });

  html = replaceTags(html, /<(?:img|source)\b/i, ({ text: tag }) => {
    const src = attributesOf(tag).get("src");
    if (src === undefined || !src.toLowerCase().endsWith(".svg")) return tag;
    const path = local(src);
    return path === null
      ? tag
      : setAttribute(tag, "src", toDataUrl(files[path] ?? "", "image/svg+xml"));
  });

  return { html, urls: linker.urls };
}
