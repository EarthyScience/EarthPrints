import { formatIsoDate } from "@/lib/map/fingerprintScale";
import { fingerprintGrid } from "@/lib/plots/fingerprint";
import type { BinStats } from "@/lib/plots/timeBins";
import type { ExportProvenance } from "./provenance";

export type MarginRow = {
  /** Hour of day on the plot's clock, or the date of the column. */
  key: number | string;
  mean: number | null;
  std: number | null;
  /** Days behind an hour's value, or hours behind a day's. */
  count: number;
};

export type MarginTables = {
  dailyCycle: MarginRow[];
  seasonalCourse: MarginRow[];
};

function finite(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value)
    ? Number(value.toPrecision(7))
    : null;
}

function rowsOf(stats: BinStats, keyOf: (i: number) => number | string) {
  return Array.from(stats.mean, (_, i) => ({
    key: keyOf(i),
    mean: finite(stats.mean[i]),
    std: finite(stats.std[i]),
    count: stats.count[i] ?? 0,
  }));
}

/**
 * The fingerprint's strips as tables. `values` is the series as plotted, so
 * on the local clock when that is the plot's time basis.
 */
export function buildMarginTables(
  values: Float32Array,
  prov: ExportProvenance,
): MarginTables {
  const grid = fingerprintGrid(values, prov.hoursPerDay, prov.selectedYears);
  return {
    dailyCycle: rowsOf(grid.margins.byHour, (hour) => hour),
    seasonalCourse: rowsOf(grid.margins.byColumn, (col) =>
      formatIsoDate(grid.bins[col]!.firstDay),
    ),
  };
}

export function marginColumns(prov: ExportProvenance) {
  const clock = prov.timeBasis === "utc" ? "utc" : "local";
  return {
    dailyCycle: [`hour_${clock}`, "mean", "std", "days"],
    seasonalCourse: [`date_${clock}`, "mean", "std", "hours"],
  };
}
