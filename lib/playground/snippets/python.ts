/** @file Python snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    note: "print() writes to the Output pane; input() reads the stdin box.",
    keywords: "print input main boilerplate starter f-string",
    code: `def main() -> None:
    print("Hello, world!")

    name = "playground"
    print(f"Hello, {name}! 2 + 2 = {2 + 2}")

    # input() reads the next line of the stdin box ("" when it's empty)
    who = input("Your name? ") or "stranger"
    print(f"Nice to meet you, {who}.")


# Runs main() when this file is the program, not when it's imported
if __name__ == "__main__":
    main()
`,
  },
  {
    id: "variables",
    title: "Variables & types",
    note: "Built-in types, type hints, unpacking, conversions.",
    keywords: "int float str bool none type hints annotation unpacking swap conversion",
    code: `count = 0  # int (any size)
ratio = 0.75  # float
title = "Playground"  # str
done = False  # bool
nothing = None  # the "no value" value
big = 2**100  # ints never overflow

# Type hints document intent: the editor checks them, Python ignores them at runtime
scores: list[int] = [90, 72]
point: tuple[float, float] = (1.5, 2.0)
maybe: str | None = None

# Several names at once, swapping, and unpacking the rest
a, b = 1, 2
a, b = b, a
first, *rest = [1, 2, 3, 4]

print(type(count).__name__, type(ratio).__name__, type(nothing).__name__)
print(big, a, b, first, rest, title, done, scores, point, maybe)
print(int("42") + 1, float("3.5"), str(10) + "!", bool(""), bool("x"))
`,
  },
  {
    id: "functions",
    title: "Functions",
    note: "Defaults, keyword-only and variadic parameters, several return values, docstrings.",
    keywords: "def return parameters default keyword args kwargs docstring callable",
    code: `from collections.abc import Callable


def add(a: int, b: int) -> int:
    """Return the sum of a and b (docstrings show in hovers)."""
    return a + b


# Parameters after * must be passed by keyword
def greet(name: str = "world", *, punctuation: str = "!") -> str:
    return f"Hello, {name}{punctuation}"


# *args collects extra positional arguments, **kwargs extra keyword ones
def total(*numbers: float, **options: bool) -> float:
    result = sum(numbers)
    return round(result) if options.get("rounded") else result


# Several return values come back as a tuple
def min_max(values: list[int]) -> tuple[int, int]:
    return min(values), max(values)


# Functions are objects: pass them to other functions
def apply(func: Callable[[int], int], value: int) -> int:
    return func(value)


print(add(2, 3))
print(greet(), greet("Ada", punctuation="?"))
print(total(1.2, 2.5), total(1.2, 2.5, rounded=True))
low, high = min_max([3, 9, 1])
print(low, high, apply(abs, -7))
`,
  },
  {
    id: "arrow",
    title: "Lambdas & closures",
    note: "Python's arrow functions: one-expression lambdas, mostly as keys and callbacks.",
    keywords: "lambda arrow closure anonymous sorted key map filter comprehension",
    code: `from collections.abc import Callable

# A lambda is an anonymous function of one expression
square = lambda x: x * x  # fine for a demo; a named function reads better as a def
print(square(4))

# Most often: a key or a callback
words = ["banana", "Apple", "cherry"]
print(sorted(words, key=lambda w: w.lower()))
print(sorted(words, key=len, reverse=True))

people = [("Ada", 36), ("Grace", 85), ("Linus", 28)]
print(max(people, key=lambda person: person[1]))

print(list(map(lambda n: n * 2, [1, 2, 3])))
print(list(filter(lambda n: n % 2 == 0, range(10))))
# ...though comprehensions usually read better:
print([n * 2 for n in [1, 2, 3]], [n for n in range(10) if n % 2 == 0])


# A closure: a function that remembers values from where it was made
def make_multiplier(factor: int) -> Callable[[int], int]:
    return lambda n: n * factor


triple = make_multiplier(3)
print(triple(5))
`,
  },
  {
    id: "control",
    title: "Conditionals & loops",
    note: "if/elif/else, for with range, enumerate and zip, while, match.",
    keywords: "if elif else for while range enumerate zip break continue match case pattern",
    code: `score = 72

if score >= 90:
    grade = "A"
elif score >= 70:
    grade = "B"
else:
    grade = "C"
print(grade, "pass" if score >= 50 else "fail")  # a conditional expression

for i in range(3):  # 0, 1, 2
    print("i =", i)

for index, fruit in enumerate(["apple", "pear"], start=1):
    print(index, fruit)

for name, age in zip(["Ada", "Grace"], [36, 85]):
    print(name, age)

n = 10
while n > 0:
    n -= 3
    if n == 4:
        continue
    if n < 2:
        break
    print("n =", n)


# Structural pattern matching
def describe(command: object) -> str:
    match command:
        case ["go", direction]:
            return f"going {direction}"
        case {"action": "look"}:
            return "looking around"
        case int(number) if number > 0:
            return f"a positive number: {number}"
        case _:
            return "unknown"


print(describe(["go", "north"]), describe({"action": "look"}), describe(5), describe(None))
`,
  },
  {
    id: "collections",
    title: "Lists, dicts, sets & tuples",
    note: "The everyday methods, slicing, comprehensions, Counter and defaultdict.",
    keywords: "list dict dictionary set tuple slice comprehension counter defaultdict append sort",
    code: `from collections import Counter, defaultdict

# list: ordered, mutable
nums = [5, 3, 8, 1]
nums.append(10)
nums.sort()  # in place; sorted(nums) returns a sorted copy
print(nums, nums[0], nums[-1], nums[1:3], len(nums), 8 in nums)

# tuple: ordered, immutable
point = (3, 4)
x, y = point

# dict: key -> value, in insertion order
ages = {"Ada": 36, "Grace": 85}
ages["Linus"] = 28
print(ages.get("Alan", "unknown"), list(ages))
for name, age in ages.items():
    print(f"{name}: {age}")

# set: unique values
tags = {"py", "web", "py"}
print(sorted(tags | {"data"}), tags & {"web", "cli"}, len(tags))

# Comprehensions
squares = [n * n for n in range(5)]
lengths = {word: len(word) for word in ["hi", "hello"]}
odd = {n for n in range(10) if n % 2}
print(squares, lengths, sorted(odd), x + y)

# Counting and grouping
print(Counter("mississippi").most_common(2))
groups: defaultdict[str, list[str]] = defaultdict(list)
for word in ["apple", "avocado", "banana"]:
    groups[word[0]].append(word)
print(dict(groups))
`,
  },
  {
    id: "classes",
    title: "Classes",
    note: "__init__, properties, class and static methods, inheritance, dataclasses.",
    keywords:
      "class init self property classmethod staticmethod inheritance super dataclass repr oop",
    code: `from dataclasses import dataclass, field
from typing import Self


class Animal:
    count = 0  # a class attribute, shared by every instance

    def __init__(self, name: str, sound: str) -> None:
        self.name = name  # an instance attribute
        self._sound = sound  # a leading underscore means "private" by convention
        Animal.count += 1

    def speak(self) -> str:
        return f"{self.name} says {self._sound}"

    @property
    def shout(self) -> str:
        return self.speak().upper()

    @classmethod
    def parse(cls, text: str) -> Self:
        name, sound = text.split(":")
        return cls(name, sound)

    @staticmethod
    def kingdom() -> str:
        return "Animalia"

    def __repr__(self) -> str:
        return f"Animal({self.name!r})"


class Dog(Animal):
    def __init__(self, name: str) -> None:
        super().__init__(name, "woof")

    def speak(self) -> str:  # overrides Animal.speak
        return super().speak() + "!"


# A dataclass writes __init__, __repr__ and __eq__ for you
@dataclass(order=True)
class Point:
    x: float
    y: float = 0.0
    tags: list[str] = field(default_factory=list)

    def distance(self) -> float:
        return (self.x**2 + self.y**2) ** 0.5


rex = Dog("Rex")
print(rex.speak(), rex.shout, isinstance(rex, Animal))
print(Animal.parse("Cat:meow"), Animal.kingdom(), Animal.count)
p = Point(3, 4)
print(p, p.distance(), p == Point(3, 4), Point(1) < p)
`,
  },
  {
    id: "errors",
    title: "Exception handling",
    note: "try/except/else/finally, raise … from, custom exceptions, context managers.",
    keywords: "try except else finally raise from exception error custom with context manager",
    code: `from contextlib import suppress


class ValidationError(ValueError):
    """Raised when input is invalid."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field


def parse_age(text: str) -> int:
    try:
        age = int(text)
    except ValueError as error:
        # from keeps the original error as the cause
        raise ValidationError("age", f"not a number: {text!r}") from error
    if age < 0:
        raise ValidationError("age", "must not be negative")
    return age


for text in ["42", "-1", "abc"]:
    try:
        age = parse_age(text)
    except ValidationError as error:
        print(f"{error.field}: {error}")
    else:
        print("age:", age)  # only when nothing was raised
    finally:
        print("checked", repr(text))  # always


# Several exception types at once
def lookup(data: dict[str, int], key: str) -> int | None:
    try:
        return data[key]
    except (KeyError, TypeError) as error:
        print("lookup failed:", type(error).__name__, error)
        return None


lookup({"a": 1}, "b")

# with: the block's resources are cleaned up even when it raises
with suppress(ZeroDivisionError):
    print(1 / 0)
print("still running")
`,
  },
  {
    id: "async",
    title: "Async / await",
    note: "Coroutines with asyncio: gather, tasks, timeouts, errors.",
    keywords: "async await asyncio coroutine gather task timeout sleep concurrency",
    code: `import asyncio
import sys


async def fetch(name: str, delay: float) -> str:
    await asyncio.sleep(delay)  # stands in for network I/O
    return f"{name} after {delay}s"


async def fail() -> None:
    await asyncio.sleep(0.1)
    raise RuntimeError("something went wrong")


async def main() -> None:
    # One after the other
    print(await fetch("first", 0.2))

    # Concurrently: takes as long as the slowest, not the sum
    print(await asyncio.gather(fetch("a", 0.3), fetch("b", 0.1)))

    # A task starts running as soon as it's created
    task = asyncio.create_task(fetch("background", 0.2))
    print("task started")
    print(await task)

    # Give up after a timeout
    try:
        await asyncio.wait_for(fetch("slow", 5), timeout=0.2)
    except TimeoutError:
        print("timed out")

    # Errors come out of await
    try:
        await fail()
    except RuntimeError as error:
        print("caught:", error)


if sys.platform == "emscripten":
    # In the browser (Pyodide) the page's event loop is already running: schedule main() on it
    asyncio.ensure_future(main())
else:
    asyncio.run(main())  # everywhere else: start a loop and wait for main() to finish
`,
  },
  {
    id: "modules-export",
    title: "Modules: a module",
    note: "A file of its own; main.py imports it (next snippet).",
    file: "geometry.py",
    keywords: "module import file package __all__",
    code: `"""Shapes and distances."""

import math

PI = math.pi

__all__ = ["PI", "Circle", "distance"]  # what \`from geometry import *\` takes


class Circle:
    def __init__(self, radius: float) -> None:
        self.radius = radius

    @property
    def area(self) -> float:
        return PI * self.radius**2


def distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.dist(a, b)
`,
  },
  {
    id: "modules-import",
    title: "Modules: importing",
    note: "Uses geometry.py from the previous snippet; packages like numpy load on import.",
    file: "main.py",
    keywords: "module import from as package numpy pandas standard library",
    code: `import geometry
from geometry import Circle, distance
from geometry import PI as pi

import json
from pathlib import Path

print(Circle(2).area, distance((0, 0), (3, 4)), pi, geometry.PI)

# Standard library modules are always there
print(json.dumps({"ok": True}), Path("data/values.txt").suffix)

# Pyodide packages (numpy, pandas, ...) download the first time you import them:
# import numpy as np
`,
  },
];
