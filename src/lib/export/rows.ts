import { ZARR_TIME_ORIGIN_UTC } from "@/lib/zarr/timeRange";
import type { ExportProvenance } from "./provenance";

export type SeriesRow = {
  timestamp: Date;
  /** Absolute day index in the archive (0 = origin). */
  dayIndex: number;
  hour: number;
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
 * builder behind both CSV and XLSX, so the two cannot drift apart.
 */
export function buildSeriesRows(
  values: Float32Array,
  prov: ExportProvenance,
): SeriesRow[] {
  const { hoursPerDay, baseDay, dayCount } = prov;
  const count = Math.min(values.length, dayCount * hoursPerDay);
  const rows: SeriesRow[] = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const hour = i % hoursPerDay;
    const dayIndex = baseDay + Math.floor(i / hoursPerDay);
    const raw = values[i];

    rows[i] = {
      timestamp: new Date(
        ZARR_TIME_ORIGIN_UTC + dayIndex * MS_PER_DAY + hour * MS_PER_HOUR,
      ),
      dayIndex,
      hour,
      value: Number.isFinite(raw) ? roundFloat32(raw) : null,
    };
  }

  return rows;
}
