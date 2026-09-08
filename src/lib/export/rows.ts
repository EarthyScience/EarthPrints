import {
  ZARR_TIME_ORIGIN_UTC,
  getSelectedYearsDayMapping,
} from "@/lib/zarr/timeRange";
import type { ExportProvenance } from "./provenance";

export type SeriesRow = {
  timestamp: Date;
  /**
   * The same instant on the cell's own clock. Carried beside the UTC stamp
   * rather than replacing it, so a file downloaded before local time existed
   * still lines up column for column with a new one.
   */
  timestampLocal: Date;
  year: number;
  date: string;
  /** Absolute day index in the archive (0 = origin). */
  dayIndex: number;
  hour: number;
  /** Hour of day on the cell's clock, i.e. `hour` shifted by the UTC offset. */
  hourLocal: number;
  /** Calendar date on the cell's clock, which rolls over before or after UTC. */
  dateLocal: string;
  /** `null` where the source held NaN: ocean, or a gap in the record. */
  value: number | null;
};

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Reading a `Float32Array` element widens it to a double, so `-0.412` comes
 * back as `-0.41200000047683716`. Float32 carries about 7 significant decimal
 * digits, so rounding there is lossless for the stored value and spares every
 * consumer a wall of noise digits.
 */
function roundFloat32(value: number): number {
  return Number(value.toPrecision(7));
}

/**
 * Flatten the loaded `[day, hour]` series into dated rows. The single row
 * builder behind the workbook, and the seam a second table format would reuse.
 *
 * Reads the archive values, which are on the UTC hour axis, and derives the
 * cell's local clock arithmetically. Nothing is re-indexed here: the tables stay
 * a faithful dump of the store, with the local columns beside the UTC ones.
 */
export function buildSeriesRows(
  values: Float32Array,
  prov: ExportProvenance,
): SeriesRow[] {
  const { hoursPerDay, baseDay, dayCount, selectedYears, utcOffsetHours } = prov;
  const count = Math.min(values.length, dayCount * hoursPerDay);
  const rows: SeriesRow[] = new Array(count);

  const dayMapping = getSelectedYearsDayMapping(
    selectedYears,
    undefined,
    dayCount,
  );

  for (let i = 0; i < count; i += 1) {
    const hour = i % hoursPerDay;
    const localDay = Math.floor(i / hoursPerDay);
    const dayIndex =
      dayMapping.absoluteDays[localDay] ?? (baseDay + localDay);
    const raw = values[i];
    const timestamp = new Date(
      ZARR_TIME_ORIGIN_UTC + dayIndex * MS_PER_DAY + hour * MS_PER_HOUR,
    );

    const timestampLocal = new Date(
      timestamp.getTime() + utcOffsetHours * MS_PER_HOUR,
    );

    rows[i] = {
      timestamp,
      timestampLocal,
      year: timestamp.getUTCFullYear(),
      date: timestamp.toISOString().slice(0, 10),
      dayIndex,
      hour,
      hourLocal: timestampLocal.getUTCHours(),
      dateLocal: timestampLocal.toISOString().slice(0, 10),
      value: Number.isFinite(raw) ? roundFloat32(raw) : null,
    };
  }

  return rows;
}
