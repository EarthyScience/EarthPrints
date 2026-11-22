import { describe, expect, it } from "vitest";
import { columnLabel, fingerprintGrid, rowLabel } from "@/lib/plots/fingerprint";

const YEARS = [2001, 2002, 2003];
// Hourly values for 2001 to 2003: an offset per year plus the hour of day.
// 2002 is 3 warmer and 2003 is 1 cooler than 2001.
const OFFSET: Record<number, number> = { 2001: 0, 2002: 3, 2003: -1 };
const days = (year: number) => (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
const hourly = Float32Array.from(
  YEARS.flatMap((year) =>
    Array.from({ length: days(year) * 24 }, (_, i) => OFFSET[year]! + (i % 24)),
  ),
);

describe("typical year", () => {
  it("summarises each month and hour across the years", () => {
    const mean = fingerprintGrid(hourly, 24, YEARS, "month", "auto", {
      kind: "typical",
      stat: "mean",
    });
    expect(mean.typical).toEqual({ stat: "mean", years: 3 });
    expect(mean.bins).toHaveLength(12);
    expect(mean.mean[5 * 24 + 12]).toBeCloseTo(12 + 2 / 3, 5);
    expect(columnLabel(mean, 5)).toBe("Jun");
    expect(rowLabel(mean, 12)).toBe("12:00");

    const median = fingerprintGrid(hourly, 24, YEARS, "month", "auto", {
      kind: "typical",
      stat: "median",
    });
    expect(median.mean[12]).toBe(12);

    const spread = fingerprintGrid(hourly, 24, YEARS, "month", "auto", {
      kind: "typical",
      stat: "spread",
    });
    // Sample std of 0, 3 and -1.
    expect(spread.mean[0]).toBeCloseTo(Math.sqrt(13 / 3), 5);
  });
});

describe("difference from the typical year", () => {
  const grid = fingerprintGrid(hourly, 24, YEARS, "month", "auto", {
    kind: "difference",
  });

  it("subtracts the typical value of the same month and hour", () => {
    expect(grid.bins).toHaveLength(36);
    // June 2002, noon: 15 against a typical 12 2/3.
    const at = (12 + 5) * 24 + 12;
    expect(grid.mean[at]).toBeCloseTo(3 - 2 / 3, 5);
    expect(grid.difference?.reference[at]).toBeCloseTo(12 + 2 / 3, 5);
  });

  it("ranks the years by the size of their difference, either sign", () => {
    const unusual = grid.difference!.unusual;
    expect(unusual.map((u) => u.year)).toEqual([2002, 2003, 2001]);
    expect(unusual[0]!.rms).toBeCloseTo(7 / 3, 5);
    expect(unusual[1]!.rms).toBeCloseTo(5 / 3, 5);
  });

  it("works on the yearly scale", () => {
    const yearly = fingerprintGrid(hourly, 24, YEARS, "year", "auto", {
      kind: "difference",
    });
    expect(yearly.bins).toHaveLength(3);
    expect(yearly.mean[2 * 24]).toBeCloseTo(-1 - 2 / 3, 5);
  });

  it("builds yearly columns from months, so a part year is not pulled by its season", () => {
    // A seasonal cycle the same every year; 2003 stops after June.
    const months = (year: number) => (year === 2003 ? 6 : 12);
    const seasonal = Float32Array.from(
      YEARS.flatMap((year) =>
        Array.from({ length: days(year) }, (_, day) => {
          const month = new Date(Date.UTC(year, 0, 1 + day)).getUTCMonth();
          return month < months(year) ? 10 * Math.sin((month / 12) * 2 * Math.PI) : NaN;
        }),
      ),
    );
    const yearly = fingerprintGrid(seasonal, 1, YEARS, "year", "auto", {
      kind: "difference",
    });
    for (let col = 0; col < 3; col++) expect(yearly.mean[col]).toBeCloseTo(0, 5);
    expect(yearly.difference?.partial).toEqual([2003]);
    expect(yearly.difference?.unusual.map((u) => u.year)).toEqual([2001, 2002]);
  });

  it("keeps the reference in step with a seasonal layout", () => {
    // One value a day, so years become rows.
    const daily = Float32Array.from(
      YEARS.flatMap((year) => Array.from({ length: days(year) }, () => OFFSET[year]!)),
    );
    const season = fingerprintGrid(daily, 1, YEARS, "month", "auto", {
      kind: "difference",
    });
    expect(season.seasonal?.years).toEqual(YEARS);
    const cell = (month: number, row: number) => month * 3 + row;
    expect(season.mean[cell(4, 1)]).toBeCloseTo(3 - 2 / 3, 5);
    expect(season.difference?.reference[cell(4, 1)]).toBeCloseTo(2 / 3, 5);
    expect(season.difference?.unusual[0]!.year).toBe(2002);
  });
});
