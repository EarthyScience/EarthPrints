import { describe, expect, it } from "vitest";
import {
  contiguousDayBlocks,
  formatTimeBasis,
  formatUtcOffset,
  localHourOffset,
  shiftSeriesToLocalTime,
} from "@/lib/zarr/localTime";
import { getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";

const HOURS = 24;

/** A window of `days` days whose every cell records its own flat index. */
function indexSeries(days: number): Float32Array {
  return Float32Array.from({ length: days * HOURS }, (_, i) => i);
}

describe("localHourOffset", () => {
  it("reads the nominal zone off the longitude", () => {
    expect(localHourOffset(0)).toBe(0);
    expect(localHourOffset(10)).toBe(1);
    expect(localHourOffset(-60)).toBe(-4);
    expect(localHourOffset(150)).toBe(10);
  });

  it("rounds to the nearest whole hour, since the data is hourly", () => {
    expect(localHourOffset(7)).toBe(0);
    expect(localHourOffset(8)).toBe(1);
    expect(localHourOffset(-22.4)).toBe(-1);
  });

  it("never exceeds +/-12, including past the antimeridian", () => {
    expect(localHourOffset(179.975)).toBe(12);
    expect(localHourOffset(-179.975)).toBe(-12);
    // A wrapped map can hand back a longitude outside [-180, 180).
    expect(localHourOffset(190)).toBe(localHourOffset(-170));
    expect(localHourOffset(-190)).toBe(localHourOffset(170));
  });

  it("falls back to UTC for a non-finite longitude", () => {
    expect(localHourOffset(Number.NaN)).toBe(0);
  });
});

describe("formatUtcOffset", () => {
  it("names the offset the way the axis caption reads it", () => {
    expect(formatUtcOffset(0)).toBe("UTC");
    expect(formatUtcOffset(10)).toBe("UTC+10");
    expect(formatUtcOffset(-4)).toBe("UTC-4");
  });

  it("says which clock a basis means", () => {
    expect(formatTimeBasis("utc", 10)).toBe("UTC");
    expect(formatTimeBasis("local", 10)).toBe("local solar time (UTC+10)");
  });
});

describe("contiguousDayBlocks", () => {
  it("keeps adjacent years in one run", () => {
    const { absoluteDays } = getSelectedYearsDayMapping([2004, 2005]);
    expect(contiguousDayBlocks(absoluteDays)).toEqual([
      { start: 0, dayCount: absoluteDays.length },
    ]);
  });

  it("splits a gap in the selection", () => {
    const { absoluteDays } = getSelectedYearsDayMapping([2005, 2018]);
    const blocks = contiguousDayBlocks(absoluteDays);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ start: 0, dayCount: 365 });
    expect(blocks[1]).toEqual({ start: 365, dayCount: 365 });
  });

  it("carries a tail the mapping does not describe into the run before it", () => {
    expect(contiguousDayBlocks([0, 1], 4)).toEqual([{ start: 0, dayCount: 4 }]);
  });
});

describe("shiftSeriesToLocalTime", () => {
  const absoluteDays = getSelectedYearsDayMapping([2018]).absoluteDays;

  it("moves an hour east by the offset, into the same local day", () => {
    // Solar noon over eastern Australia falls at 02:00 UTC. Reading the array
    // at local hour 12 has to return that cell, not the one at UTC 12.
    const values = indexSeries(365);
    const shifted = shiftSeriesToLocalTime(values, {
      hoursPerDay: HOURS,
      offsetHours: 10,
      absoluteDays,
    });

    const day = 100;
    expect(shifted[day * HOURS + 12]).toBe(values[day * HOURS + 2]);
    expect(shifted[day * HOURS + 0]).toBe(values[(day - 1) * HOURS + 14]);
  });

  it("moves an hour west by the offset", () => {
    const values = indexSeries(365);
    const shifted = shiftSeriesToLocalTime(values, {
      hoursPerDay: HOURS,
      offsetHours: -4,
      absoluteDays,
    });

    const day = 100;
    expect(shifted[day * HOURS + 12]).toBe(values[day * HOURS + 16]);
  });

  it("leaves the unsourced edge hours empty rather than wrapping them", () => {
    const values = indexSeries(365);
    const shifted = shiftSeriesToLocalTime(values, {
      hoursPerDay: HOURS,
      offsetHours: 10,
      absoluteDays,
    });

    for (let hour = 0; hour < 10; hour += 1) {
      expect(shifted[hour]).toBeNaN();
    }
    expect(shifted[10]).toBe(0);

    const finite = shifted.filter((value) => Number.isFinite(value)).length;
    expect(finite).toBe(values.length - 10);
  });

  it("rolls each contiguous run on its own, so one year cannot leak into another", () => {
    const { absoluteDays: split } = getSelectedYearsDayMapping([2005, 2018]);
    const values = indexSeries(split.length);
    const shifted = shiftSeriesToLocalTime(values, {
      hoursPerDay: HOURS,
      offsetHours: 10,
      absoluteDays: split,
    });

    const secondRun = 365 * HOURS;
    for (let hour = 0; hour < 10; hour += 1) {
      expect(shifted[secondRun + hour]).toBeNaN();
    }
    expect(shifted[secondRun + 10]).toBe(values[secondRun]);
  });

  it("hands back the same array when the pixel is already on UTC", () => {
    const values = indexSeries(3);
    expect(
      shiftSeriesToLocalTime(values, {
        hoursPerDay: HOURS,
        offsetHours: 0,
        absoluteDays,
      }),
    ).toBe(values);
  });
});
