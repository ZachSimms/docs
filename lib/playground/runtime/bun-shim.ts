/**
 * @file An emulation of Bun's APIs for the sandboxed JS worker.
 *
 * Serialized with `toString()` into the worker (see `sandbox.ts`), so it must
 * be self-contained. What it provides:
 * - `Bun.serve({ fetch, port })` registers the handler; requests arrive from
 *   the page's HTTP panel as `request` messages and are answered with
 *   `response` messages. A default export with a `fetch` method (Hono's
 *   `export default app`) is served the same way.
 * - `Bun.file(path)` / `Bun.write(path, data)` over an in-memory copy of the
 *   project's files; `Bun.env` / `process.env` from `.env`; `Bun.sleep`.
 * - `Bun.spawn`, `Bun.$` and friends throw a clear "not available" error.
 * It never leaves the sandbox: requests are handled in the worker itself.
 */

/** A request from the HTTP panel. */
export interface ShimRequest {
  id: string;
  method: string;
  url: string;
  headers: [string, string][];
  body: string;
}

/** What the worker needs from the shim. */
export interface BunShimHandle {
  /** Answer one request from the HTTP panel. */
  handle(request: ShimRequest): Promise<void>;
  /** Serve the module's default export if it has a `fetch` method and nothing is served yet. */
  adopt(module: unknown): void;
}

/**
 * Install `Bun` and `process` on the worker's global scope.
 *
 * @param scope - The worker's global object.
 * @param files - The project's text files (the in-memory filesystem).
 * @param env - Variables from `.env`.
 * @param entry - The entry file's path (`Bun.main`).
 * @param post - Sends a message to the page.
 */
export function installBunShim(
  scope: Record<string, unknown>,
  files: Record<string, string>,
  env: Record<string, string>,
  entry: string,
  post: (message: Record<string, unknown>) => void,
): BunShimHandle {
  const MAX_BODY = 256 * 1024;
  const fs = new Map<string, string>(Object.entries(files));
  let served: {
    fetch: (req: Request, server: unknown) => unknown;
    error?: (e: unknown) => unknown;
    port: number;
  } | null = null;

  const normalize = (path: string) =>
    path
      .replace(/^file:\/\//, "")
      .split("/")
      .filter((s) => s && s !== ".")
      .reduce<string[]>((out, s) => (s === ".." ? out.slice(0, -1) : [...out, s]), [])
      .join("/");

  const typeOf = (path: string) => {
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    const types: Record<string, string> = {
      json: "application/json;charset=utf-8",
      html: "text/html;charset=utf-8",
      css: "text/css;charset=utf-8",
      js: "text/javascript;charset=utf-8",
      ts: "text/javascript;charset=utf-8",
      txt: "text/plain;charset=utf-8",
      md: "text/markdown;charset=utf-8",
      svg: "image/svg+xml",
    };
    return types[ext] ?? "application/octet-stream";
  };

  const unsupported = (name: string) => () => {
    throw new Error(
      `${name} isn't available: Bun is emulated in your browser (no processes, shells or native code).`,
    );
  };

  const file = (path: string) => {
    const key = normalize(String(path));
    const read = () => {
      const text = fs.get(key);
      if (text === undefined) throw new Error(`ENOENT: no such file or directory, open '${key}'`);
      return text;
    };
    return {
      name: key,
      type: typeOf(key),
      get size() {
        return new TextEncoder().encode(fs.get(key) ?? "").length;
      },
      exists: async () => fs.has(key),
      text: async () => read(),
      json: async () => JSON.parse(read()) as unknown,
      bytes: async () => new TextEncoder().encode(read()),
      arrayBuffer: async () => new TextEncoder().encode(read()).buffer,
      stream: () => new Response(read()).body,
    };
  };

  const write = async (destination: unknown, data: unknown) => {
    const target =
      typeof destination === "string" ? destination : (destination as { name?: string })?.name;
    if (!target) throw new Error("Bun.write: the destination must be a path or a Bun.file()");
    const text =
      typeof data === "string"
        ? data
        : data instanceof Response || (typeof data === "object" && data !== null && "text" in data)
          ? await (data as { text(): Promise<string> }).text()
          : data instanceof ArrayBuffer || ArrayBuffer.isView(data)
            ? new TextDecoder().decode(data as ArrayBuffer)
            : typeof data === "object"
              ? JSON.stringify(data)
              : String(data);
    fs.set(normalize(target), text);
    return new TextEncoder().encode(text).length;
  };

  const serverFor = (port: number) => ({
    port,
    hostname: "localhost",
    url: new URL(`http://localhost:${port}/`),
    development: true,
    pendingRequests: 0,
    stop: () => {
      served = null;
      post({ type: "serve", port: null });
    },
    fetch: (input: string | Request) =>
      handleRequest(
        new Request(
          new URL(
            String(input instanceof Request ? input.url : input),
            `http://localhost:${port}/`,
          ),
        ),
      ),
  });

  const register = (fetch: unknown, port: unknown, error?: unknown) => {
    if (typeof fetch !== "function")
      throw new TypeError("Bun.serve needs a fetch(request) function");
    const p = typeof port === "number" && port > 0 && port < 65536 ? port : 3000;
    served = {
      fetch: fetch as never,
      error: typeof error === "function" ? (error as never) : undefined,
      port: p,
    };
    post({ type: "serve", port: p });
    return serverFor(p);
  };

  const Bun = {
    version: "1.4.0",
    revision: "emulated-in-browser",
    env,
    main: entry,
    argv: ["bun", entry],
    serve: (options: { fetch?: unknown; port?: unknown; error?: unknown }) =>
      register(options?.fetch, options?.port, options?.error),
    file,
    write,
    sleep: (ms: number | Date) =>
      new Promise((resolve) =>
        setTimeout(resolve, ms instanceof Date ? ms.getTime() - Date.now() : ms),
      ),
    nanoseconds: () => Math.round(performance.now() * 1e6),
    which: () => null,
    inspect: (value: unknown) => String(value),
    spawn: unsupported("Bun.spawn"),
    spawnSync: unsupported("Bun.spawnSync"),
    $: unsupported("Bun.$ (the shell)"),
    sleepSync: unsupported("Bun.sleepSync"),
    dlopen: unsupported("bun:ffi"),
  };

  scope.Bun = Bun;
  scope.process = {
    env,
    argv: ["bun", entry],
    platform: "browser",
    version: "v24.0.0-emulated",
    versions: { bun: Bun.version },
    cwd: () => "/",
    exit: (code?: number) => {
      throw new Error(`process.exit(${code ?? 0}) called`);
    },
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
      queueMicrotask(() => fn(...args)),
  };

  /** Run one request through the handler, as a Response. */
  const handleRequest = async (request: Request): Promise<Response> => {
    if (!served)
      return new Response("No server: call Bun.serve() or `export default app`.", { status: 503 });
    try {
      const result = await served.fetch(request, serverFor(served.port));
      if (!(result instanceof Response))
        throw new TypeError("the fetch handler must return a Response");
      return result;
    } catch (error) {
      if (served.error) {
        const handled = await served.error(error);
        if (handled instanceof Response) return handled;
      }
      console.error(error);
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      return new Response(message, { status: 500, headers: { "content-type": "text/plain" } });
    }
  };

  return {
    async handle(request) {
      const start = performance.now();
      try {
        const bodyAllowed = request.method !== "GET" && request.method !== "HEAD";
        const response = await handleRequest(
          new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: bodyAllowed && request.body ? request.body : undefined,
          }),
        );
        const body = await response.text();
        post({
          type: "response",
          id: request.id,
          status: response.status,
          statusText: response.statusText,
          headers: [...response.headers],
          body: body.slice(0, MAX_BODY),
          truncated: body.length > MAX_BODY,
          ms: Math.round((performance.now() - start) * 10) / 10,
        });
      } catch (error) {
        post({
          type: "response",
          id: request.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    adopt(module) {
      if (served) return;
      const fallback = (module as { default?: { fetch?: unknown; port?: unknown } } | null)
        ?.default;
      if (fallback && typeof fallback.fetch === "function") {
        register(fallback.fetch.bind(fallback), fallback.port);
      }
    },
  };
}
