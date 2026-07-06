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
