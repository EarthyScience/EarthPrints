import { formatUtcOffset } from "@/lib/zarr/localTime";
import { isoDate, type ExportProvenance } from "./provenance";
import type { SeriesRow } from "./rows";

export const CSV_COLUMNS =
  "timestamp_utc,timestamp_local,year,date,date_local,hour,hour_local,day_index,value";

/**
 * Provenance rides along as `#` comment lines. A file of bare numbers is
 * useless six months later, and every common reader skips these:
 * `pandas.read_csv(path, comment="#")`, `readr::read_csv(comment = "#")`.
 */
function buildHeader(rowCount: number, prov: ExportProvenance): string[] {
  const lines = [
    "EarthPrints export",
    `generated: ${prov.generatedAt.toISOString()}`,
    `dataset: ${prov.dataset}`,
    `grid: ${prov.resolutionDeg} deg, hourly`,
    `source: ${prov.sourceUrl}`,
    `variable: ${prov.variable}`,
    `units: ${prov.units ?? "unspecified"}`,
    `click_lat: ${prov.click.lat}`,
    `click_lon: ${prov.click.lon}`,
    `cell_lat: ${prov.cell.lat}`,
    `cell_lon: ${prov.cell.lon}`,
    `lat_index: ${prov.cell.latIndex}`,
    `lon_index: ${prov.cell.lonIndex}`,
    // The store's hour axis is UTC. The local columns are that axis moved by the
    // cell's nominal solar offset, so a reader can pick either without guessing.
    `local_time: mean solar time, ${formatUtcOffset(prov.utcOffsetHours)}`,
    `utc_offset_hours: ${prov.utcOffsetHours}`,
    `plot_time_basis: ${prov.timeBasis}`,
    `history_years: ${prov.historyYears}`,
    ...(prov.selectedYears && prov.selectedYears.length > 0
      ? [`selected_years: ${prov.selectedYears.join(", ")}`]
      : prov.selectedYear
        ? [`selected_year: ${prov.selectedYear}`]
        : []),
    `window_start: ${isoDate(prov.windowStart)}`,
    `window_end: ${isoDate(prov.windowEnd)}`,
    `rows: ${rowCount}`,
  ];
  return lines.map((line) => `# ${line}`);
}

/**
 * Serialise the hourly series. Every column is numeric or an ISO timestamp, so
 * no field can contain a comma or quote and no escaping is required.
 * Missing values are written empty, which reads back as NaN.
 */
export function buildSeriesCsv(
  rows: SeriesRow[],
  prov: ExportProvenance,
): string {
  const lines = buildHeader(rows.length, prov);
  lines.push(CSV_COLUMNS);

  for (const row of rows) {
    lines.push(
      [
        row.timestamp.toISOString(),
        // No trailing Z: this one is a wall clock, not an instant in UTC.
        row.timestampLocal.toISOString().slice(0, 19),
        row.year,
        row.date,
        row.dateLocal,
        row.hour,
        row.hourLocal,
        row.dayIndex,
        row.value ?? "",
      ].join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}
