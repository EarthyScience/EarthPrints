/**
 * `Date.UTC` without its two-digit-year rule: `Date.UTC(1, 0, 1)` is 1901,
 * but model runs and paleo records really do start in year 1.
 */
export function utcMs(year: number, monthIndex = 0, day = 1): number {
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  return date.getTime();
}
