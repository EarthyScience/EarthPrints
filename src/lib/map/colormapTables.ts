/**
 * Lookup tables for the diverging colour maps offered by the fingerprint plot.
 *
 * These are Fabio Crameri's perceptually uniform, colourblind-safe scientific
 * colour maps, downsampled from the official 256-entry tables to 33 stops
 * (indistinguishable once interpolated, small enough to read in a diff). Cite
 * as: Crameri, F. (2023), Scientific colour maps, Zenodo,
 * doi:10.5281/zenodo.1243862 (MIT). RdBu is the familiar ColorBrewer ramp, kept
 * as a non-uniform reference point.
 *
 * Every table here is diverging with a neutral centre, so stop 16 of 33 is the
 * zero colour. `vik`, `broc`, `cork` and `roma` are light-centred; `berlin` and
 * `vanimo` are dark-centred, so a near-zero cell recedes into a dark panel
 * instead of glowing. The Flux palette is not here: it is two sequential CET
 * ramps glued at zero rather than a single diverging table, and lives in
 * `fingerprintScale.ts` with the rest of the CET data.
 */

import type { Rgb } from "@/lib/map/fingerprintScale";

const VIK: readonly Rgb[] = [
  [0, 18, 97],
  [2, 31, 105],
  [2, 43, 113],
  [2, 55, 121],
  [3, 68, 129],
  [5, 81, 137],
  [12, 94, 146],
  [28, 109, 156],
  [48, 125, 166],
  [72, 141, 178],
  [97, 158, 189],
  [122, 174, 200],
  [148, 190, 210],
  [173, 205, 221],
  [198, 219, 230],
  [222, 230, 233],
  [236, 229, 224],
  [238, 219, 208],
  [233, 204, 186],
  [227, 188, 165],
  [220, 172, 144],
  [214, 157, 124],
  [207, 142, 104],
  [201, 128, 86],
  [195, 114, 67],
  [189, 100, 49],
  [179, 83, 31],
  [165, 64, 15],
  [148, 47, 6],
  [131, 33, 6],
  [116, 21, 6],
  [103, 10, 7],
  [89, 0, 8],
];

const BERLIN: readonly Rgb[] = [
  [158, 176, 255],
  [140, 174, 246],
  [121, 171, 237],
  [101, 167, 226],
  [81, 159, 211],
  [65, 148, 193],
  [54, 133, 173],
  [46, 118, 153],
  [40, 104, 134],
  [34, 89, 115],
  [29, 75, 97],
  [24, 61, 79],
  [20, 48, 62],
  [17, 36, 46],
  [17, 26, 32],
  [18, 18, 20],
  [25, 12, 9],
  [33, 11, 3],
  [42, 14, 1],
  [52, 15, 0],
  [63, 18, 1],
  [75, 22, 2],
  [89, 28, 7],
  [106, 37, 16],
  [123, 50, 28],
  [140, 64, 44],
  [156, 79, 61],
  [172, 94, 79],
  [188, 109, 97],
  [204, 125, 115],
  [221, 141, 134],
  [238, 157, 154],
  [255, 173, 173],
];

const BROC: readonly Rgb[] = [
  [44, 26, 76],
  [43, 38, 88],
  [42, 49, 100],
  [41, 62, 113],
  [41, 75, 125],
  [46, 88, 137],
  [57, 102, 149],
  [73, 116, 159],
  [91, 130, 169],
  [109, 144, 178],
  [127, 158, 188],
  [146, 172, 198],
  [165, 187, 208],
  [184, 201, 218],
  [203, 216, 228],
  [222, 229, 236],
  [235, 238, 236],
  [237, 238, 225],
  [231, 231, 207],
  [222, 222, 189],
  [212, 212, 170],
  [201, 201, 150],
  [188, 188, 131],
  [172, 172, 113],
  [155, 155, 98],
  [139, 139, 84],
  [123, 123, 71],
  [108, 108, 58],
  [93, 93, 45],
  [78, 78, 33],
  [64, 64, 22],
  [50, 51, 12],
  [38, 38, 0],
];

const CORK: readonly Rgb[] = [
  [44, 25, 76],
  [43, 38, 89],
  [42, 50, 101],
  [40, 63, 114],
  [40, 75, 126],
  [45, 89, 138],
  [56, 102, 149],
  [71, 115, 158],
  [86, 127, 166],
  [102, 139, 175],
  [119, 152, 184],
  [138, 166, 194],
  [158, 181, 204],
  [178, 197, 215],
  [200, 213, 226],
  [220, 229, 235],
  [230, 237, 236],
  [224, 234, 225],
  [207, 223, 207],
  [188, 211, 188],
  [169, 197, 168],
  [149, 184, 149],
  [130, 171, 129],
  [111, 159, 111],
  [93, 147, 93],
  [77, 136, 76],
  [61, 125, 60],
  [45, 112, 44],
  [32, 99, 30],
  [24, 84, 20],
  [20, 69, 14],
  [17, 55, 9],
  [15, 41, 3],
];

const ROMA: readonly Rgb[] = [
  [126, 23, 0],
  [134, 44, 6],
  [143, 60, 12],
  [150, 75, 18],
  [157, 88, 24],
  [163, 101, 30],
  [169, 114, 35],
  [176, 127, 42],
  [182, 140, 50],
  [189, 155, 60],
  [196, 170, 74],
  [203, 186, 93],
  [208, 202, 114],
  [210, 215, 138],
  [209, 226, 161],
  [203, 232, 180],
  [192, 234, 195],
  [179, 233, 205],
  [162, 229, 212],
  [142, 221, 215],
  [121, 210, 215],
  [100, 198, 213],
  [83, 184, 209],
  [68, 171, 204],
  [57, 157, 199],
  [49, 144, 193],
  [43, 132, 188],
  [38, 119, 183],
  [34, 106, 177],
  [30, 93, 171],
  [25, 79, 165],
  [17, 64, 159],
  [3, 49, 152],
];

const VANIMO: readonly Rgb[] = [
  [255, 205, 253],
  [243, 182, 236],
  [230, 160, 220],
  [218, 139, 204],
  [205, 120, 189],
  [192, 103, 174],
  [178, 88, 159],
  [163, 75, 144],
  [146, 62, 128],
  [126, 51, 110],
  [105, 42, 91],
  [84, 33, 72],
  [64, 27, 55],
  [47, 23, 40],
  [36, 20, 30],
  [29, 20, 23],
  [26, 21, 19],
  [25, 24, 17],
  [28, 31, 17],
  [33, 41, 19],
  [41, 53, 22],
  [50, 68, 25],
  [60, 83, 29],
  [71, 98, 33],
  [81, 112, 38],
  [91, 126, 43],
  [101, 140, 49],
  [113, 155, 57],
  [126, 172, 69],
  [140, 190, 85],
  [156, 210, 107],
  [173, 231, 134],
  [190, 253, 165],
];

/** ColorBrewer RdBu, reversed so blue is negative and red positive like the rest. */
const RDBU: readonly Rgb[] = [
  [5, 48, 97],
  [33, 102, 172],
  [67, 147, 195],
  [146, 197, 222],
  [209, 229, 240],
  [247, 247, 247],
  [253, 219, 199],
  [244, 165, 130],
  [214, 96, 77],
  [178, 24, 43],
  [103, 0, 31],
];

/** Every table that `fingerprintColorScale` can sample, keyed by colormap id. */
export const DIVERGING_TABLES = {
  vik: VIK,
  berlin: BERLIN,
  broc: BROC,
  cork: CORK,
  roma: ROMA,
  vanimo: VANIMO,
  rdbu: RDBU,
} as const;

export type DivergingTableId = keyof typeof DIVERGING_TABLES;

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Colour at position `u` along a table, interpolating between the two
 * neighbouring stops. `u` is clamped to [0, 1], so 0.5 is always the map's
 * neutral centre.
 */
export function sampleTable(lut: readonly Rgb[], u: number): Rgb {
  const t = Math.max(0, Math.min(1, u));
  const pos = t * (lut.length - 1);
  const i = Math.floor(pos);
  if (i >= lut.length - 1) return lut[lut.length - 1];
  const f = pos - i;
  const a = lut[i];
  const b = lut[i + 1];
  return [
    lerpChannel(a[0], b[0], f),
    lerpChannel(a[1], b[1], f),
    lerpChannel(a[2], b[2], f),
  ];
}
