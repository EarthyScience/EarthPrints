export const HERO_SEED = 41.7;

export const TEAL_RGB = [0, 108, 102] as const;

/** Bright teal for dark UI (matches --accent in dark mode). */
export const TEAL_ON_DARK_RGB = [82, 212, 200] as const;

/** Violet accent for the downloaded patch, distinct from the teal cell. */
export const VIOLET_RGB = [85, 71, 206] as const;
export const VIOLET_ON_DARK_RGB = [137, 124, 253] as const;

/** Azure blue for patches already cached in memory. */
export const BLUE_RGB = [1, 64, 151] as const;
export const BLUE_ON_DARK_RGB = [73, 151, 255] as const;

export const COLD_RGB = {
  light: [120, 120, 118] as const,
  dark: [150, 150, 150] as const,
};

export const HERO_BASE_COLOR = {
  light: "#F4F4F2",
  dark: "#070707",
} as const;
