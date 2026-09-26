/** Unit tests for server projects: `.env` parsing, HTTP panel requests and the emulated Bun APIs. */
import { describe, expect, it } from "bun:test";
import { parseDotEnv } from "@/lib/playground/dotenv";
import { buildHttpRequest, formatBody, parseHeaderLines } from "@/lib/playground/http";
import { getLanguage, LANGUAGE_GROUPS, LANGUAGES } from "@/lib/playground/languages";
import { installBunShim } from "@/lib/playground/runtime/bun-shim";

describe("parseDotEnv", () => {
  it("reads KEY=value lines, quotes, export and comments", () => {
    expect(
      parseDotEnv(
        '# comment\nGREETING=Hi\nexport NAME="Ada Lovelace"\nMULTI="a\\nb"\nSINGLE=\'x # y\'\nTRAIL=v # note\n bad line\n',
      ),
    ).toEqual({ GREETING: "Hi", NAME: "Ada Lovelace", MULTI: "a\nb", SINGLE: "x # y", TRAIL: "v" });
  });
});

describe("HTTP panel requests", () => {
  it("builds a request for the emulated server, adding a JSON content type", () => {
    const request = buildHttpRequest(
      { method: "POST", path: "/users?x=1", headers: "X-Trace: 7", body: '{"name":"Ada"}' },
      3000,
      "r1",
    );
    expect(request).toEqual({
      id: "r1",
      method: "POST",
      url: "http://localhost:3000/users?x=1",
      headers: [
        ["X-Trace", "7"],
        ["content-type", "application/json"],
      ],
      body: '{"name":"Ada"}',
    });
  });

  it("refuses paths off the server and malformed headers, and drops GET bodies", () => {
    expect(
      buildHttpRequest({ method: "GET", path: "//evil.test/", headers: "", body: "" }, 3000, "a"),
    ).toEqual({
      error: "The path must start with a single /",
    });
    expect(parseHeaderLines("no colon here")).toEqual({
      error: 'Not a header line: "no colon here" (use Name: value)',
    });
    const get = buildHttpRequest(
      { method: "GET", path: "", headers: "", body: "ignored" },
      8080,
      "b",
    );
    expect(get).toMatchObject({ url: "http://localhost:8080/", body: "" });
  });

  it("pretty-prints JSON bodies only", () => {
    expect(formatBody('{"a":1}', [["content-type", "application/json"]])).toBe('{\n  "a": 1\n}');
    expect(formatBody("hello", [["content-type", "text/plain"]])).toBe("hello");
  });
});

/** Install the shim on a fake scope and collect what it posts. */
function shim(files: Record<string, string> = {}, env: Record<string, string> = {}) {
  const scope: Record<string, unknown> = {};
  const posted: Record<string, unknown>[] = [];
  const handle = installBunShim(scope, files, env, "index.ts", (m) => posted.push(m));
  const Bun = scope.Bun as {
    serve(o: { fetch(r: Request): Response | Promise<Response>; port?: number }): {
      url: URL;
      port: number;
    };
    file(p: string): {
      text(): Promise<string>;
      json(): Promise<unknown>;
      exists(): Promise<boolean>;
    };
    write(p: string, d: unknown): Promise<number>;
    env: Record<string, string>;
    spawn(): never;
  };
  return { scope, posted, handle, Bun };
}

describe("installBunShim", () => {
  it("serves Bun.serve's handler to HTTP panel requests", async () => {
    const { Bun, handle, posted } = shim();
    const server = Bun.serve({
      port: 4000,
      fetch: (req) => Response.json({ path: new URL(req.url).pathname }),
    });
    expect(server.url.href).toBe("http://localhost:4000/");
    expect(posted[0]).toEqual({ type: "serve", port: 4000 });
    await handle.handle({
      id: "1",
      method: "GET",
      url: "http://localhost:4000/hi",
      headers: [],
      body: "",
    });
    expect(posted[1]).toMatchObject({
      type: "response",
      id: "1",
      status: 200,
      body: '{"path":"/hi"}',
    });
  });

  it("serves a default export with fetch (Hono's `export default app`)", async () => {
    const { handle, posted } = shim();
    handle.adopt({ default: { fetch: () => new Response("from app") } });
    await handle.handle({
      id: "2",
      method: "POST",
      url: "http://localhost:3000/",
      headers: [],
      body: "x",
    });
    expect(posted.at(-1)).toMatchObject({ id: "2", status: 200, body: "from app" });
  });

  it("answers handler errors with a 500 and no server with a 503", async () => {
    const empty = shim();
    await empty.handle.handle({
      id: "3",
      method: "GET",
      url: "http://localhost:3000/",
      headers: [],
      body: "",
    });
    expect(empty.posted.at(-1)).toMatchObject({ status: 503 });
    const broken = shim();
    const original = console.error;
    console.error = () => undefined;
    try {
      broken.Bun.serve({
        fetch: () => {
          throw new Error("boom");
        },
      });
      await broken.handle.handle({
        id: "4",
        method: "GET",
        url: "http://localhost:3000/",
        headers: [],
        body: "",
      });
    } finally {
      console.error = original;
    }
    expect(broken.posted.at(-1)).toMatchObject({ status: 500 });
    expect(String(broken.posted.at(-1)?.body)).toContain("boom");
  });

  it("reads and writes project files in memory, exposes env and refuses processes", async () => {
    const { Bun, scope } = shim({ "data/config.json": '{"v":1}' }, { GREETING: "Hi" });
    expect(await Bun.file("./data/config.json").json()).toEqual({ v: 1 });
    expect(await Bun.file("missing.txt").exists()).toBe(false);
    expect(Bun.file("missing.txt").text()).rejects.toThrow(/ENOENT/);
    await Bun.write("out/log.txt", "saved");
    expect(await Bun.file("out/log.txt").text()).toBe("saved");
    expect(Bun.env.GREETING).toBe("Hi");
    expect((scope.process as { env: Record<string, string> }).env.GREETING).toBe("Hi");
    expect(() => Bun.spawn()).toThrow(/emulated in your browser/);
  });
});

describe("project types", () => {
  it("group every project type and give server projects HTTP presets", () => {
    for (const lang of LANGUAGES) expect(LANGUAGE_GROUPS).toContain(lang.group);
    for (const group of LANGUAGE_GROUPS)
      expect(LANGUAGES.some((l) => l.group === group)).toBe(true);
    for (const id of ["bun", "hono"] as const)
      expect(getLanguage(id).httpPresets?.length).toBeGreaterThan(0);
    expect(getLanguage("react").template.files["package.json"]).toContain('"react": "19.3.0"');
    for (const lang of LANGUAGES) expect(lang.template.files["README.md"]).toBeTruthy();
  });
});
