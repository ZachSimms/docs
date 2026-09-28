/** @file React (TSX) snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello, component",
    note: "A function component with typed props; replace App.tsx with it.",
    file: "src/App.tsx",
    keywords: "hello world component props jsx tsx function boilerplate starter app",
    code: `interface GreetingProps {
  name: string;
  excited?: boolean;
}

function Greeting({ name, excited = false }: GreetingProps) {
  return (
    <p>
      Hello, {name}
      {excited ? "!" : "."}
    </p>
  );
}

export default function App() {
  return (
    <main>
      <h1>Hello, world!</h1>
      <Greeting name="React" excited />
      <Greeting name="TypeScript" />
    </main>
  );
}
`,
  },
  {
    id: "state",
    title: "State (useState)",
    note: "Local state; update from the previous value when the new one depends on it.",
    keywords: "usestate state hook counter setstate update toggle",
    code: `import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(true);

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <button onClick={() => setCount((c) => c - 1)}>-1</button>
      <button onClick={() => setCount(0)}>reset</button>
      <button onClick={() => setVisible((v) => !v)}>{visible ? "hide" : "show"}</button>
      {visible && <p>Count: {count}</p>}
    </div>
  );
}
`,
  },
  {
    id: "effect",
    title: "Effects (useEffect)",
    note: "Sync with things outside React: timers, subscriptions, fetching. Always clean up.",
    keywords: "useeffect effect cleanup timer interval fetch subscription dependency array",
    code: `import { useEffect, useState } from "react";

interface Todo {
  id: number;
  title: string;
}

export default function Clock() {
  const [now, setNow] = useState(() => new Date());
  const [todo, setTodo] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Runs after the first render; the returned function cleans up
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []); // [] = only on mount

  // Fetch data; ignore the answer if the component went away first
  useEffect(() => {
    let active = true;
    fetch("https://jsonplaceholder.typicode.com/todos/1")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(\`HTTP \${r.status}\`))))
      .then((data: Todo) => active && setTodo(data))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <p>{now.toLocaleTimeString()}</p>
      <p>{error ?? todo?.title ?? "Loading…"}</p>
    </div>
  );
}
`,
  },
  {
    id: "lists",
    title: "Lists & conditionals",
    note: "Render arrays with map and a stable key; show or hide with && and ?:.",
    keywords: "list map key conditional rendering ternary filter array",
    code: `import { useState } from "react";

interface Item {
  id: number;
  name: string;
  done: boolean;
}

export default function TodoList() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, name: "Write code", done: true },
    { id: 2, name: "Test it", done: false },
  ]);
  const [showDone, setShowDone] = useState(true);

  const toggle = (id: number) =>
    setItems((all) => all.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));

  const visible = showDone ? items : items.filter((it) => !it.done);

  return (
    <div>
      <label>
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        show done
      </label>
      {visible.length === 0 ? (
        <p>Nothing to do.</p>
      ) : (
        <ul>
          {visible.map((it) => (
            <li key={it.id} onClick={() => toggle(it.id)}>
              {it.done ? <s>{it.name}</s> : it.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
`,
  },
  {
    id: "form",
    title: "Forms",
    note: "Controlled inputs: React state is the single source of truth.",
    keywords: "form input controlled onchange onsubmit preventdefault select textarea validation",
    code: `import { useState, type FormEvent } from "react";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("free");
  const [sent, setSent] = useState<string | null>(null);

  const valid = name.trim().length >= 2;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(\`\${name} signed up for \${plan}\`);
    setName("");
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <select value={plan} onChange={(e) => setPlan(e.target.value)}>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
      <button disabled={!valid}>Sign up</button>
      {sent && <p>{sent}</p>}
    </form>
  );
}
`,
  },
  {
    id: "hook",
    title: "Custom hook",
    note: "Reuse stateful logic: a function whose name starts with use and calls other hooks.",
    keywords: "custom hook use reuse logic toggle window size resize",
    code: `import { useCallback, useEffect, useState } from "react";

// A hook: returns state plus functions to change it
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;
}

// A hook that subscribes to the browser
function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export default function App() {
  const [dark, toggleDark] = useToggle();
  const width = useWindowWidth();

  return (
    <div style={{ background: dark ? "#222" : "#fff", color: dark ? "#eee" : "#111", padding: 16 }}>
      <button onClick={toggleDark}>{dark ? "light" : "dark"} mode</button>
      <p>The window is {width}px wide.</p>
    </div>
  );
}
`,
  },
  {
    id: "context",
    title: "Context & reducer",
    note: "Share state down the tree without passing props through every level.",
    keywords: "context createcontext usecontext provider usereducer reducer dispatch global state",
    code: `import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";

type Action = { type: "add"; amount: number } | { type: "reset" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "add":
      return state + action.amount;
    case "reset":
      return 0;
  }
}

const CountContext = createContext<{ count: number; dispatch: Dispatch<Action> } | null>(null);

function CountProvider({ children }: { children: ReactNode }) {
  const [count, dispatch] = useReducer(reducer, 0);
  return <CountContext value={{ count, dispatch }}>{children}</CountContext>;
}

function useCount() {
  const value = useContext(CountContext);
  if (!value) throw new Error("useCount must be used inside <CountProvider>");
  return value;
}

function Display() {
  const { count } = useCount();
  return <p>Count: {count}</p>;
}

function Buttons() {
  const { dispatch } = useCount();
  return (
    <div>
      <button onClick={() => dispatch({ type: "add", amount: 1 })}>+1</button>
      <button onClick={() => dispatch({ type: "add", amount: 10 })}>+10</button>
      <button onClick={() => dispatch({ type: "reset" })}>reset</button>
    </div>
  );
}

export default function App() {
  return (
    <CountProvider>
      <Display />
      <Buttons />
    </CountProvider>
  );
}
`,
  },
];
