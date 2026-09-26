/** Unit tests for `lib/theme.ts`, including the inline bootstrap script. */
import { describe, expect, it } from "bun:test";
import { STORAGE_KEY, THEME_INIT_SCRIPT, isTheme, nextTheme, resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("uses the stored choice when valid", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("falls back to the system preference when nothing valid is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(undefined, false)).toBe("light");
    expect(resolveTheme("blue", true)).toBe("dark");
  });
});

describe("nextTheme / isTheme", () => {
  it("flips between light and dark", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("recognizes only the two themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("applies a stored theme to <html> before paint", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    document.documentElement.removeAttribute("data-theme");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    localStorage.removeItem(STORAGE_KEY);
  });

  it("leaves <html> untouched when nothing is stored", () => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("data-theme");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
