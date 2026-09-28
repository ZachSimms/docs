/** @file Rust snippets (see `./index.ts`). */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    note: "println! formats with {}; stdin reads the stdin box.",
    keywords: "main print println format stdin boilerplate starter",
    code: `use std::io;

fn main() {
    println!("Hello, world!");

    let name = "playground";
    println!("Hello, {name}! 2 + 2 = {}", 2 + 2);

    // Read a line from the stdin box
    let mut line = String::new();
    io::stdin().read_line(&mut line).expect("couldn't read stdin");
    println!("You typed: {}", line.trim());
}
`,
  },
  {
    id: "variables",
    title: "Variables & types",
    note: "Immutable by default, mut, shadowing, tuples, arrays, Option, as conversions.",
    keywords: "let mut const shadowing integer float string str char tuple array option types",
    code: `fn main() {
    let count = 5; // immutable by default; the type (i32) is inferred
    let mut total: i64 = 0; // mut: can change
    total += count as i64; // an explicit conversion

    let ratio: f64 = 0.75;
    let done = false;
    let letter = 'A'; // a char is one Unicode scalar value
    let title = "Playground"; // &str: a borrowed string slice
    let owned = String::from("owned"); // String: owned and growable
    let big: u128 = 2u128.pow(100);
    let million = 1_000_000;

    // Shadowing: a new variable with the same name (it may change type)
    let spaces = "   ";
    let spaces = spaces.len();

    // Tuples and arrays
    let point: (i32, f64) = (1, 2.5);
    let (x, y) = point;
    let primes: [u32; 4] = [2, 3, 5, 7];

    // No null: Option says "maybe a value"
    let nickname: Option<&str> = None;

    const MAX_USERS: u32 = 100; // a constant needs its type

    println!("{count} {total} {ratio} {done} {letter} {title} {owned} {big} {million}");
    println!("{spaces} {x} {y} {primes:?} {} {MAX_USERS}", nickname.unwrap_or("none"));
    println!("{:?} {:?}", "42".parse::<i32>(), "x".parse::<i32>().is_err());
}
`,
  },
  {
    id: "functions",
    title: "Functions",
    note: "Implicit return, borrowing with & and &mut, Option returns, generics, impl Fn.",
    keywords: "fn return parameters borrow reference mut generic trait bound impl option",
    code: `// The last expression (no semicolon) is the return value
fn add(a: i32, b: i32) -> i32 {
    a + b
}

// return leaves early
fn describe(n: i32) -> &'static str {
    if n < 0 {
        return "negative";
    }
    if n == 0 { "zero" } else { "positive" }
}

// Borrow with & to read without taking ownership...
fn total(values: &[f64]) -> f64 {
    values.iter().sum()
}

// ...and with &mut to change the caller's value
fn double_all(values: &mut [f64]) {
    for v in values.iter_mut() {
        *v *= 2.0;
    }
}

// Several results: a tuple; "maybe no result": Option (? returns None early)
fn min_max(values: &[i32]) -> Option<(i32, i32)> {
    let min = *values.iter().min()?;
    let max = *values.iter().max()?;
    Some((min, max))
}

// A generic function with trait bounds
fn largest<T: PartialOrd + Copy>(items: &[T]) -> T {
    let mut best = items[0];
    for &item in items {
        if item > best {
            best = item;
        }
    }
    best
}

// Taking a function (or closure) as an argument
fn apply(f: impl Fn(i32) -> i32, value: i32) -> i32 {
    f(value)
}

fn main() {
    let mut values = vec![1.5, 2.5];
    double_all(&mut values);
    println!("{} {} {}", add(2, 3), describe(-4), total(&values));
    println!("{:?} {:?}", min_max(&[3, 9, 1]), min_max(&[]));
    println!("{} {}", largest(&[3, 7, 2]), largest(&['x', 'b']));
    println!("{}", apply(|n| n * 10, 4));
}
`,
  },
  {
    id: "arrow",
    title: "Closures",
    note: "Rust's arrow functions: |args| expr, captures, move, iterator adapters, returning closures.",
    keywords: "closure lambda arrow anonymous move fn fnmut iterator map filter fold sort",
    code: `// Return a closure; move makes it own what it captures
fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n
}

// FnMut: a closure that changes its captured state
fn make_counter() -> impl FnMut() -> u32 {
    let mut count = 0;
    move || {
        count += 1;
        count
    }
}

fn main() {
    // |parameters| expression
    let square = |x: i32| x * x;
    let add = |a: i32, b: i32| -> i32 { a + b };

    // Closures capture variables from around them
    let offset = 10;
    let shift = |x: i32| x + offset;

    // Iterator adapters take closures
    let nums = vec![5, 3, 8, 1];
    let doubled: Vec<i32> = nums.iter().map(|n| n * 2).collect();
    let evens: Vec<&i32> = nums.iter().filter(|n| *n % 2 == 0).collect();
    let sum = nums.iter().fold(0, |acc, n| acc + n);

    let mut sorted = nums.clone();
    sorted.sort_by(|a, b| b.cmp(a)); // descending
    let mut words = vec!["banana", "Apple", "cherry"];
    words.sort_by_key(|w| w.to_lowercase());

    let add_five = make_adder(5);
    let mut next = make_counter();
    next();

    println!("{} {} {}", square(4), add(2, 3), shift(5));
    println!("{doubled:?} {evens:?} {sum} {sorted:?} {words:?}");
    println!("{} {}", add_five(1), next());
}
`,
  },
  {
    id: "control",
    title: "Conditionals, match & loops",
    note: "if as an expression, match on enums and ranges, if let, let else, for, while, loop.",
    keywords: "if else match enum pattern if let let else for while loop break continue range",
    code: `enum Command {
    Go(String),
    Look,
    Wait { turns: u32 },
}

fn main() {
    let score = 72;

    // if is an expression: it has a value
    let grade = if score >= 90 {
        "A"
    } else if score >= 70 {
        "B"
    } else {
        "C"
    };
    println!("grade {grade}");

    // match must cover every case
    let commands = [Command::Go("north".into()), Command::Look, Command::Wait { turns: 3 }];
    for command in &commands {
        let text = match command {
            Command::Go(direction) => format!("going {direction}"),
            Command::Look => "looking around".to_string(),
            Command::Wait { turns } if *turns > 1 => format!("waiting {turns} turns"),
            Command::Wait { .. } => "waiting".to_string(),
        };
        println!("{text}");
    }

    match score {
        0..=49 => println!("fail"),
        50 | 60 => println!("borderline"),
        _ => println!("pass"),
    }

    // if let and let else: match a single pattern
    let maybe: Option<i32> = Some(7);
    if let Some(n) = maybe {
        println!("got {n}");
    }
    let Some(start) = maybe else {
        return;
    };

    for i in 0..3 {
        println!("i = {i}");
    }
    for (index, fruit) in ["apple", "pear"].iter().enumerate() {
        println!("{index} {fruit}");
    }

    let mut count = start;
    while count > 0 {
        count -= 3;
    }

    // loop runs until break, which can hand back a value
    let mut tries = 0;
    let found = loop {
        tries += 1;
        if tries * tries > 50 {
            break tries;
        }
    };
    println!("count {count}, found {found}");
}
`,
  },
  {
    id: "collections",
    title: "Vec, HashMap & HashSet",
    note: "The standard collections, slices, the entry API, collect.",
    keywords: "vec vector hashmap btreemap hashset slice entry collect iterator push sort",
    code: `use std::collections::{BTreeMap, HashMap, HashSet};

fn main() {
    // Vec: a growable array
    let mut nums = vec![5, 3, 8, 1];
    nums.push(10);
    nums.sort();
    println!("{nums:?} len={} first={:?} has 8: {}", nums.len(), nums.first(), nums.contains(&8));
    println!("{:?} {:?}", &nums[1..3], nums.get(99)); // a slice; get returns an Option
    nums.retain(|&n| n > 2);

    // HashMap: key -> value
    let mut ages: HashMap<String, u32> = HashMap::new();
    ages.insert("Ada".to_string(), 36);
    ages.insert("Grace".to_string(), 85);
    *ages.entry("Linus".to_string()).or_insert(0) += 28;
    if let Some(age) = ages.get("Grace") {
        println!("Grace is {age}");
    }

    // Count words with the entry API (BTreeMap keeps keys sorted)
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for word in "the cat and the hat".split_whitespace() {
        *counts.entry(word).or_default() += 1;
    }

    // HashSet: unique values
    let tags: HashSet<&str> = ["rust", "web", "rust"].into_iter().collect();

    // collect turns an iterator into any collection
    let squares: Vec<u32> = (1..=5).map(|n| n * n).collect();

    println!("{nums:?} {} {counts:?} {} {squares:?}", ages.len(), tags.len());
}
`,
  },
  {
    id: "classes",
    title: "Structs, impl & traits",
    note: "Rust's classes: data in structs, methods in impl blocks, shared behavior in traits.",
    keywords:
      "class struct impl trait method self new constructor derive display dyn box generic oop interface",
    code: `use std::fmt;

// A trait: behavior that types can share (like an interface)
trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> String {
        "shape".to_string() // a default method
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Circle {
    radius: f64,
}

impl Circle {
    // An associated function (no self): a constructor, by convention called new
    fn new(radius: f64) -> Self {
        Self { radius }
    }

    // &mut self: a method that changes the value
    fn grow(&mut self, by: f64) {
        self.radius += by;
    }
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }

    fn name(&self) -> String {
        "circle".to_string()
    }
}

struct Rect {
    width: f64,
    height: f64,
}

impl Shape for Rect {
    fn area(&self) -> f64 {
        self.width * self.height
    }
}

// Display: what {} prints
impl fmt::Display for Circle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Circle(r={})", self.radius)
    }
}

// A generic struct
struct Stack<T> {
    items: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self {
        Self { items: Vec::new() }
    }

    fn push(&mut self, item: T) {
        self.items.push(item);
    }

    fn pop(&mut self) -> Option<T> {
        self.items.pop()
    }
}

fn main() {
    let mut c = Circle::new(1.0);
    c.grow(1.0);
    println!("{c} {c:?} area={:.2} same={}", c.area(), c == Circle::new(2.0));

    // Trait objects: different types behind one interface
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(c.clone()),
        Box::new(Rect { width: 2.0, height: 3.0 }),
    ];
    for shape in &shapes {
        println!("{}: {:.2}", shape.name(), shape.area());
    }

    let mut stack = Stack::new();
    stack.push("a");
    stack.push("b");
    println!("{:?}", stack.pop());
}
`,
  },
  {
    id: "errors",
    title: "Error handling",
    note: "Rust has no exceptions: Result, the ? operator, custom error types, panics for bugs.",
    keywords:
      "exception try catch result option error ? question mark unwrap expect panic custom from",
    code: `use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

// A custom error type
#[derive(Debug)]
enum AgeError {
    NotANumber(ParseIntError),
    Negative(i64),
}

impl fmt::Display for AgeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AgeError::NotANumber(e) => write!(f, "not a number ({e})"),
            AgeError::Negative(n) => write!(f, "{n} is negative"),
        }
    }
}

impl Error for AgeError {}

// From lets ? convert a ParseIntError into an AgeError
impl From<ParseIntError> for AgeError {
    fn from(error: ParseIntError) -> Self {
        AgeError::NotANumber(error)
    }
}

// Result<T, E> is either Ok(T) or Err(E)
fn parse_age(text: &str) -> Result<u32, AgeError> {
    let n: i64 = text.trim().parse()?; // ? returns the error to the caller
    if n < 0 {
        return Err(AgeError::Negative(n));
    }
    Ok(n as u32)
}

// Box<dyn Error> holds any error type
fn run() -> Result<(), Box<dyn Error>> {
    let age = parse_age("42")?;
    println!("age: {age}");
    let bad = parse_age("abc")?; // returns early from run()
    println!("never printed: {bad}");
    Ok(())
}

fn main() {
    for text in ["42", "-1", "abc"] {
        match parse_age(text) {
            Ok(age) => println!("age: {age}"),
            Err(error) => println!("error: {error}"),
        }
    }

    if let Err(error) = run() {
        println!("run failed: {error}");
    }

    // Handy methods on Result (and Option)
    let fallback = parse_age("x").unwrap_or(0);
    let doubled = parse_age("21").map(|n| n * 2);
    println!("{fallback} {doubled:?}");

    // panic! (and unwrap/expect on an Err) stops the program: keep it for bugs,
    // for example: let n: u32 = "x".parse().expect("the config holds a number");
}
`,
  },
  {
    id: "async",
    title: "Async, threads & channels",
    note: "async/await on a tiny std-only executor (no tokio here), threads, Arc<Mutex>, channels.",
    keywords:
      "async await future executor block_on thread spawn join arc mutex channel mpsc concurrency parallel",
    code: `use std::future::Future;
use std::pin::pin;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Wake, Waker};
use std::thread;
use std::time::Duration;

// Rust has async/await but ships no runtime (and tokio isn't available here),
// so block_on drives one future to completion on the current thread.
struct ThreadWaker(thread::Thread);

impl Wake for ThreadWaker {
    fn wake(self: Arc<Self>) {
        self.0.unpark();
    }
}

fn block_on<F: Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let waker = Waker::from(Arc::new(ThreadWaker(thread::current())));
    let mut cx = Context::from_waker(&waker);
    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => return value,
            Poll::Pending => thread::park(),
        }
    }
}

async fn fetch(id: u32) -> String {
    format!("user{id}")
}

async fn fetch_both() -> (String, String) {
    let a = fetch(1).await; // .await waits for another future
    let b = fetch(2).await;
    (a, b)
}

fn main() {
    println!("{:?}", block_on(fetch_both()));

    // Threads: real parallelism; join() waits and returns the result
    let handles: Vec<_> = (1..=3u64)
        .map(|n| {
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(50 * n));
                n * n
            })
        })
        .collect();
    let squares: Vec<u64> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    println!("squares {squares:?}");

    // Shared state: Arc (shared ownership) + Mutex (one thread at a time)
    let total = Arc::new(Mutex::new(0));
    let workers: Vec<_> = (1..=4)
        .map(|i| {
            let total = Arc::clone(&total);
            thread::spawn(move || *total.lock().unwrap() += i)
        })
        .collect();
    for worker in workers {
        worker.join().unwrap();
    }
    println!("total {}", total.lock().unwrap());

    // Channels: send values from one thread to another
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        for word in ["hello", "from", "a", "thread"] {
            tx.send(word).unwrap();
        }
    });
    let words: Vec<&str> = rx.iter().collect(); // ends when the sender is dropped
    println!("{}", words.join(" "));
}
`,
  },
  {
    id: "module",
    title: "Modules: a module file",
    note: "Loaded by mod geometry; in src/main.rs (next snippet). pub makes items visible outside.",
    file: "src/geometry.rs",
    keywords: "mod module pub use file crate visibility",
    code: `pub const PI: f64 = std::f64::consts::PI;

pub struct Circle {
    pub radius: f64,
}

impl Circle {
    pub fn area(&self) -> f64 {
        PI * square(self.radius)
    }
}

pub fn distance(a: (f64, f64), b: (f64, f64)) -> f64 {
    (square(b.0 - a.0) + square(b.1 - a.1)).sqrt()
}

// Private (no pub): only this module can call it
fn square(x: f64) -> f64 {
    x * x
}

// A module inside a module
pub mod units {
    pub fn to_degrees(radians: f64) -> f64 {
        radians.to_degrees()
    }
}
`,
  },
  {
    id: "use",
    title: "Modules: using",
    note: "Declares the module from the previous snippet and brings its items into scope.",
    file: "src/main.rs",
    keywords: "mod module use import path crate",
    code: `mod geometry; // loads src/geometry.rs

use geometry::units::to_degrees;
use geometry::{Circle, distance};

fn main() {
    let c = Circle { radius: 2.0 };
    println!("{:.2} {} {}", c.area(), distance((0.0, 0.0), (3.0, 4.0)), geometry::PI);
    println!("{}", to_degrees(geometry::PI));
}
`,
  },
];
