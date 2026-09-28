/** @file Bun snippets (see `./index.ts`), limited to what the playground emulates. */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello server",
    note: "Bun.serve with one fetch handler; send requests from the HTTP panel.",
    file: "index.ts",
    keywords: "hello world server serve http fetch request response boilerplate starter",
    code: `const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response(\`Hello from Bun! You asked for \${new URL(req.url).pathname}\`);
  },
});

console.log(\`Listening on \${server.url}\`);
`,
  },
  {
    id: "routes",
    title: "JSON API with routes",
    note: "Route on method and path inside fetch; read bodies, send JSON, 404s and errors.",
    file: "index.ts",
    keywords: "api json routes router rest get post method path params status error",
    code: `interface Note {
  id: number;
  text: string;
}

const notes: Note[] = [{ id: 1, text: "Try GET /notes" }];

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\\/notes\\/(\\d+)$/);

  if (req.method === "GET" && url.pathname === "/notes") return Response.json(notes);

  if (req.method === "GET" && match) {
    const note = notes.find((n) => n.id === Number(match[1]));
    return note ? Response.json(note) : Response.json({ error: "not found" }, { status: 404 });
  }

  if (req.method === "POST" && url.pathname === "/notes") {
    const { text } = (await req.json()) as { text?: string };
    if (!text) return Response.json({ error: "text is required" }, { status: 400 });
    const note = { id: notes.length + 1, text };
    notes.push(note);
    return Response.json(note, { status: 201 });
  }

  return new Response("Not found", { status: 404 });
}

Bun.serve({
  port: 3000,
  fetch: route,
  // Called when fetch throws (a bad JSON body, say)
  error(error) {
    return Response.json({ error: error.message }, { status: 500 });
  },
});
console.log("Try GET /notes, GET /notes/1, POST /notes with { \\"text\\": \\"hi\\" }");
`,
  },
  {
    id: "files",
    title: "Files",
    note: "Bun.file and Bun.write on the project's files (kept in memory here).",
    keywords: "file read write bun.file bun.write json text exists fs",
    code: `// Write a file (a string, a Response, bytes, or a Bun.file to copy)
await Bun.write("data/hello.txt", "Hello, file!\\n");

// Read it back
const file = Bun.file("data/hello.txt");
console.log(await file.exists(), file.size, file.type);
console.log(await file.text());

// JSON in and out
await Bun.write("data/settings.json", JSON.stringify({ theme: "dark" }, null, 2));
const settings = (await Bun.file("data/settings.json").json()) as { theme: string };
console.log("theme:", settings.theme);

// A missing file: exists() is false, reading it throws
const missing = Bun.file("nope.txt");
if (!(await missing.exists())) console.log("nope.txt doesn't exist");
`,
  },
  {
    id: "env",
    title: "Environment & timing",
    note: "Bun.env reads the project's .env file; Bun.sleep waits.",
    keywords: "env environment variables dotenv .env sleep delay config process.env",
    code: `// Add GREETING=Hi and PORT=3000 to .env
const greeting = Bun.env.GREETING ?? "Hello";
const port = Number(Bun.env.PORT ?? 3000);
console.log(\`\${greeting}! port=\${port}\`);

// process.env works too
console.log(process.env.GREETING === Bun.env.GREETING);

const start = performance.now();
await Bun.sleep(250);
console.log(\`slept \${Math.round(performance.now() - start)} ms\`);
`,
  },
];
