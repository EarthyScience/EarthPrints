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

export const ALL_AVAILABLE_YEARS = Array.from(
  { length: 2021 - 2001 + 1 },
  (_, index) => 2001 + index,
);

/** Convert a calendar year into an absolute `[startDay, stopDay)` slice. */
export function yearToDateRange(
  year: number,
  totalDays: number = ZARR_TIME.totalDays,
): AxisSlice {
  const start = Math.max(
    0,
    Math.round((Date.UTC(year, 0, 1) - ZARR_TIME_ORIGIN_UTC) / MS_PER_DAY),
  );
  const stop = Math.min(
    totalDays,
    Math.round((Date.UTC(year + 1, 0, 1) - ZARR_TIME_ORIGIN_UTC) / MS_PER_DAY),
  );
  return [start, stop];
}

/** Get the native temporal chunk index (0..N) containing the given year. */
export function yearToTimeChunkIndex(
  year: number,
  chunkTime = 1461,
): number {
  const [start] = yearToDateRange(year);
  return Math.floor(start / chunkTime);
}

/** Get all available calendar years that fall into a specific time chunk index. */
export function timeChunkIndexToYears(
  chunkIdx: number,
  chunkTime = 1461,
): number[] {
  return ALL_AVAILABLE_YEARS.filter(
    (year) => yearToTimeChunkIndex(year, chunkTime) === chunkIdx,
  );
}

export function chunkIndexToStartDay(chunkIdx: number, chunkTime: number): number {
  return chunkIdx * chunkTime;
}

/** Split an array of years into sorted contiguous blocks, e.g. [2002, 2003, 2005] -> [[2002, 2003], [2005]] */
export function yearsToContiguousBlocks(years: number[]): number[][] {
  if (years.length === 0) return [];
  const sorted = Array.from(new Set(years)).sort((a, b) => a - b);
  const blocks: number[][] = [];
  let currentBlock: number[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (curr === prev + 1) {
      currentBlock.push(curr);
    } else {
      blocks.push(currentBlock);
      currentBlock = [curr];
    }
  }
  blocks.push(currentBlock);
  return blocks;
}

/** Convert a set or array of years into an encompassing [startDay, stopDay) slice. */
export function yearsToDateRange(
  years: number[],
  totalDays: number = ZARR_TIME.totalDays,
): AxisSlice {
  if (years.length === 0) return [0, 0];
  const sorted = Array.from(new Set(years)).sort((a, b) => a - b);
  const minYear = sorted[0]!;
  const maxYear = sorted[sorted.length - 1]!;
  const start = yearToDateRange(minYear, totalDays)[0];
  const stop = yearToDateRange(maxYear, totalDays)[1];
  return [start, stop];
}

/** Format selected years for UI labels and filenames (e.g. '2018–2021' or '2005, 2018–2020') */
export function formatSelectedYearsLabel(years: number[]): string {
  if (years.length === 0) return "";
  const blocks = yearsToContiguousBlocks(years);
  return blocks
    .map((block) => {
      if (block.length === 1) return `${block[0]}`;
      return `${block[0]}–${block[block.length - 1]}`;
    })
    .join(", ");
}

export type YearInterval = {
  year: number;
  startDayLocal: number;
  endDayLocal: number;
  dayCount: number;
};

export type YearDayMapping = {
  absoluteDays: number[];
  yearIntervals: YearInterval[];
};

/**
 * Builds an exact local-to-absolute day index map and year interval list for any
 * combination of selected years (single, contiguous, or non-contiguous).
 */
export function getSelectedYearsDayMapping(
  years?: number[] | null,
  totalDays: number = ZARR_TIME.totalDays,
  fallbackDaysCount?: number,
): YearDayMapping {
  if (!years || years.length === 0) {
    const count = fallbackDaysCount ?? 365;
    const baseDay = Math.max(0, totalDays - count);
    const absoluteDays = Array.from({ length: count }, (_, i) => baseDay + i);
    const startYear = dayIndexToUTCDate(baseDay).getUTCFullYear();
    return {
      absoluteDays,
      yearIntervals: [
        {
          year: startYear,
          startDayLocal: 0,
          endDayLocal: count - 1,
          dayCount: count,
        },
      ],
    };
  }

  const sortedYears = Array.from(new Set(years)).sort((a, b) => a - b);
  const absoluteDays: number[] = [];
  const yearIntervals: YearInterval[] = [];

  let currentOffset = 0;
  for (const yr of sortedYears) {
    const [start, stop] = yearToDateRange(yr, totalDays);
    const count = stop - start;
    for (let d = start; d < stop; d++) {
      absoluteDays.push(d);
    }
    yearIntervals.push({
      year: yr,
      startDayLocal: currentOffset,
      endDayLocal: currentOffset + count - 1,
      dayCount: count,
    });
    currentOffset += count;
  }

  return { absoluteDays, yearIntervals };
}


