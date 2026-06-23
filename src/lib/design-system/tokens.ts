/** Design tokens for canvas, WebGL, and other non-CSS consumers. */

export const colors = {
  accentSolid: "#006c66",
  accentDark: "#52d4c8",
  accentBrightLight: "#00837b",
  accentBrightDark: "#7df5e8",
  pageLight: "#f2f1ee",
  pageDark: "#242424",
  mapLight: "#f4f4f2",
  mapDark: "#000000",
  textLight: "#0a0a0a",
  textDark: "#ffffff",
} as const;

/** RGB tuples aligned with `--accent` / `--accent-solid` in tokens.css */
export const accentRgb = {
  light: [0, 108, 102] as const,
  onDark: [82, 212, 200] as const,
} as const;

export const accentBrightRgb = {
  light: [0, 131, 123] as const,
  dark: [125, 245, 232] as const,
} as const;

export const coldRgb = {
  light: [120, 120, 118] as const,
  dark: [150, 150, 150] as const,
} as const;

export const heroBaseColor = {
  light: colors.pageLight,
  dark: colors.pageDark,
} as const;

export const spacing = {
  pageX: "clamp(16px, 3vw, 28px)",
  pageWide: "clamp(22px, 6vw, 84px)",
} as const;

export const radius = {
  sm: "10px",
  md: "14px",
  lg: "18px",
  pill: "100px",
} as const;

/** CSS class names for shared primitives — use in components for consistency. */
export const primitives = {
  island: "island",
  elevatedChip: "elevated-chip",
  brandWord: "ds-brand-word",
  title: "ds-title",
  kicker: "ds-kicker",
  label: "ds-label",
  hint: "ds-hint",
  navLink: "ds-nav-link",
  enter: "ds-enter",
} as const;
