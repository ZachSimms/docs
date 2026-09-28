/** @file GDScript outlines (see `./index.ts`). Code is indented with tabs, like Godot's editor. */

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
`,
  },
  {
    id: "variables",
    title: "Variables",
    keywords: "var const enum type hint inferred",
    code: `const CONSTANT_NAME := 100
enum State { IDLE, RUNNING }

var variable_name: int = 0
var inferred := "value"
`,
  },
  {
    id: "functions",
    title: "Function",
    keywords: "func function return parameters",
    code: `func function_name(param: int) -> void:
	pass
`,
  },
  {
    id: "arrow",
    title: "Lambda",
    note: "GDScript's arrow function: an inline func stored in a Callable.",
    keywords: "lambda arrow anonymous callable func",
    code: `var function_name := func(param):
	pass

function_name.call(value)
`,
  },
  {
    id: "if",
    title: "if / elif / else",
    keywords: "if elif else conditional branch",
    code: `if condition:
	pass
elif other_condition:
	pass
else:
	pass
`,
  },
  {
    id: "match",
    title: "match",
    keywords: "match pattern switch case",
    code: `match value:
	1:
		pass
	"text":
		pass
	_:
		pass
`,
  },
  {
    id: "loops",
    title: "Loops",
    keywords: "for while range loop break continue",
    code: `for item in items:
	pass

for i in range(count):
	pass

while condition:
	pass
`,
  },
  {
    id: "collections",
    title: "Array & Dictionary",
    keywords: "array dictionary typed collection",
    code: `var items: Array[String] = []
var lookup: Dictionary[String, int] = {}
`,
  },
  {
    id: "classes",
    title: "Inner class",
    note: "Every .gd file is a class too; preload one to use it.",
    keywords: "class inner init constructor method oop",
    code: `class ClassName:
	var field: int

	func _init(p_field: int) -> void:
		field = p_field

	func method_name() -> void:
		pass
`,
  },
  {
    id: "extends",
    title: "Subclass",
    keywords: "extends inheritance super override",
    code: `class ChildClass extends ParentClass:
	func _init() -> void:
		super()

	func method_name() -> void:
		super.method_name()
`,
  },
  {
    id: "signal",
    title: "Signal",
    keywords: "signal emit connect event",
    code: `signal signal_name(value: int)


func _ready() -> void:
	signal_name.connect(_on_signal_name)
	signal_name.emit(0)


func _on_signal_name(value: int) -> void:
	pass
`,
  },
  {
    id: "errors",
    title: "Error check",
    note: "GDScript has no try/catch: check the Error a call returns.",
    keywords: "exception try catch error ok err handling push_error",
    code: `var err := function_that_can_fail()
if err != OK:
	push_error("failed: %s" % error_string(err))
	return
`,
  },
  {
    id: "async",
    title: "Coroutine (await)",
    keywords: "async await coroutine signal timer",
    code: `func function_name() -> void:
	await get_tree().create_timer(1.0).timeout
	# ...
`,
  },
  {
    id: "preload",
    title: "Preload a script",
    note: "class_name globals don't resolve in the playground: preload the file.",
    keywords: "module import preload load script const",
    code: `const ScriptName := preload("res://path/to/script.gd")
`,
  },
];
