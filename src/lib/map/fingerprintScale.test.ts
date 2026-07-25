import { describe, expect, it } from "vitest";
import {
  dayIndexTicks,
  fingerprintColorScale,
  symmetricAbsMax,
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

describe("fingerprintColorScale", () => {
  const scale = fingerprintColorScale(true);

  it("maps non-finite values to transparent", () => {
    expect(scale(NaN, 5)).toBe("transparent");
    expect(scale(Infinity, 5)).toBe("transparent");
  });

  it("gives negative and positive extremes distinct hues", () => {
    const uptake = scale(-5, 5);
    const release = scale(5, 5);
    expect(uptake).not.toBe(release);
    expect(uptake).toMatch(/^rgb\(/);
    expect(release).toMatch(/^rgb\(/);
  });

  it("collapses to the neutral midpoint at zero", () => {
    expect(scale(0, 5)).toBe(scale(0, 5));
    // With no spread every value is neutral, not an endpoint.
    expect(scale(3, 0)).toBe(scale(-3, 0));
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
