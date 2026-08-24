import { ZARR_STORE } from "@/lib/constants/store";
import type { AxisSlice } from "@/lib/zarr/chunks";

export const DEFAULT_HISTORY_YEARS = 1;

/**
 * Calendar origin of the time axis, mirroring the store's time coordinate
 * (`units: "days since 2001-01-01"`). Kept as a constant alongside the other
 * hardcoded time facts; a day index maps to `origin + index days`.
 */
export const ZARR_TIME_ORIGIN_UTC = Date.UTC(2001, 0, 1);

const MS_PER_DAY = 86_400_000;

/** Absolute day index (0 = origin) to its UTC calendar date. */
export function dayIndexToUTCDate(absoluteDay: number): Date {
  return new Date(ZARR_TIME_ORIGIN_UTC + absoluteDay * MS_PER_DAY);
}

export const ZARR_TIME = {
  totalDays: ZARR_STORE.dimensions.time,
  hoursPerDay: ZARR_STORE.dimensions.hour,
  defaultHistoryYears: DEFAULT_HISTORY_YEARS,
  /** Whole years covered by the archive (~21 for FLUXCOM-X NEE). */
  maxHistoryYears: Math.ceil(ZARR_STORE.dimensions.time / 365.25),
} as const;

/** Map a "last N years" control value to a half-open day slice `[start, stop)`. */
export function yearsToDayRange(
  years: number,
  totalDays?: number,
): AxisSlice {
  const stop = totalDays ?? ZARR_TIME.totalDays;

  if (years >= ZARR_TIME.maxHistoryYears) {
    return [0, stop];
  }

  const start = Math.max(0, stop - Math.round(years * 365));
  return [start, stop];
}

export function chunkIndexToStartDay(chunkIdx: number, chunkTime: number): number {
  return chunkIdx * chunkTime;
}
