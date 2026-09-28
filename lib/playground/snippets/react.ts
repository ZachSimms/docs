/** @file React (TSX) outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Component",
    keywords: "hello world component props jsx tsx function boilerplate starter",
    code: `interface ComponentNameProps {
  // props
}

export default function ComponentName(props: ComponentNameProps) {
  return <div>{/* ... */}</div>;
}
`,
  },
  {
    id: "state",
    title: "useState",
    keywords: "usestate state hook setstate update",
    code: `const [value, setValue] = useState(initialValue);

// Update from the previous value when the new one depends on it
setValue((previous) => previous);
`,
  },
  {
    id: "effect",
    title: "useEffect",
    keywords: "useeffect effect cleanup subscription timer fetch dependency",
    code: `useEffect(() => {
  // set up: subscribe, start a timer, fetch...
  return () => {
    // clean up
  };
}, [dependency]);
`,
  },
  {
    id: "lists",
    title: "List & conditional",
    keywords: "list map key conditional rendering ternary",
    code: `<div>
  {condition ? <p>{/* shown when true */}</p> : null}
  <ul>
    {items.map((item) => (
      <li key={item.id}>{/* ... */}</li>
    ))}
  </ul>
</div>
`,
  },
  {
    id: "form",
    title: "Controlled input",
    keywords: "form input controlled onchange onsubmit preventdefault",
    code: `<form
  onSubmit={(event) => {
    event.preventDefault();
    // ...
  }}
>
  <input value={value} onChange={(event) => setValue(event.target.value)} />
  <button>Submit</button>
</form>
`,
  },
  {
    id: "hook",
    title: "Custom hook",
    keywords: "custom hook use reuse logic",
    code: `function useHookName(param: string) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    // ...
  }, [param]);

  return value;
}
`,
  },
  {
    id: "context",
    title: "Context",
    keywords: "context createcontext usecontext provider global state",
    code: `const ContextName = createContext<ValueType | null>(null);

function ContextNameProvider({ children }: { children: ReactNode }) {
  return <ContextName value={/* value */ null}>{children}</ContextName>;
}

function useContextName() {
  const value = useContext(ContextName);
  if (!value) throw new Error("useContextName must be used inside <ContextNameProvider>");
  return value;
}
`,
  },
  {
    id: "reducer",
    title: "useReducer",
    keywords: "usereducer reducer dispatch action state",
    code: `type Action = { type: "first" } | { type: "second"; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "first":
      return state;
    case "second":
      return state;
  }
}

const [state, dispatch] = useReducer(reducer, initialState);
`,
  },
];
