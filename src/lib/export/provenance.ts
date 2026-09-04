import { ZARR_STORE } from "@/lib/constants/store";
import { ZARR_TIME, dayIndexToUTCDate, yearToDateRange } from "@/lib/zarr/timeRange";
import type { GeoPoint, GridCell, MapSelection } from "@/types/map";

/**
 * Everything an export needs to describe where its numbers came from. Built
 * once per export and shared by the PDF and XLSX writers so the two can never
 * disagree about the pixel, the window or the units.
 */
export type ExportProvenance = {
  generatedAt: Date;
  dataset: string;
  sourceUrl: string;
  variable: string;
  units: string | null;
  resolutionDeg: number;
  click: GeoPoint;
  cell: GridCell;
  historyYears: number;
  selectedYear: number | null;
  hoursPerDay: number;
  /** Days covered by the loaded window. */
  dayCount: number;
  /** Absolute day index (0 = archive origin) of the window's first day. */
  baseDay: number;
  windowStart: Date;
  /** Last day of the window, inclusive. */
  windowEnd: Date;
};

type BuildInput = {
  selection: MapSelection;
  historyYears?: number;
  selectedYear?: number | null;
  /** Length of the loaded `Float32Array`, i.e. days x hours. */
  valueCount: number;
  units?: string | null;
  variable?: string;
  hoursPerDay?: number;
  totalDays?: number;
  generatedAt?: Date;
};

export function buildProvenance({
  selection,
  historyYears = 1,
  selectedYear = null,
  valueCount,
  units = null,
  variable = ZARR_STORE.defaultVariable,
  hoursPerDay = ZARR_TIME.hoursPerDay,
  totalDays = ZARR_TIME.totalDays,
  generatedAt = new Date(),
}: BuildInput): ExportProvenance {
  const dayCount = Math.floor(valueCount / hoursPerDay);

  // If a specific calendar year is selected, the window starts at the first day
  // of that year. Otherwise, it defaults to the trailing end of the archive.
  const baseDay = selectedYear
    ? yearToDateRange(selectedYear, totalDays)[0]
    : totalDays - dayCount;

  return {
    generatedAt,
    dataset: ZARR_STORE.kicker,
    sourceUrl: ZARR_STORE.url,
    variable,
    units,
    resolutionDeg: ZARR_STORE.spatialResolutionDeg,
    click: selection.click,
    cell: selection.grid,
    historyYears,
    selectedYear,
    hoursPerDay,
    dayCount,
    baseDay,
    windowStart: dayIndexToUTCDate(baseDay),
    windowEnd: dayIndexToUTCDate(baseDay + Math.max(0, dayCount - 1)),
  };
}

/** `2025-01-01`, the date half of an ISO timestamp. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function coordinateTag(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(3)}${value >= 0 ? positive : negative}`;
}

/**
 * Shared stem for every download, so a PDF and its workbook sort next to each
 * other:
 * `earthprints_NEE_50.913N_11.567E_2025-01-01_2025-12-31`.
 */
export function exportFileBaseName(prov: ExportProvenance): string {
  return [
    "earthprints",
    prov.variable,
    coordinateTag(prov.cell.lat, "N", "S"),
    coordinateTag(prov.cell.lon, "E", "W"),
    isoDate(prov.windowStart),
    isoDate(prov.windowEnd),
  ].join("_");
}
