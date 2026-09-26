/**
 * @file Starter projects: one per language, each split across files and
 * folders so imports, exports, headers and modules are there to practice with.
 */

import type { Project } from "./project";

/** A project whose entry is open in a single tab. */
function starter(entry: string, files: Record<string, string>): Project {
  return { files, dirs: [], entry, open: entry, tabs: [entry] };
}

const JS = starter("main.js", {
  "main.js": `import { add, mean, greet } from "./lib/index.js";

console.log(greet("playground"));
console.log("2 + 3 =", add(2, 3));
console.log("mean:", mean([1, 2, 3, 4]));
console.table([{ n: 1, sq: 1 }, { n: 2, sq: 4 }]);
`,
  "lib/index.js": `// Re-export everything from one place.
export * from "./math.js";
export { default as greet } from "./greet.js";
`,
  "lib/math.js": `export const add = (a, b) => a + b;

export function mean(xs) {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}
`,
  "lib/greet.js": `export default function greet(name) {
  return \`Hello, \${name}!\`;
}
`,
});

const TS = starter("main.ts", {
  "main.ts": `import { add, mean, type Stats } from "./lib";
import greet from "./lib/greet";

const stats: Stats = { count: 4, mean: mean([1, 2, 3, 4]) };

console.log(greet("playground"));
console.log("2 + 3 =", add(2, 3));
console.log(stats);
`,
  "lib/index.ts": `export * from "./math";
export type { Stats } from "./types";
`,
  "lib/math.ts": `export const add = (a: number, b: number): number => a + b;

export function mean(xs: readonly number[]): number {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}
`,
  "lib/types.ts": `export interface Stats {
  readonly count: number;
  readonly mean: number;
}
`,
  "lib/greet.ts": `export default function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
});

const WEB = starter("index.html", {
  "index.html": `<!doctype html>
<link rel="stylesheet" href="css/style.css">

<main class="row">
  <button>A</button>
  <button>B</button>
  <button>C</button>
</main>
<p id="out">Click a button</p>

<script type="module" src="js/main.js"></script>
`,
  "css/style.css": `body { font-family: system-ui, sans-serif; }

.row {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  max-width: 16rem;
}
`,
  "js/main.js": `import { label } from "./util.js";

for (const button of document.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    document.querySelector("#out").textContent = label(button);
    console.log("clicked", button.textContent);
  });
}
`,
  "js/util.js": `export const label = (el) => \`You clicked \${el.textContent}\`;
`,
});

const PYTHON = starter("main.py", {
  "main.py": `from pathlib import Path

from shapes import Circle

radius = float(Path("data/values.txt").read_text())
print(f"area of r={radius}:", round(Circle(radius).area(), 3))

name = input("name? ")
print(f"hello {name}")
`,
  "shapes/__init__.py": `from .circle import Circle

__all__ = ["Circle"]
`,
  "shapes/circle.py": `import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Circle:
    radius: float

    def area(self) -> float:
        return math.pi * self.radius**2
`,
  "data/values.txt": `2
`,
});

const CPP = starter("main.cpp", {
  "main.cpp": `#include <iostream>
#include <print>

#include "vec.h"

int main() {
  Vec v{3, 4};
  std::println("|v| = {}", v.length());

  int n = 0;
  std::cin >> n;
  std::println("n * 2 = {}", n * 2);
}
`,
  "include/vec.h": `#pragma once

struct Vec {
  double x = 0;
  double y = 0;

  double length() const;
};
`,
  "src/vec.cpp": `#include "vec.h"

#include <cmath>

double Vec::length() const {
  return std::hypot(x, y);
}
`,
});

const RUST = starter("src/main.rs", {
  "src/main.rs": `mod geometry;

use geometry::shapes::Circle;
use std::io::Read;

fn main() {
    let c = Circle { radius: 2.0 };
    println!("area = {:.3}", geometry::area(&c));

    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    println!("stdin said: {}", input.trim());
}
`,
  "src/geometry.rs": `pub mod shapes;

pub fn area(c: &shapes::Circle) -> f64 {
    std::f64::consts::PI * c.radius * c.radius
}
`,
  "src/geometry/shapes.rs": `pub struct Circle {
    pub radius: f64,
}
`,
});

const GDSCRIPT = starter("main.gd", {
  "main.gd": `extends Node

const Utils = preload("res://lib/utils.gd")


func _ready() -> void:
	print("Hello from Godot ", Engine.get_version_info().string)
	print("5! = ", Utils.factorial(5))

	var inventory := {"apples": 3, "pears": 1}
	for item in inventory:
		print(item, ": ", inventory[item])
`,
  "lib/utils.gd": `# class_name globals don't resolve in the playground:
# load helper scripts with preload("res://lib/utils.gd").


static func factorial(n: int) -> int:
	return 1 if n <= 1 else n * factorial(n - 1)
`,
});

/** Starter project per language id (see `languages.ts`). */
export const TEMPLATES = {
  javascript: JS,
  typescript: TS,
  web: WEB,
  python: PYTHON,
  cpp: CPP,
  rust: RUST,
  gdscript: GDSCRIPT,
} as const satisfies Record<string, Project>;
