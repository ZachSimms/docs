/** @file JavaScript outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    keywords: "print console log main boilerplate starter",
    code: `function main() {
  console.log("Hello, world!");
}

main();
`,
  },
  {
    id: "variables",
    title: "Variables",
    note: "const by default, let when it changes.",
    keywords: "const let destructuring declare",
    code: `const constantName = "value";
let variableName = 0;

// Destructuring
const [first, second] = [1, 2];
const { propertyName } = { propertyName: "value" };
`,
  },
  {
    id: "functions",
    title: "Function",
    keywords: "function declaration return parameters",
    code: `function functionName(param1, param2) {
  // ...
  return;
}
`,
  },
  {
    id: "function-params",
    title: "Function: default & rest parameters",
    keywords: "function default rest arguments options destructuring named",
    code: `function functionName(required, optional = "default", ...rest) {
  // ...
}

// Named arguments: one options object
function functionWithOptions({ option1, option2 = false } = {}) {
  // ...
}
`,
  },
  {
    id: "arrow",
    title: "Arrow function",
    keywords: "arrow lambda => anonymous closure",
    code: `// Expression body: the value is returned
const functionName = (param) => param;

// Block body
const otherFunction = (param1, param2) => {
  // ...
};
`,
  },
  {
    id: "callbacks",
    title: "Array callbacks",
    keywords: "map filter reduce foreach find callback arrow",
    code: `const results = items.map((item) => {
  // return the new value
});

const matches = items.filter((item) => {
  // return true to keep the item
});

const total = items.reduce((accumulator, item) => {
  // return the new accumulator
}, initialValue);
`,
  },
  {
    id: "if",
    title: "if / else if / else",
    keywords: "if else conditional branch ternary",
    code: `if (condition) {
  // ...
} else if (otherCondition) {
  // ...
} else {
  // ...
}
`,
  },
  {
    id: "switch",
    title: "switch",
    keywords: "switch case default break",
    code: `switch (value) {
  case "first":
    // ...
    break;
  case "second":
    // ...
    break;
  default:
  // ...
}
`,
  },
  {
    id: "loops",
    title: "Loops",
    keywords: "for of in while do loop iterate break continue",
    code: `for (let i = 0; i < count; i++) {
  // ...
}

for (const item of items) {
  // values of an array (or any iterable)
}

for (const key in object) {
  // keys of an object
}

while (condition) {
  // ...
}
`,
  },
  {
    id: "collections",
    title: "Array, object, Map & Set",
    keywords: "array object map set collection dictionary list",
    code: `const list = [];
const record = { key: "value" };
const map = new Map(); // map.set(key, value), map.get(key)
const set = new Set(); // set.add(value), set.has(value)
`,
  },
  {
    id: "classes",
    title: "Class",
    keywords: "class constructor method field getter setter static private oop",
    code: `class ClassName {
  #privateField;
  static sharedField = null;

  constructor(param) {
    this.property = param;
  }

  methodName() {
    // ...
  }

  get computed() {
    // return a value
  }

  static helper() {
    // ...
  }
}
`,
  },
  {
    id: "extends",
    title: "Subclass",
    keywords: "class extends inheritance super override",
    code: `class ChildClass extends ParentClass {
  constructor(param) {
    super(param);
    // ...
  }

  methodName() {
    super.methodName();
    // ...
  }
}
`,
  },
  {
    id: "errors",
    title: "try / catch / finally",
    keywords: "try catch finally exception error handling",
    code: `try {
  // code that might throw
} catch (error) {
  if (error instanceof CustomError) {
    // handle the error you expect
  } else {
    throw error; // not yours: let it go up
  }
} finally {
  // always runs: clean up
}
`,
  },
  {
    id: "custom-error",
    title: "Custom error & throw",
    keywords: "throw error exception custom class extends error cause",
    code: `class CustomError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CustomError";
  }
}

throw new CustomError("what went wrong", { cause: originalError });
`,
  },
  {
    id: "async",
    title: "Async function",
    keywords: "async await promise try catch",
    code: `async function functionName() {
  try {
    const result = await promise;
    // ...
  } catch (error) {
    // handle a rejected promise
  }
}
`,
  },
  {
    id: "promise-all",
    title: "Await in parallel",
    keywords: "promise all allsettled race parallel concurrent await",
    code: `const [first, second] = await Promise.all([firstPromise, secondPromise]);

// Never rejects: one { status, value | reason } per promise
const results = await Promise.allSettled([firstPromise, secondPromise]);
`,
  },
  {
    id: "promise",
    title: "new Promise",
    note: "Wrap a callback or timer API in a promise.",
    keywords: "promise resolve reject settimeout callback wrap sleep",
    code: `const promise = new Promise((resolve, reject) => {
  // call resolve(value) on success, reject(error) on failure
});
`,
  },
  {
    id: "modules-export",
    title: "Module: export",
    keywords: "module export default named esm",
    code: `export const name = "value";

export function functionName() {
  // ...
}

export default class ClassName {
  // ...
}
`,
  },
  {
    id: "modules-import",
    title: "Module: import",
    keywords: "module import default named esm npm package dynamic",
    code: `import ClassName, { name, functionName } from "./module.js";
import * as namespace from "./module.js";
import packageName from "package-name"; // npm packages load from esm.sh
`,
  },
];
