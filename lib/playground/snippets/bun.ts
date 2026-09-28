/** @file Bun outlines (see `./index.ts`), limited to what the playground emulates. */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Server",
    note: "Send requests from the HTTP panel.",
    file: "index.ts",
    keywords: "hello world server serve http fetch request response boilerplate starter",
    code: `Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response("Hello from Bun!");
  },
});
`,
  },
  {
    id: "routes",
    title: "Routes",
    keywords: "routes router api json get post method path status",
    code: `async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/path") {
    // ...
    return Response.json({});
  }

  if (req.method === "POST" && url.pathname === "/path") {
    const body = await req.json();
    // ...
    return Response.json({}, { status: 201 });
  }

  return new Response("Not found", { status: 404 });
}
`,
  },
  {
    id: "files",
    title: "Read & write a file",
    keywords: "file read write bun.file bun.write json text",
    code: `const text = await Bun.file("path/to/file.txt").text();
const data = await Bun.file("path/to/file.json").json();
await Bun.write("path/to/output.txt", "contents");
`,
  },
  {
    id: "env",
    title: "Environment variable",
    note: "Bun.env reads the project's .env file.",
    keywords: "env environment variables dotenv config",
    code: `const value = Bun.env.VARIABLE_NAME ?? "default";
`,
  },
];
