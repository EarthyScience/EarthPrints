"use client";

import {
  CartesianGrid,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  dayCountForHistory,
  formatSeriesValue,
  TIME_SERIES_CHART_MARGIN,
  TIME_SERIES_PLOT_HEIGHT,
  timeSeriesChartTheme,
} from "@/components/map/timeSeriesChartConfig";
import { useTheme } from "@/providers/ThemeProvider";

type TimeSeriesPlotLoadingProps = {
  historyYears: number;
};

export function TimeSeriesPlotLoading({
  historyYears,
}: TimeSeriesPlotLoadingProps) {
  const { isLight } = useTheme();
  const { grid, tick } = timeSeriesChartTheme(isLight);
  const dayCount = dayCountForHistory(historyYears);

  return (
    <div
      className="relative w-full min-w-0"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading time series"
    >
      <ResponsiveContainer width="100%" height={TIME_SERIES_PLOT_HEIGHT}>
        <LineChart data={[]} margin={TIME_SERIES_CHART_MARGIN}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            type="number"
            domain={[1, dayCount]}
            allowDataOverflow
            tick={{ fill: tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickCount={6}
            label={{
              value: "Day in window",
              position: "insideBottom",
              offset: -12,
              fill: tick,
              fontSize: 11,
            }}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickCount={5}
            tickFormatter={formatSeriesValue}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="pointer-events-none absolute inset-[12px_8px_28px_48px] m-0 grid place-items-center text-[13px] text-editor-fg-tertiary">
        Loading…
      </p>
    </div>
  );
}
