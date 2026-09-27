export const TIME_SERIES_PLOT_HEIGHT = 220;

export const TIME_SERIES_CHART_MARGIN = {
  top: 12,
  right: 8,
  left: 0,
  bottom: 20,
} as const;

export function formatSeriesValue(value: number): string {
  return value.toFixed(2);
}

export function chartTickColor(isLight: boolean): string {
  return isLight ? "rgba(10, 10, 10, 0.56)" : "rgba(255, 255, 255, 0.56)";
}
