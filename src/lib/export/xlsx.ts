import type { SheetData } from "write-excel-file/browser";
import { formatUtcOffset } from "@/lib/zarr/localTime";
import { isoDate, type ExportProvenance } from "./provenance";
import type { SeriesRow } from "./rows";

export const XLSX_DATA_SHEET = "data";
export const XLSX_METADATA_SHEET = "metadata";

const BOLD = { fontWeight: "bold" } as const;

/**
 * Shape the two sheets. Split out from the writer so the layout can be tested
 * without pulling the xlsx bundle into the test run.
 *
 * The workbook earns its place over a plain CSV precisely here: provenance sits
 * on its own sheet rather than in `#` comment lines, and timestamps are real
 * date cells rather than text that Excel re-parses by locale.
 */
export function buildWorkbookSheets(
  rows: SeriesRow[],
  prov: ExportProvenance,
): { data: SheetData; metadata: SheetData } {
  const data: SheetData = [
    [
      { value: "timestamp_utc", ...BOLD },
      { value: "timestamp_local", ...BOLD },
      { value: "year", ...BOLD },
      { value: "date", ...BOLD },
      { value: "date_local", ...BOLD },
      { value: "hour", ...BOLD },
      { value: "hour_local", ...BOLD },
      { value: "day_index", ...BOLD },
      { value: `value (${prov.units ?? "unspecified"})`, ...BOLD },
    ],
    ...rows.map((row) => [
      { value: row.timestamp, type: Date },
      { value: row.timestampLocal, type: Date },
      row.year,
      row.date,
      row.dateLocal,
      row.hour,
      row.hourLocal,
      row.dayIndex,
      row.value,
    ]),
  ];

  const facts: [string, string | number][] = [
    ["generated (UTC)", prov.generatedAt.toISOString()],
    ["dataset", prov.dataset],
    ["grid", `${prov.resolutionDeg} deg, hourly`],
    ["source", prov.sourceUrl],
    ["variable", prov.variable],
    ["units", prov.units ?? "unspecified"],
    ["click_lat", prov.click.lat],
    ["click_lon", prov.click.lon],
    ["cell_lat", prov.cell.lat],
    ["cell_lon", prov.cell.lon],
    ["lat_index", prov.cell.latIndex],
    ["lon_index", prov.cell.lonIndex],
    ["local_time", `mean solar time, ${formatUtcOffset(prov.utcOffsetHours)}`],
    ["utc_offset_hours", prov.utcOffsetHours],
    ["plot_time_basis", prov.timeBasis],
    ["history_years", prov.historyYears],
    ...(prov.selectedYears && prov.selectedYears.length > 0
      ? [["selected_years", prov.selectedYears.join(", ")] as [string, string]]
      : prov.selectedYear
        ? [["selected_year", prov.selectedYear] as [string, number]]
        : []),
    ["window_start", isoDate(prov.windowStart)],
    ["window_end", isoDate(prov.windowEnd)],
    ["rows", rows.length],
  ];

  const metadata: SheetData = [
    [
      { value: "field", ...BOLD },
      { value: "value", ...BOLD },
    ],
    ...facts.map(([field, value]) => [field, value]),
  ];

  return { data, metadata };
}

/** Build the workbook. Imports the xlsx writer lazily, so it stays off the map route's first load. */
export async function buildSeriesWorkbook(
  rows: SeriesRow[],
  prov: ExportProvenance,
): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const { data, metadata } = buildWorkbookSheets(rows, prov);

  const result = await writeXlsxFile([
    {
      data,
      sheet: XLSX_DATA_SHEET,
      dateFormat: "yyyy-mm-dd hh:mm:ss",
      columns: [
        { width: 22 },
        { width: 22 },
        { width: 8 },
        { width: 14 },
        { width: 14 },
        { width: 8 },
        { width: 12 },
        { width: 12 },
        { width: 16 },
      ],
    },
    {
      data: metadata,
      sheet: XLSX_METADATA_SHEET,
      columns: [{ width: 18 }, { width: 64 }],
    },
  ]);

  return result.toBlob();
}
