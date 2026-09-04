"use client";

import { TIME_SERIES_PLOT_HEIGHT } from "@/components/map/timeSeriesChartConfig";

/**
 * Placeholder matching the fingerprint canvas footprint so the loading branch
 * keeps the same height as the rendered plot, mirroring TimeSeriesPlotLoading.
 */
export function FingerprintPlotLoading({
  transposed = false,
}: {
  transposed?: boolean;
} = {}) {
  return (
    <div
      className={`w-full min-w-0 ${transposed ? "flex-1 min-h-[380px]" : ""}`}
      aria-hidden="true"
    >
      <div
        className="w-full animate-pulse rounded-md bg-editor-bg-secondary"
        style={
          transposed
            ? { minHeight: "380px", height: "100%" }
            : { height: TIME_SERIES_PLOT_HEIGHT }
        }
      />
      <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-editor-bg-secondary" />
    </div>
  );
}
