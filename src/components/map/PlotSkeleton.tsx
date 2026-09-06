"use client";

import { TIME_SERIES_PLOT_HEIGHT } from "@/components/map/timeSeriesChartConfig";

/**
 * The loading state for both plots: a block the size of the plot with a bar for
 * the strip beneath it, pulsing.
 *
 * Shared rather than written twice so the two cannot drift. The line chart used
 * to render an empty Recharts frame here, which read as a plot with no data in
 * it rather than one still arriving.
 */
export function PlotSkeleton({
  fill = false,
}: {
  /**
   * Grow to fill the panel instead of standing at the chart's own height. The
   * transposed fingerprint puts days down the vertical axis and wants the room.
   */
  fill?: boolean;
} = {}) {
  return (
    <div
      className={`w-full min-w-0 ${fill ? "flex-1 min-h-[380px]" : ""}`}
      aria-hidden="true"
    >
      <div
        className="w-full animate-pulse rounded-md bg-editor-bg-secondary"
        style={
          fill
            ? { minHeight: "380px", height: "100%" }
            : { height: TIME_SERIES_PLOT_HEIGHT }
        }
      />
      <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-editor-bg-secondary" />
    </div>
  );
}
