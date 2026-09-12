/**
 * Local-time view of the archive's UTC hour axis.
 *
 * FLUXCOM-X stores `NEE[time, hour, lat, lon]` with the `hour` axis in UTC, so a
 * fingerprint drawn straight off that index puts the diurnal band wherever the
 * pixel's longitude happens to place solar noon in UTC: right at Greenwich, four
 * hours high over the Amazon, and upside down over eastern Australia.
 *
 * We correct with mean solar time rounded to the whole hour, `round(lon / 15)`,
 * which is the pixel's nominal time zone. The data is hourly, so rounding costs
 * nothing, and unlike a civil-zone lookup it needs no boundary dataset, puts no
 * daylight-saving step into the middle of the figure, and stays defined over
 * ocean and at the poles.
 */

/** Which clock the plots and exports are read against. */
export type TimeBasis = "local" | "utc";

/** A run of consecutive days within the loaded window. */
export type DayBlock = {
  /** Index of the run's first day within the window. */
  start: number;
  dayCount: number;
};

export type ShiftOptions = {
  hoursPerDay: number;
  offsetHours: number;
  /**
   * Absolute day index per window day, from
   * `getSelectedYearsDayMapping(...).absoluteDays`. Non-contiguous selections
   * sit side by side in the buffer, and each run has to roll on its own.
   */
  absoluteDays: readonly number[];
};

/**
 * Nominal UTC offset of a longitude, in whole hours (-12..+12).
 */
export function localHourOffset(lon: number, hoursPerDay = 24): number {
  if (!Number.isFinite(lon)) return 0;
  // Wrap into [-180, 180) first, so a click carried past the antimeridian by a
  // wrapped map cannot produce an offset of +/-13.
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Math.round(wrapped / (360 / hoursPerDay));
}

/** `UTC+10`, `UTC-4`, `UTC`. */
export function formatUtcOffset(offsetHours: number): string {
  if (offsetHours === 0) return "UTC";
  return `UTC${offsetHours > 0 ? "+" : "-"}${Math.abs(offsetHours)}`;
}

/** Caption and tooltip wording for the basis in force. */
export function formatTimeBasis(basis: TimeBasis, offsetHours: number): string {
  if (basis === "utc") return "UTC";
  return `local solar time (${formatUtcOffset(offsetHours)})`;
}

/**
 * Split the window into runs of consecutive days. `dayCount` covers the buffer
 * even when the mapping is short, so the tail still rolls with the run it
 * continues rather than being dropped.
 */
export function contiguousDayBlocks(
  absoluteDays: readonly number[],
  dayCount = absoluteDays.length,
): DayBlock[] {
  if (dayCount <= 0) return [];

  const blocks: DayBlock[] = [{ start: 0, dayCount: 1 }];
  for (let day = 1; day < dayCount; day += 1) {
    const previous = absoluteDays[day - 1];
    const current = absoluteDays[day];
    const last = blocks[blocks.length - 1]!;
    // A day the mapping does not describe continues the run it follows.
    if (current === undefined || previous === undefined || current === previous + 1) {
      last.dayCount += 1;
    } else {
      blocks.push({ start: day, dayCount: 1 });
    }
  }
  return blocks;
}

/**
 * Re-index the hourly series onto the pixel's local clock:
 * `local[day][hour] = utc[day * hoursPerDay + hour - offsetHours]`, rolled
 * inside each contiguous run so one year's December cannot leak into another
 * year's January.
 *
 * The roll leaves `|offsetHours|` cells at one end of every run with no source
 * hour. They stay NaN, which the colour scale already draws as a gap. Fetching
 * the neighbouring day instead is not worth it: the store's chunk spans 1461
 * days, so a single boundary day can cost a whole second chunk.
 */
export function shiftSeriesToLocalTime(
  values: Float32Array,
  { hoursPerDay, offsetHours, absoluteDays }: ShiftOptions,
): Float32Array {
  if (offsetHours === 0 || values.length === 0 || hoursPerDay <= 0) {
    return values;
  }

  const dayCount = Math.floor(values.length / hoursPerDay);
  const shifted = new Float32Array(values.length).fill(NaN);

  for (const block of contiguousDayBlocks(absoluteDays, dayCount)) {
    const first = block.start * hoursPerDay;
    const past = (block.start + block.dayCount) * hoursPerDay;

    for (let i = first; i < past; i += 1) {
      const source = i - offsetHours;
      if (source < first || source >= past) continue;
      shifted[i] = values[source] as number;
    }
  }

  return shifted;
}
