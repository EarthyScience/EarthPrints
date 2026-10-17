import {
  type BinStats,
  emptyStats,
  RunningStats,
} from "@/lib/plots/timeBins";

export type FingerprintMargins = {
  /** One entry per column, over its hours: the seasonal course. */
  byColumn: BinStats;
  /** One entry per hour, over the columns: the mean daily cycle. */
  byHour: BinStats;
};

/** Mean and std along each axis of the cells as drawn. */
export function fingerprintMargins(
  cells: ArrayLike<number>,
  nCols: number,
  hoursPerDay: number,
): FingerprintMargins {
  const byColumn = emptyStats(nCols);
  for (let col = 0; col < nCols; col++) {
    const acc = new RunningStats();
    for (let hour = 0; hour < hoursPerDay; hour++) {
      acc.add(cells[col * hoursPerDay + hour]);
    }
    acc.write(byColumn, col);
  }

  const byHour = emptyStats(hoursPerDay);
  for (let hour = 0; hour < hoursPerDay; hour++) {
    const acc = new RunningStats();
    for (let col = 0; col < nCols; col++) {
      acc.add(cells[col * hoursPerDay + hour]);
    }
    acc.write(byHour, hour);
  }

  return { byColumn, byHour };
}

/** Range covering mean ± std, widened to include zero. */
export function bandRange(stats: BinStats): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < stats.mean.length; i++) {
    const mean = stats.mean[i]!;
    const std = stats.std[i]!;
    if (!Number.isFinite(mean)) continue;
    lo = Math.min(lo, mean - std);
    hi = Math.max(hi, mean + std);
  }
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

/** Round tick values inside `[lo, hi]`, at least two, always with zero. */
export function niceTicks(lo: number, hi: number, count = 3): number[] {
  const rough = (hi - lo) / Math.max(1, count - 1);
  const exponent = Math.floor(Math.log10(rough));
  const steps: number[] = [];
  for (let e = exponent + 1; e >= exponent - 2; e--) {
    for (const m of [5, 2.5, 2, 1]) steps.push(m * 10 ** e);
  }
  const first = steps.findLastIndex((step) => step >= rough);
  for (const step of steps.slice(Math.max(0, first))) {
    const ticks = ticksEvery(lo, hi, step);
    if (ticks.length >= 2) return ticks;
  }
  return [0];
}

function ticksEvery(lo: number, hi: number, step: number): number[] {
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) {
    ticks.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  }
  return ticks;
}
