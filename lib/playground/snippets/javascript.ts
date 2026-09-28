/** @file JavaScript snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    note: "console.log prints a line to the Output pane.",
    keywords: "print console log boilerplate starter",
    code: `console.log("Hello, world!");

// Template literals put any expression into a string.
const place = "playground";
console.log(\`Hello, \${place}! 2 + 2 = \${2 + 2}\`);
`,
  },
  {
    id: "variables",
    title: "Variables & types",
    note: "const by default, let when it changes; never var.",
    keywords: "let const typeof destructuring number string boolean null undefined bigint",
    code: `const pi = 3.14159; // number (a 64-bit float)
let count = 0; // let: can be reassigned
count += 1;

const big = 2n ** 64n; // bigint: whole numbers of any size
const title = "Playground"; // string
const done = false; // boolean
const nothing = null; // "no value", on purpose
let notYet; // undefined until assigned

console.log(typeof pi, typeof big, typeof title, typeof done, typeof nothing, typeof notYet);
// number bigint string boolean object undefined  (typeof null is "object": a historical quirk)

// Destructuring, with defaults and renaming
const [first, second = "default"] = ["a"];
const { x, y: why = 0 } = { x: 1 };
console.log(count, big, first, second, x, why);

// Conversions
console.log(Number("42") + 1, String(7) + "!", parseInt("12px", 10), Boolean(""), Boolean("x"));
`,
  },
  {
    id: "functions",
    title: "Functions",
    note: "Declarations, default and rest parameters, named arguments, functions as values.",
    keywords: "function return parameters default rest arguments hoisting callback",
    code: `// Declarations are hoisted: they can be called above the line they're on.
function add(a, b) {
  return a + b;
}

// Default and rest parameters
function greet(name = "world", ...others) {
  const also = others.length > 0 ? \` and \${others.join(", ")}\` : "";
  return \`Hello, \${name}\${also}!\`;
}

// Named arguments: one options object, destructured
function createUser({ name, admin = false }) {
  return { name, admin };
}

// Functions are values: store them, pass them, return them
const operations = {
  add,
  multiply(a, b) {
    return a * b;
  },
};

function twice(fn, value) {
  return fn(fn(value));
}

console.log(add(2, 3)); // 5
console.log(greet()); // Hello, world!
console.log(greet("Ada", "Grace", "Linus"));
console.log(createUser({ name: "Ada" })); // { name: 'Ada', admin: false }
console.log(operations.multiply(4, 5)); // 20
console.log(twice((n) => n * 3, 2)); // 18
`,
  },
  {
    id: "arrow",
    title: "Arrow functions",
    note: "Short functions for callbacks; they keep the surrounding this.",
    keywords: "lambda closure => callback map filter reduce this anonymous",
    code: `// Expression body: the value is returned.
const square = (x) => x * x;

// Block body: needs an explicit return.
const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

// Returning an object literal: wrap it in parentheses.
const point = (x, y) => ({ x, y });

// Callbacks
const doubled = [1, 2, 3].map((n) => n * 2);
const evens = [1, 2, 3, 4].filter((n) => n % 2 === 0);
const total = [1, 2, 3, 4].reduce((sum, n) => sum + n, 0);

// Closures: an arrow that remembers a value
const makeCounter = () => {
  let count = 0;
  return () => ++count;
};
const next = makeCounter();
next();

// Arrows have no this of their own: they use the one around them.
class Clicker {
  clicks = 0;
  clickThreeTimes() {
    [1, 2, 3].forEach(() => this.clicks++); // this is the Clicker
    return this.clicks;
  }
}

console.log(square(4), clamp(12, 0, 10), point(1, 2));
console.log(doubled, evens, total, next(), new Clicker().clickThreeTimes());
`,
  },
  {
    id: "control",
    title: "Conditionals & loops",
    note: "if, ternary, ?? and ||, switch, for, for…of, for…in, while.",
    keywords: "if else switch case for while loop break continue ternary nullish",
    code: `const score = 72;

if (score >= 90) {
  console.log("A");
} else if (score >= 70) {
  console.log("B or C");
} else {
  console.log("keep going");
}

// Conditional expression
console.log(score >= 50 ? "pass" : "fail");

// ?? falls back only on null/undefined; || on any falsy value (0, "", false)
const input = null;
const configured = 0;
console.log(input ?? "anonymous", configured ?? 3000, configured || 3000); // anonymous 0 3000

switch (new Date().getDay()) {
  case 0:
  case 6:
    console.log("weekend");
    break;
  default:
    console.log("weekday");
}

for (let i = 0; i < 3; i++) console.log("i =", i);
for (const fruit of ["apple", "pear"]) console.log(fruit); // values of an iterable
for (const key in { a: 1, b: 2 }) console.log(key); // keys of an object

let n = 10;
while (n > 0) {
  n -= 3;
  if (n === 4) continue;
  if (n < 2) break;
  console.log("n =", n);
}
`,
  },
  {
    id: "collections",
    title: "Arrays, objects, Map & Set",
    note: "The everyday methods, spread and destructuring.",
    keywords: "array list object dictionary map set push sort slice spread keys entries",
    code: `// Arrays
const nums = [5, 3, 8, 1];
nums.push(10); // add to the end
const sorted = nums.toSorted((a, b) => a - b); // a sorted copy (sort() sorts in place)
console.log(sorted, nums.includes(8), nums.indexOf(3), nums.at(-1));
console.log(nums.slice(1, 3), [...nums, 99], nums.length);
console.log(nums.find((n) => n > 4), nums.some((n) => n > 9), nums.every((n) => n > 0));

// Objects
const user = { name: "Ada", born: 1815 };
user.language = "Analytical Engine";
const { name: userName, ...rest } = user;
const older = { ...user, born: 1814 }; // a shallow copy with one field changed
console.log(userName, rest, older.born, Object.keys(user), Object.entries(user));

// Map: any kind of key, keeps insertion order
const ages = new Map([["Ada", 36]]);
ages.set("Grace", 85);
console.log(ages.get("Grace"), ages.has("Linus"), ages.size);
for (const [who, age] of ages) console.log(who, age);

// Set: unique values
const tags = new Set(["js", "web", "js"]);
tags.add("css");
console.log(tags.size, [...tags], tags.has("web"));
`,
  },
  {
    id: "classes",
    title: "Classes",
    note: "Fields, private #fields, static members, getters, inheritance with super.",
    keywords:
      "class constructor extends super this static private getter setter method inheritance oop",
    code: `class Animal {
  #sound; // private field: only code inside the class can read it
  static count = 0; // one value shared by the class

  constructor(name, sound) {
    this.name = name;
    this.#sound = sound;
    Animal.count++;
  }

  speak() {
    return \`\${this.name} says \${this.#sound}\`;
  }

  get shout() {
    return this.speak().toUpperCase();
  }

  toString() {
    return \`Animal(\${this.name})\`;
  }
}

class Dog extends Animal {
  constructor(name) {
    super(name, "woof"); // call the parent constructor before using this
  }

  // Override, and call the parent's version
  speak() {
    return \`\${super.speak()}!\`;
  }

  fetch(item = "ball") {
    return \`\${this.name} fetches the \${item}\`;
  }
}

const rex = new Dog("Rex");
console.log(rex.speak()); // Rex says woof!
console.log(rex.shout); // a getter: no parentheses
console.log(rex.fetch());
console.log(\`\${rex}\`, rex instanceof Animal, Animal.count);
`,
  },
  {
    id: "errors",
    title: "Exception handling",
    note: "throw, try/catch/finally, custom errors, and wrapping with cause.",
    keywords: "try catch finally throw error exception custom cause",
    code: `// A custom error type
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function parseAge(text) {
  const age = Number(text);
  if (!Number.isInteger(age) || age < 0) {
    throw new ValidationError("age", \`not a valid age: \${JSON.stringify(text)}\`);
  }
  return age;
}

for (const input of ["42", "-1", "abc"]) {
  try {
    console.log("age:", parseAge(input));
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log(\`\${error.name} on \${error.field}: \${error.message}\`);
    } else {
      throw error; // not ours: let it go up
    }
  } finally {
    console.log("checked", input); // runs either way
  }
}

// Wrap a low-level error with context; the original stays in cause.
try {
  try {
    JSON.parse("{ not json");
  } catch (cause) {
    throw new Error("the config file is invalid", { cause });
  }
} catch (error) {
  console.log(error.message, "<-", error.cause.name); // ... <- SyntaxError
}
`,
  },
  {
    id: "async",
    title: "Async / await",
    note: "Promises, await, running in parallel, errors, timeouts.",
    keywords: "async await promise then all allsettled race settimeout sleep concurrency",
    code: `// A promise that resolves after ms milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchUser(id) {
  await sleep(100); // stands in for a network request
  if (id < 0) throw new Error(\`no user \${id}\`);
  return { id, name: \`user\${id}\` };
}

async function main() {
  // One after the other
  const first = await fetchUser(1);
  console.log("first:", first.name);

  // In parallel: start them all, then wait for all of them
  const users = await Promise.all([fetchUser(2), fetchUser(3)]);
  console.log("all:", users.map((u) => u.name));

  // A rejected promise throws at the await
  try {
    await fetchUser(-1);
  } catch (error) {
    console.log("caught:", error.message);
  }

  // allSettled never rejects: a status for each
  const results = await Promise.allSettled([fetchUser(4), fetchUser(-2)]);
  console.log(results.map((r) => r.status)); // [ 'fulfilled', 'rejected' ]

  // race settles with whichever finishes first
  const winner = await Promise.race([
    sleep(50).then(() => "fast"),
    sleep(300).then(() => "slow"),
  ]);
  console.log("race:", winner);
}

// .then/.catch work too: an async function returns a promise
main().catch((error) => console.error(error));
`,
  },
  {
    id: "modules-export",
    title: "Modules: exporting",
    note: "A file of its own; import it from main.js (next snippet).",
    file: "math.js",
    keywords: "module export default named esm import file",
    code: `// Named exports
export const PI = 3.14159;

export function area(radius) {
  return PI * radius * radius;
}

// One default export per module
export default class Circle {
  constructor(radius) {
    this.radius = radius;
  }

  get area() {
    return area(this.radius);
  }
}
`,
  },
  {
    id: "modules-import",
    title: "Modules: importing",
    note: "Uses math.js from the previous snippet; npm packages load by name from esm.sh.",
    file: "main.js",
    keywords: "module import default named esm npm package dynamic",
    code: `import Circle, { area, PI as pi } from "./math.js";
import * as math from "./math.js";

console.log(new Circle(2).area, area(1), pi, math.PI);

// Dynamic import: loads the module when this line runs
const { default: Lazy } = await import("./math.js");
console.log(new Lazy(3).area);

// npm packages by name (fetched from esm.sh), for example:
// import confetti from "canvas-confetti";
`,
  },
];
