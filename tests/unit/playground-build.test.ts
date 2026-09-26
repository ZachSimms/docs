/** Unit tests for the playground's build helpers: Rust module inlining, CMake generation and console output. */
import { describe, expect, it } from "bun:test";
import { generateCMakeLists } from "@/lib/playground/cmake";
import {
  appendOutput,
  EMPTY_OUTPUT,
  OUTPUT_LIMITS,
  outputText,
  stripAnsi,
} from "@/lib/playground/output";
import { inlineRustModules, mapRustPositions, RustModuleError } from "@/lib/playground/rust-inline";
import { TEMPLATES } from "@/lib/playground/templates";

describe("inlineRustModules", () => {
  it("inlines nested file modules the way rustc resolves them", () => {
    const { code } = inlineRustModules(TEMPLATES.rust.files, "src/main.rs");
    expect(code).toContain("mod geometry {");
    expect(code).toContain("pub mod shapes {");
    expect(code).toContain("pub struct Circle");
    expect(code).not.toMatch(/mod \w+;/);
  });

  it("finds foo/mod.rs as well as foo.rs, and keeps pub(crate) and comments", () => {
    const files = {
      "src/main.rs": "pub(crate) mod util; // helpers\nfn main() {}",
      "src/util/mod.rs": "pub fn one() -> i32 { 1 }",
    };
    const { code } = inlineRustModules(files, "src/main.rs");
    expect(code.split("\n")[0]).toBe("pub(crate) mod util {");
    expect(code).toContain("pub fn one()");
  });

  it("leaves inline modules and commented-out declarations alone", () => {
    const files = { "src/main.rs": "// mod gone;\nmod tests { }\nfn main() {}" };
    expect(inlineRustModules(files, "src/main.rs").code).toBe(files["src/main.rs"]);
  });

  it("maps compiler positions back to the original file and line", () => {
    const { lines } = inlineRustModules(TEMPLATES.rust.files, "src/main.rs");
    // Line 1 is `mod geometry {` (from main.rs:1); line 2 is geometry.rs:1.
    expect(lines[0]).toEqual({ file: "src/main.rs", line: 1 });
    expect(lines[1]).toEqual({ file: "src/geometry.rs", line: 1 });
    expect(mapRustPositions(" --> <source>:2:5 and src/main.rs:1:1", lines)).toBe(
      " --> src/geometry.rs:1:5 and src/main.rs:1:1",
    );
    expect(mapRustPositions("<source>:999:1", lines)).toBe("<source>:999:1");
  });

  it("explains a missing module file", () => {
    const files = { "src/main.rs": "mod gone;\nfn main() {}" };
    expect(() => inlineRustModules(files, "src/main.rs")).toThrow(RustModuleError);
    expect(() => inlineRustModules(files, "src/main.rs")).toThrow(
      /src\/gone\.rs or src\/gone\/mod\.rs/,
    );
  });
});

describe("generateCMakeLists", () => {
  it("builds every source into `app` with header directories on the include path", () => {
    const text = generateCMakeLists(Object.keys(TEMPLATES.cpp.files));
    expect(text).toContain("add_executable(app main.cpp src/vec.cpp)");
    expect(text).toContain("target_include_directories(app PRIVATE include)");
    expect(text).toContain("set(CMAKE_CXX_STANDARD 23)");
    expect(text).toContain("LANGUAGES CXX");
  });

  it("adds C when there are .c files and the root when headers sit there", () => {
    const text = generateCMakeLists(["main.cpp", "legacy.c", "util.h"]);
    expect(text).toContain("LANGUAGES C CXX");
    expect(text).toContain("PRIVATE .)");
  });
});

describe("output", () => {
  it("strips ANSI colour codes from compiler output", () => {
    expect(stripAnsi("\u001b[01;31m\u001b[Kerror: \u001b[m\u001b[Kboom")).toBe("error: boom");
  });

  it("merges consecutive chunks of one stream and keeps order across streams", () => {
    let out = appendOutput(EMPTY_OUTPUT, "stdout", "a");
    out = appendOutput(out, "stdout", "b\n");
    out = appendOutput(out, "stderr", "oops\n");
    expect(out.chunks).toEqual([
      { stream: "stdout", text: "ab\n" },
      { stream: "stderr", text: "oops\n" },
    ]);
    expect(outputText(out)).toBe("ab\noops\n");
    expect(EMPTY_OUTPUT.chunks).toEqual([]);
  });

  it("stops at the size cap and marks the output truncated", () => {
    const big = appendOutput(EMPTY_OUTPUT, "stdout", "x".repeat(OUTPUT_LIMITS.maxChars + 10));
    expect(big.size).toBe(OUTPUT_LIMITS.maxChars);
    expect(big.truncated).toBe(true);
    expect(appendOutput(big, "stdout", "more")).toBe(big);
  });
});
