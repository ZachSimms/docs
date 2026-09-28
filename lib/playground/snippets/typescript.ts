/** @file TypeScript snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    note: "Types are stripped before the code runs; the editor still checks them.",
    keywords: "print console log boilerplate starter",
    code: `function greet(who: string): string {
  return \`Hello, \${who}!\`;
}

console.log(greet("world"));

const place: string = "playground";
console.log(\`Hello, \${place}! 2 + 2 = \${2 + 2}\`);
`,
  },
  {
    id: "variables",
    title: "Types & variables",
    note: "Annotations, unions, literal types, interfaces, unknown, as const, satisfies.",
    keywords: "type interface union literal tuple unknown any as const satisfies readonly optional",
    code: `// Annotations (often inferred: \`let n = 1\` is already a number)
let count: number = 0;
const title: string = "Playground";
const done: boolean = false;
const big: bigint = 10n;

// Arrays and tuples
const scores: number[] = [90, 72];
const pair: [string, number] = ["age", 42];

// Unions and literal types
type Status = "idle" | "loading" | "error";
let current: Status = "idle";
let id: string | number = 7;

// Object shapes
interface User {
  readonly id: number;
  name: string;
  email?: string; // optional
}
const ada: User = { id: 1, name: "Ada" };

// unknown must be narrowed before use (prefer it to any)
const data: unknown = JSON.parse('{ "x": 1 }');
if (typeof data === "object" && data !== null && "x" in data) console.log("x =", data.x);

// as const keeps literal types; satisfies checks a value without widening it
const directions = ["up", "down"] as const;
const config = { port: 3000, host: "localhost" } satisfies Record<string, string | number>;

count += scores.length;
current = "loading";
id = "seven";
console.log(count, title, done, big, pair, current, id, ada, directions, config.port);
`,
  },
  {
    id: "functions",
    title: "Functions",
    note: "Typed parameters, optional and rest parameters, overloads, generics, function types.",
    keywords: "function return parameters optional default rest overload generic signature",
    code: `function add(a: number, b: number): number {
  return a + b;
}

// Optional, default and rest parameters
function greet(name?: string, greeting = "Hello", ...extra: string[]): string {
  return [\`\${greeting}, \${name ?? "world"}!\`, ...extra].join(" ");
}

// Overloads: several signatures, one implementation
function parse(value: string): number;
function parse(value: string[]): number[];
function parse(value: string | string[]): number | number[] {
  return Array.isArray(value) ? value.map(Number) : Number(value);
}

// Generics: the type flows from the argument to the result
function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

// A function type
type BinaryOp = (a: number, b: number) => number;
const multiply: BinaryOp = (a, b) => a * b;

console.log(add(2, 3), greet(), greet("Ada", "Hi", "(from TypeScript)"));
console.log(parse("42"), parse(["1", "2"]), first(["x", "y"]), multiply(4, 5));
`,
  },
  {
    id: "arrow",
    title: "Arrow functions",
    note: "Typed arrows, generic arrows, callbacks, closures and this.",
    keywords: "lambda closure => callback map filter generic this anonymous",
    code: `const square = (x: number): number => x * x;

// Return an object literal in parentheses
const point = (x: number, y: number) => ({ x, y });

// A generic arrow (in .tsx files write <T,> so it isn't read as JSX)
const identity = <T,>(value: T): T => value;

// Callbacks take their parameter types from context
const names = ["ada", "grace"].map((n) => n.toUpperCase());
const adults = [{ age: 12 }, { age: 30 }].filter(({ age }) => age >= 18);

// An arrow that returns an arrow (a closure over a)
const adder = (a: number) => (b: number) => a + b;
const addTen = adder(10);

// Arrow properties keep this, even when passed around as callbacks
class Timer {
  ticks = 0;
  tick = (): void => {
    this.ticks++;
  };
}
const timer = new Timer();
[1, 2, 3].forEach(timer.tick);

console.log(square(4), point(1, 2), identity("same"), names, adults, addTen(5), timer.ticks);
`,
  },
  {
    id: "control",
    title: "Conditionals & loops",
    note: "Narrowing with switch on a discriminated union, exhaustiveness with never.",
    keywords: "if else switch case for while loop narrowing union never optional chaining",
    code: `type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

// switch on the kind field narrows the type in each case
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    default: {
      const unreachable: never = shape; // a type error here means a case is missing
      return unreachable;
    }
  }
}

const shapes: Shape[] = [
  { kind: "circle", radius: 1 },
  { kind: "square", side: 2 },
];

for (const shape of shapes) {
  const a = area(shape);
  if (a > 3.5) console.log(shape.kind, "is big:", a.toFixed(2));
  else console.log(shape.kind, "is small:", a.toFixed(2));
}

for (let i = 0; i < 3; i++) console.log("i =", i);

let n = 3;
while (n > 0) n--;

// Optional chaining and nullish coalescing
const maybe: string | null = Math.random() > 0.5 ? "value" : null;
console.log(n, maybe?.length ?? "no value");
`,
  },
  {
    id: "collections",
    title: "Arrays, records, Map & Set",
    note: "Typed collections and grouping items by a key.",
    keywords: "array list record dictionary map set readonly group reduce",
    code: `const nums: number[] = [5, 3, 8, 1];
const sorted = nums.toSorted((a, b) => a - b); // a sorted copy
const evens: readonly number[] = nums.filter((n) => n % 2 === 0);

// Record: an object used as a dictionary
const stock: Record<string, number> = { apples: 3, pears: 0 };
stock.plums = 7;

// Map and Set take their types as parameters
const ages = new Map<string, number>([["Ada", 36]]);
ages.set("Grace", 85);
const seen = new Set<string>(["a", "b", "a"]);

// Group items by a key
interface Book {
  title: string;
  year: number;
}
const books: Book[] = [
  { title: "Dune", year: 1965 },
  { title: "Neuromancer", year: 1984 },
  { title: "Foundation", year: 1951 },
];
const byDecade = books.reduce<Record<string, string[]>>((groups, book) => {
  const decade = \`\${Math.floor(book.year / 10) * 10}s\`;
  (groups[decade] ??= []).push(book.title);
  return groups;
}, {});

console.log(sorted, evens, stock, ages.get("Grace"), seen.size);
console.log(byDecade);
`,
  },
  {
    id: "classes",
    title: "Classes",
    note: "Interfaces, abstract classes, parameter properties, access modifiers, generics.",
    keywords:
      "class interface implements abstract extends override private public readonly static generic getter setter oop",
    code: `interface Shape {
  area(): number;
}

abstract class Base implements Shape {
  static created = 0;

  // A parameter property declares and assigns the field in one go
  constructor(public readonly name: string) {
    Base.created++;
  }

  abstract area(): number;

  describe(): string {
    return \`\${this.name}: \${this.area().toFixed(2)}\`;
  }
}

class Circle extends Base {
  #radius: number; // private at runtime too

  constructor(radius: number) {
    super("circle");
    this.#radius = radius;
  }

  override area(): number {
    return Math.PI * this.#radius ** 2;
  }

  get radius(): number {
    return this.#radius;
  }

  set radius(value: number) {
    if (value <= 0) throw new RangeError("radius must be positive");
    this.#radius = value;
  }
}

class Rect extends Base {
  constructor(
    private width: number,
    private height: number,
  ) {
    super("rect");
  }

  override area(): number {
    return this.width * this.height;
  }
}

// A generic class
class Stack<T> {
  private items: T[] = [];

  push(item: T): this {
    this.items.push(item);
    return this;
  }

  pop(): T | undefined {
    return this.items.pop();
  }
}

const shapes: Base[] = [new Circle(1), new Rect(2, 3)];
for (const shape of shapes) console.log(shape.describe());
console.log(new Stack<number>().push(1).push(2).pop(), Base.created);
`,
  },
  {
    id: "errors",
    title: "Exception handling",
    note: "Caught values are unknown: narrow them. Or return errors as values.",
    keywords: "try catch finally throw error exception custom unknown result",
    code: `class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function request(path: string): string {
  if (path === "/missing") throw new HttpError(404, \`not found: \${path}\`);
  if (path === "/boom") throw new Error("the server broke");
  return \`200 OK \${path}\`;
}

for (const path of ["/", "/missing", "/boom"]) {
  try {
    console.log(request(path));
  } catch (error: unknown) {
    // Anything can be thrown, so narrow before use
    if (error instanceof HttpError) console.log(\`HTTP \${error.status}: \${error.message}\`);
    else if (error instanceof Error) console.log("failed:", error.message);
    else throw error;
  } finally {
    console.log("done", path);
  }
}

// Errors as values: the compiler makes callers check
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

function safeParse(text: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const parsed = safeParse("{ nope");
if (parsed.ok) console.log(parsed.value);
else console.log("invalid JSON:", parsed.error);
`,
  },
  {
    id: "async",
    title: "Async / await",
    note: "Typed promises, parallel work, a timeout, async generators.",
    keywords: "async await promise all race timeout settimeout sleep generator for await",
    code: `const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface User {
  id: number;
  name: string;
}

async function fetchUser(id: number): Promise<User> {
  await sleep(100); // stands in for a network request
  if (id < 0) throw new Error(\`no user \${id}\`);
  return { id, name: \`user\${id}\` };
}

// Reject if the promise takes longer than ms
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

// An async generator: yields values over time
async function* countdown(from: number): AsyncGenerator<number> {
  for (let i = from; i > 0; i--) {
    await sleep(50);
    yield i;
  }
}

async function main(): Promise<void> {
  const user = await fetchUser(1);
  console.log("one:", user.name);

  const [a, b] = await Promise.all([fetchUser(2), fetchUser(3)]);
  console.log("in parallel:", a.name, b.name);

  try {
    await withTimeout(fetchUser(4), 10);
  } catch (error) {
    console.log("caught:", error instanceof Error ? error.message : error);
  }

  for await (const n of countdown(3)) console.log("t-minus", n);
}

main().catch(console.error);
`,
  },
  {
    id: "modules-export",
    title: "Modules: exporting",
    note: "A file of its own; import it from main.ts (next snippet).",
    file: "math.ts",
    keywords: "module export default named type esm file",
    code: `export const PI = 3.14159;

export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default class Circle {
  constructor(public radius: number) {}

  get area(): number {
    return PI * this.radius ** 2;
  }
}
`,
  },
  {
    id: "modules-import",
    title: "Modules: importing",
    note: "Uses math.ts from the previous snippet; import type brings in only types.",
    file: "main.ts",
    keywords: "module import default named type esm npm package",
    code: `import Circle, { distance, PI } from "./math";
import type { Point } from "./math";

const origin: Point = { x: 0, y: 0 };
console.log(new Circle(2).area, distance(origin, { x: 3, y: 4 }), PI);

// npm packages by name (fetched from esm.sh, typed when they ship types), for example:
// import { nanoid } from "nanoid";
`,
  },
];
