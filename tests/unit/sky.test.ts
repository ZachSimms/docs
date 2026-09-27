/** Unit tests for the home page's moon and sun (`lib/sky.ts`) and the hemisphere they are drawn for. */
import { describe, expect, it } from "bun:test";
import {
  PHASE_NAMES,
  moonBits,
  moonPhase,
  nextSeasonEvent,
  seasonEvents,
  sunBits,
} from "@/lib/sky";
import { hemisphereOf, localTimeZone } from "@/lib/hemisphere";

const HOUR = 3_600_000;

describe("moonPhase", () => {
  it("matches published new, quarter and full moons", () => {
    const at = (iso: string) => moonPhase(new Date(iso));
    expect(at("2024-01-11T11:57Z")).toMatchObject({ name: "new moon" });
    expect(at("2024-01-11T11:57Z").illumination).toBeLessThan(0.01);
    expect(at("2024-01-18T03:52Z").name).toBe("first quarter");
    expect(at("2024-01-18T03:52Z").illumination).toBeCloseTo(0.5, 0);
    expect(at("2024-01-25T17:54Z").name).toBe("full moon");
    expect(at("2024-01-25T17:54Z").illumination).toBeGreaterThan(0.99);
    expect(at("2024-02-02T23:18Z").name).toBe("last quarter");
  });

  it("names waxing phases before full and waning after", () => {
    expect(moonPhase(new Date("2024-01-14T00:00Z")).name).toBe("waxing crescent");
    expect(moonPhase(new Date("2024-01-22T00:00Z")).name).toBe("waxing gibbous");
    expect(moonPhase(new Date("2024-01-29T00:00Z")).name).toBe("waning gibbous");
    expect(moonPhase(new Date("2024-02-06T00:00Z")).name).toBe("waning crescent");
    expect(PHASE_NAMES).toHaveLength(8);
  });

  it("keeps age in [0, 1) for dates before the reference new moon", () => {
    const { age } = moonPhase(new Date("1990-05-01T00:00Z"));
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(1);
  });
});

describe("seasons", () => {
  it("places 2026's equinoxes and solstices within an hour of the published times", () => {
    const published = [
      "2026-03-20T14:46Z",
      "2026-06-21T08:24Z",
      "2026-09-23T00:05Z",
      "2026-12-21T20:50Z",
    ];
    seasonEvents(2026).forEach((event, i) => {
      expect(Math.abs(event.date.getTime() - Date.parse(published[i]!))).toBeLessThan(HOUR);
    });
    expect(seasonEvents(2026).map((e) => e.name)).toEqual([
      "spring equinox",
      "summer solstice",
      "autumn equinox",
      "winter solstice",
    ]);
  });

  it("counts whole days to the next one, rolling into the next year", () => {
    // Local noon keeps the calendar day the same whatever the test machine's time zone.
    expect(nextSeasonEvent(new Date(2026, 8, 27, 12))).toMatchObject({
      name: "winter solstice",
      days: 85,
    });
    expect(nextSeasonEvent(new Date(2026, 11, 30, 12))).toMatchObject({ name: "spring equinox" });
    expect(nextSeasonEvent(new Date(2026, 11, 30, 12)).date.getFullYear()).toBe(2027);
  });

  it("names them for the southern hemisphere on the same dates", () => {
    const north = seasonEvents(2026);
    const south = seasonEvents(2026, "south");
    expect(south.map((e) => e.name)).toEqual([
      "autumn equinox",
      "winter solstice",
      "spring equinox",
      "summer solstice",
    ]);
    expect(south.map((e) => e.date.getTime())).toEqual(north.map((e) => e.date.getTime()));
    expect(nextSeasonEvent(new Date(2026, 8, 27, 12), "south")).toMatchObject({
      name: "summer solstice",
      days: 85,
    });
  });
});

describe("hemisphereOf", () => {
  it("reads southern time zones and their aliases as south", () => {
    for (const zone of [
      "Australia/Sydney",
      "Australia/NSW",
      "Pacific/Auckland",
      "NZ",
      "America/Sao_Paulo",
      "America/Argentina/Buenos_Aires",
      "America/Buenos_Aires",
      "America/Santiago",
      "Africa/Johannesburg",
      "Asia/Jakarta",
    ]) {
      expect(hemisphereOf(zone)).toBe("south");
    }
  });

  it("reads everything else, unknown or missing, as north", () => {
    for (const zone of [
      "America/Chicago",
      "Europe/London",
      "Asia/Tokyo",
      "America/Boa_Vista",
      "Africa/Kampala",
      "UTC",
      "Etc/GMT+10",
      "Mars/Olympus_Mons",
      "",
      undefined,
    ]) {
      expect(hemisphereOf(zone)).toBe("north");
    }
  });

  it("reports the runtime's time zone", () => {
    expect(typeof localTimeZone()).toBe("string");
  });
});

/** Share of inked cells in the given column range, over all rows. */
function density(bits: Uint8Array, size: number, from: number, to: number): number {
  let inked = 0;
  for (let y = 0; y < size; y++) for (let x = from; x < to; x++) inked += bits[y * size + x]!;
  return inked / (size * (to - from));
}

describe("moonBits", () => {
  const size = 60;

  it("leaves the corners empty and outlines the disc", () => {
    const bits = moonBits(size, 0.5);
    expect(bits).toHaveLength(size * size);
    expect(bits[0]).toBe(0);
    expect(bits[size * size - 1]).toBe(0);
    expect(bits[(size / 2) * size + 0]).toBe(1);
  });

  it("inks the shadow densely and the lit face sparsely", () => {
    const full = moonBits(size, 0.5);
    const inner = (bits: Uint8Array) => density(bits, size, 20, 40);
    expect(inner(full)).toBeLessThan(0.3);
    expect(inner(moonBits(size, 0))).toBeGreaterThan(0.5);
  });

  it("darkens the right-hand side when waning and the left when waxing", () => {
    const waning = moonBits(size, 0.8);
    expect(density(waning, size, 35, 55)).toBeGreaterThan(density(waning, size, 5, 25));
    const waxing = moonBits(size, 0.2);
    expect(density(waxing, size, 5, 25)).toBeGreaterThan(density(waxing, size, 35, 55));
  });

  it("turns the moon half a circle for the southern hemisphere", () => {
    const waxing = moonBits(size, 0.2, "south");
    expect(density(waxing, size, 35, 55)).toBeGreaterThan(density(waxing, size, 5, 25));
    // Every cell of the northern moon is found at the opposite cell of the southern one.
    const north = moonBits(size, 0.2, "north");
    expect([...waxing].reverse()).toEqual([...north]);
  });
});

describe("sunBits", () => {
  it("is densest at the center and empty in the corners", () => {
    const size = 60;
    const bits = sunBits(size);
    expect(bits[0]).toBe(0);
    expect(density(bits, size, 25, 35)).toBeGreaterThan(density(bits, size, 0, 10));
  });
});
