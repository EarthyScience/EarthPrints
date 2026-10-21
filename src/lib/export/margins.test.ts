import { describe, expect, it } from "vitest";
import { buildMarginCsv } from "@/lib/export/csv";
import { buildMarginTables, marginColumns } from "@/lib/export/margins";
import { buildProvenance } from "@/lib/export/provenance";
import { buildMarginSheets } from "@/lib/export/xlsx";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import type { MapSelection } from "@/types/map";

const SELECTION: MapSelection = {
  click: { lon: 11.5669, lat: 50.9128 },
  grid: { lon: 11.575, lat: 50.925, lonIndex: 3831, latIndex: 780 },
};

function tablesForDays(days: number) {
  const hours = ZARR_TIME.hoursPerDay;
  const prov = buildProvenance({
    selection: SELECTION,
    historyYears: 1,
    selectedYears: [2019],
    valueCount: days * hours,
    units: "gC m-2 d-1",
    timeBasis: "utc",
  });
  // Each hour's value is the hour itself, plus the day index.
  const values = Float32Array.from(
    { length: days * hours },
    (_, i) => (i % hours) + Math.floor(i / hours),
  );
  values[0] = Number.NaN;
  return { prov, tables: buildMarginTables(values, prov) };
}

describe("buildMarginTables", () => {
  const { prov, tables } = tablesForDays(3);

  it("gives one row per hour across the days", () => {
    expect(tables.dailyCycle).toHaveLength(ZARR_TIME.hoursPerDay);
    expect(tables.dailyCycle[0]).toEqual({ key: 0, mean: 1.5, std: 0.5, count: 2 });
    expect(tables.dailyCycle[5]).toMatchObject({ key: 5, mean: 6, count: 3 });
  });

  it("gives one dated row per day across its hours", () => {
    expect(tables.seasonalCourse.map((row) => row.key)).toEqual([
      "2019-01-01",
      "2019-01-02",
      "2019-01-03",
    ]);
    expect(tables.seasonalCourse[1]).toMatchObject({ mean: 12.5, count: 24 });
    expect(tables.seasonalCourse[0]!.count).toBe(23);
  });

  it("names the clock in the first column", () => {
    expect(marginColumns(prov).dailyCycle[0]).toBe("hour_utc");
    expect(marginColumns(prov).seasonalCourse[0]).toBe("date_utc");
  });

  it("writes CSV with provenance comments and empty cells for gaps", () => {
    const text = buildMarginCsv(
      [{ key: 0, mean: null, std: null, count: 0 }],
      marginColumns(prov).dailyCycle,
      "mean daily cycle",
      prov,
    );
    const lines = text.trim().split("\n");
    expect(lines.at(-3)).toBe("# table: mean daily cycle");
    expect(lines.at(-2)).toBe("hour_utc,mean,std,days");
    expect(lines.at(-1)).toBe("0,,,0");
  });

  it("lays out a sheet per axis with a bold header", () => {
    const sheets = buildMarginSheets(tables, prov);
    expect(sheets.dailyCycle).toHaveLength(ZARR_TIME.hoursPerDay + 1);
    expect(sheets.seasonalCourse[1]).toEqual(["2019-01-01", 12, expect.any(Number), 23]);
  });
});
