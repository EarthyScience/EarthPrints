import { ZARR_STORE } from "@/lib/constants/store";
import type { AxisSlice } from "@/lib/zarr/chunks";
import { utcMs } from "@/lib/zarr/utc";

export const DEFAULT_HISTORY_YEARS = 1;

/**
 * Calendar origin of the FLUXCOM-X time axis (`units: "days since
 * 2001-01-01"`), and the default until another store is opened.
 */
export const ZARR_TIME_ORIGIN_UTC = utcMs(2001, 0, 1);

const MS_PER_DAY = 86_400_000;

/** The time facts of the open store, as day indices from its origin. */
export type ActiveTime = {
  originMs: number;
  totalDays: number;
  /** Values per day; "hours" for FLUXCOM-X, 4 for a 6-hourly store. */
  slotsPerDay: number;
  years: number[];
};

function yearsOf(originMs: number, totalDays: number): number[] {
  const first = new Date(originMs).getUTCFullYear();
  const last = new Date(originMs + (totalDays - 1) * MS_PER_DAY).getUTCFullYear();
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

const FLUXCOM_TIME: ActiveTime = {
  originMs: ZARR_TIME_ORIGIN_UTC,
  totalDays: ZARR_STORE.dimensions.time,
  slotsPerDay: ZARR_STORE.dimensions.hour,
  years: yearsOf(ZARR_TIME_ORIGIN_UTC, ZARR_STORE.dimensions.time),
};

// One store is open at a time, and every day index in the app is relative to
// its origin. Module state rather than a prop, because the helpers below are
// called from plots, exports and tooltips alike.
let active: ActiveTime = FLUXCOM_TIME;

export function setActiveTime(time: Omit<ActiveTime, "years"> | null): void {
  active = time
    ? { ...time, years: yearsOf(time.originMs, time.totalDays) }
    : FLUXCOM_TIME;
}

export function activeTime(): ActiveTime {
  return active;
}

/** Calendar years the open store has data for. */
export function availableYears(): number[] {
  return active.years;
}

/** Absolute day index (0 = origin) to its UTC calendar date. */
export function dayIndexToUTCDate(absoluteDay: number): Date {
  return new Date(active.originMs + absoluteDay * MS_PER_DAY);
}

export const ZARR_TIME = {
  get totalDays() {
    return active.totalDays;
  },
  /** Values per day. Hours for hourly data, but 4 for 6-hourly, 1 for daily. */
  get hoursPerDay() {
    return active.slotsPerDay;
  },
  defaultHistoryYears: DEFAULT_HISTORY_YEARS,
  /** Whole years covered by the archive (~21 for FLUXCOM-X NEE). */
  get maxHistoryYears() {
    return Math.ceil(active.totalDays / 365.25);
  },
};

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

/** Convert a calendar year into an absolute `[startDay, stopDay)` slice. */
export function yearToDateRange(
  year: number,
  totalDays: number = ZARR_TIME.totalDays,
): AxisSlice {
  const start = Math.max(
    0,
    Math.round((utcMs(year, 0, 1) - active.originMs) / MS_PER_DAY),
  );
  const stop = Math.min(
    totalDays,
    Math.round((utcMs(year + 1, 0, 1) - active.originMs) / MS_PER_DAY),
  );
  return [start, stop];
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


