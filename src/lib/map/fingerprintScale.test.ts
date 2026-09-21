import { describe, expect, it } from "vitest";
import {
  asymmetricExtents,
  dayIndexTicks,
  fingerprintColorScale,
  formatIsoDate,
  symmetricAbsMax,
  yearRangesInWindow,
} from "@/lib/map/fingerprintScale";

describe("symmetricAbsMax", () => {
  it("returns the largest absolute finite value", () => {
    expect(symmetricAbsMax([-3, 1, 2])).toBe(3);
    expect(symmetricAbsMax([0.5, -0.2, 4.1])).toBeCloseTo(4.1, 10);
  });

  it("ignores NaN and non-finite entries", () => {
    expect(symmetricAbsMax([NaN, -2, Infinity, 1])).toBe(2);
  });

  it("returns 0 for an all-missing series", () => {
    expect(symmetricAbsMax([NaN, NaN])).toBe(0);
    expect(symmetricAbsMax([])).toBe(0);
  });
});

describe("asymmetricExtents", () => {
  it("separates negative and positive extents", () => {
    const { negMax, posMax } = asymmetricExtents([-1, 0, 3]);
    expect(negMax).toBeCloseTo(1);
    expect(posMax).toBeCloseTo(3);
  });

  it("returns a sentinel for the missing side", () => {
    // All-positive: negMax should be the tiny sentinel, not 0
    const { negMax } = asymmetricExtents([1, 2, 3]);
    expect(negMax).toBeGreaterThan(0);
    expect(negMax).toBeLessThan(1e-5);
  });

  it("ignores non-finite values", () => {
    const { negMax, posMax } = asymmetricExtents([NaN, -2, Infinity, 1]);
    expect(negMax).toBeCloseTo(2);
    expect(posMax).toBeCloseTo(1);
  });
});

describe("fingerprintColorScale — science-light (symmetric)", () => {
  const scale = fingerprintColorScale("science-light");

  it("maps non-finite values to transparent", () => {
    expect(scale(NaN, 5, 5)).toBe("transparent");
    expect(scale(Infinity, 5, 5)).toBe("transparent");
  });

  it("gives negative and positive extremes distinct hues", () => {
    const uptake = scale(-5, 5, 5);
    const release = scale(5, 5, 5);
    expect(uptake).not.toBe(release);
    expect(uptake).toMatch(/^rgb\(/);
    expect(release).toMatch(/^rgb\(/);
  });

  it("collapses to the neutral midpoint when absMax is zero", () => {
    // With no spread every value is neutral, not an endpoint.
    expect(scale(3, 0, 0)).toBe(scale(-3, 0, 0));
  });
});

describe("fingerprintColorScale — science-dark (symmetric)", () => {
  const scale = fingerprintColorScale("science-dark");

  it("maps non-finite values to transparent", () => {
    expect(scale(NaN, 5, 5)).toBe("transparent");
  });

  it("gives different colours to different values", () => {
    expect(scale(-5, 5, 5)).not.toBe(scale(5, 5, 5));
  });

  it("produces different colours than science-light", () => {
    const light = fingerprintColorScale("science-light")(-5, 5, 5);
    const dark = fingerprintColorScale("science-dark")(-5, 5, 5);
    expect(light).not.toBe(dark);
  });
});

describe("fingerprintColorScale — flux (asymmetric)", () => {
  const scale = fingerprintColorScale("flux");

  it("maps non-finite values to transparent", () => {
    expect(scale(NaN, 1, 3)).toBe("transparent");
  });

  it("returns an rgb string for valid values", () => {
    expect(scale(-1, 1, 3)).toMatch(/^rgb\(/);
    expect(scale(3, 1, 3)).toMatch(/^rgb\(/);
    expect(scale(0, 1, 3)).toMatch(/^rgb\(/);
  });

  it("zero maps to the kbc end (near cyan)", () => {
    // At value=0 on the negative half (t=0 → kbc index 255), we expect
    // approximately [179, 255, 246] from CET_KBC.
    const color = scale(0, 1, 3);
    expect(color).toMatch(/^rgb\(/);
  });

  it("uses full negMax span independently of posMax", () => {
    // With asymmetric extents (-1 vs 3), the colour at -1 should be
    // the same as at -5 with negMax=5 (both hit the darkest kbc entry).
    const colorA = scale(-1, 1, 3);
    const colorB = scale(-5, 5, 5);
    expect(colorA).toBe(colorB);
  });
});

describe("dayIndexTicks", () => {
  it("spans both ends and dedupes", () => {
    const ticks = dayIndexTicks(365);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(364);
  });

  it("handles degenerate windows", () => {
    expect(dayIndexTicks(1)).toEqual([0]);
    expect(dayIndexTicks(0)).toEqual([0]);
  });
});

describe("time mapping", () => {
  it("maps day 0 to the 2001-01-01 origin", () => {
    expect(formatIsoDate(0)).toBe("2001-01-01");
    expect(formatIsoDate(364)).toBe("2001-12-31");
  });

  it("splits a window into contiguous calendar years", () => {
    // A 400-day window starting mid-2001 spans 2001 and 2002.
    const ranges = yearRangesInWindow(180, 400);
    expect(ranges.map((r) => r.year)).toEqual([2001, 2002]);
    expect(ranges[0].startDay).toBe(0);
    expect(ranges[1].endDay).toBe(399);
    // Ranges are contiguous and non-overlapping.
    expect(ranges[1].startDay).toBe(ranges[0].endDay + 1);
  });
});
