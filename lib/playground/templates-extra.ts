/**
 * @file Starter projects for the web, server and notes project types:
 * HTML/CSS/TS, React, Bun (emulated), Bun + Hono, Next.js and Markdown.
 */

import type { Project } from "./project";

/** A project whose entry is open in a single tab. */
function starter(entry: string, files: Record<string, string>): Project {
  return { files, dirs: [], entry, open: entry, tabs: [entry] };
}

/** Versions the templates pin (checked against npm on 2026-09-26). */
/**
 * Pinned versions. Next.js stays on 15.4.8: newer releases fail in WebContainers with
 * "Expected workUnitAsyncStorage to have a store" (stackblitz/webcontainer-core#1978), and
 * 15.4.8 is the newest release with both the security fixes and a WebAssembly SWC build.
 */
export const TEMPLATE_VERSIONS = {
  react: "19.3.0",
  hono: "4.13.9",
  next: "15.4.8",
  nextReact: "19.2.0",
} as const;

export const WEB_TS = starter("index.html", {
  "README.md": `# HTML/CSS/TS

A page with TypeScript modules. \`index.html\` loads \`src/main.ts\`, which imports
\`src/counter.ts\`; types are stripped in your browser, not checked.

Try:
- change the step in \`src/main.ts\` and watch the preview update
- add a \`reset()\` method to \`Counter\` and a button for it
`,
  "index.html": `<!doctype html>
<link rel="stylesheet" href="css/style.css">

<main>
  <output id="count">0</output>
  <button id="inc">+1</button>
</main>

<script type="module" src="src/main.ts"></script>
`,
  "css/style.css": `body { font-family: system-ui, sans-serif; }

main {
  display: flex;
  gap: 1rem;
  align-items: center;
}

output { font-size: 2rem; min-width: 3ch; }
`,
  "src/main.ts": `import { Counter } from "./counter";

const counter = new Counter(document.querySelector<HTMLOutputElement>("#count")!);

document.querySelector("#inc")?.addEventListener("click", () => {
  counter.add(1);
  console.log("count is", counter.value);
});
`,
  "src/counter.ts": `export class Counter {
  #value = 0;

  constructor(private readonly view: HTMLOutputElement) {}

  get value(): number {
    return this.#value;
  }

  add(step: number): void {
    this.#value += step;
    this.view.value = String(this.#value);
  }
}
`,
});

export const REACT = starter("index.html", {
  "README.md": `# React

React ${TEMPLATE_VERSIONS.react} with TSX, no build step: packages load from esm.sh at the
versions in \`package.json\`, all on one React.

- \`src/main.tsx\` mounts \`<App />\` into \`#root\`
- \`src/components/Counter.tsx\` is a small stateful component
- \`import "./styles.css"\` works like in Vite

Routing: use \`MemoryRouter\` (the preview can't change its URL).
`,
  "index.html": `<!doctype html>
<div id="root"></div>
<script type="module" src="src/main.tsx"></script>
`,
  "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  "src/App.tsx": `import { useState } from "react";
import Counter from "./components/Counter";

export default function App() {
  const [todos, setTodos] = useState<string[]>(["Read the React sheet"]);
  const [draft, setDraft] = useState("");

  return (
    <main>
      <h1>Hello, React</h1>
      <Counter start={1} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) setTodos([...todos, draft.trim()]);
          setDraft("");
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New todo" />
        <button>Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo}>{todo}</li>
        ))}
      </ul>
    </main>
  );
}
`,
  "src/components/Counter.tsx": `import { useState } from "react";

interface CounterProps {
  start?: number;
}

export default function Counter({ start = 0 }: CounterProps) {
  const [count, setCount] = useState(start);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Clicked {count} {count === 1 ? "time" : "times"}
    </button>
  );
}
`,
  "src/styles.css": `body {
  font-family: system-ui, sans-serif;
  margin: 2rem;
}

main { display: grid; gap: 1rem; max-width: 24rem; }
`,
  "package.json": `{
  "name": "react-playground",
  "private": true,
  "type": "module",
  "dependencies": {
    "react": "${TEMPLATE_VERSIONS.react}",
    "react-dom": "${TEMPLATE_VERSIONS.react}"
  }
}
`,
});

export const BUN = starter("index.ts", {
  "README.md": `# Bun (emulated)

Bun's APIs, **emulated in your browser**: this is not real Bun. What works:

- \`Bun.serve({ fetch })\`: send requests from the HTTP panel under the editor
- \`Bun.file(path)\` / \`Bun.write(path, data)\` on the project's files (in memory)
- \`Bun.env\` from \`.env\`, \`Bun.sleep(ms)\`, TypeScript out of the box

Not available here: \`Bun.spawn\`, \`Bun.$\`, \`bun:sqlite\`, FFI, real sockets.
`,
  "index.ts": `import { route } from "./src/routes";

const config = await Bun.file("data/config.json").json();
console.log("config:", config);

const server = Bun.serve({ port: 3000, fetch: route });
console.log(\`\${Bun.env.GREETING}! Listening on \${server.url}\`);
`,
  "src/routes.ts": `export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/") return new Response("Hello from Bun!");
  if (url.pathname === "/time") return Response.json({ now: new Date().toISOString() });
  if (url.pathname === "/echo" && req.method === "POST") {
    return Response.json({ youSent: await req.json() });
  }
  return new Response("Not found", { status: 404 });
}
`,
  "data/config.json": `{ "name": "bun-playground", "version": 1 }
`,
  ".env": `GREETING=Hi
`,
  "package.json": `{
  "name": "bun-playground",
  "type": "module",
  "private": true
}
`,
});

export const HONO = starter("src/index.ts", {
  "README.md": `# Bun + Hono

A real Hono ${TEMPLATE_VERSIONS.hono} app (from esm.sh) on **emulated** Bun APIs: send
requests from the HTTP panel under the editor.

- \`src/index.ts\` exports the app (\`export default app\`), which Bun serves
- \`src/routes/users.ts\` is a sub-app mounted at \`/users\`
- \`src/middleware/logger.ts\` logs every request to the console
`,
  "src/index.ts": `import { Hono } from "hono";
import { logger } from "./middleware/logger";
import users from "./routes/users";

const app = new Hono();

app.use(logger);
app.get("/", (c) => c.text("Hello Hono!"));
app.route("/users", users);

export default app;
`,
  "src/routes/users.ts": `import { Hono } from "hono";

interface User {
  id: number;
  name: string;
}

const users: User[] = [{ id: 1, name: "Ada" }];
const app = new Hono();

app.get("/", (c) => c.json(users));
app.get("/:id", (c) => {
  const user = users.find((u) => u.id === Number(c.req.param("id")));
  return user ? c.json(user) : c.json({ error: "not found" }, 404);
});
app.post("/", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  const user = { id: users.length + 1, name };
  users.push(user);
  return c.json(user, 201);
});

export default app;
`,
  "src/middleware/logger.ts": `import { createMiddleware } from "hono/factory";

export const logger = createMiddleware(async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(1);
  console.log(\`\${c.req.method} \${c.req.path} → \${c.res.status} (\${ms} ms)\`);
});
`,
  "package.json": `{
  "name": "hono-playground",
  "type": "module",
  "dependencies": {
    "hono": "${TEMPLATE_VERSIONS.hono}"
  }
}
`,
});

export const NEXTJS = starter("app/page.tsx", {
  "README.md": `# Next.js

A real \`next dev\` (Next.js ${TEMPLATE_VERSIONS.next}, App Router) running in a WebContainer in your
browser. It needs desktop Chrome, Edge or Firefox; the first run installs about 200 MB into memory.

Next.js 15.4 is the newest version that runs in WebContainers today (newer ones hit a
WebContainer bug). Edits reload in the preview; press Run again after changing \`package.json\`.

- \`app/page.tsx\` is the home page, \`app/layout.tsx\` wraps every page
- \`app/api/hello/route.ts\` is a route handler at \`/api/hello\`
`,
  "app/layout.tsx": `import type { ReactNode } from "react";

export const metadata = { title: "Next.js playground" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem" }}>{children}</body>
    </html>
  );
}
`,
  "app/page.tsx": `export default async function Home() {
  const time = new Date().toLocaleTimeString();
  return (
    <main>
      <h1>Hello from Next.js</h1>
      <p>Rendered on the server at {time}.</p>
      <p>
        <a href="/api/hello">/api/hello</a>
      </p>
    </main>
  );
}
`,
  "app/api/hello/route.ts": `export function GET() {
  return Response.json({ hello: "world" });
}
`,
  "next.config.ts": `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
  "package.json": `{
  "name": "next-playground",
  "private": true,
  "scripts": { "dev": "next dev --port 3000" },
  "dependencies": {
    "next": "${TEMPLATE_VERSIONS.next}",
    "react": "${TEMPLATE_VERSIONS.nextReact}",
    "react-dom": "${TEMPLATE_VERSIONS.nextReact}"
  },
  "devDependencies": {
    "@next/swc-wasm-nodejs": "${TEMPLATE_VERSIONS.next}",
    "typescript": "5.9.3",
    "@types/react": "19.2.2",
    "@types/node": "24.13.3"
  }
}
`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
`,
});

export const MARKDOWN = starter("README.md", {
  "README.md": `# Notes

Markdown with a live preview (**Preview** above the editor). GitHub-flavored:

| Feature | Syntax |
| ------- | ------ |
| Tables | \`| a | b |\` |
| Tasks | \`- [ ]\` |
| Strikethrough | \`~~text~~\` |

- [x] Write notes
- [ ] Link them: [ideas](notes/ideas.md)

\`\`\`ts
const answer = 42;
\`\`\`
`,
  "notes/ideas.md": `# Ideas

1. Learn one new thing a day
2. ~~Remember everything~~ Write it down
`,
  "notes/checklist.md": `# Checklist

- [ ] Draft
- [ ] Review
- [ ] Publish
`,
});
