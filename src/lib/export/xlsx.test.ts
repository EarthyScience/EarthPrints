import { describe, expect, it } from "vitest";
import { buildProvenance } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { buildWorkbookSheets } from "@/lib/export/xlsx";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import type { MapSelection } from "@/types/map";

/** Index of the value column, last in the row. */
const VALUE_COLUMN = 8;

const SELECTION: MapSelection = {
  click: { lon: 11.5669, lat: 50.9128 },
  grid: { lon: 11.575, lat: 50.925, lonIndex: 3831, latIndex: 780 },
};

function sheetsForDays(days: number) {
  const prov = buildProvenance({
    selection: SELECTION,
    historyYears: 1,
    valueCount: days * ZARR_TIME.hoursPerDay,
    units: "gC m-2 d-1",
  });
  const values = new Float32Array(days * ZARR_TIME.hoursPerDay).fill(1.5);
  values[2] = Number.NaN;

  return { prov, ...buildWorkbookSheets(buildSeriesRows(values, prov), prov) };
}

describe("buildWorkbookSheets", () => {
  it("puts a header row above one row per hour", () => {
    const { data } = sheetsForDays(2);

    expect(data).toHaveLength(2 * ZARR_TIME.hoursPerDay + 1);
    expect(data[0].map((cell) => (cell as { value: string }).value)).toEqual([
      "timestamp_utc",
      "timestamp_local",
      "year",
      "date",
      "date_local",
      "hour",
      "hour_local",
      "day_index",
      "value (gC m-2 d-1)",
    ]);
  });

  it("writes timestamps as date cells, not text Excel would re-parse", () => {
    const { data } = sheetsForDays(1);
    const cell = data[1][0] as { value: Date; type: unknown };

    expect(cell.type).toBe(Date);
    expect(cell.value).toBeInstanceOf(Date);
  });

  it("leaves missing values null so Excel shows a blank, not a zero", () => {
    const { data } = sheetsForDays(1);

    expect(data[3][VALUE_COLUMN]).toBeNull();
    expect(data[2][VALUE_COLUMN]).toBe(1.5);
  });

  it("carries the provenance facts on its own sheet", () => {
    const { metadata, prov } = sheetsForDays(2);
    const facts = new Map(
      metadata.slice(1).map((row) => [row[0] as string, row[1]]),
    );

    expect(facts.get("source")).toBe(prov.sourceUrl);
    expect(facts.get("cell_lat")).toBe(SELECTION.grid.lat);
    expect(facts.get("lon_index")).toBe(SELECTION.grid.lonIndex);
    expect(facts.get("units")).toBe("gC m-2 d-1");
    expect(facts.get("rows")).toBe(2 * ZARR_TIME.hoursPerDay);
  });
});
