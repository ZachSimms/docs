/**
 * @file A `CMakeLists.txt` for C/C++ playground projects.
 *
 * Compiler Explorer builds multi-file projects with CMake. When the project
 * has no `CMakeLists.txt` of its own, this one compiles every source file into
 * a target called `app` (the executable Compiler Explorer runs), with C++23 and
 * every directory that holds a header on the include path.
 */

import { dirname } from "./project";

/** The target name Compiler Explorer expects to run. */
export const CMAKE_TARGET = "app";
/** A user-written build file, if present, is used instead of the generated one. */
export const CMAKE_FILE = "CMakeLists.txt";

const SOURCE = /\.(?:cpp|cc|cxx|c)$/i;
const HEADER = /\.(?:h|hh|hpp|hxx)$/i;

/**
 * Generate a `CMakeLists.txt` for the project's files.
 *
 * @param paths - Every file path in the project.
 * @returns The build file's text.
 */
export function generateCMakeLists(paths: readonly string[]): string {
  const sources = paths.filter((p) => SOURCE.test(p)).sort();
  const includes = [
    ...new Set(paths.filter((p) => HEADER.test(p)).map((p) => dirname(p) || ".")),
  ].sort();
  const languages = sources.some((s) => s.toLowerCase().endsWith(".c")) ? "C CXX" : "CXX";
  return [
    "cmake_minimum_required(VERSION 3.20)",
    `project(playground LANGUAGES ${languages})`,
    "set(CMAKE_CXX_STANDARD 23)",
    "set(CMAKE_CXX_STANDARD_REQUIRED ON)",
    `add_executable(${CMAKE_TARGET} ${sources.join(" ")})`,
    ...(includes.length
      ? [`target_include_directories(${CMAKE_TARGET} PRIVATE ${includes.join(" ")})`]
      : []),
    "",
  ].join("\n");
}
