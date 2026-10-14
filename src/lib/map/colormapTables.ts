/**
 * Lookup tables for the diverging colour maps offered by the fingerprint plot.
 *
 * These are Fabio Crameri's perceptually uniform, colourblind-safe scientific
 * colour maps, downsampled from the official 256-entry tables (version 8.0.0)
 * to 33 stops by taking entry round(i * 255 / 32) (indistinguishable once
 * interpolated, small enough to read in a diff). RdBu is the familiar
 * ColorBrewer ramp, kept as a non-uniform reference point. Sources and licences
 * are in THIRD_PARTY_NOTICES.md.
 *
 * Every table here is diverging with a neutral centre, so stop 16 of 33 is the
 * zero colour. `vik`, `broc`, `cork`, `bam` and `roma` are light-centred; `berlin`,
 * `lisbon`, `tofino`, `vanimo` and `managua` are their dark-centred
 * counterparts, so a near-zero cell recedes into a dark panel instead of
 * glowing (see `onDarkPanel`). The Flux palette is not here: it is two sequential CET
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

const LISBON: readonly Rgb[] = [
  [230, 229, 255],
  [208, 214, 242],
  [187, 198, 229],
  [165, 183, 217],
  [144, 167, 204],
  [124, 152, 192],
  [104, 137, 179],
  [84, 121, 166],
  [65, 106, 151],
  [48, 90, 134],
  [36, 76, 116],
  [27, 63, 97],
  [22, 51, 79],
  [18, 40, 62],
  [17, 31, 46],
  [18, 25, 33],
  [23, 25, 25],
  [30, 29, 23],
  [40, 38, 26],
  [53, 50, 32],
  [67, 63, 40],
  [81, 76, 49],
  [96, 90, 57],
  [111, 105, 67],
  [127, 120, 76],
  [143, 135, 88],
  [160, 152, 101],
  [177, 169, 117],
  [193, 186, 135],
  [209, 203, 154],
  [224, 220, 175],
  [240, 238, 195],
  [255, 255, 217],
];

const TOFINO: readonly Rgb[] = [
  [222, 217, 255],
  [200, 202, 246],
  [179, 187, 236],
  [158, 172, 227],
  [136, 157, 217],
  [115, 141, 206],
  [95, 125, 193],
  [76, 109, 175],
  [62, 94, 154],
  [52, 80, 134],
  [44, 68, 113],
  [36, 56, 93],
  [29, 45, 74],
  [23, 35, 56],
  [18, 26, 40],
  [15, 21, 27],
  [13, 22, 19],
  [15, 27, 18],
  [18, 35, 20],
  [22, 47, 25],
  [28, 59, 31],
  [34, 72, 37],
  [40, 86, 44],
  [47, 100, 52],
  [55, 115, 60],
  [65, 131, 69],
  [80, 147, 80],
  [100, 164, 92],
  [124, 179, 105],
  [148, 192, 118],
  [172, 205, 131],
  [195, 217, 143],
  [219, 230, 155],
];

const BAM: readonly Rgb[] = [
  [101, 2, 75],
  [119, 23, 93],
  [136, 39, 110],
  [151, 53, 126],
  [165, 67, 140],
  [178, 80, 153],
  [189, 94, 165],
  [200, 110, 176],
  [209, 127, 188],
  [217, 145, 198],
  [224, 163, 208],
  [231, 181, 218],
  [236, 198, 226],
  [241, 213, 233],
  [245, 226, 239],
  [246, 235, 241],
  [246, 241, 240],
  [243, 243, 237],
  [238, 242, 228],
  [229, 239, 213],
  [216, 232, 194],
  [200, 222, 171],
  [181, 210, 146],
  [161, 196, 122],
  [141, 181, 101],
  [122, 167, 84],
  [105, 153, 70],
  [90, 141, 58],
  [76, 129, 47],
  [62, 117, 37],
  [48, 104, 25],
  [32, 90, 13],
  [13, 76, 0],
];

const MANAGUA: readonly Rgb[] = [
  [255, 207, 103],
  [245, 191, 98],
  [235, 176, 93],
  [225, 161, 88],
  [216, 147, 83],
  [206, 134, 79],
  [197, 121, 74],
  [187, 109, 70],
  [177, 98, 67],
  [166, 87, 63],
  [154, 76, 61],
  [142, 66, 58],
  [129, 57, 57],
  [116, 49, 57],
  [105, 43, 60],
  [95, 41, 65],
  [87, 41, 73],
  [82, 44, 83],
  [78, 50, 96],
  [76, 59, 111],
  [76, 69, 127],
  [77, 81, 142],
  [80, 93, 156],
  [83, 105, 168],
  [87, 117, 179],
  [92, 129, 189],
  [96, 142, 199],
  [102, 156, 208],
  [107, 170, 218],
  [112, 184, 227],
  [118, 199, 236],
  [123, 215, 245],
  [129, 231, 255],
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

/** The dark theme's panel colour, `--editor-bg-primary` in `globals.css`. */
export const DARK_PANEL: Rgb = [33, 33, 32];

/**
 * The dark-centred maps bottom out darker than the dark panel, so near-zero
 * cells read as a black band instead of receding. Shift the centre stop onto
 * the panel colour and fade the shift linearly to nothing at both ends; the
 * shift changes more slowly than the maps brighten, so lightness still rises
 * steadily away from zero.
 */
function onDarkPanel(lut: readonly Rgb[]): readonly Rgb[] {
  const mid = (lut.length - 1) / 2;
  const centre = lut[mid];
  return lut.map(([r, g, b], i) => {
    const w = 1 - Math.abs(i - mid) / mid;
    return [
      Math.round(r + (DARK_PANEL[0] - centre[0]) * w),
      Math.round(g + (DARK_PANEL[1] - centre[1]) * w),
      Math.round(b + (DARK_PANEL[2] - centre[2]) * w),
    ];
  });
}

/** Every table that `fingerprintColorScale` can sample, keyed by colormap id. */
export const DIVERGING_TABLES = {
  vik: VIK,
  berlin: onDarkPanel(BERLIN),
  broc: BROC,
  cork: CORK,
  roma: ROMA,
  vanimo: onDarkPanel(VANIMO),
  lisbon: onDarkPanel(LISBON),
  tofino: onDarkPanel(TOFINO),
  bam: BAM,
  managua: onDarkPanel(MANAGUA),
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
