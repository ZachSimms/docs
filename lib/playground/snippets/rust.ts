/** @file Rust outlines (see `./index.ts`). todo!() marks what to fill in, and compiles meanwhile. */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    keywords: "main print println boilerplate starter",
    code: `fn main() {
    println!("Hello, world!");
}
`,
  },
  {
    id: "variables",
    title: "Variables",
    keywords: "let mut const type declare",
    code: `let name = "value";
let mut count: i32 = 0;
const MAX: u32 = 100;
`,
  },
  {
    id: "functions",
    title: "Function",
    keywords: "fn function return parameters borrow",
    code: `fn function_name(param: &str) -> ReturnType {
    todo!()
}
`,
  },
  {
    id: "generic",
    title: "Generic function",
    keywords: "generic trait bound where impl",
    code: `fn function_name<T: Clone>(value: &T) -> T {
    todo!()
}
`,
  },
  {
    id: "arrow",
    title: "Closure",
    note: "Rust's arrow function: |parameters| body.",
    keywords: "closure lambda arrow anonymous move fn",
    code: `let function_name = |param: i32| {
    // ...
};
`,
  },
  {
    id: "if",
    title: "if / else if / else",
    keywords: "if else conditional branch if let",
    code: `if condition {
    // ...
} else if other_condition {
    // ...
} else {
    // ...
}
`,
  },
  {
    id: "match",
    title: "match",
    keywords: "match pattern enum option switch case",
    code: `match value {
    Pattern::First => {
        // ...
    }
    Pattern::Second(inner) => {
        // ...
    }
    _ => {
        // ...
    }
}
`,
  },
  {
    id: "loops",
    title: "Loops",
    keywords: "for while loop range iter break continue",
    code: `for item in &items {
    // ...
}

for i in 0..count {
    // ...
}

while condition {
    // ...
}

loop {
    // ... break when done
}
`,
  },
  {
    id: "collections",
    title: "Vec, HashMap & HashSet",
    keywords: "vec hashmap hashset collection list dictionary",
    code: `use std::collections::{HashMap, HashSet};

let mut items: Vec<String> = Vec::new();
let mut lookup: HashMap<String, i32> = HashMap::new();
let mut unique: HashSet<String> = HashSet::new();
`,
  },
  {
    id: "classes",
    title: "Struct & impl",
    note: "Rust's class: data in a struct, methods in an impl block.",
    keywords: "class struct impl method self new constructor oop",
    code: `struct StructName {
    field: String,
}

impl StructName {
    fn new(field: String) -> Self {
        Self { field }
    }

    fn method_name(&self) {
        todo!()
    }
}
`,
  },
  {
    id: "trait",
    title: "Trait & impl",
    keywords: "trait interface impl for default method",
    code: `trait TraitName {
    fn required_method(&self);

    fn default_method(&self) {
        // ...
    }
}

impl TraitName for StructName {
    fn required_method(&self) {
        todo!()
    }
}
`,
  },
  {
    id: "enum",
    title: "Enum",
    keywords: "enum variant data",
    code: `enum EnumName {
    Unit,
    Tuple(i32),
    Struct { field: String },
}
`,
  },
  {
    id: "errors",
    title: "Result & ?",
    note: "No exceptions in Rust: functions return a Result, and ? passes an error up.",
    keywords: "exception try catch error result question mark handling",
    code: `fn function_name() -> Result<ReturnType, ErrorType> {
    let value = fallible_call()?;
    // ...
    Ok(todo!())
}

match function_name() {
    Ok(value) => {
        // ...
    }
    Err(error) => {
        // ...
    }
}
`,
  },
  {
    id: "custom-error",
    title: "Custom error type",
    keywords: "error custom enum display impl std error",
    code: `#[derive(Debug)]
enum CustomError {
    Variant(String),
}

impl std::fmt::Display for CustomError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        todo!()
    }
}

impl std::error::Error for CustomError {}
`,
  },
  {
    id: "async",
    title: "Async function",
    note: "Needs a runtime (tokio etc.) to run; the playground has only the standard library.",
    keywords: "async await future",
    code: `async fn function_name() -> ReturnType {
    let value = other_async_fn().await;
    todo!()
}
`,
  },
  {
    id: "thread",
    title: "Thread",
    keywords: "thread spawn join move concurrency parallel",
    code: `let handle = std::thread::spawn(move || {
    // runs on another thread
});

handle.join().unwrap();
`,
  },
  {
    id: "module",
    title: "Module",
    file: "src/main.rs",
    note: "mod name; loads src/name.rs.",
    keywords: "mod module pub use file",
    code: `mod module_name;

use module_name::function_name;
`,
  },
];
