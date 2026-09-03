import { isoDate, type ExportProvenance } from "./provenance";
import type { SeriesRow } from "./rows";

export const CSV_COLUMNS = "timestamp_utc,day_index,hour,value";

/**
 * Provenance rides along as `#` comment lines. A file of bare numbers is
 * useless six months later, and every common reader skips these:
 * `pandas.read_csv(path, comment="#")`, `readr::read_csv(comment = "#")`.
 */
function buildHeader(rowCount: number, prov: ExportProvenance): string[] {
  return [
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
    `history_years: ${prov.historyYears}`,
    `window_start: ${isoDate(prov.windowStart)}`,
    `window_end: ${isoDate(prov.windowEnd)}`,
    `rows: ${rowCount}`,
  ].map((line) => `# ${line}`);
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
      `${row.timestamp.toISOString()},${row.dayIndex},${row.hour},${
        row.value ?? ""
      }`,
    );
  }

  return `${lines.join("\n")}\n`;
}
