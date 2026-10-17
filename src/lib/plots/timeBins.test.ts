import { describe, expect, it } from "vitest";
import {
  binHourGrid,
  binLineStats,
  formatBinLabel,
  monthStartTicks,
  timeBins,
  WEEKS_PER_YEAR,
} from "@/lib/plots/timeBins";
import { getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";

const daysOf = (years: number[]) =>
  getSelectedYearsDayMapping(years).absoluteDays;

describe("timeBins", () => {
  it("makes 52 weeks a year, with the spare days in the last week", () => {
    const common = timeBins(daysOf([2019]), "week");
    expect(common).toHaveLength(WEEKS_PER_YEAR);
    expect(common[0]).toMatchObject({ startLocal: 0, endLocal: 6 });
    expect(common.at(-1)).toMatchObject({ startLocal: 357, endLocal: 364 });

    const leap = timeBins(daysOf([2020]), "week");
    expect(leap).toHaveLength(WEEKS_PER_YEAR);
    expect(leap.at(-1)).toMatchObject({ startLocal: 357, endLocal: 365 });
  });

  it("follows calendar months, including a leap February", () => {
    const months = timeBins(daysOf([2020]), "month");
    expect(months).toHaveLength(12);
    expect(months[1]).toMatchObject({ index: 1, startLocal: 31, endLocal: 59 });
  });

  it("keeps years with a gap between them apart", () => {
    const years = timeBins(daysOf([2003, 2010]), "year");
    expect(years.map((bin) => bin.year)).toEqual([2003, 2010]);
    expect(years[1]).toMatchObject({ startLocal: 365, endLocal: 729 });

    const weeks = timeBins(daysOf([2003, 2010]), "week");
    expect(weeks).toHaveLength(2 * WEEKS_PER_YEAR);
    expect(weeks[WEEKS_PER_YEAR]).toMatchObject({ year: 2010, index: 0 });
  });

  it("gives one bin per day at the daily scale", () => {
    expect(timeBins(daysOf([2019]), "day")).toHaveLength(365);
  });
});

describe("binHourGrid", () => {
  it("averages each hour across the days of a bin, skipping gaps", () => {
    const bins = [
      { year: 2019, index: 0, startLocal: 0, endLocal: 2, firstDay: 0, lastDay: 2 },
    ];
    const values = new Float32Array([1, 10, 3, NaN, 5, 30]);
    const grid = binHourGrid(values, 2, bins);

    expect(Array.from(grid.mean)).toEqual([3, 20]);
    expect(Array.from(grid.count)).toEqual([3, 2]);
    expect(grid.std[0]).toBeCloseTo(Math.sqrt(8 / 3));
    expect(grid.std[1]).toBeCloseTo(10);
  });

  it("returns the values unchanged for daily bins", () => {
    const days = daysOf([2019]).slice(0, 3);
    const values = new Float32Array([0.1, -2.7, NaN, 4.2, 5.5, -0.3]);
    const grid = binHourGrid(values, 2, timeBins(days, "day"));

    expect(Array.from(grid.mean)).toEqual(Array.from(values));
  });

  it("marks a bin with no data as missing", () => {
    const bins = [
      { year: 2019, index: 0, startLocal: 0, endLocal: 0, firstDay: 0, lastDay: 0 },
    ];
    const grid = binHourGrid(new Float32Array([NaN]), 1, bins);
    expect(grid.mean[0]).toBeNaN();
    expect(grid.count[0]).toBe(0);
  });
});

describe("binLineStats", () => {
  const values = new Float32Array([0, 2, 4, 6, 10, 10]);
  const bins = [
    { year: 2019, index: 0, startLocal: 0, endLocal: 2, firstDay: 0, lastDay: 2 },
  ];

  it("spreads a day across its hours", () => {
    const daily = binLineStats(
      values,
      2,
      timeBins(daysOf([2019]).slice(0, 3), "day"),
      "day",
    );
    expect(Array.from(daily.mean)).toEqual([1, 5, 10]);
    expect(Array.from(daily.std)).toEqual([1, 1, 0]);
    expect(Array.from(daily.count)).toEqual([2, 2, 2]);
  });

  it("spreads a week or month across its daily means", () => {
    const weekly = binLineStats(values, 2, bins, "week");
    expect(weekly.mean[0]).toBeCloseTo(16 / 3);
    expect(weekly.std[0]).toBeCloseTo(Math.sqrt((1 + 25 + 100) / 3 - (16 / 3) ** 2));
    expect(weekly.count[0]).toBe(3);
  });

  it("leaves days without data out of the count", () => {
    const gappy = new Float32Array([NaN, NaN, 4, 6, 10, 10]);
    const weekly = binLineStats(gappy, 2, bins, "week");
    expect(weekly.count[0]).toBe(2);
    expect(weekly.mean[0]).toBeCloseTo(7.5);
  });
});

describe("monthStartTicks", () => {
  it("puts ticks on the first of every other month in one year", () => {
    const days = daysOf([2019]);
    const ticks = monthStartTicks(days);
    expect(ticks).toHaveLength(6);
    expect(ticks.map((local) => formatBinLabel(timeBins([days[local]!], "day")[0]!, "day"))).toEqual([
      "2019-01-01",
      "2019-03-01",
      "2019-05-01",
      "2019-07-01",
      "2019-09-01",
      "2019-11-01",
    ]);
  });
});

describe("formatBinLabel", () => {
  it("names each scale plainly", () => {
    const [week] = timeBins(daysOf([2019]), "week").slice(11);
    const [month] = timeBins(daysOf([2019]), "month").slice(2);
    const [day] = timeBins(daysOf([2019]), "day");
    expect(formatBinLabel(week!, "week")).toBe("19 to 25 Mar 2019");
    expect(formatBinLabel(month!, "month")).toBe("Mar 2019");
    expect(formatBinLabel(day!, "day")).toBe("2019-01-01");
    expect(formatBinLabel(timeBins(daysOf([2019]), "year")[0]!, "year")).toBe(
      "2019",
    );
  });

  it("spells out both months when a week crosses one", () => {
    const [week] = timeBins(daysOf([2019]), "week").slice(4);
    expect(formatBinLabel(week!, "week")).toBe("29 Jan to 4 Feb 2019");
  });
});
