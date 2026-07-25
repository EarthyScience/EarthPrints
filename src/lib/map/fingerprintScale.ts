/**
 * Color scale and axis helpers for the fingerprint plot (hour-of-day x day
 * heatmap of NEE flux). NEE is signed: negative means uptake (the ecosystem is a
 * sink), positive means release (a source). We therefore use a diverging ramp
 * that is symmetric around zero, so the sign reads at a glance and midday uptake
 * separates cleanly from nighttime respiration.
 *
 * Colors are hardcoded and `isLight`-branched, matching the existing
 * `timeSeriesChartTheme` pattern rather than pulling from CSS variables.
 */

export type Rgb = readonly [number, number, number];

/*
 * Poles follow the geoscience-standard "vik" diverging convention (Crameri's
 * perceptually uniform, colourblind-safe scientific colour maps): a cool blue
 * for uptake and a warm red for release, so warm reading as CO2 emission matches
 * how signed anomaly fields are shown in the flux/climate literature. Dark-mode
 * poles are lifted so they stay legible on the dark surface.
 */

/** Uptake (negative) end: blue. */
const UPTAKE_LIGHT: Rgb = [33, 102, 172]; // #2166ac
const UPTAKE_DARK: Rgb = [106, 168, 224]; // #6aa8e0

/** Release (positive) end: red. */
const RELEASE_LIGHT: Rgb = [178, 24, 43]; // #b2182b
const RELEASE_DARK: Rgb = [232, 114, 76]; // #e8724c

/**
 * Zero end is a neutral gray kept distinct from both the panel background and
 * from transparent gaps, so a near-zero cell never looks like missing data.
 */
const MID_LIGHT: Rgb = [235, 235, 231];
const MID_DARK: Rgb = [66, 66, 64];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    lerpChannel(a[0], b[0], t),
    lerpChannel(a[1], b[1], t),
    lerpChannel(a[2], b[2], t),
  ];
}

function rgbString(rgb: Rgb): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Endpoint swatches for a legend, matching what the scale produces at ±absMax. */
export function fingerprintLegendStops(isLight: boolean): {
  uptake: string;
  mid: string;
  release: string;
} {
  return {
    uptake: rgbString(isLight ? UPTAKE_LIGHT : UPTAKE_DARK),
    mid: rgbString(isLight ? MID_LIGHT : MID_DARK),
    release: rgbString(isLight ? RELEASE_LIGHT : RELEASE_DARK),
  };
}

/**
 * Build a diverging color function. `absMax` is the symmetric extent (see
 * {@link symmetricAbsMax}); values outside `[-absMax, absMax]` clamp to the
 * endpoints. Non-finite values (NaN over ocean / missing pixels) are transparent
 * so gaps read as gaps.
 */
export function fingerprintColorScale(
  isLight: boolean,
): (value: number, absMax: number) => string {
  const uptake = isLight ? UPTAKE_LIGHT : UPTAKE_DARK;
  const release = isLight ? RELEASE_LIGHT : RELEASE_DARK;
  const mid = isLight ? MID_LIGHT : MID_DARK;

  return (value, absMax) => {
    if (!Number.isFinite(value)) return "transparent";
    if (absMax <= 0) return rgbString(mid);
    const t = Math.max(-1, Math.min(1, value / absMax));
    const end = t < 0 ? uptake : release;
    return rgbString(lerpRgb(mid, end, Math.abs(t)));
  };
}

/**
 * Largest absolute finite value, so the diverging scale can be centered on zero.
 * NaN-safe; returns 0 for an all-missing series.
 */
export function symmetricAbsMax(values: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) {
      const a = Math.abs(v);
      if (a > max) max = a;
    }
  }
  return max;
}

/** Hour-of-day gridlines/labels worth annotating on the y axis. */
export const FINGERPRINT_HOUR_TICKS = [0, 6, 12, 18] as const;

/** Evenly spaced day-index ticks for the x axis (deduped, inclusive of ends). */
export function dayIndexTicks(nDays: number, count = 6): number[] {
  if (nDays <= 1) return [0];
  const span = nDays - 1;
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(Math.round((i / (count - 1)) * span));
  }
  return [...new Set(ticks)];
}
