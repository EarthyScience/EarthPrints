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

  it("handles non-contiguous selected years with accurate UTC timestamps for each year", () => {
    const prov = buildProvenance({
      selection: SELECTION,
      selectedYears: [2002, 2018],
      valueCount: (365 + 365) * ZARR_TIME.hoursPerDay,
    });

    const values = new Float32Array((365 + 365) * ZARR_TIME.hoursPerDay).fill(0.5);
    const rows = buildSeriesRows(values, prov);

    expect(rows).toHaveLength((365 + 365) * ZARR_TIME.hoursPerDay);

    // Day 0 should be 2002-01-01T00:00:00.000Z
    expect(rows[0].timestamp.toISOString()).toBe("2002-01-01T00:00:00.000Z");

    // Day 364 (last day of 2002) at 23:00
    const last2002 = rows[365 * 24 - 1];
    expect(last2002.timestamp.toISOString()).toBe("2002-12-31T23:00:00.000Z");

    // Day 365 (first day of 2018) at 00:00
    const first2018 = rows[365 * 24];
    expect(first2018.timestamp.toISOString()).toBe("2018-01-01T00:00:00.000Z");

    // Last day of 2018 at 23:00
    const last2018 = rows[rows.length - 1];
    expect(last2018.timestamp.toISOString()).toBe("2018-12-31T23:00:00.000Z");
  });

  it("handles [2001, 2004, 2021] including leap year with exact year and date fields", () => {
    // 2001 (365d), 2004 (366d), 2021 (365d) = 1096 days
    const totalDays = 365 + 366 + 365;
    const prov = buildProvenance({
      selection: SELECTION,
      selectedYears: [2001, 2004, 2021],
      valueCount: totalDays * ZARR_TIME.hoursPerDay,
    });

    const values = new Float32Array(totalDays * ZARR_TIME.hoursPerDay).fill(0.8);
    const rows = buildSeriesRows(values, prov);

    expect(rows).toHaveLength(totalDays * 24);

    // First row: 2001-01-01
    expect(rows[0]).toMatchObject({
      year: 2001,
      date: "2001-01-01",
      dayIndex: 0,
      hour: 0,
    });

    // Last row of 2001: index 365 * 24 - 1
    expect(rows[365 * 24 - 1]).toMatchObject({
      year: 2001,
      date: "2001-12-31",
      dayIndex: 364,
      hour: 23,
    });

    // First row of 2004: index 365 * 24
    expect(rows[365 * 24]).toMatchObject({
      year: 2004,
      date: "2004-01-01",
      dayIndex: 1095,
      hour: 0,
    });

    // Leap day in 2004 (2004-02-29): day offset 31 (Jan) + 28 = 59
    const leapDayRow = rows[(365 + 59) * 24];
    expect(leapDayRow).toMatchObject({
      year: 2004,
      date: "2004-02-29",
      dayIndex: 1095 + 59,
      hour: 0,
    });

    // Last row of 2004: index (365 + 366) * 24 - 1
    expect(rows[(365 + 366) * 24 - 1]).toMatchObject({
      year: 2004,
      date: "2004-12-31",
      dayIndex: 1460,
      hour: 23,
    });

    // First row of 2021: index (365 + 366) * 24
    expect(rows[(365 + 366) * 24]).toMatchObject({
      year: 2021,
      date: "2021-01-01",
      dayIndex: 7305,
      hour: 0,
    });

    // Last row of 2021: index rows.length - 1
    expect(rows[rows.length - 1]).toMatchObject({
      year: 2021,
      date: "2021-12-31",
      dayIndex: 7669,
      hour: 23,
    });
  });
});
