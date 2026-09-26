## Runs playground projects inside the Godot web build.
##
## The HTML shell (shell.html) calls window.godotRun(filesJson, entry). The
## project is written to user://project/ (in memory: the runner is sandboxed,
## so it has no persistent storage), every "res://" in the scripts is pointed
## at that folder, and the entry script is loaded fresh and added to the tree
## so its _ready() runs. print() and errors reach the page through the shell.
extends Node

const ROOT := "user://project"
## Frames to wait after adding the entry before reporting "done" (lets
## call_deferred and the first _process run).
const SETTLE_FRAMES := 2

var _run_callback: JavaScriptObject
var _current: Node


func _ready() -> void:
	if not OS.has_feature("web"):
		print("The playground runner only works in the web export.")
		return
	_run_callback = JavaScriptBridge.create_callback(_on_run)
	var window := JavaScriptBridge.get_interface("window")
	window.godotRun = _run_callback
	window.godotReady()


func _on_run(args: Array) -> void:
	var files = JSON.parse_string(str(args[0]))
	var entry := str(args[1])
	if typeof(files) != TYPE_DICTIONARY:
		printerr("Runner: the project couldn't be read.")
		_done(1)
		return
	_reset()
	for path in files:
		_write(str(path), str(files[path]))
	var script = ResourceLoader.load(ROOT.path_join(entry), "", ResourceLoader.CACHE_MODE_IGNORE_DEEP)
	if script == null or not (script is Script) or not script.can_instantiate():
		printerr("Runner: %s didn't compile (see the errors above)." % entry)
		_done(1)
		return
	var instance = script.new()
	if instance is Node:
		_current = instance
		add_child(instance)
	elif instance != null and instance.has_method("main"):
		instance.main()
	for i in SETTLE_FRAMES:
		await get_tree().process_frame
	_done(0)


func _write(path: String, text: String) -> void:
	var full := ROOT.path_join(path)
	DirAccess.make_dir_recursive_absolute(full.get_base_dir())
	if path.get_extension() in ["gd", "tscn", "tres"]:
		text = text.replace("res://", ROOT + "/")
	var file := FileAccess.open(full, FileAccess.WRITE)
	if file == null:
		printerr("Runner: couldn't write %s." % path)
		return
	file.store_string(text)


func _reset() -> void:
	if is_instance_valid(_current):
		_current.queue_free()
	_current = null
	_remove_tree(ROOT)


func _remove_tree(dir_path: String) -> void:
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return
	for name in dir.get_directories():
		_remove_tree(dir_path.path_join(name))
	for name in dir.get_files():
		dir.remove(name)
	DirAccess.remove_absolute(dir_path)


func _done(code: int) -> void:
	JavaScriptBridge.eval("window.godotDone && window.godotDone(%d)" % code)
