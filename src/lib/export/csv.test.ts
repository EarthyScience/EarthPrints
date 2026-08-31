import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, buildSeriesCsv } from "@/lib/export/csv";
import { buildProvenance, exportFileBaseName } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import type { MapSelection } from "@/types/map";

const SELECTION: MapSelection = {
  click: { lon: 11.5669, lat: 50.9128 },
  grid: { lon: 11.575, lat: 50.925, lonIndex: 3831, latIndex: 780 },
};

function csvForDays(days: number, mutate?: (values: Float32Array) => void) {
  const prov = buildProvenance({
    selection: SELECTION,
    historyYears: 1,
    valueCount: days * ZARR_TIME.hoursPerDay,
    units: "gC m-2 d-1",
  });
  const values = new Float32Array(days * ZARR_TIME.hoursPerDay).fill(1.5);
  mutate?.(values);

  return {
    prov,
    text: buildSeriesCsv(buildSeriesRows(values, prov), prov),
  };
}

describe("buildSeriesCsv", () => {
  it("keeps provenance in comment lines above the column header", () => {
    const { text } = csvForDays(2);
    const lines = text.split("\n");
    const headerIndex = lines.indexOf(CSV_COLUMNS);

    expect(headerIndex).toBeGreaterThan(0);
    expect(lines.slice(0, headerIndex).every((l) => l.startsWith("# "))).toBe(
      true,
    );
  });

  it("records the pixel and window a reader would need to reproduce it", () => {
    const { text, prov } = csvForDays(2);

    expect(text).toContain(`# cell_lat: ${SELECTION.grid.lat}`);
    expect(text).toContain(`# cell_lon: ${SELECTION.grid.lon}`);
    expect(text).toContain(`# lat_index: ${SELECTION.grid.latIndex}`);
    expect(text).toContain(`# units: gC m-2 d-1`);
    expect(text).toContain(
      `# window_start: ${prov.windowStart.toISOString().slice(0, 10)}`,
    );
  });

  it("writes one data line per hour, plus a trailing newline", () => {
    const days = 3;
    const { text } = csvForDays(days);
    const lines = text.split("\n");
    const dataLines = lines.slice(lines.indexOf(CSV_COLUMNS) + 1, -1);

    expect(text.endsWith("\n")).toBe(true);
    expect(dataLines).toHaveLength(days * ZARR_TIME.hoursPerDay);
    expect(text).toContain(`# rows: ${days * ZARR_TIME.hoursPerDay}`);
  });

  it("writes missing values as an empty field", () => {
    const { text } = csvForDays(1, (values) => {
      values[3] = Number.NaN;
    });
    const dataLines = text.split("\n").slice(-25, -1);

    expect(dataLines[3].endsWith(",")).toBe(true);
    expect(dataLines[3].split(",")).toHaveLength(4);
  });

  it("says unspecified rather than null when units are absent", () => {
    const prov = buildProvenance({
      selection: SELECTION,
      historyYears: 1,
      valueCount: ZARR_TIME.hoursPerDay,
    });

    expect(buildSeriesCsv([], prov)).toContain("# units: unspecified");
  });
});

describe("exportFileBaseName", () => {
  it("names files by variable, hemisphere-tagged cell, and window", () => {
    const { prov } = csvForDays(2);

    expect(exportFileBaseName(prov)).toMatch(
      /^earthprints_NEE_50\.925N_11\.575E_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("tags southern and western coordinates without a minus sign", () => {
    const prov = buildProvenance({
      selection: {
        click: { lon: -60.1, lat: -3.2 },
        grid: { lon: -60.125, lat: -3.225, lonIndex: 2397, latIndex: 1864 },
      },
      historyYears: 1,
      valueCount: ZARR_TIME.hoursPerDay,
    });

    expect(exportFileBaseName(prov)).toContain("3.225S_60.125W");
  });
});
