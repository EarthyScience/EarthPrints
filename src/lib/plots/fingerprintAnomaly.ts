import {
  type BinStats,
  type BinUnit,
  emptyStats,
  type TimeBin,
  WEEKS_PER_YEAR,
} from "@/lib/plots/timeBins";

export type TypicalStat = "mean" | "median" | "spread";

export type FingerprintView =
  | { kind: "values" }
  | { kind: "typical"; stat: TypicalStat }
  | { kind: "difference" };

export const VALUES_VIEW: FingerprintView = { kind: "values" };

/** Positions in the year: day of year, week or month; one for a whole year. */
export const POSITIONS: Record<BinUnit, number> = {
  day: 366,
  week: WEEKS_PER_YEAR,
  month: 12,
  year: 1,
};

/**
 * The same position and hour across the selected years: mean, median and
 * sample std of the bin means, laid out position by position. `count` is the
 * number of years with data.
 */
export type TypicalYear = {
  positions: number;
  mean: Float32Array;
  median: Float32Array;
  std: Float32Array;
  count: Uint32Array;
};

export function typicalYear(
  binned: BinStats,
  bins: readonly TimeBin[],
  hoursPerDay: number,
  unit: BinUnit,
): TypicalYear {
  const positions = POSITIONS[unit];
  const size = positions * hoursPerDay;
  const samples: number[][] = Array.from({ length: size }, () => []);
  bins.forEach((bin, b) => {
    for (let hour = 0; hour < hoursPerDay; hour++) {
      const value = binned.mean[b * hoursPerDay + hour]!;
      if (Number.isFinite(value)) samples[bin.index * hoursPerDay + hour]!.push(value);
    }
  });

  const typical: TypicalYear = {
    positions,
    mean: new Float32Array(size).fill(NaN),
    median: new Float32Array(size).fill(NaN),
    std: new Float32Array(size).fill(NaN),
    count: new Uint32Array(size),
  };
  samples.forEach((values, at) => {
    const n = values.length;
    typical.count[at] = n;
    if (n === 0) return;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    typical.mean[at] = mean;
    values.sort((a, b) => a - b);
    const mid = n >> 1;
    typical.median[at] = n % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
    if (n > 1) {
      const ss = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
      typical.std[at] = Math.sqrt(ss / (n - 1));
    }
  });
  return typical;
}

/** The typical year as bin stats, in the statistic asked for. */
export function typicalStats(typical: TypicalYear, stat: TypicalStat): BinStats {
  const stats = emptyStats(typical.mean.length);
  stats.mean.set(
    stat === "mean" ? typical.mean : stat === "median" ? typical.median : typical.std,
  );
  stats.std.set(typical.std);
  stats.count.set(typical.count);
  return stats;
}

/**
 * Each bin minus the typical mean of its position and hour. The std and count
 * still describe the days inside the bin. `reference` holds the typical value
 * each cell was compared with.
 */
export function differenceFromTypical(
  binned: BinStats,
  bins: readonly TimeBin[],
  hoursPerDay: number,
  typical: TypicalYear,
): { stats: BinStats; reference: Float32Array } {
  const stats = emptyStats(binned.mean.length);
  stats.std.set(binned.std);
  stats.count.set(binned.count);
  const reference = new Float32Array(binned.mean.length);
  bins.forEach((bin, b) => {
    for (let hour = 0; hour < hoursPerDay; hour++) {
      const at = b * hoursPerDay + hour;
      const ref = typical.mean[bin.index * hoursPerDay + hour]!;
      reference[at] = ref;
      stats.mean[at] = binned.mean[at]! - ref;
    }
  });
  return { stats, reference };
}

/**
 * Yearly columns built from monthly differences. A raw yearly mean of a part
 * year leans towards the season it covers; month differences do not.
 */
export function yearlyDifference(
  monthly: { stats: BinStats; reference: Float32Array },
  monthBins: readonly TimeBin[],
  yearBins: readonly TimeBin[],
  hoursPerDay: number,
): { stats: BinStats; reference: Float32Array } {
  const stats = emptyStats(yearBins.length * hoursPerDay);
  const reference = new Float32Array(stats.mean.length);
  yearBins.forEach((bin, y) => {
    const months = monthBins.flatMap((month, m) => (month.year === bin.year ? [m] : []));
    for (let hour = 0; hour < hoursPerDay; hour++) {
      let sum = 0;
      let ref = 0;
      let sumSq = 0;
      let count = 0;
      for (const m of months) {
        const value = monthly.stats.mean[m * hoursPerDay + hour]!;
        if (!Number.isFinite(value)) continue;
        sum += value;
        sumSq += value * value;
        ref += monthly.reference[m * hoursPerDay + hour]!;
        count++;
      }
      const at = y * hoursPerDay + hour;
      stats.count[at] = count;
      stats.mean[at] = count ? sum / count : NaN;
      stats.std[at] = count ? Math.sqrt(Math.max(0, sumSq / count - (sum / count) ** 2)) : NaN;
      reference[at] = count ? ref / count : NaN;
    }
  });
  return { stats, reference };
}

export type UnusualYear = {
  year: number;
  /** Root mean square of the year's differences, in the data's units. */
  rms: number;
};

/** A year enters the ranking with data in at least this many months. */
export const MIN_RANKED_MONTHS = 9;

/**
 * Years ordered by the size of their monthly differences from the typical
 * year, either sign. Raw units rather than z scores: dividing by each cell's
 * spread lets quiet cells (winter, night) with tiny anomalies decide the
 * ranking. Years with too few months are returned separately.
 */
export function unusualYears(
  monthly: BinStats,
  monthBins: readonly TimeBin[],
  hoursPerDay: number,
): { ranked: UnusualYear[]; partial: number[] } {
  const byYear = new Map<number, { sum: number; count: number; months: number }>();
  monthBins.forEach((bin, b) => {
    const acc = byYear.get(bin.year) ?? { sum: 0, count: 0, months: 0 };
    let any = false;
    for (let hour = 0; hour < hoursPerDay; hour++) {
      const value = monthly.mean[b * hoursPerDay + hour]!;
      if (!Number.isFinite(value)) continue;
      acc.sum += value * value;
      acc.count++;
      any = true;
    }
    if (any) acc.months++;
    byYear.set(bin.year, acc);
  });
  const entries = [...byYear];
  return {
    ranked: entries
      .filter(([, acc]) => acc.months >= MIN_RANKED_MONTHS)
      .map(([year, acc]) => ({ year, rms: Math.sqrt(acc.sum / acc.count) }))
      .sort((a, b) => b.rms - a.rms),
    partial: entries
      .filter(([, acc]) => acc.months < MIN_RANKED_MONTHS)
      .map(([year]) => year),
  };
}
