import { yearsToDayRange } from "@/lib/zarr/timeRange";

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

export function dayCountForHistory(historyYears: number): number {
  const [start, stop] = yearsToDayRange(historyYears);
  return stop - start;
}

export function timeSeriesChartTheme(isLight: boolean) {
  return {
    stroke: isLight ? "#006c66" : "#52d4c8",
    grid: isLight ? "rgba(10, 10, 10, 0.08)" : "rgba(255, 255, 255, 0.08)",
    tick: isLight ? "rgba(10, 10, 10, 0.56)" : "rgba(255, 255, 255, 0.56)",
    tooltipBg: isLight ? "#fafaf8" : "#212120",
    tooltipBorder: isLight
      ? "rgba(45, 45, 42, 0.16)"
      : "rgba(255, 255, 255, 0.18)",
  };
}
