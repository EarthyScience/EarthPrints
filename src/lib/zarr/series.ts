export type DailyMeanPoint = {
  day: number;
  value: number;
};

/** Collapse hourly (or sub-daily) steps into one mean per day. */
export function dailyMeanSeries(
  values: ArrayLike<number>,
  hoursPerDay = 24,
): DailyMeanPoint[] {
  if (values.length === 0 || hoursPerDay <= 0) return [];

  const dayCount = Math.ceil(values.length / hoursPerDay);
  const points: DailyMeanPoint[] = [];

  for (let day = 0; day < dayCount; day++) {
    const start = day * hoursPerDay;
    const end = Math.min(start + hoursPerDay, values.length);
    let sum = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const value = values[i];
      if (value === undefined || Number.isNaN(value)) continue;
      sum += value;
      count++;
    }

    if (count > 0) {
      points.push({
        day: day + 1,
        value: sum / count,
      });
    }
  }

  return points;
}

/**
 * Whether a series carries any usable number.
 *
 * FLUXCOM-X only estimates fluxes over vegetated land, so ocean and
 * bare-ground cells come back as all-NaN. That is a legitimate answer rather
 * than a failure, and the plots collapse to nothing when it happens, so
 * callers use this to say so explicitly instead of rendering a blank panel.
 */
export function hasFiniteValues(values: ArrayLike<number>): boolean {
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i])) return true;
  }
  return false;
}
