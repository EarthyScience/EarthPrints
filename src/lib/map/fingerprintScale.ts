/**
 * Color scale and axis helpers for the fingerprint plot (hour-of-day x day
 * heatmap of NEE flux). NEE is signed: negative means uptake (the ecosystem is a
 * sink), positive means release (a source). We therefore use a diverging ramp
 * that is symmetric around zero, so the sign reads at a glance and midday uptake
 * separates cleanly from nighttime respiration.
 *
 * Three colormaps are available:
 *   - "science-light": blue→grey→red diverging, tuned for light backgrounds.
 *   - "science-dark":  lighter poles for dark backgrounds.
 *   - "flux":          Crameri/Kovesi CET perceptually-uniform palette:
 *                      negative half = linear_kbc_5_95_c73 (dark-blue → cyan),
 *                      positive half = Reverse(linear_kryw_5_100_c67) (white → dark).
 *                      Supports true asymmetric extent: negMax and posMax may differ.
 */

import { dayIndexToUTCDate } from "@/lib/zarr/timeRange";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ColormapId = "science-light" | "science-dark" | "flux";

/** What the user picks; Science resolves to its light or dark variant by theme. */
export type Palette = "science" | "flux";

export function colormapFor(palette: Palette, isLight: boolean): ColormapId {
  if (palette === "flux") return "flux";
  return isLight ? "science-light" : "science-dark";
}

export const COLORMAPS: Record<
  ColormapId,
  { label: string; description: string }
> = {
  "science-light": {
    label: "Science",
    description: "Diverging blue–red, tuned for light backgrounds",
  },
  "science-dark": {
    label: "Science",
    description: "Diverging blue–red, lifted for dark backgrounds",
  },
  flux: {
    label: "Flux",
    description:
      "Perceptually uniform: CET kbc (uptake) + reversed kryw (release)",
  },
};

export type Rgb = readonly [number, number, number];

// ---------------------------------------------------------------------------
// Science colormap poles
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Flux colormap: CET linear_kbc_5_95_c73 and Reverse(linear_kryw_5_100_c67)
// ---------------------------------------------------------------------------

// 256 entries, laid out as [r0,g0,b0, r1,g1,b1, ...].
// Source: colorcet Python package (Peter Kovesi / HoloViz).

// linear_kbc_5_95_c73 (256 entries, [r,g,b,...])
const CET_KBC = new Uint8Array([
  0, 1, 78, 0, 1, 80, 0, 2, 82, 0, 2, 84, 0, 2, 86, 0, 3, 88, 0, 3, 90, 0, 3,
  92, 0, 3, 94, 0, 3, 96, 1, 3, 98, 2, 3, 100, 2, 3, 102, 3, 3, 104, 4, 2, 106,
  5, 2, 108, 5, 2, 110, 6, 2, 112, 7, 2, 114, 8, 2, 116, 8, 2, 118, 9, 2, 120,
  10, 2, 123, 11, 2, 125, 11, 2, 127, 12, 2, 129, 13, 2, 131, 13, 2, 133, 14, 2,
  136, 14, 1, 138, 15, 1, 140, 15, 1, 142, 15, 1, 144, 16, 1, 147, 16, 1, 149,
  16, 1, 151, 16, 1, 153, 16, 2, 156, 16, 2, 158, 16, 2, 160, 16, 2, 162, 15, 2,
  165, 15, 2, 167, 14, 3, 170, 13, 3, 172, 13, 3, 174, 12, 4, 177, 11, 4, 179,
  10, 4, 181, 10, 5, 183, 9, 5, 185, 9, 6, 188, 8, 7, 190, 8, 7, 192, 8, 8, 194,
  8, 9, 196, 8, 10, 198, 8, 10, 200, 8, 11, 202, 8, 12, 204, 9, 13, 206, 9, 14,
  208, 10, 15, 210, 11, 16, 212, 12, 17, 214, 13, 18, 216, 14, 18, 217, 16, 19,
  219, 17, 20, 221, 18, 21, 223, 19, 22, 224, 21, 23, 226, 22, 24, 227, 24, 25,
  229, 25, 26, 231, 26, 28, 232, 27, 29, 233, 28, 30, 235, 29, 31, 236, 31, 33,
  237, 32, 34, 238, 33, 36, 240, 34, 37, 241, 35, 38, 242, 35, 40, 243, 36, 41,
  244, 37, 43, 244, 38, 45, 245, 39, 46, 246, 40, 48, 247, 40, 49, 247, 41, 51,
  248, 42, 53, 248, 42, 54, 249, 43, 56, 249, 43, 58, 250, 44, 59, 250, 44, 61,
  250, 45, 63, 250, 45, 65, 251, 45, 66, 251, 46, 68, 251, 46, 70, 251, 46, 71,
  251, 47, 73, 251, 47, 75, 251, 47, 76, 251, 47, 78, 251, 47, 79, 251, 47, 81,
  251, 47, 82, 252, 48, 84, 252, 48, 86, 252, 48, 87, 252, 48, 89, 252, 48, 90,
  252, 48, 92, 252, 48, 93, 252, 47, 94, 252, 47, 96, 252, 47, 97, 252, 47, 99,
  253, 47, 100, 253, 47, 102, 253, 46, 103, 253, 46, 105, 253, 46, 106, 253, 45,
  107, 253, 45, 109, 253, 45, 110, 253, 45, 112, 253, 44, 113, 253, 44, 114,
  253, 44, 116, 253, 44, 117, 254, 44, 118, 254, 43, 120, 254, 43, 121, 254, 43,
  123, 254, 43, 124, 254, 43, 125, 254, 44, 126, 254, 44, 128, 254, 44, 129,
  254, 44, 130, 254, 44, 132, 254, 45, 133, 254, 45, 134, 254, 45, 135, 254, 46,
  137, 254, 46, 138, 254, 47, 139, 254, 47, 141, 254, 48, 142, 254, 48, 143,
  254, 49, 144, 253, 50, 146, 253, 50, 147, 253, 51, 148, 253, 51, 149, 253, 52,
  150, 253, 52, 152, 253, 53, 153, 253, 53, 154, 253, 53, 155, 253, 53, 157,
  253, 54, 158, 253, 54, 159, 253, 54, 160, 253, 54, 162, 253, 54, 163, 253, 54,
  164, 253, 54, 166, 253, 54, 167, 253, 53, 168, 253, 53, 169, 252, 53, 171,
  252, 53, 172, 252, 52, 173, 252, 52, 174, 252, 51, 176, 252, 51, 177, 252, 50,
  178, 252, 49, 180, 252, 49, 181, 252, 48, 182, 252, 47, 183, 252, 46, 185,
  252, 46, 186, 252, 45, 187, 252, 44, 188, 252, 44, 190, 252, 43, 191, 252, 43,
  192, 252, 42, 194, 252, 42, 195, 252, 42, 196, 252, 41, 197, 252, 41, 199,
  252, 41, 200, 252, 41, 201, 251, 41, 202, 251, 41, 203, 251, 41, 205, 251, 41,
  206, 251, 41, 207, 251, 41, 208, 251, 42, 210, 251, 42, 211, 251, 43, 212,
  251, 43, 213, 251, 44, 214, 251, 44, 216, 250, 45, 217, 250, 47, 218, 250, 48,
  219, 250, 51, 220, 250, 53, 221, 250, 56, 222, 250, 60, 223, 250, 63, 225,
  250, 66, 226, 249, 70, 227, 249, 73, 228, 249, 77, 229, 249, 80, 229, 249, 84,
  230, 249, 87, 231, 249, 91, 232, 249, 94, 233, 249, 98, 234, 248, 101, 235,
  248, 105, 236, 248, 108, 237, 248, 112, 238, 248, 115, 239, 248, 118, 240,
  248, 122, 240, 248, 125, 241, 248, 128, 242, 247, 132, 243, 247, 135, 244,
  247, 138, 245, 247, 142, 245, 247, 145, 246, 247, 148, 247, 247, 151, 248,
  247, 154, 249, 246, 157, 249, 246, 161, 250, 246, 164, 251, 246, 167, 252,
  246, 170, 253, 246, 173, 253, 246, 176, 254, 246, 179, 255, 246,
]);

// linear_kryw_5_100_c67 (256 entries, [r,g,b,...])
const CET_KRYW = new Uint8Array([
  17, 17, 17, 21, 17, 16, 24, 17, 16, 27, 17, 16, 29, 17, 15, 32, 18, 15, 34,
  18, 15, 37, 18, 14, 39, 18, 14, 41, 17, 14, 44, 17, 13, 46, 17, 13, 48, 17,
  13, 51, 16, 12, 53, 16, 12, 55, 16, 12, 58, 15, 11, 60, 15, 11, 62, 14, 11,
  64, 13, 10, 66, 13, 10, 69, 12, 9, 71, 11, 9, 73, 10, 9, 75, 10, 8, 77, 9, 8,
  79, 8, 8, 81, 7, 7, 83, 6, 7, 85, 5, 7, 87, 4, 7, 89, 3, 6, 91, 2, 6, 93, 1,
  6, 95, 0, 5, 97, 0, 5, 99, 0, 5, 100, 0, 5, 102, 0, 5, 104, 0, 4, 105, 0, 4,
  107, 0, 4, 109, 0, 4, 110, 0, 4, 112, 0, 4, 113, 0, 3, 115, 0, 3, 117, 0, 3,
  118, 0, 3, 120, 0, 3, 121, 0, 3, 123, 0, 2, 124, 0, 2, 126, 0, 2, 128, 0, 2,
  129, 0, 2, 131, 0, 2, 132, 0, 2, 134, 0, 2, 136, 0, 1, 137, 0, 1, 139, 0, 1,
  140, 0, 1, 142, 0, 1, 144, 0, 1, 145, 0, 1, 147, 0, 1, 149, 0, 1, 150, 0, 1,
  152, 0, 0, 153, 0, 0, 155, 0, 0, 157, 0, 0, 158, 0, 0, 160, 0, 0, 162, 0, 0,
  163, 0, 0, 165, 0, 0, 167, 0, 0, 168, 0, 0, 170, 0, 0, 172, 0, 0, 173, 0, 0,
  175, 0, 0, 177, 0, 0, 178, 0, 0, 180, 0, 0, 182, 0, 0, 183, 0, 0, 185, 0, 0,
  187, 0, 0, 189, 0, 0, 190, 0, 0, 192, 0, 0, 194, 0, 0, 196, 0, 0, 197, 0, 0,
  199, 0, 0, 201, 0, 0, 202, 0, 0, 204, 0, 0, 206, 0, 0, 208, 0, 0, 209, 0, 0,
  211, 0, 0, 213, 0, 0, 214, 0, 0, 216, 0, 0, 218, 0, 0, 219, 0, 0, 221, 0, 0,
  223, 0, 0, 224, 0, 0, 226, 0, 0, 228, 0, 0, 229, 0, 0, 231, 0, 0, 233, 0, 0,
  234, 0, 0, 236, 1, 0, 238, 2, 0, 239, 4, 0, 241, 5, 0, 242, 7, 0, 244, 10, 0,
  245, 13, 0, 247, 16, 0, 248, 18, 0, 249, 21, 0, 251, 24, 0, 252, 27, 0, 253,
  30, 0, 254, 33, 0, 255, 35, 0, 255, 38, 0, 255, 41, 0, 255, 44, 0, 255, 47, 0,
  255, 49, 0, 255, 52, 0, 255, 55, 0, 255, 58, 0, 255, 61, 0, 255, 63, 0, 255,
  66, 0, 255, 69, 0, 255, 72, 0, 255, 74, 0, 255, 77, 0, 255, 80, 0, 255, 82, 0,
  255, 85, 0, 255, 88, 0, 255, 90, 0, 255, 92, 0, 255, 95, 0, 255, 97, 1, 255,
  99, 1, 255, 102, 1, 255, 104, 2, 255, 106, 2, 255, 108, 3, 255, 110, 3, 255,
  112, 3, 255, 114, 4, 255, 117, 4, 255, 119, 5, 255, 121, 5, 255, 123, 5, 255,
  125, 6, 255, 127, 6, 255, 129, 7, 255, 130, 7, 255, 132, 7, 255, 134, 8, 255,
  136, 8, 255, 138, 8, 255, 140, 9, 255, 142, 9, 255, 144, 10, 255, 145, 10,
  255, 147, 10, 255, 149, 11, 255, 151, 11, 255, 153, 12, 255, 154, 12, 255,
  156, 12, 255, 158, 13, 255, 160, 13, 255, 161, 13, 255, 163, 14, 255, 165, 14,
  255, 166, 14, 255, 168, 15, 255, 170, 15, 255, 171, 15, 255, 173, 16, 255,
  175, 16, 255, 176, 16, 255, 178, 17, 255, 179, 17, 255, 181, 17, 255, 183, 18,
  255, 184, 20, 255, 186, 23, 255, 187, 27, 255, 189, 31, 255, 190, 35, 255,
  192, 39, 255, 193, 44, 255, 194, 48, 255, 196, 52, 255, 197, 57, 255, 199, 61,
  255, 200, 65, 255, 201, 70, 255, 203, 74, 255, 204, 78, 255, 205, 83, 255,
  207, 87, 255, 208, 91, 255, 209, 96, 255, 211, 100, 255, 212, 104, 255, 213,
  109, 255, 215, 113, 255, 216, 117, 255, 217, 122, 255, 219, 126, 255, 220,
  131, 255, 221, 135, 255, 223, 140, 255, 224, 144, 255, 225, 149, 255, 227,
  153, 255, 228, 158, 255, 229, 163, 255, 231, 167, 255, 232, 172, 255, 233,
  177, 255, 235, 181, 255, 236, 186, 255, 237, 191, 255, 239, 196, 255, 240,
  200, 255, 241, 205, 255, 243, 210, 255, 244, 215, 255, 245, 220, 255, 247,
  225, 255, 248, 230, 255, 250, 235, 255, 251, 240, 255, 252, 245, 255, 254,
  250, 255, 255, 255,
]);

/** Sample a CET Uint8Array table at a normalised position t ∈ [0, 1]. */
function sampleCet(table: Uint8Array, t: number): Rgb {
  const clamped = Math.max(0, Math.min(1, t));
  const lo = Math.min(255, Math.floor(clamped * 255));
  const hi = Math.min(255, lo + 1);
  const frac = clamped * 255 - lo;
  const i0 = lo * 3;
  const i1 = hi * 3;
  return [
    Math.round(table[i0]! + (table[i1]! - table[i0]!) * frac),
    Math.round(table[i0 + 1]! + (table[i1 + 1]! - table[i0 + 1]!) * frac),
    Math.round(table[i0 + 2]! + (table[i1 + 2]! - table[i0 + 2]!) * frac),
  ];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Color-scale extent helpers
// ---------------------------------------------------------------------------

/**
 * Largest absolute finite value, so a diverging scale can be centered on zero.
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

/**
 * For the Flux colormap: compute separate extents for the negative and positive
 * halves so each half spans the full ramp independently.
 *
 * Returns `{ negMax, posMax }` where `negMax ≥ 0` and `posMax ≥ 0`.
 * If all values are on one side, the other extent is set to a tiny positive
 * sentinel (1e-10) to avoid a division-by-zero degenerate state.
 */
export function asymmetricExtents(values: ArrayLike<number>): {
  negMax: number;
  posMax: number;
} {
  let negMax = 0;
  let posMax = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < 0 && -v > negMax) negMax = -v;
    if (v > 0 && v > posMax) posMax = v;
  }
  return {
    negMax: negMax > 0 ? negMax : 1e-10,
    posMax: posMax > 0 ? posMax : 1e-10,
  };
}

// ---------------------------------------------------------------------------
// Legend stops
// ---------------------------------------------------------------------------

/**
 * Endpoint swatches for a legend bar, matching what each scale produces at
 * its extreme values. Used both in the in-app legend and in the export.
 */
export function fingerprintLegendStopsForColormap(colormapId: ColormapId): {
  uptake: string;
  mid: string;
  release: string;
} {
  switch (colormapId) {
    case "science-light":
      return {
        uptake: rgbString(UPTAKE_LIGHT),
        mid: rgbString(MID_LIGHT),
        release: rgbString(RELEASE_LIGHT),
      };
    case "science-dark":
      return {
        uptake: rgbString(UPTAKE_DARK),
        mid: rgbString(MID_DARK),
        release: rgbString(RELEASE_DARK),
      };
    case "flux":
      // kbc[0] = most-negative (dark blue), kbc[255] = zero (light cyan)
      // Reversed kryw: kryw[255] = zero (white), kryw[0] = most-positive (dark)
      return {
        uptake: rgbString(sampleCet(CET_KBC, 0)), // [0, 1, 78]
        mid: rgbString(sampleCet(CET_KBC, 1)), // [179, 255, 246] — cyan at zero
        release: rgbString(sampleCet(CET_KRYW, 0)), // [17, 17, 17] — dark at posMax
      };
  }
}

/**
 * Convenience overload for the export path, which always renders in light mode.
 * @deprecated Prefer {@link fingerprintLegendStopsForColormap}.
 */
export function fingerprintLegendStops(isLight: boolean): {
  uptake: string;
  mid: string;
  release: string;
} {
  return fingerprintLegendStopsForColormap(
    isLight ? "science-light" : "science-dark",
  );
}

// ---------------------------------------------------------------------------
// Color scale function
// ---------------------------------------------------------------------------

/**
 * Build a diverging color function for the given colormap.
 *
 * For "science-light" and "science-dark": uses symmetric `absMax` — pass
 * `absMax` as both `negMax` and `posMax`.
 *
 * For "flux": pass separate `negMax` (the magnitude of the most-negative
 * finite value) and `posMax` (the most-positive finite value) to get the
 * true asymmetric mapping where each ramp half spans the full colour table.
 *
 * Non-finite values (NaN / ocean / missing) are returned as "transparent".
 */
export function fingerprintColorScale(
  colormapId: ColormapId,
): (value: number, negMax: number, posMax: number) => string {
  switch (colormapId) {
    case "science-light":
    case "science-dark": {
      const uptake =
        colormapId === "science-light" ? UPTAKE_LIGHT : UPTAKE_DARK;
      const release =
        colormapId === "science-light" ? RELEASE_LIGHT : RELEASE_DARK;
      const mid = colormapId === "science-light" ? MID_LIGHT : MID_DARK;

      return (value, negMax, posMax) => {
        if (!Number.isFinite(value)) return "transparent";
        // Science maps use symmetric absMax — whichever extent the caller
        // computed, we take the larger one so zero stays centred.
        const absMax = Math.max(negMax, posMax);
        if (absMax <= 0) return rgbString(mid);
        const t = Math.max(-1, Math.min(1, value / absMax));
        const end = t < 0 ? uptake : release;
        return rgbString(lerpRgb(mid, end, Math.abs(t)));
      };
    }

    case "flux": {
      return (value, negMax, posMax) => {
        if (!Number.isFinite(value)) return "transparent";
        if (value < 0) {
          // Negative half: kbc traversed from index 255 (zero) → 0 (−negMax).
          const t = Math.max(0, Math.min(1, -value / negMax));
          return rgbString(sampleCet(CET_KBC, 1 - t));
        } else {
          // Positive half: reversed kryw traversed from index 255 (zero) → 0 (+posMax).
          const t = Math.max(0, Math.min(1, value / posMax));
          return rgbString(sampleCet(CET_KRYW, 1 - t));
        }
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Axis helpers (unchanged)
// ---------------------------------------------------------------------------

/** Hour-of-day gridlines/labels worth annotating on the hour axis. */
export const FINGERPRINT_HOUR_TICKS = [0, 6, 12, 18] as const;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** A contiguous run of local day indices (inclusive) belonging to one calendar year. */
export type YearRange = {
  year: number;
  /** Local index of the first day of this year within the loaded window. */
  startDay: number;
  /** Local index of the last day of this year within the loaded window. */
  endDay: number;
};

/**
 * Split the loaded window into the calendar years it spans. `base` is the
 * absolute day index of the window's first day (0 = the time-axis origin); days
 * are contiguous and chronological, so each year is a single inclusive range.
 */
export function yearRangesInWindow(base: number, nDays: number): YearRange[] {
  const ranges: YearRange[] = [];
  for (let local = 0; local < nDays; local++) {
    const year = dayIndexToUTCDate(base + local).getUTCFullYear();
    const last = ranges[ranges.length - 1];
    if (last && last.year === year) {
      last.endDay = local;
    } else {
      ranges.push({ year, startDay: local, endDay: local });
    }
  }
  return ranges;
}

/** Compact "Mon 'yy" label for an axis tick at absolute day `absoluteDay`. */
export function formatDayTick(absoluteDay: number): string {
  const date = dayIndexToUTCDate(absoluteDay);
  return `${SHORT_MONTHS[date.getUTCMonth()]} '${String(
    date.getUTCFullYear(),
  ).slice(2)}`;
}

/** ISO date (YYYY-MM-DD) for a tooltip readout. */
export function formatIsoDate(absoluteDay: number): string {
  return dayIndexToUTCDate(absoluteDay).toISOString().slice(0, 10);
}

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
