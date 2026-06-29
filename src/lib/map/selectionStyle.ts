import { TEAL_ON_DARK_RGB, TEAL_RGB } from "@/lib/constants/theme";

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

export function rgba(
  [r, g, b, a]: readonly [number, number, number, number],
): string {
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}
