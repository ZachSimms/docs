/** @file Python outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    keywords: "print main boilerplate starter name",
    code: `def main() -> None:
    print("Hello, world!")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "variables",
    title: "Variables",
    keywords: "variable type hint annotation unpacking",
    code: `variable_name: str = "value"
count: int = 0
maybe: str | None = None
first, second = 1, 2
`,
  },
  {
    id: "functions",
    title: "Function",
    keywords: "def function return parameters docstring",
    code: `def function_name(param: str, optional: int = 0) -> None:
    """What the function does."""
    ...
`,
  },
  {
    id: "function-params",
    title: "Function: *args, keyword-only & **kwargs",
    keywords: "def args kwargs keyword-only variadic parameters",
    code: `def function_name(required: str, *args: int, keyword_only: bool = False, **kwargs: str) -> None:
    ...
`,
  },
  {
    id: "arrow",
    title: "Lambda",
    note: "Python's arrow function: one expression, mostly as a key or callback.",
    keywords: "lambda arrow anonymous closure key sorted callback",
    code: `function_name = lambda param: param

sorted_items = sorted(items, key=lambda item: item)
`,
  },
  {
    id: "if",
    title: "if / elif / else",
    keywords: "if elif else conditional branch",
    code: `if condition:
    ...
elif other_condition:
    ...
else:
    ...
`,
  },
  {
    id: "match",
    title: "match / case",
    keywords: "match case pattern switch structural",
    code: `match value:
    case "first":
        ...
    case [first, *rest]:
        ...
    case {"key": key_value}:
        ...
    case _:
        ...
`,
  },
  {
    id: "loops",
    title: "Loops",
    keywords: "for while range enumerate zip loop break continue",
    code: `for item in items:
    ...

for index, item in enumerate(items):
    ...

for i in range(count):
    ...

while condition:
    ...
`,
  },
  {
    id: "comprehension",
    title: "Comprehensions",
    keywords: "list dict set comprehension generator filter map",
    code: `new_list = [item for item in items if condition]
new_dict = {key: value for key, value in pairs}
new_set = {item for item in items}
`,
  },
  {
    id: "collections",
    title: "list, dict, set & tuple",
    keywords: "list dict set tuple collection dictionary",
    code: `items: list[str] = []
lookup: dict[str, int] = {}
unique: set[str] = set()
pair: tuple[str, int] = ("key", 0)
`,
  },
  {
    id: "classes",
    title: "Class",
    keywords: "class init self method property classmethod staticmethod oop",
    code: `class ClassName:
    shared = 0  # class attribute

    def __init__(self, param: str) -> None:
        self.param = param

    def method_name(self) -> None:
        ...

    @property
    def computed(self) -> str:
        return self.param

    @classmethod
    def from_other(cls, other: str) -> "ClassName":
        return cls(other)

    def __repr__(self) -> str:
        return f"ClassName({self.param!r})"
`,
  },
  {
    id: "extends",
    title: "Subclass",
    keywords: "class inheritance super override subclass",
    code: `class ChildClass(ParentClass):
    def __init__(self, param: str) -> None:
        super().__init__(param)
        ...

    def method_name(self) -> None:
        super().method_name()
        ...
`,
  },
  {
    id: "dataclass",
    title: "Dataclass",
    keywords: "dataclass field frozen record",
    code: `from dataclasses import dataclass, field


@dataclass
class ClassName:
    name: str
    count: int = 0
    tags: list[str] = field(default_factory=list)
`,
  },
  {
    id: "errors",
    title: "try / except / else / finally",
    keywords: "try except else finally exception error handling",
    code: `try:
    ...  # code that might raise
except (ValueError, KeyError) as error:
    ...  # handle it
else:
    ...  # runs only if nothing was raised
finally:
    ...  # always runs: clean up
`,
  },
  {
    id: "custom-error",
    title: "Custom exception & raise",
    keywords: "raise exception custom error from",
    code: `class CustomError(Exception):
    """What went wrong."""


raise CustomError("what went wrong") from original_error
`,
  },
  {
    id: "with",
    title: "with (context manager)",
    keywords: "with context manager open file close",
    code: `with open("path/to/file.txt") as file:
    ...
`,
  },
  {
    id: "async",
    title: "Async function",
    note: "In the playground, asyncio.run works in Chrome and Edge; elsewhere use asyncio.ensure_future(main()).",
    keywords: "async await asyncio coroutine run",
    code: `import asyncio


async def main() -> None:
    result = await coroutine()
    ...


asyncio.run(main())
`,
  },
  {
    id: "gather",
    title: "Await in parallel",
    keywords: "asyncio gather task create_task parallel concurrent",
    code: `async def function_name() -> None:
    first, second = await asyncio.gather(first_coroutine(), second_coroutine())
`,
  },
  {
    id: "modules-import",
    title: "Imports",
    keywords: "import from as module package",
    code: `import module_name
from module_name import name, other_name
from package.module import name as alias
`,
  },
];
