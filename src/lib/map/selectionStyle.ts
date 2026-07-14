import {
  BLUE_ON_DARK_RGB,
  BLUE_RGB,
  TEAL_ON_DARK_RGB,
  TEAL_RGB,
  VIOLET_ON_DARK_RGB,
  VIOLET_RGB,
} from "@/lib/constants/theme";

export const SELECTION_GUIDE_COLOR = {
  light: [110, 110, 110, 170] as const,
  dark: [190, 190, 190, 150] as const,
};

export const SELECTION_CELL_COLOR = {
  light: {
    fill: [...TEAL_RGB, 36] as const,
    line: [...TEAL_RGB, 255] as const,
  },
  dark: {
    fill: [255, 255, 255, 48] as const,
    line: [...TEAL_ON_DARK_RGB, 255] as const,
  },
};

/** The downloaded 40x40 patch: a faint fill with a dashed outline. */
export const SELECTION_PATCH_COLOR = {
  light: {
    fill: [...VIOLET_RGB, 14] as const,
    line: [...VIOLET_RGB, 150] as const,
  },
  dark: {
    fill: [...VIOLET_ON_DARK_RGB, 20] as const,
    line: [...VIOLET_ON_DARK_RGB, 170] as const,
  },
};

/** Patches already held in the LRU cache: a faint blue fill and outline. */
export const SELECTION_CACHED_COLOR = {
  light: {
    fill: [...BLUE_RGB, 12] as const,
    line: [...BLUE_RGB, 120] as const,
  },
  dark: {
    fill: [...BLUE_ON_DARK_RGB, 16] as const,
    line: [...BLUE_ON_DARK_RGB, 140] as const,
  },
};

export function rgba(
  [r, g, b, a]: readonly [number, number, number, number],
): string {
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}
