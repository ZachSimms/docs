/** @file TypeScript outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    keywords: "print console log main boilerplate starter",
    code: `function main(): void {
  console.log("Hello, world!");
}

main();
`,
  },
  {
    id: "variables",
    title: "Variables",
    keywords: "const let type annotation declare",
    code: `const constantName: string = "value";
let variableName: number = 0;
let maybe: string | null = null;
`,
  },
  {
    id: "interface",
    title: "Interface",
    keywords: "interface object shape type optional readonly",
    code: `interface InterfaceName {
  readonly id: number;
  name: string;
  optional?: string;
  method(param: string): void;
}
`,
  },
  {
    id: "type",
    title: "Type alias & union",
    keywords: "type alias union literal discriminated",
    code: `type Status = "idle" | "loading" | "error";

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number };
`,
  },
  {
    id: "functions",
    title: "Function",
    keywords: "function return parameters typed optional default",
    code: `function functionName(param: string, optional?: number): void {
  // ...
}
`,
  },
  {
    id: "generic",
    title: "Generic function",
    keywords: "generic type parameter constraint extends",
    code: `function functionName<T>(value: T): T {
  // ...
  return value;
}
`,
  },
  {
    id: "arrow",
    title: "Arrow function",
    keywords: "arrow lambda => anonymous closure callback",
    code: `const functionName = (param: string): void => {
  // ...
};

// Expression body: the value is returned
const shortFunction = (param: number): number => param;
`,
  },
  {
    id: "if",
    title: "if / else if / else",
    keywords: "if else conditional branch narrowing",
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
    title: "switch (exhaustive)",
    note: "The never check makes the compiler flag a missing case.",
    keywords: "switch case default union narrowing never exhaustive",
    code: `switch (value.kind) {
  case "first":
    // ...
    break;
  case "second":
    // ...
    break;
  default: {
    const unreachable: never = value;
    throw new Error(\`unhandled: \${unreachable}\`);
  }
}
`,
  },
  {
    id: "loops",
    title: "Loops",
    keywords: "for of in while loop iterate break continue",
    code: `for (let i = 0; i < count; i++) {
  // ...
}

for (const item of items) {
  // ...
}

while (condition) {
  // ...
}
`,
  },
  {
    id: "collections",
    title: "Array, Record, Map & Set",
    keywords: "array record map set collection dictionary list typed",
    code: `const list: string[] = [];
const record: Record<string, number> = {};
const map = new Map<string, number>();
const set = new Set<string>();
`,
  },
  {
    id: "classes",
    title: "Class",
    keywords: "class constructor method field private readonly static getter implements oop",
    code: `class ClassName implements InterfaceName {
  private field: string;
  static shared = 0;

  constructor(public readonly name: string) {
    this.field = name;
  }

  methodName(param: string): void {
    // ...
  }

  get computed(): string {
    return this.field;
  }
}
`,
  },
  {
    id: "extends",
    title: "Subclass & abstract class",
    keywords: "class extends abstract inheritance super override",
    code: `abstract class BaseClass {
  abstract methodName(): void;
}

class ChildClass extends BaseClass {
  constructor() {
    super();
  }

  override methodName(): void {
    // ...
  }
}
`,
  },
  {
    id: "errors",
    title: "try / catch / finally",
    keywords: "try catch finally exception error handling unknown narrow instanceof",
    code: `try {
  // code that might throw
} catch (error: unknown) {
  // Anything can be thrown, so narrow before use
  if (error instanceof CustomError) {
    // ...
  } else if (error instanceof Error) {
    // ...
  } else {
    throw error;
  }
} finally {
  // always runs: clean up
}
`,
  },
  {
    id: "custom-error",
    title: "Custom error & throw",
    keywords: "throw error exception custom class extends error",
    code: `class CustomError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
    this.name = "CustomError";
  }
}

throw new CustomError("what went wrong", 400);
`,
  },
  {
    id: "async",
    title: "Async function",
    keywords: "async await promise try catch",
    code: `async function functionName(): Promise<void> {
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
    keywords: "promise all allsettled parallel concurrent await",
    code: `const [first, second] = await Promise.all([firstPromise, secondPromise]);
`,
  },
  {
    id: "modules-export",
    title: "Module: export",
    keywords: "module export default named type esm",
    code: `export interface TypeName {
  // ...
}

export function functionName(): void {
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
    keywords: "module import default named type esm npm package",
    code: `import ClassName, { functionName } from "./module";
import type { TypeName } from "./module";
`,
  },
];
