/** @file GDScript snippets (see `./index.ts`). Code is indented with tabs, like Godot's editor. */

import type { Snippet } from "./index";

export const SNIPPETS: readonly Snippet[] = [
  {
    id: "hello",
    title: "Hello world",
    note: "The script extends Node, so Godot calls _ready() when it enters the scene tree.",
    keywords: "print ready extends node boilerplate starter",
    code: `extends Node


func _ready() -> void:
	print("Hello, world!")

	var who := "playground"
	print("Hello, %s! 2 + 2 = %d" % [who, 2 + 2])  # % formats like printf
	print("Hello, ", who, "!")  # print() joins its arguments
	print("Hello, {0}!".format([who]))
`,
  },
  {
    id: "variables",
    title: "Variables & types",
    note: "Typed and inferred variables, constants, enums, engine types, Variant.",
    keywords:
      "var const enum type hint inferred := int float string vector2 color array dictionary variant",
    code: `extends Node

const MAX_HEALTH := 100  # a constant
enum State { IDLE, RUNNING, JUMPING }  # named integer constants

var health: int = MAX_HEALTH  # a typed member variable
var speed := 4.5  # := infers the type (float) and keeps it
var state := State.IDLE
var anything = "no type: can hold any Variant"


func _ready() -> void:
	var title: String = "Playground"
	var done := false
	var spot := Vector2(3, 4)  # engine types are values too
	var tint := Color.CORNFLOWER_BLUE
	var items: Array[String] = ["sword", "shield"]  # a typed array
	var stats := {"hp": 10, "mp": 5}  # a Dictionary
	var nothing = null

	health -= 25
	anything = 42
	print(title, " ", done, " ", health, " ", speed, " ", State.keys()[state])
	print(spot.length(), " ", tint, " ", items, " ", stats["hp"], " ", nothing)
	print(typeof(anything) == TYPE_INT, " ", int("42") + 1, " ", str(3.5), " ", float("2.5"))
`,
  },
  {
    id: "functions",
    title: "Functions",
    note: "Typed parameters, defaults, static functions, functions as Callables.",
    keywords: "func return parameters default static callable void",
    code: `extends Node


# Typed parameters and return value
func add(a: int, b: int) -> int:
	return a + b


# Default arguments
func greet(who: String = "world", punctuation: String = "!") -> String:
	return "Hello, %s%s" % [who, punctuation]


# No return value
func say_twice(message: String) -> void:
	for _i in 2:
		print(message)


# Several results: return a Dictionary (or an Array)
func min_max(values: Array[int]) -> Dictionary:
	return {"min": values.min(), "max": values.max()}


# A static function needs no instance
static func clamp_health(value: int) -> int:
	return clampi(value, 0, 100)


func _ready() -> void:
	print(add(2, 3))
	print(greet(), " ", greet("Ada", "?"))
	say_twice("hi")
	var result := min_max([3, 9, 1])
	print(result["min"], " ", result["max"])
	print(clamp_health(150))

	# A function is a value too: a Callable
	var op: Callable = add
	print(op.call(4, 5))
`,
  },
  {
    id: "arrow",
    title: "Lambdas",
    note: "GDScript's arrow functions: inline func values, with array helpers, bind() and signals.",
    keywords:
      "lambda arrow anonymous closure callable func map filter reduce sort_custom bind signal connect",
    code: `extends Node

signal scored(points: int)


func _ready() -> void:
	# A lambda is an inline func, stored in a Callable
	var square := func(x: int) -> int: return x * x
	print(square.call(4))

	# A lambda can span several lines
	var clamp_to_ten := func(value: int) -> int:
		if value > 10:
			return 10
		return value
	print(clamp_to_ten.call(12))

	# Array helpers take lambdas
	var nums := [5, 3, 8, 1]
	print(nums.map(func(n): return n * 2))
	print(nums.filter(func(n): return n % 2 == 0))
	print(nums.reduce(func(total, n): return total + n, 0))
	nums.sort_custom(func(a, b): return a > b)  # descending
	print(nums)

	# Lambdas capture local variables (their values when the lambda is made)
	var offset := 10
	var shift := func(x: int) -> int: return x + offset
	print(shift.call(5))

	# bind() adds arguments after the ones given to call()
	var add_five := add.bind(5)
	print(add_five.call(1))

	# Connect a lambda to a signal
	scored.connect(func(points: int): print("scored ", points))
	scored.emit(3)


func add(a: int, b: int) -> int:
	return a + b
`,
  },
  {
    id: "control",
    title: "Conditionals & loops",
    note: "if/elif/else, conditional expressions, match with patterns, for, while.",
    keywords: "if elif else match pattern for while range break continue loop",
    code: `extends Node

enum Direction { NORTH, EAST, SOUTH, WEST }


func _ready() -> void:
	var score := 72

	if score >= 90:
		print("A")
	elif score >= 70:
		print("B")
	else:
		print("C")

	print("pass" if score >= 50 else "fail")  # a conditional expression

	# match: GDScript's switch, with patterns
	var dir := Direction.EAST
	match dir:
		Direction.NORTH, Direction.SOUTH:
			print("vertical")
		Direction.EAST, Direction.WEST:
			print("horizontal")

	var value: Variant = [1, 2]
	match value:
		[]:
			print("an empty array")
		[var first, ..]:
			print("an array starting with ", first)
		{"name": var who}:
			print("named ", who)
		_:
			print("something else")

	for i in 3:  # 0, 1, 2
		print("i = ", i)
	for i in range(10, 0, -4):  # 10, 6, 2
		print(i)
	for item in ["apple", "pear"]:
		print(item)
	for key in {"a": 1, "b": 2}:
		print(key)

	var n := 10
	while n > 0:
		n -= 3
		if n == 4:
			continue
		if n < 2:
			break
		print("n = ", n)
`,
  },
  {
    id: "collections",
    title: "Arrays & dictionaries",
    note: "Array, typed arrays, Dictionary, packed arrays, and copying.",
    keywords: "array dictionary typed packed append sort slice erase keys has duplicate",
    code: `extends Node


func _ready() -> void:
	# Array: ordered; Array[int] only takes ints
	var nums: Array[int] = [5, 3, 8, 1]
	nums.append(10)
	nums.sort()
	print(nums, " size=", nums.size(), " first=", nums[0], " last=", nums[-1])
	print(nums.has(8), " ", nums.find(3), " ", nums.slice(1, 3))
	nums.erase(8)  # remove by value
	nums.remove_at(0)  # remove by index
	print(nums)

	# Dictionary: key -> value, in insertion order
	var ages := {"Ada": 36, "Grace": 85}
	ages["Linus"] = 28
	print(ages.get("Alan", "unknown"), " ", ages.keys(), " ", ages.has("Grace"))
	for who in ages:
		print(who, ": ", ages[who])
	ages.erase("Ada")

	# A typed dictionary (Godot 4.4+)
	var stock: Dictionary[String, int] = {"apples": 3}
	stock["pears"] = 2

	# Packed arrays store one type compactly
	var bytes := PackedByteArray([1, 2, 3])
	var names := PackedStringArray(["a", "b"])

	# Arrays and dictionaries are shared by reference: duplicate() before changing a copy
	var copy := nums.duplicate()
	copy.append(99)
	print(nums, " ", copy, " ", stock, " ", bytes.size(), " ", ", ".join(names))
`,
  },
  {
    id: "classes",
    title: "Classes",
    note: "Every script is a class; inner classes, _init, inheritance with super, properties.",
    keywords:
      "class extends inner class init constructor super inheritance setter getter property static oop",
    code: `extends Node


# An inner class. A whole .gd file is a class too: load one with preload("res://path.gd").
class Animal:
	static var count := 0
	var name: String
	var _sound: String  # a leading underscore means "private" by convention

	func _init(p_name: String, p_sound: String) -> void:  # the constructor
		name = p_name
		_sound = p_sound
		Animal.count += 1

	func speak() -> String:
		return "%s says %s" % [name, _sound]

	func _to_string() -> String:  # what print() shows
		return "Animal(%s)" % name


class Dog extends Animal:
	func _init(p_name: String) -> void:
		super(p_name, "woof")  # the parent's constructor

	func speak() -> String:
		return super.speak() + "!"  # the parent's version of this method

	func fetch(item := "ball") -> String:
		return "%s fetches the %s" % [name, item]


# Properties with a setter and a getter
class Player:
	var health := 100:
		set(value):
			health = clampi(value, 0, 100)

	var is_alive: bool:
		get:
			return health > 0


func _ready() -> void:
	var rex := Dog.new("Rex")
	print(rex.speak())
	print(rex.fetch())
	print(rex, " ", rex is Animal, " ", Animal.count)

	var player := Player.new()
	player.health -= 150
	print(player.health, " alive: ", player.is_alive)
`,
  },
  {
    id: "errors",
    title: "Error handling",
    note: "GDScript has no try/catch: return Error codes or results, check them, assert on bugs.",
    keywords:
      "exception try catch error ok err push_error push_warning assert null is_instance_valid json",
    code: `extends Node

# No exceptions in GDScript: functions report failure in what they return,
# push_error()/push_warning() log a problem, and assert() stops a debug build on a bug.


func parse_age(text: String) -> int:
	if not text.is_valid_int():
		push_warning("not a number: %s" % text)
		return -1
	return text.to_int()


# Return an Error (OK, ERR_INVALID_PARAMETER, ...): the engine's own convention
func save_score(score: int) -> Error:
	if score < 0:
		return ERR_INVALID_PARAMETER
	var file := FileAccess.open("user://score.txt", FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_line(str(score))
	return OK


# Or return a Dictionary holding either a value or an error message
func parse_json(text: String) -> Dictionary:
	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		return {"error": "%s at line %d" % [json.get_error_message(), json.get_error_line()]}
	return {"value": json.data}


func _ready() -> void:
	for text in ["42", "abc"]:
		var age := parse_age(text)
		print("age: ", str(age) if age >= 0 else "invalid")

	var result := save_score(-5)
	if result != OK:
		print("save failed: ", error_string(result))
	print("save 10: ", error_string(save_score(10)))

	var parsed := parse_json("{ nope")
	if parsed.has("error"):
		print("bad JSON: ", parsed["error"])
	print(parse_json('{"hp": 3}')["value"])

	var lives := 3
	assert(lives > 0, "lives must be positive")  # checked in debug builds only

	# A freed object leaves a dangling reference: check before using it
	var node := Node.new()
	node.free()
	print("still valid: ", is_instance_valid(node))
`,
  },
  {
    id: "async",
    title: "Coroutines & await",
    note: "await a timer, a frame, a signal or another coroutine without blocking the game.",
    keywords: "async await coroutine signal timer process_frame call_deferred yield",
    code: `extends Node

signal loaded(data: String)


# A coroutine: a function that uses await
func fetch_data() -> String:
	await get_tree().create_timer(0.2).timeout  # wait 0.2 s; the game keeps running
	return "level data"


func count_down(from: int) -> void:
	for i in range(from, 0, -1):
		print("t-minus ", i)
		await get_tree().process_frame  # wait one frame


func emit_loaded() -> void:
	loaded.emit("hello")


func _ready() -> void:
	print("start")
	var data: String = await fetch_data()  # await a coroutine's result
	print("got ", data)

	await count_down(3)

	# Await a signal (emitted at the end of this frame)
	emit_loaded.call_deferred()
	var payload: String = await loaded
	print("the signal said ", payload)

	# Without await, a coroutine runs on its own and this function carries on
	count_down(2)
	print("didn't wait")
`,
  },
  {
    id: "module",
    title: "Scripts: a helper script",
    note: "A file of its own; main.gd preloads it (next snippet). class_name globals don't resolve here.",
    file: "lib/math_utils.gd",
    keywords: "module preload load script file static const class_name",
    code: `extends RefCounted

const GREETING := "Hello"


static func greet(who: String) -> String:
	return "%s, %s!" % [GREETING, who]


static func sum(values: Array) -> float:
	var total := 0.0
	for v in values:
		total += v
	return total
`,
  },
  {
    id: "preload",
    title: "Scripts: preloading",
    note: "Uses lib/math_utils.gd from the previous snippet.",
    file: "main.gd",
    keywords: "module import preload load script const",
    code: `extends Node

# preload loads the script when this one compiles; the constant is the class
const MathUtils := preload("res://lib/math_utils.gd")


func _ready() -> void:
	print(MathUtils.greet("Godot"))
	print(MathUtils.sum([1, 2, 3.5]))
	print(MathUtils.GREETING)

	# A script that extends RefCounted can be instanced too
	var helper := MathUtils.new()
	print(helper is RefCounted)
`,
  },
];
