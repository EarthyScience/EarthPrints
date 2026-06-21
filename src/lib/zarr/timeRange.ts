import { ZARR_STORE } from "@/lib/constants/store";
import type { AxisSlice } from "@/lib/zarr/chunks";

export const DEFAULT_HISTORY_YEARS = 1;

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
