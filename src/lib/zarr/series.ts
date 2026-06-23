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

    for (let i = start; i < end; i++) {
      sum += values[i]!;
    }

    points.push({
      day: day + 1,
      value: sum / (end - start),
    });
  }

  return points;
}
