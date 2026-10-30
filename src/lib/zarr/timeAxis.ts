import type { AxisSlice } from "@/lib/zarr/chunks";
import { utcMs } from "@/lib/zarr/utc";

const MS_PER_DAY = 86_400_000;
const EPSILON = 1e-6;

/**
 * Everything the plots need to know about a store's time axis.
 *
 * Every dataset is resampled onto one shape, `days x slotsPerDay`, so the
 * plots, exports and local-time shift never see the store's own layout. A
 * day index counts whole UTC days from `originMs`.
 */
export type TimeAxis = {
  /** UTC midnight of day 0. */
  originMs: number;
  totalDays: number;
  /** Values per day: 24 for hourly, 4 for 6-hourly, 1 for daily or coarser. */
  slotsPerDay: number;
  /** Days since the origin at which each store sample starts. */
  samplePos: Float64Array;
  /** The store carries the hour of day as its own axis (FLUXCOM-X). */
  hourAxis: boolean;
  /** How a sample coarser than a day is spread over the days it covers. */
  span: "slot" | "month" | "year" | "days";
  /** Typical days per sample, for `span: "days"`. */
  stepDays: number;
  /** "hourly", "6-hourly", "daily", "monthly". */
  stepLabel: string;
  /** Calendar years with at least one day on the axis. */
  years: number[];
};

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function stepLabelFor(slotsPerDay: number, span: TimeAxis["span"], stepDays: number) {
  if (span === "month") return "monthly";
  if (span === "year") return "yearly";
  if (span === "days") {
    if (Math.abs(stepDays - 7) < 0.5) return "weekly";
    return `${Math.round(stepDays)}-daily`;
  }
  if (slotsPerDay === 1) return "daily";
  if (slotsPerDay === 24) return "hourly";
  if (slotsPerDay === 48) return "half-hourly";
  const hours = 24 / slotsPerDay;
  return Number.isInteger(hours) ? `${hours}-hourly` : `${slotsPerDay} per day`;
}

function yearsBetween(originMs: number, totalDays: number): number[] {
  if (totalDays <= 0) return [];
  const first = new Date(originMs).getUTCFullYear();
  const last = new Date(originMs + (totalDays - 1) * MS_PER_DAY).getUTCFullYear();
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

function startOfUtcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

function spanFor(stepDays: number): TimeAxis["span"] {
  if (stepDays < 1 + EPSILON) return "slot";
  if (stepDays >= 27.5 && stepDays <= 31.5) return "month";
  if (stepDays >= 360 && stepDays <= 367) return "year";
  return "days";
}

/** Day 0 sits on the first sample's day, month or year, so bins line up. */
function originFor(
  firstMs: number,
  span: TimeAxis["span"],
  stepDays: number,
): number {
  const date = new Date(firstMs);
  if (span === "days") {
    const yearStart = utcMs(date.getUTCFullYear(), 0, 1);
    return startOfUtcDay(
      Math.max(yearStart, firstMs - (stepDays / 2) * MS_PER_DAY),
    );
  }
  if (span === "month") {
    return utcMs(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  if (span === "year") return utcMs(date.getUTCFullYear(), 0, 1);
  return startOfUtcDay(firstMs);
}

/**
 * Build the axis from decoded sample times. `hourCount` is the size of a
 * separate hour-of-day axis when the store has one.
 */
export function buildTimeAxis(
  times: Float64Array,
  hourCount: number | null = null,
): TimeAxis {
  let firstMs = NaN;
  let lastMs = NaN;
  for (const t of times) {
    if (!Number.isFinite(t)) continue;
    if (!Number.isFinite(firstMs)) firstMs = t;
    lastMs = t;
  }
  if (!Number.isFinite(firstMs)) {
    throw new Error("The time coordinate has no valid dates.");
  }

  const steps: number[] = [];
  for (let i = 1; i < times.length && steps.length < 2000; i++) {
    const step = (times[i]! - times[i - 1]!) / MS_PER_DAY;
    if (Number.isFinite(step) && step > 0) steps.push(step);
  }
  const stepDays = hourCount !== null ? 1 : steps.length > 0 ? median(steps) : 1;
  const span = hourCount !== null ? "slot" : spanFor(stepDays);
  const originMs = originFor(firstMs, span, stepDays);
  const samplePos = Float64Array.from(times, (t) => (t - originMs) / MS_PER_DAY);
  const lastPos = (lastMs - originMs) / MS_PER_DAY;

  const slotsPerDay =
    hourCount ?? (stepDays < 1 - EPSILON ? Math.max(1, Math.round(1 / stepDays)) : 1);

  let totalDays: number;
  if (span === "slot") {
    totalDays = Math.floor(lastPos + EPSILON) + 1;
  } else {
    const last = new Date(lastMs);
    const coveredUntil =
      span === "month"
        ? utcMs(last.getUTCFullYear(), last.getUTCMonth() + 1, 1)
        : span === "year"
          ? utcMs(last.getUTCFullYear() + 1, 0, 1)
          : Math.min(
              lastMs + (stepDays / 2) * MS_PER_DAY,
              utcMs(last.getUTCFullYear() + 1, 0, 1),
            );
    totalDays = Math.max(1, Math.ceil((coveredUntil - originMs) / MS_PER_DAY - EPSILON));
  }

  return {
    originMs,
    totalDays,
    slotsPerDay,
    samplePos,
    hourAxis: hourCount !== null,
    span,
    stepDays,
    stepLabel: stepLabelFor(slotsPerDay, span, stepDays),
    years: yearsBetween(originMs, totalDays),
  };
}

/** First index whose position is at or after `day`. */
function lowerBound(positions: Float64Array, day: number): number {
  let lo = 0;
  let hi = positions.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (positions[mid]! < day - EPSILON) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Store samples that contribute to the days `[d0, d1)`. */
export function sampleRangeForDays(axis: TimeAxis, [d0, d1]: AxisSlice): AxisSlice {
  const count = axis.samplePos.length;
  if (d1 <= d0 || count === 0) return [0, 0];
  if (axis.hourAxis || axis.span === "slot") {
    return [lowerBound(axis.samplePos, d0), lowerBound(axis.samplePos, d1)];
  }
  // A coarse sample that starts before d0 can still cover it.
  const start = Math.max(0, lowerBound(axis.samplePos, d0 + EPSILON) - 1);
  return [start, Math.max(start, lowerBound(axis.samplePos, d1))];
}

function yearBounds(axis: TimeAxis, pos: number): [number, number] {
  const year = new Date(axis.originMs + pos * MS_PER_DAY).getUTCFullYear();
  return [
    (utcMs(year, 0, 1) - axis.originMs) / MS_PER_DAY,
    (utcMs(year + 1, 0, 1) - axis.originMs) / MS_PER_DAY,
  ];
}

/**
 * The days `[start, end)` one coarse sample stands for. A month or year
 * fills its calendar period. Other steps (8-daily, weekly) are taken as
 * centred on their timestamp, as aggregated products usually stamp them, and
 * stop halfway to their neighbours and at the end of their year, since such
 * products restart their windows every January.
 */
function coverRange(axis: TimeAxis, index: number): [number, number] {
  const pos = axis.samplePos[index]!;
  if (axis.span === "month" || axis.span === "year") {
    const date = new Date(axis.originMs + pos * MS_PER_DAY);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const [from, to] =
      axis.span === "month"
        ? [utcMs(y, m, 1), utcMs(y, m + 1, 1)]
        : [utcMs(y, 0, 1), utcMs(y + 1, 0, 1)];
    return [(from - axis.originMs) / MS_PER_DAY, (to - axis.originMs) / MS_PER_DAY];
  }
  const half = axis.stepDays / 2;
  const prev = axis.samplePos[index - 1];
  const next = axis.samplePos[index + 1];
  const [yearStart, yearEnd] = yearBounds(axis, pos);
  let start = Math.max(pos - half, yearStart);
  let end = Math.min(pos + half, yearEnd);
  if (prev !== undefined && Number.isFinite(prev)) start = Math.max(start, (prev + pos) / 2);
  if (next !== undefined && Number.isFinite(next)) end = Math.min(end, (pos + next) / 2);
  return [start, end];
}

/** Store samples whose timestamp falls on the days `[d0, d1)`. */
export function samplesInDays(axis: TimeAxis, [d0, d1]: AxisSlice): number {
  return lowerBound(axis.samplePos, d1) - lowerBound(axis.samplePos, d0);
}

/**
 * Lay store samples `[sampleStart, sampleStart + n)` onto the days
 * `[d0, d1)`. `values` holds `hoursPerSample` values per sample (24 for a
 * store with an hour axis, 1 otherwise). Days or slots with no sample stay
 * NaN; a sample coarser than a day fills every day it covers.
 */
export function resampleToDays(
  axis: TimeAxis,
  values: Float32Array,
  sampleStart: number,
  [d0, d1]: AxisSlice,
): Float32Array {
  const slots = axis.slotsPerDay;
  const out = new Float32Array(Math.max(0, d1 - d0) * slots).fill(NaN);
  const perSample = axis.hourAxis ? slots : 1;
  const sampleCount = Math.floor(values.length / perSample);

  for (let k = 0; k < sampleCount; k++) {
    const index = sampleStart + k;
    const pos = axis.samplePos[index];
    if (pos === undefined || !Number.isFinite(pos)) continue;

    if (axis.hourAxis) {
      const day = Math.round(pos) - d0;
      if (day < 0 || day >= d1 - d0) continue;
      out.set(values.subarray(k * slots, (k + 1) * slots), day * slots);
      continue;
    }

    const value = values[k]!;
    if (axis.span === "slot") {
      const slot = Math.floor((pos - d0) * slots + EPSILON);
      if (slot >= 0 && slot < out.length) out[slot] = value;
      continue;
    }

    const [start, end] = coverRange(axis, index);
    const from = Math.max(d0, Math.round(start));
    const to = Math.min(d1, Math.round(end));
    for (let day = from; day < to; day++) out[day - d0] = value;
  }

  return out;
}
