/** @file C++ snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    note: "std::println (C++23) formats like Python's f-strings; std::cin reads the stdin box.",
    keywords: "main print println cout cin iostream boilerplate starter",
    code: `#include <iostream>
#include <print>
#include <string>

int main() {
  std::println("Hello, world!");

  std::string name = "playground";
  std::println("Hello, {}! 2 + 2 = {}", name, 2 + 2);

  // The classic way works too
  std::cout << "Hello from iostream\\n";

  // Read a word from the stdin box
  std::string word;
  if (std::cin >> word) std::println("You typed: {}", word);

  return 0;  // optional in main: falling off the end returns 0
}
`,
  },
  {
    id: "variables",
    title: "Variables & types",
    note: "Built-in types, auto, const and constexpr, brace initialization, structured bindings.",
    keywords: "int double bool char string auto const constexpr optional static_cast types",
    code: `#include <cstdint>
#include <optional>
#include <print>
#include <string>
#include <utility>
#include <vector>

int main() {
  int count = 0;  // at least 32 bits on every platform you'll meet
  double ratio = 0.75;
  bool done = false;
  char letter = 'A';
  std::string title = "Playground";
  std::int64_t big = 9'000'000'000;  // fixed-width integers from <cstdint>
  unsigned flags = 0b1010;

  auto inferred = 3.5f;  // auto: the type comes from the initializer (float here)
  const int max_users = 100;  // can't change after initialization
  constexpr double pi = 3.14159;  // known at compile time

  int braced{42};  // brace initialization refuses narrowing: int bad{3.5}; doesn't compile

  std::vector<int> scores{90, 72};
  std::optional<std::string> nickname;  // a value, or nothing

  auto [x, y] = std::pair{1, 2};  // structured bindings

  count += static_cast<int>(scores.size());  // an explicit conversion
  std::println("{} {} {} {} {} {} {}", count, ratio, done, letter, title, big, flags);
  std::println("{} {} {} {} {} {}", inferred, max_users, pi, braced, x + y,
               nickname.value_or("none"));
}
`,
  },
  {
    id: "functions",
    title: "Functions",
    note: "Declarations, default arguments, overloading, references, templates.",
    keywords: "function return parameters default overload reference const template auto",
    code: `#include <algorithm>
#include <format>
#include <print>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// A declaration: the definition can come later (or live in a .cpp file)
int add(int a, int b);

// Default arguments
std::string greet(std::string_view name = "world") {
  return std::format("Hello, {}!", name);
}

// Overloading: one name, different parameter types
double area(double radius) { return 3.14159 * radius * radius; }
double area(double width, double height) { return width * height; }

// const reference: read a big object without copying it
double sum(const std::vector<double>& values) {
  double total = 0;
  for (double v : values) total += v;
  return total;
}

// Non-const reference: change the caller's object
void double_all(std::vector<double>& values) {
  for (double& v : values) v *= 2;
}

// Several results: return a pair (or a struct)
std::pair<int, int> min_max(const std::vector<int>& values) {
  auto [lo, hi] = std::ranges::minmax(values);
  return {lo, hi};
}

// A template: one function for many types
template <typename T>
T largest(T a, T b) {
  return a > b ? a : b;
}

// An abbreviated template (C++20): auto parameters
auto twice(auto value) { return value + value; }

int main() {
  std::vector<double> values{1.5, 2.5};
  double_all(values);
  auto [lo, hi] = min_max({3, 9, 1});

  std::println("{} {} {} {}", add(2, 3), greet(), greet("Ada"), area(1.0));
  std::println("{} {} {} {}", area(2.0, 3.0), sum(values), lo, hi);
  std::println("{} {} {}", largest(3, 7), largest<std::string>("pear", "apple"), twice(21));
}

int add(int a, int b) { return a + b; }
`,
  },
  {
    id: "arrow",
    title: "Lambdas",
    note: "C++'s arrow functions: [captures](params) { body }, with algorithms and std::function.",
    keywords: "lambda arrow closure capture anonymous function std::function sort algorithm",
    code: `#include <algorithm>
#include <functional>
#include <print>
#include <string>
#include <vector>

int main() {
  // [captures](parameters) -> return type { body }
  auto square = [](int x) { return x * x; };
  auto add = [](int a, int b) -> int { return a + b; };

  // Captures: by value [x] (a copy) or by reference [&x]
  int offset = 10;
  auto shift = [offset](int x) { return x + offset; };
  int calls = 0;
  auto count = [&calls] { ++calls; };
  count();
  count();

  // mutable: the lambda keeps its own state between calls
  auto next_id = [id = 0]() mutable { return ++id; };
  next_id();

  // A generic lambda: auto parameters
  auto print_twice = [](const auto& value) { std::println("{} {}", value, value); };

  // With algorithms
  std::vector<int> nums{5, 3, 8, 1};
  std::ranges::sort(nums, [](int a, int b) { return a > b; });  // descending
  auto evens = std::ranges::count_if(nums, [](int n) { return n % 2 == 0; });

  // std::function holds any callable with a given signature
  std::function<int(int)> op = square;

  std::println("{} {} {} {} {}", square(4), add(2, 3), shift(5), calls, next_id());
  std::println("{} {} {}", nums, evens, op(9));
  print_twice(std::string("hi"));
}
`,
  },
  {
    id: "control",
    title: "Conditionals & loops",
    note: "if with an initializer, switch on an enum class, for, range-for, while, do-while.",
    keywords: "if else switch case enum for while do loop break continue ternary range",
    code: `#include <print>
#include <string>
#include <vector>

enum class Color { red, green, blue };

int main() {
  int score = 72;

  if (score >= 90) {
    std::println("A");
  } else if (score >= 70) {
    std::println("B or C");
  } else {
    std::println("keep going");
  }

  // if with an initializer: bonus only exists inside the if
  if (int bonus = score / 10; bonus > 5) std::println("bonus {}", bonus);

  std::println("{}", score >= 50 ? "pass" : "fail");

  Color color = Color::green;
  switch (color) {
    case Color::red:
      std::println("stop");
      break;
    case Color::green:
      std::println("go");
      break;
    case Color::blue:
      std::println("blue?");
      break;
  }

  for (int i = 0; i < 3; ++i) std::println("i = {}", i);

  std::vector<std::string> fruits{"apple", "pear"};
  for (const auto& fruit : fruits) std::println("{}", fruit);  // range-based for

  int n = 10;
  while (n > 0) {
    n -= 3;
    if (n == 4) continue;
    if (n < 2) break;
    std::println("n = {}", n);
  }

  do {
    ++n;  // the body runs at least once
  } while (n < 3);
  std::println("n = {}", n);
}
`,
  },
  {
    id: "collections",
    title: "vector, array, map & set",
    note: "The standard containers and the everyday operations on them.",
    keywords: "vector array map unordered_map set container push_back sort find erase contains",
    code: `#include <algorithm>
#include <array>
#include <map>
#include <print>
#include <set>
#include <string>
#include <unordered_map>
#include <vector>

int main() {
  // vector: a growable array (the default choice)
  std::vector<int> nums{5, 3, 8, 1};
  nums.push_back(10);
  std::ranges::sort(nums);
  bool has8 = std::ranges::contains(nums, 8);  // C++23
  std::println("{} size={} first={} last={} has 8: {}", nums, nums.size(), nums.front(),
               nums.back(), has8);

  // array: fixed size, no heap allocation
  std::array<double, 3> xyz{1.0, 2.0, 3.0};

  // map: sorted by key (unordered_map: hashed, usually faster)
  std::map<std::string, int> ages{{"Ada", 36}, {"Grace", 85}};
  ages["Linus"] = 28;
  for (const auto& [name, age] : ages) std::println("{}: {}", name, age);
  if (ages.find("Alan") == ages.end()) std::println("no Alan");
  std::println("has Grace: {}", ages.contains("Grace"));

  std::unordered_map<std::string, int> stock{{"apples", 3}};
  stock["pears"] += 2;  // a missing key starts at 0

  // set: unique values, sorted
  std::set<std::string> tags{"cpp", "web", "cpp"};
  tags.insert("games");

  // Remove every element that matches (C++20)
  std::erase_if(nums, [](int n) { return n < 4; });

  std::println("{} {} {} {}", xyz, stock.at("pears"), tags, nums);
}
`,
  },
  {
    id: "classes",
    title: "Classes",
    note: "Constructors, access, virtual functions, smart pointers, operators, class templates.",
    keywords:
      "class struct constructor virtual override inheritance public private unique_ptr operator template oop",
    code: `#include <memory>
#include <print>
#include <string>
#include <utility>
#include <vector>

// An abstract base class: an interface with a virtual destructor
class Shape {
 public:
  virtual ~Shape() = default;
  virtual double area() const = 0;  // pure virtual: subclasses must define it
  virtual std::string name() const { return "shape"; }
};

class Circle : public Shape {
 public:
  explicit Circle(double radius) : radius_(radius) {}  // a member initializer list

  double area() const override { return 3.14159 * radius_ * radius_; }
  std::string name() const override { return "circle"; }

  double radius() const { return radius_; }
  void set_radius(double r) {
    if (r > 0) radius_ = r;
  }

 private:
  double radius_;
};

class Rect : public Shape {
 public:
  Rect(double w, double h) : w_(w), h_(h) {}
  double area() const override { return w_ * h_; }

 private:
  double w_;
  double h_;
};

// struct: members are public by default; an aggregate needs no constructor
struct Point {
  double x = 0;
  double y = 0;

  Point operator+(const Point& other) const { return {x + other.x, y + other.y}; }
  bool operator==(const Point&) const = default;  // C++20: the compiler writes it
};

// A class template
template <typename T>
class Stack {
 public:
  Stack() { ++created; }

  void push(T item) { items_.push_back(std::move(item)); }
  T pop() {
    T top = std::move(items_.back());
    items_.pop_back();
    return top;
  }
  bool empty() const { return items_.empty(); }

  static inline int created = 0;  // one per Stack<T> type

 private:
  std::vector<T> items_;
};

int main() {
  // Polymorphism through pointers; unique_ptr deletes each object for you
  std::vector<std::unique_ptr<Shape>> shapes;
  shapes.push_back(std::make_unique<Circle>(1.0));
  shapes.push_back(std::make_unique<Rect>(2.0, 3.0));
  for (const auto& shape : shapes) std::println("{}: {:.2f}", shape->name(), shape->area());

  Circle c{2.0};
  c.set_radius(3.0);
  Point p = Point{1, 2} + Point{3, 4};
  std::println("r={} p=({}, {}) equal={}", c.radius(), p.x, p.y, p == Point{4, 6});

  Stack<std::string> stack;
  stack.push("a");
  stack.push("b");
  std::println("{} empty={} created={}", stack.pop(), stack.empty(), Stack<std::string>::created);
}
`,
  },
  {
    id: "errors",
    title: "Exception handling",
    note: "throw, try/catch by const reference, custom exceptions, std::expected (C++23).",
    keywords:
      "try catch throw exception runtime_error custom expected error handling raii noexcept",
    code: `#include <expected>
#include <print>
#include <stdexcept>
#include <string>
#include <utility>

// A custom exception: derive from a standard one
class ValidationError : public std::runtime_error {
 public:
  ValidationError(std::string field, const std::string& message)
      : std::runtime_error(message), field_(std::move(field)) {}

  const std::string& field() const { return field_; }

 private:
  std::string field_;
};

int parse_age(const std::string& text) {
  std::size_t used = 0;
  int age = std::stoi(text, &used);  // throws std::invalid_argument or std::out_of_range
  if (used != text.size()) throw ValidationError("age", "extra characters in '" + text + "'");
  if (age < 0) throw ValidationError("age", "must not be negative");
  return age;
}

// Errors as values (C++23): the caller must look at the result
std::expected<double, std::string> safe_divide(double a, double b) {
  if (b == 0) return std::unexpected("division by zero");
  return a / b;
}

int main() {
  for (std::string text : {"42", "-1", "abc", "7x"}) {
    try {
      std::println("age: {}", parse_age(text));
    } catch (const ValidationError& e) {  // the most specific type first
      std::println("{}: {}", e.field(), e.what());
    } catch (const std::exception& e) {  // then any standard exception
      std::println("error: {}", e.what());
    }
  }

  // catch (...) catches anything at all (rethrow it with a bare throw;)
  try {
    throw 42;
  } catch (...) {
    std::println("caught something that isn't an exception object");
  }

  // No finally in C++: destructors (RAII) clean up while an exception unwinds.

  if (auto result = safe_divide(1, 0)) {
    std::println("{}", *result);
  } else {
    std::println("failed: {}", result.error());
  }
  std::println("{}", safe_divide(9, 3).value_or(-1));
}
`,
  },
  {
    id: "async",
    title: "Async, threads & coroutines",
    note: "std::async and futures, jthread with a mutex, promise, and a std::generator coroutine.",
    keywords:
      "async future promise thread jthread mutex lock concurrency parallel coroutine co_yield generator",
    code: `#include <chrono>
#include <future>
#include <generator>
#include <mutex>
#include <print>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

using namespace std::chrono_literals;

int slow_square(int n) {
  std::this_thread::sleep_for(100ms);  // stands in for slow work
  return n * n;
}

// A coroutine (C++23 std::generator): co_yield hands out one value at a time
std::generator<int> countdown(int from) {
  for (int i = from; i > 0; --i) co_yield i;
}

int main() {
  // std::async runs a function on another thread; the future holds its result
  std::future<int> a = std::async(std::launch::async, slow_square, 3);
  std::future<int> b = std::async(std::launch::async, slow_square, 4);
  std::println("both started");
  std::println("{} {}", a.get(), b.get());  // get() waits for the result

  // An exception thrown on the other thread comes out of get()
  auto failing = std::async(std::launch::async, []() -> int {
    throw std::runtime_error("the worker failed");
  });
  try {
    failing.get();
  } catch (const std::exception& e) {
    std::println("caught: {}", e.what());
  }

  // Threads sharing data: a mutex lets one in at a time
  int total = 0;
  std::mutex m;
  {
    std::vector<std::jthread> workers;  // a jthread joins when it's destroyed
    for (int i = 1; i <= 4; ++i) {
      workers.emplace_back([&total, &m, i] {
        std::lock_guard lock(m);
        total += i;
      });
    }
  }  // every worker has finished here
  std::println("total = {}", total);

  // promise/future: hand one value from a thread to another
  std::promise<std::string> promise;
  std::future<std::string> message = promise.get_future();
  std::jthread producer([&promise] { promise.set_value("hello from a thread"); });
  std::println("{}", message.get());

  for (int n : countdown(3)) std::println("t-minus {}", n);
}
`,
  },
  {
    id: "header",
    title: "Headers: declaring",
    note: "A header of its own; the next two snippets define and use it.",
    file: "include/geometry.h",
    keywords: "header include pragma once namespace declaration module file",
    code: `#pragma once  // include this file at most once per .cpp file

#include <string>

namespace geometry {

constexpr double pi = 3.14159265358979;

struct Circle {
  double radius = 1;
  double area() const;  // declared here, defined in src/geometry.cpp
};

double distance(double x1, double y1, double x2, double y2);

// Small inline functions and templates are defined in the header itself
inline std::string describe(const Circle& c) { return "circle r=" + std::to_string(c.radius); }

}  // namespace geometry
`,
  },
  {
    id: "source",
    title: "Headers: defining",
    note: "Every .cpp file in the project is compiled and linked.",
    file: "src/geometry.cpp",
    keywords: "source definition cpp file namespace link module",
    code: `#include "geometry.h"

#include <cmath>

namespace geometry {

double Circle::area() const { return pi * radius * radius; }

double distance(double x1, double y1, double x2, double y2) {
  return std::hypot(x2 - x1, y2 - y1);
}

}  // namespace geometry
`,
  },
  {
    id: "include",
    title: "Headers: using",
    note: "Includes the header from the previous two snippets.",
    file: "main.cpp",
    keywords: "include header using namespace main module",
    code: `#include <print>

#include "geometry.h"

int main() {
  geometry::Circle c{2};
  std::println("{} area={:.2f}", geometry::describe(c), c.area());
  std::println("{}", geometry::distance(0, 0, 3, 4));

  using geometry::pi;  // bring one name into scope
  std::println("pi = {}", pi);
}
`,
  },
];
