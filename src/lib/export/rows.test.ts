import { describe, expect, it } from "vitest";
import { buildProvenance } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { ZARR_TIME, dayIndexToUTCDate } from "@/lib/zarr/timeRange";
import type { MapSelection } from "@/types/map";

const SELECTION: MapSelection = {
  click: { lon: 11.5669, lat: 50.9128 },
  grid: { lon: 11.575, lat: 50.925, lonIndex: 3831, latIndex: 780 },
};

function provenanceFor(days: number) {
  return buildProvenance({
    selection: SELECTION,
    historyYears: 1,
    valueCount: days * ZARR_TIME.hoursPerDay,
    units: "gC m-2 d-1",
  });
}

describe("buildSeriesRows", () => {
  it("emits one row per hour of the window", () => {
    const prov = provenanceFor(3);
    const values = new Float32Array(3 * ZARR_TIME.hoursPerDay).fill(1);

    expect(buildSeriesRows(values, prov)).toHaveLength(
      3 * ZARR_TIME.hoursPerDay,
    );
  });

  it("walks hours within a day before advancing the day", () => {
    const prov = provenanceFor(2);
    const rows = buildSeriesRows(
      new Float32Array(2 * ZARR_TIME.hoursPerDay),
      prov,
    );

    expect(rows[0]).toMatchObject({ dayIndex: prov.baseDay, hour: 0 });
    expect(rows[23]).toMatchObject({ dayIndex: prov.baseDay, hour: 23 });
    expect(rows[24]).toMatchObject({ dayIndex: prov.baseDay + 1, hour: 0 });
  });

  it("anchors the first and last timestamps to the window bounds", () => {
    const prov = provenanceFor(4);
    const rows = buildSeriesRows(
      new Float32Array(4 * ZARR_TIME.hoursPerDay),
      prov,
    );
    const last = rows[rows.length - 1];

    expect(rows[0].timestamp.toISOString()).toBe(
      dayIndexToUTCDate(prov.baseDay).toISOString(),
    );
    expect(last.timestamp.getUTCHours()).toBe(23);
    expect(last.timestamp.toISOString().slice(0, 10)).toBe(
      prov.windowEnd.toISOString().slice(0, 10),
    );
  });

  it("carries NaN through as null rather than a number", () => {
    const prov = provenanceFor(1);
    const values = new Float32Array(ZARR_TIME.hoursPerDay).fill(2);
    values[5] = Number.NaN;

    const rows = buildSeriesRows(values, prov);

    expect(rows[5].value).toBeNull();
    expect(rows[4].value).toBe(2);
  });

  it("rounds off the noise digits float32 widening introduces", () => {
    const prov = provenanceFor(1);
    const values = new Float32Array(ZARR_TIME.hoursPerDay);
    values[0] = -0.412;

    // Read back raw, this is -0.41200000047683716.
    expect(buildSeriesRows(values, prov)[0].value).toBe(-0.412);
  });

  it("ignores a trailing partial day the hour grid cannot fill", () => {
    const prov = buildProvenance({
      selection: SELECTION,
      historyYears: 1,
      valueCount: 2 * ZARR_TIME.hoursPerDay + 7,
    });

    expect(
      buildSeriesRows(new Float32Array(2 * ZARR_TIME.hoursPerDay + 7), prov),
    ).toHaveLength(2 * ZARR_TIME.hoursPerDay);
  });
});

describe("buildProvenance", () => {
  it("ends the window at the last day of the archive", () => {
    const prov = provenanceFor(10);

    expect(prov.baseDay).toBe(ZARR_TIME.totalDays - 10);
    expect(prov.windowEnd.toISOString()).toBe(
      dayIndexToUTCDate(ZARR_TIME.totalDays - 1).toISOString(),
    );
  });
});
