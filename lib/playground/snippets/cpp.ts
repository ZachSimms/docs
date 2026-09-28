/** @file C++ outlines (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    keywords: "main print println cout boilerplate starter",
    code: `#include <print>

int main() {
  std::println("Hello, world!");
}
`,
  },
  {
    id: "variables",
    title: "Variables",
    keywords: "variable auto const constexpr type declare",
    code: `int count = 0;
auto inferred = 0.0;
const std::string name = "value";
constexpr int kLimit = 100;
`,
  },
  {
    id: "functions",
    title: "Function",
    keywords: "function return parameters declaration definition reference",
    code: `ReturnType function_name(const ParamType& param) {
  // ...
  return {};
}
`,
  },
  {
    id: "template",
    title: "Function template",
    keywords: "template generic typename function",
    code: `template <typename T>
T function_name(const T& value) {
  // ...
  return value;
}
`,
  },
  {
    id: "arrow",
    title: "Lambda",
    note: "C++'s arrow function: [captures](parameters) { body }.",
    keywords: "lambda arrow closure capture anonymous function",
    code: `auto function_name = [&](const auto& param) {
  // ...
};
`,
  },
  {
    id: "if",
    title: "if / else if / else",
    keywords: "if else conditional branch",
    code: `if (condition) {
  // ...
} else if (other_condition) {
  // ...
} else {
  // ...
}
`,
  },
  {
    id: "switch",
    title: "switch",
    keywords: "switch case default break enum",
    code: `switch (value) {
  case 1:
    // ...
    break;
  case 2:
    // ...
    break;
  default:
    // ...
    break;
}
`,
  },
  {
    id: "loops",
    title: "Loops",
    keywords: "for range while do loop iterate break continue",
    code: `for (int i = 0; i < count; ++i) {
  // ...
}

for (const auto& item : items) {
  // ...
}

while (condition) {
  // ...
}
`,
  },
  {
    id: "collections",
    title: "vector, map & set",
    keywords: "vector map unordered_map set array container collection",
    code: `std::vector<int> items;
std::map<std::string, int> lookup;
std::unordered_map<std::string, int> hashed;
std::set<std::string> unique;
`,
  },
  {
    id: "classes",
    title: "Class",
    keywords: "class constructor method member public private oop",
    code: `class ClassName {
 public:
  explicit ClassName(int value) : value_(value) {}

  void method_name() {
    // ...
  }

  int value() const { return value_; }

 private:
  int value_;
};
`,
  },
  {
    id: "extends",
    title: "Base & derived class",
    keywords: "inheritance virtual override derived base abstract polymorphism",
    code: `class Base {
 public:
  virtual ~Base() = default;
  virtual void method_name() = 0;
};

class Derived : public Base {
 public:
  void method_name() override {
    // ...
  }
};
`,
  },
  {
    id: "struct",
    title: "Struct",
    keywords: "struct aggregate data plain",
    code: `struct StructName {
  int field = 0;
  std::string name;
};
`,
  },
  {
    id: "errors",
    title: "try / catch",
    note: "No finally in C++: destructors clean up (RAII).",
    keywords: "try catch throw exception error handling",
    code: `try {
  // code that might throw
} catch (const CustomError& error) {
  // the most specific type first
} catch (const std::exception& error) {
  // any standard exception: error.what()
} catch (...) {
  // anything else
}
`,
  },
  {
    id: "custom-error",
    title: "Custom exception & throw",
    keywords: "throw exception custom runtime_error class",
    code: `class CustomError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

throw CustomError("what went wrong");
`,
  },
  {
    id: "async",
    title: "std::async & future",
    keywords: "async future thread concurrency parallel get",
    code: `std::future<ResultType> future = std::async(std::launch::async, [] {
  // runs on another thread
  return ResultType{};
});

ResultType result = future.get();  // waits for the result
`,
  },
  {
    id: "thread",
    title: "Thread & mutex",
    keywords: "thread jthread mutex lock_guard concurrency",
    code: `std::mutex mutex;

std::jthread worker([&] {
  std::lock_guard lock(mutex);
  // ...
});  // joins when it goes out of scope
`,
  },
  {
    id: "header",
    title: "Header file",
    file: "include/name.h",
    keywords: "header include pragma once declaration namespace",
    code: `#pragma once

namespace name {

void function_name();

}  // namespace name
`,
  },
  {
    id: "source",
    title: "Source file",
    file: "src/name.cpp",
    keywords: "source definition cpp include namespace",
    code: `#include "name.h"

namespace name {

void function_name() {
  // ...
}

}  // namespace name
`,
  },
];
