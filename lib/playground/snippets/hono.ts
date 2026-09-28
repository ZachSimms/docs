/** @file Hono outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "App",
    file: "src/index.ts",
    keywords: "hello world hono app route boilerplate starter export default",
    code: `import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
`,
  },
  {
    id: "routes",
    title: "Routes",
    keywords: "route get post put delete param query body json status",
    code: `app.get("/items/:id", (c) => {
  const id = c.req.param("id");
  // ...
  return c.json({});
});

app.post("/items", async (c) => {
  const body = await c.req.json();
  // ...
  return c.json({}, 201);
});
`,
  },
  {
    id: "group",
    title: "Route group",
    keywords: "sub app route group mount",
    code: `const group = new Hono();

group.get("/", (c) => {
  // ...
  return c.json([]);
});

app.route("/prefix", group);
`,
  },
  {
    id: "middleware",
    title: "Middleware",
    keywords: "middleware use next createmiddleware auth logger",
    code: `import { createMiddleware } from "hono/factory";

const middlewareName = createMiddleware(async (c, next) => {
  // before the handler
  await next();
  // after the handler
});

app.use(middlewareName);
`,
  },
  {
    id: "errors",
    title: "Error handling",
    keywords: "error exception httpexception onerror notfound",
    code: `import { HTTPException } from "hono/http-exception";

// In a handler: throw new HTTPException(400, { message: "..." });

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  // ...
  return c.json({ error: "internal error" }, 500);
});

app.notFound((c) => c.json({ error: "not found" }, 404));
`,
  },
];
