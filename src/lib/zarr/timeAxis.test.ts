import { describe, expect, it } from "vitest";
import {
  buildTimeAxis,
  resampleToDays,
  sampleRangeForDays,
  samplesInDays,
} from "@/lib/zarr/timeAxis";

const H = 3_600_000;
const D = 24 * H;

describe("buildTimeAxis", () => {
  it("reads a 6-hourly axis as 4 slots a day", () => {
    const start = Date.UTC(2023, 0, 1);
    const times = Float64Array.from({ length: 8 }, (_, i) => start + i * 6 * H);
    const axis = buildTimeAxis(times);
    expect(axis.slotsPerDay).toBe(4);
    expect(axis.totalDays).toBe(2);
    expect(axis.stepLabel).toBe("6-hourly");
    expect(axis.years).toEqual([2023]);
  });

  it("anchors a monthly axis on the first of the month", () => {
    const times = Float64Array.from([Date.UTC(2000, 0, 15), Date.UTC(2000, 1, 15), Date.UTC(2000, 2, 15)]);
    const axis = buildTimeAxis(times);
    expect(axis.span).toBe("month");
    expect(axis.originMs).toBe(Date.UTC(2000, 0, 1));
    expect(axis.totalDays).toBe(31 + 29 + 31);
  });

  it("keeps a separate hour axis as the day's slots", () => {
    const times = Float64Array.from({ length: 3 }, (_, i) => Date.UTC(2001, 0, 1) + i * D);
    const axis = buildTimeAxis(times, 24);
    expect(axis.hourAxis).toBe(true);
    expect(axis.slotsPerDay).toBe(24);
    expect(axis.totalDays).toBe(3);
  });
});

describe("resampleToDays", () => {
  it("places sub-daily samples in their slots and leaves gaps NaN", () => {
    const start = Date.UTC(2023, 0, 1);
    // The second day's 12:00 sample is missing.
    const times = Float64Array.from([0, 6, 12, 18, 24, 30, 42].map((h) => start + h * H));
    const axis = buildTimeAxis(times);
    const range = sampleRangeForDays(axis, [1, 2]);
    expect(range).toEqual([4, 7]);
    const out = resampleToDays(axis, Float32Array.from([4, 5, 6]), range[0], [1, 2]);
    expect(Array.from(out)).toEqual([4, 5, NaN, 6]);
  });

  it("fills every day of a monthly sample", () => {
    const times = Float64Array.from([Date.UTC(2001, 0, 1), Date.UTC(2001, 1, 1)]);
    const axis = buildTimeAxis(times);
    const range = sampleRangeForDays(axis, [30, 33]);
    const out = resampleToDays(axis, Float32Array.from([1, 2]), range[0], [30, 33]);
    expect(range[0]).toBe(0);
    expect(Array.from(out)).toEqual([1, 2, 2]);
  });

  it("keeps an 8-daily window inside its year and the record", () => {
    // ESDC stamps each 8-day window at its centre and restarts in January.
    const times = Float64Array.from([
      Date.UTC(2014, 11, 28),
      Date.UTC(2015, 0, 5),
      Date.UTC(2015, 0, 13),
    ]);
    const axis = buildTimeAxis(times);
    expect(axis.span).toBe("days");
    expect(axis.years).toEqual([2014, 2015]);
    const out = resampleToDays(axis, Float32Array.from([1, 2, 3]), 0, [0, axis.totalDays]);
    const day = (y: number, m: number, d: number) =>
      Math.round((Date.UTC(y, m, d) - axis.originMs) / D);
    expect(out[day(2014, 11, 31)]).toBe(1);
    expect(out[day(2015, 0, 1)]).toBe(2);
    expect(out[day(2015, 0, 13)]).toBe(3);
    expect(axis.totalDays).toBe(day(2015, 0, 17));
  });
});

describe("samplesInDays", () => {
  it("counts store samples, not filled days", () => {
    const times = Float64Array.from({ length: 12 }, (_, m) => Date.UTC(2001, m, 15));
    const axis = buildTimeAxis(times);
    expect(samplesInDays(axis, [0, axis.totalDays])).toBe(12);
    expect(axis.years).toEqual([2001]);
  });
});

describe("records before year 100", () => {
  it("keeps year 1 as year 1", async () => {
    const { decodeCfTimes } = await import("@/lib/zarr/cfTime");
    const times = decodeCfTimes([0, 31, 59], "days since 0001-01-15", "noleap")!;
    const axis = buildTimeAxis(times);
    expect(axis.span).toBe("month");
    expect(axis.years).toEqual([1]);
    expect(new Date(axis.originMs).getUTCFullYear()).toBe(1);
  });
});

describe("gappy daily records", () => {
  it("keeps each value on its own day instead of spreading it", () => {
    // Daily stamps with most days missing: the median step is 2 days.
    const days = [0, 2, 4, 5, 8, 10, 12, 15, 16];
    const times = Float64Array.from(days, (d) => Date.UTC(2019, 0, 1) + d * D);
    const axis = buildTimeAxis(times);
    expect(axis.span).toBe("slot");
    expect(axis.stepLabel).toBe("daily");
    const out = resampleToDays(axis, Float32Array.from(days), 0, [0, axis.totalDays]);
    expect(Array.from(out).filter(Number.isFinite)).toHaveLength(days.length);
    expect(Number.isNaN(out[1]!)).toBe(true);
  });
});
