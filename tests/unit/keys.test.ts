/** Unit tests for `lib/keys.ts`: shortcut guards and menu index arithmetic. */
import { afterEach, describe, expect, it } from "bun:test";
import {
  isAnyPlainKey,
  isOverlayOpen,
  isPlainKey,
  isTypingTarget,
  nextIndex,
  type KeyLike,
} from "@/lib/keys";

/** A keyboard event shape with no modifiers, aimed at `document.body`. */
function key(overrides: Partial<KeyLike> & { key: string }): KeyLike {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: false,
    defaultPrevented: false,
    target: document.body,
    ...overrides,
  };
}

describe("isTypingTarget", () => {
  it("is true for inputs, textareas, selects and contenteditable", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect([input, textarea, select].map(isTypingTarget)).toEqual([true, true, true]);
    // happy-dom does not compute isContentEditable from the attribute, so assert via the property shim.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTypingTarget(editable)).toBe(true);
  });

  it("is false for other elements, non-elements and null", () => {
    expect(isTypingTarget(document.createElement("a"))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("isPlainKey", () => {
  it("matches the exact key with no modifiers", () => {
    expect(isPlainKey(key({ key: "d" }), "d")).toBe(true);
  });

  it("rejects other keys, Shift variants and modifier chords", () => {
    expect(isPlainKey(key({ key: "D" }), "d")).toBe(false);
    expect(isPlainKey(key({ key: "d", metaKey: true }), "d")).toBe(false);
    expect(isPlainKey(key({ key: "d", ctrlKey: true }), "d")).toBe(false);
    expect(isPlainKey(key({ key: "d", altKey: true }), "d")).toBe(false);
  });

  it("accepts auto-repeat only when asked to", () => {
    expect(isPlainKey(key({ key: "j", repeat: true }), "j", { allowRepeat: true })).toBe(true);
  });

  it("rejects auto-repeat, handled events and keys typed into fields", () => {
    expect(isPlainKey(key({ key: "d", repeat: true }), "d")).toBe(false);
    expect(isPlainKey(key({ key: "d", defaultPrevented: true }), "d")).toBe(false);
    const input = document.createElement("input");
    expect(isPlainKey(key({ key: "d", target: input }), "d")).toBe(false);
  });
});

describe("isAnyPlainKey", () => {
  it("matches any of the listed keys under the same rules", () => {
    expect(isAnyPlainKey(key({ key: "h" }), ["ArrowLeft", "h"])).toBe(true);
    expect(isAnyPlainKey(key({ key: "ArrowLeft" }), ["ArrowLeft", "h"])).toBe(true);
    expect(isAnyPlainKey(key({ key: "h", ctrlKey: true }), ["ArrowLeft", "h"])).toBe(false);
    expect(isAnyPlainKey(key({ key: "l" }), ["ArrowLeft", "h"])).toBe(false);
  });
});

describe("isOverlayOpen", () => {
  afterEach(() => {
    document.body.removeAttribute("data-search-open");
    document.body.removeAttribute("data-toc-open");
    document.body.innerHTML = "";
  });

  it("is false on a plain page", () => {
    expect(isOverlayOpen()).toBe(false);
  });

  it("is true while the contents menu is open", () => {
    document.body.setAttribute("data-toc-open", "");
    expect(isOverlayOpen()).toBe(true);
  });

  it("is true while the search palette or an open dialog is showing", () => {
    document.body.setAttribute("data-search-open", "");
    expect(isOverlayOpen()).toBe(true);
    document.body.removeAttribute("data-search-open");
    document.body.innerHTML = "<dialog open></dialog>";
    expect(isOverlayOpen()).toBe(true);
  });
});

describe("nextIndex", () => {
  it("starts at the first row going down and the last row going up", () => {
    expect(nextIndex(null, 1, 3)).toBe(0);
    expect(nextIndex(null, -1, 3)).toBe(2);
  });

  it("moves by one and wraps at both ends", () => {
    expect(nextIndex(0, 1, 3)).toBe(1);
    expect(nextIndex(2, 1, 3)).toBe(0);
    expect(nextIndex(0, -1, 3)).toBe(2);
  });

  it("returns null for an empty list and clamps a stale index", () => {
    expect(nextIndex(null, 1, 0)).toBeNull();
    expect(nextIndex(9, 1, 3)).toBe(0);
  });
});
