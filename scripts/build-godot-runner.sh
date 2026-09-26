#!/usr/bin/env bash
# Rebuild the playground's GDScript runner (public/playground/godot/) from playground/godot-runner/.
#
# Needs Godot 4.7 (`brew install --cask godot`) and its single-threaded web export templates
# (web_nothreads_debug.zip / web_nothreads_release.zip) in
# ~/Library/Application Support/Godot/export_templates/<version>/ (Editor > Manage Export Templates).
# The debug template is used: its script errors carry file and line numbers.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
project="$root/playground/godot-runner"
out="$root/public/playground/godot"
godot="${GODOT:-godot}"

mkdir -p "$out"
rm -f "$out"/index.*
"$godot" --headless --path "$project" --import
"$godot" --headless --path "$project" --export-debug "Web" "$out/index.html"
# Only what the runner frame loads is kept.
rm -f "$out"/*.png "$out"/*.ico "$out"/*.service.worker.js "$out"/*.manifest.json
ls -la "$out"
