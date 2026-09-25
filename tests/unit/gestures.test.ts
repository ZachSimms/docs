/** Unit tests for `lib/gestures.ts`: edge zones, taps and double taps. */
import { describe, expect, it } from "bun:test";
import { isDoubleTap, isTap, tapZone, type Tap } from "@/lib/gestures";

describe("tapZone", () => {
  it("is left or right in the outer quarters and null in the middle half", () => {
    expect(tapZone(0, 400)).toBe("left");
    expect(tapZone(99, 400)).toBe("left");
    expect(tapZone(100, 400)).toBeNull();
    expect(tapZone(200, 400)).toBeNull();
    expect(tapZone(300, 400)).toBeNull();
    expect(tapZone(301, 400)).toBe("right");
    expect(tapZone(400, 400)).toBe("right");
  });
});

describe("isTap", () => {
  const down = { x: 10, y: 10, t: 0 };
  it("accepts a short, still touch", () => {
    expect(isTap(down, { x: 15, y: 14, t: 120 })).toBe(true);
  });
  it("rejects a drag (scroll) and a long press", () => {
    expect(isTap(down, { x: 10, y: 30, t: 100 })).toBe(false);
    expect(isTap(down, { x: 10, y: 10, t: 450 })).toBe(false);
  });
});

describe("isDoubleTap", () => {
  const first: Tap = { zone: "left", x: 20, y: 300, t: 1000 };
  it("pairs two taps close in time and space in the same zone", () => {
    expect(isDoubleTap(first, { zone: "left", x: 30, y: 320, t: 1250 })).toBe(true);
  });
  it("rejects taps too slow, too far apart or in different zones", () => {
    expect(isDoubleTap(first, { zone: "left", x: 20, y: 300, t: 1400 })).toBe(false);
    expect(isDoubleTap(first, { zone: "left", x: 20, y: 400, t: 1100 })).toBe(false);
    expect(isDoubleTap(first, { zone: "right", x: 20, y: 300, t: 1100 })).toBe(false);
  });
});
