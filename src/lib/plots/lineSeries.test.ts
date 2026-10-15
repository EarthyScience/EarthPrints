import { describe, expect, it } from "vitest";
import {
  keepExtremes,
  lineSeries,
  MAX_LINE_POINTS,
} from "@/lib/plots/lineSeries";

const hourly = (days: number, at: (day: number, hour: number) => number) =>
  Float32Array.from({ length: days * 24 }, (_, i) =>
    at(Math.floor(i / 24), i % 24),
  );

describe("keepExtremes", () => {
  it("keeps every point when there are few enough", () => {
    const points = [1, 2, 3].map((value) => ({ value }));
    expect(keepExtremes(points, 10)).toEqual(points);
  });

  it("keeps each slice's lowest and highest point in time order", () => {
    const points = [5, 1, 9, 3, 2, 8, 7, 4].map((value) => ({ value }));
    expect(keepExtremes(points, 4).map((point) => point.value)).toEqual([
      1, 9, 2, 8,
    ]);
  });
});

describe("lineSeries", () => {
  const year = hourly(365, (day, hour) => day + hour);

  it("labels days with real dates and adds a std band", () => {
    const { points } = lineSeries(year, 24, [2019], "day");
    expect(points).toHaveLength(365);
    expect(points[0]).toMatchObject({ label: "2019-01-01", x: 0.5 });
    expect(points[0]!.value).toBeCloseTo(11.5);
    expect(points[0]!.band![1] - points[0]!.value).toBeCloseTo(
      Math.sqrt((24 * 24 - 1) / 12),
    );
  });

  it("groups weeks and months on the calendar", () => {
    expect(lineSeries(year, 24, [2019], "week").points).toHaveLength(52);
    const months = lineSeries(year, 24, [2019], "month").points;
    expect(months.map((point) => point.label).slice(0, 2)).toEqual([
      "Jan 2019",
      "Feb 2019",
    ]);
  });

  it("thins a long hourly line without losing its peak", () => {
    const peaked = hourly(365, (day, hour) => (day === 200 && hour === 13 ? 99 : 0));
    const { points } = lineSeries(peaked, 24, [2019], "hour", "local");
    expect(points.length).toBeLessThanOrEqual(MAX_LINE_POINTS);
    expect(points.some((point) => point.value === 99)).toBe(true);
    expect(points[0]!.label).toBe("2019-01-01 · 00:00 local");
  });

  it("marks year breaks and labels each year when several are picked", () => {
    const twoYears = hourly(730, () => 1);
    const { ticks, yearBreaks } = lineSeries(twoYears, 24, [2003, 2010], "day");
    expect(yearBreaks).toEqual([365]);
    expect(ticks.map((tick) => tick.label)).toEqual(["2003", "2010"]);
  });
});
