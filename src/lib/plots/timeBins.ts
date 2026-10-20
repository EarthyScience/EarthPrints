import { dayIndexToUTCDate } from "@/lib/zarr/timeRange";

export type BinUnit = "day" | "week" | "month" | "year";

export const WEEKS_PER_YEAR = 52;

const MS_PER_DAY = 86_400_000;
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type TimeBin = {
  year: number;
  /** Day of year, week (0 to 51) or month (0 to 11); 0 for a whole year. */
  index: number;
  /** First and last selected day in the bin, as positions in the series. */
  startLocal: number;
  endLocal: number;
  /** The same two days as absolute day indices. */
  firstDay: number;
  lastDay: number;
};

function binKey(absoluteDay: number, unit: BinUnit) {
  const date = dayIndexToUTCDate(absoluteDay);
  const year = date.getUTCFullYear();
  if (unit === "year") return { year, index: 0 };
  if (unit === "month") return { year, index: date.getUTCMonth() };
  const dayOfYear = Math.round(
    (date.getTime() - Date.UTC(year, 0, 1)) / MS_PER_DAY,
  );
  if (unit === "day") return { year, index: dayOfYear };
  // The last week also takes day 365 (and 366 in leap years).
  return {
    year,
    index: Math.min(WEEKS_PER_YEAR - 1, Math.floor(dayOfYear / 7)),
  };
}

/** Group consecutive selected days into calendar bins. */
export function timeBins(absoluteDays: readonly number[], unit: BinUnit) {
  const bins: TimeBin[] = [];
  absoluteDays.forEach((absoluteDay, local) => {
    const { year, index } = binKey(absoluteDay, unit);
    const last = bins.at(-1);
    if (last && last.year === year && last.index === index) {
      last.endLocal = local;
      last.lastDay = absoluteDay;
    } else {
      bins.push({
        year,
        index,
        startLocal: local,
        endLocal: local,
        firstDay: absoluteDay,
        lastDay: absoluteDay,
      });
    }
  });
  return bins;
}

export type BinStats = {
  mean: Float32Array;
  std: Float32Array;
  count: Uint32Array;
};

class Accumulator {
  sum = 0;
  sumSq = 0;
  count = 0;

  add(value: number | undefined) {
    if (value === undefined || !Number.isFinite(value)) return;
    this.sum += value;
    this.sumSq += value * value;
    this.count++;
  }

  write(stats: BinStats, at: number) {
    stats.count[at] = this.count;
    if (this.count === 0) {
      stats.mean[at] = NaN;
      stats.std[at] = NaN;
      return;
    }
    const mean = this.sum / this.count;
    stats.mean[at] = mean;
    // Population std; clamped because rounding can leave a tiny negative.
    stats.std[at] = Math.sqrt(Math.max(0, this.sumSq / this.count - mean * mean));
  }
}

function emptyStats(length: number): BinStats {
  return {
    mean: new Float32Array(length),
    std: new Float32Array(length),
    count: new Uint32Array(length),
  };
}

/**
 * One value per bin and hour of day, laid out bin by bin. The std and count
 * describe how that hour varies across the days in the bin.
 */
export function binHourGrid(
  values: ArrayLike<number>,
  hoursPerDay: number,
  bins: readonly TimeBin[],
): BinStats {
  const stats = emptyStats(bins.length * hoursPerDay);
  bins.forEach((bin, b) => {
    for (let hour = 0; hour < hoursPerDay; hour++) {
      const acc = new Accumulator();
      for (let day = bin.startLocal; day <= bin.endLocal; day++) {
        acc.add(values[day * hoursPerDay + hour]);
      }
      acc.write(stats, b * hoursPerDay + hour);
    }
  });
  return stats;
}

/**
 * One value per bin for a line. A day's spread is across its hours; a week's
 * or month's is across its daily means, so the band shows how much days vary
 * rather than the day and night swing.
 */
export function binLineStats(
  values: ArrayLike<number>,
  hoursPerDay: number,
  bins: readonly TimeBin[],
  unit: BinUnit,
): BinStats {
  const stats = emptyStats(bins.length);
  const dayMean = (day: number) => {
    const acc = new Accumulator();
    for (let hour = 0; hour < hoursPerDay; hour++) {
      acc.add(values[day * hoursPerDay + hour]);
    }
    return acc.count > 0 ? acc.sum / acc.count : NaN;
  };

  bins.forEach((bin, b) => {
    const acc = new Accumulator();
    for (let day = bin.startLocal; day <= bin.endLocal; day++) {
      if (unit === "day") {
        for (let hour = 0; hour < hoursPerDay; hour++) {
          acc.add(values[day * hoursPerDay + hour]);
        }
      } else {
        acc.add(dayMean(day));
      }
    }
    acc.write(stats, b);
  });
  return stats;
}

function shortDate(absoluteDay: number) {
  const date = dayIndexToUTCDate(absoluteDay);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

/** Readout label for a bin, such as "19 to 25 Mar 2019" for a week. */
export function formatBinLabel(bin: TimeBin, unit: BinUnit): string {
  if (unit === "year") return String(bin.year);
  if (unit === "month") return `${SHORT_MONTHS[bin.index]} ${bin.year}`;
  if (unit === "day") return dayIndexToUTCDate(bin.firstDay).toISOString().slice(0, 10);
  const first = dayIndexToUTCDate(bin.firstDay);
  const last = dayIndexToUTCDate(bin.lastDay);
  const range =
    first.getUTCMonth() === last.getUTCMonth()
      ? `${first.getUTCDate()} to ${shortDate(bin.lastDay)}`
      : `${shortDate(bin.firstDay)} to ${shortDate(bin.lastDay)}`;
  return `${range} ${bin.year}`;
}

/** Compact label for the short "vs ..." comparison line. */
export function formatBinShortLabel(bin: TimeBin, unit: BinUnit): string {
  if (unit === "week") return `week of ${shortDate(bin.firstDay)}`;
  return formatBinLabel(bin, unit);
}

/** First day of every month, thinned to at most `count` ticks. */
export function monthStartTicks(
  absoluteDays: readonly number[],
  count = 6,
): number[] {
  const starts = timeBins(absoluteDays, "month").map((bin) => bin.startLocal);
  const step = Math.max(1, Math.ceil(starts.length / count));
  return starts.filter((_, i) => i % step === 0);
}

export function binCountLabel(count: number, unit: BinUnit): string {
  const plural = (n: number, word: string) =>
    `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
  if (unit === "year") return plural(count, "year");
  if (unit === "month") return plural(count, "month");
  if (unit === "week") return plural(count, "week");
  return plural(count, "day");
}
