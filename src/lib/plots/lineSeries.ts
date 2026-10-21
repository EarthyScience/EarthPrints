import { formatDayTick, formatIsoDate } from "@/lib/map/fingerprintScale";
import { formatSeriesValue } from "@/lib/plots/chartTheme";
import {
  binCountLabel,
  binLineStats,
  type BinUnit,
  formatBinLabel,
  formatBinShortLabel,
  monthStartTicks,
  timeBins,
} from "@/lib/plots/timeBins";
import { getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";

export type LineResolution = "hour" | Exclude<BinUnit, "year">;

/** Above this many hourly points the line keeps only each slice's extremes. */
export const MAX_LINE_POINTS = 4000;

export type LinePoint = {
  /** Position in days from the start of the selection, at the bin's centre. */
  x: number;
  value: number;
  band?: [number, number];
  label: string;
  shortLabel: string;
  spread?: string;
};

export type LineTick = { x: number; label: string };

export type LineSeries = {
  points: LinePoint[];
  ticks: LineTick[];
  /** Positions where a new year starts, after the first. */
  yearBreaks: number[];
  nDays: number;
  binCount: number;
};

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Keep the lowest and highest point of each slice, in time order. */
export function keepExtremes<T extends { value: number }>(
  points: readonly T[],
  maxPoints: number,
): T[] {
  if (points.length <= maxPoints) return [...points];
  const slices = Math.max(1, Math.floor(maxPoints / 2));
  const size = points.length / slices;
  const kept: T[] = [];
  for (let s = 0; s < slices; s++) {
    const start = Math.floor(s * size);
    const end = Math.min(points.length, Math.floor((s + 1) * size));
    let lo = -1;
    let hi = -1;
    for (let i = start; i < end; i++) {
      const value = points[i]!.value;
      if (!Number.isFinite(value)) continue;
      if (lo < 0 || value < points[lo]!.value) lo = i;
      if (hi < 0 || value > points[hi]!.value) hi = i;
    }
    if (lo < 0) continue;
    kept.push(points[Math.min(lo, hi)]!);
    if (lo !== hi) kept.push(points[Math.max(lo, hi)]!);
  }
  return kept;
}

export function lineSeries(
  values: Float32Array,
  hoursPerDay: number,
  selectedYears: number[] | null,
  resolution: LineResolution,
  timeBasisSuffix = "",
): LineSeries {
  const nDays = Math.floor(values.length / hoursPerDay);
  const absoluteDays = getSelectedYearsDayMapping(
    selectedYears,
    undefined,
    nDays,
  ).absoluteDays.slice(0, nDays);
  const years = timeBins(absoluteDays, "year");
  const yearBreaks = years.slice(1).map((year) => year.startLocal);
  const ticks: LineTick[] =
    years.length > 1
      ? years.map((year) => ({
          x: (year.startLocal + year.endLocal + 1) / 2,
          label: String(year.year),
        }))
      : monthStartTicks(absoluteDays).map((day) => ({
          x: day,
          label: formatDayTick(absoluteDays[day] ?? 0),
        }));

  let points: LinePoint[] = [];
  let binCount = 0;

  if (resolution === "hour") {
    const suffix = timeBasisSuffix ? ` ${timeBasisSuffix}` : "";
    for (let day = 0; day < nDays; day++) {
      const date = formatIsoDate(absoluteDays[day] ?? 0);
      for (let hour = 0; hour < hoursPerDay; hour++) {
        const value = values[day * hoursPerDay + hour] as number;
        if (!Number.isFinite(value)) continue;
        points.push({
          x: day + (hour + 0.5) / hoursPerDay,
          value,
          label: `${date} · ${hourLabel(hour)}${suffix}`,
          shortLabel: `${date} ${hourLabel(hour)}`,
        });
      }
    }
    binCount = points.length;
    points = keepExtremes(points, MAX_LINE_POINTS);
  } else {
    const bins = timeBins(absoluteDays, resolution);
    const stats = binLineStats(values, hoursPerDay, bins, resolution);
    binCount = bins.length;
    bins.forEach((bin, b) => {
      const count = stats.count[b] ?? 0;
      if (count === 0) return;
      const mean = stats.mean[b] as number;
      const std = stats.std[b] as number;
      const across =
        resolution === "day"
          ? `${count.toLocaleString()} hour${count === 1 ? "" : "s"}`
          : binCountLabel(count, "day");
      points.push({
        x: (bin.startLocal + bin.endLocal + 1) / 2,
        value: mean,
        band: [mean - std, mean + std],
        label: formatBinLabel(bin, resolution),
        shortLabel: formatBinShortLabel(bin, resolution),
        spread: `Std ${formatSeriesValue(std)} across ${across}`,
      });
    });
  }

  return { points, ticks, yearBreaks, nDays, binCount };
}
