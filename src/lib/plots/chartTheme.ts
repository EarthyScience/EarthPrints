export const TIME_SERIES_PLOT_HEIGHT = 220;

export const TIME_SERIES_CHART_MARGIN = {
  top: 12,
  right: 8,
  left: 0,
  bottom: 0,
} as const;

/**
 * About three significant digits whatever the magnitude, so rainfall in
 * kg m-2 s-1 (1e-5) and pressure in Pa (1e5) stay readable. Values from 1 to
 * 100 keep two decimals, as NEE always showed them.
 */
export function formatSeriesValue(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs < 1e-12) return "0";
  if (abs < 1e-3 || abs >= 1e6) return trimZeros(value.toExponential(2));
  // Whole values (integer-typed data, counts, flags) print without decimals.
  if (abs >= 1000 || Number.isInteger(value)) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(2 - Math.floor(Math.log10(abs)));
}

/** Axis ticks are round numbers, so their trailing zeros are noise. */
export function formatTickValue(value: number): string {
  return trimZeros(formatSeriesValue(value));
}

function trimZeros(text: string): string {
  return text.replace(/(\.\d*?)0+(?=$|e)/, "$1").replace(/\.(?=$|e)/, "");
}

/**
 * Value axis limits that fit the data. Zero stays in view when the data
 * crosses it or sits within one data range of it, as a flux or rainfall
 * does; pressure or temperature in kelvin get an axis around their values.
 */
export function valueDomain(lo: number, hi: number): [number, number] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  const width = hi - lo;
  if (lo > 0 && lo <= width) lo = 0;
  if (hi < 0 && -hi <= width) hi = 0;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.05;
  return [lo === 0 ? 0 : lo - pad, hi === 0 ? 0 : hi + pad];
}

export function chartTickColor(isLight: boolean): string {
  return isLight ? "rgba(10, 10, 10, 0.56)" : "rgba(255, 255, 255, 0.56)";
}
