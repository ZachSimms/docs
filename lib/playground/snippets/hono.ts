/** @file Hono snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello, Hono",
    note: "The smallest app: one route, exported for Bun to serve.",
    file: "src/index.ts",
    keywords: "hello world hono app route get text boilerplate starter export default",
    code: `import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello Hono!"));
app.get("/json", (c) => c.json({ ok: true, at: new Date().toISOString() }));

export default app;
`,
  },
  {
    id: "routes",
    title: "Routes, params & bodies",
    note: "Path and query parameters, JSON bodies, status codes, sub-apps.",
    file: "src/index.ts",
    keywords: "route param query body json post put delete status 404 201 sub app route group",
    code: `import { Hono } from "hono";

interface Book {
  id: number;
  title: string;
}

const books: Book[] = [{ id: 1, title: "Dune" }];

// A sub-app, mounted at /books below
const bookRoutes = new Hono()
  .get("/", (c) => {
    const q = c.req.query("q")?.toLowerCase(); // /books?q=dune
    return c.json(q ? books.filter((b) => b.title.toLowerCase().includes(q)) : books);
  })
  .get("/:id", (c) => {
    const book = books.find((b) => b.id === Number(c.req.param("id")));
    return book ? c.json(book) : c.json({ error: "not found" }, 404);
  })
  .post("/", async (c) => {
    const { title } = await c.req.json<{ title?: string }>();
    if (!title) return c.json({ error: "title is required" }, 400);
    const book = { id: books.length + 1, title };
    books.push(book);
    return c.json(book, 201);
  })
  .delete("/:id", (c) => {
    const index = books.findIndex((b) => b.id === Number(c.req.param("id")));
    if (index === -1) return c.notFound();
    books.splice(index, 1);
    return c.body(null, 204);
  });

const app = new Hono();
app.route("/books", bookRoutes);

export default app;
`,
  },
  {
    id: "middleware",
    title: "Middleware",
    note: "Code that runs around every request: timing, headers, a simple auth check.",
    file: "src/index.ts",
    keywords: "middleware use next header auth logger timing createmiddleware cors",
    code: `import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

// Runs before and after every handler
const timing = createMiddleware(async (c, next) => {
  const start = performance.now();
  await next(); // run the rest of the chain
  c.header("X-Response-Time", \`\${(performance.now() - start).toFixed(1)}ms\`);
  console.log(\`\${c.req.method} \${c.req.path} → \${c.res.status}\`);
});

// Stops the request early when the header is missing
const requireKey = createMiddleware(async (c, next) => {
  if (c.req.header("X-Api-Key") !== "secret") return c.json({ error: "unauthorized" }, 401);
  await next();
});

const app = new Hono();
app.use(timing); // every route
app.use("/admin/*", requireKey); // only under /admin

app.get("/", (c) => c.text("public"));
app.get("/admin/stats", (c) => c.json({ users: 42 }));

export default app;
`,
  },
  {
    id: "errors",
    title: "Error handling",
    note: "Throw HTTPException for expected failures; onError and notFound catch the rest.",
    file: "src/index.ts",
    keywords: "error exception httpexception onerror notfound 404 500 try catch",
    code: `import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const app = new Hono();

app.get("/divide/:a/:b", (c) => {
  const a = Number(c.req.param("a"));
  const b = Number(c.req.param("b"));
  if (b === 0) throw new HTTPException(400, { message: "can't divide by zero" });
  return c.json({ result: a / b });
});

app.get("/boom", () => {
  throw new Error("something broke");
});

// Every error thrown in a handler lands here
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

// Requests no route matched
app.notFound((c) => c.json({ error: \`no route for \${c.req.path}\` }, 404));

export default app;
`,
  },
];
