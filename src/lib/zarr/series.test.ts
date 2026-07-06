import { describe, expect, it } from "vitest";
import { dailyMeanSeries } from "@/lib/zarr/series";

describe("dailyMeanSeries", () => {
  it("averages each block of hourly values", () => {
    const hourly = new Float32Array([
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22,
      24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46,
      100, 200,
    ]);

    expect(dailyMeanSeries(hourly, 24)).toEqual([
      { day: 1, value: 23 },
      { day: 2, value: 150 },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(dailyMeanSeries(new Float32Array(), 24)).toEqual([]);
  });

  it("ignores NaN values when averaging a day", () => {
    const hourly = new Float32Array([2, NaN, 4, NaN]);

    expect(dailyMeanSeries(hourly, 4)).toEqual([{ day: 1, value: 3 }]);
  });

  it("skips days that have no valid values", () => {
    const hourly = new Float32Array([NaN, NaN, 10, 20]);

    expect(dailyMeanSeries(hourly, 2)).toEqual([{ day: 2, value: 15 }]);
  });
});
