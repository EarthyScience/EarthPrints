"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatSeriesValue,
  TIME_SERIES_CHART_MARGIN,
  TIME_SERIES_PLOT_HEIGHT,
  timeSeriesChartTheme,
} from "@/components/map/timeSeriesChartConfig";
import { dailyMeanSeries } from "@/lib/zarr/series";
import { useTheme } from "@/providers/ThemeProvider";

export { TIME_SERIES_PLOT_HEIGHT } from "@/components/map/timeSeriesChartConfig";

type TimeSeriesPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
};

export function TimeSeriesPlot({
  values,
  units,
  hoursPerDay = 24,
}: TimeSeriesPlotProps) {
  const { isLight } = useTheme();
  const data = useMemo(
    () => dailyMeanSeries(values, hoursPerDay),
    [values, hoursPerDay],
  );

  const { stroke, grid, tick, tooltipBg, tooltipBorder } =
    timeSeriesChartTheme(isLight);

  if (data.length === 0) return null;

  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={TIME_SERIES_PLOT_HEIGHT}>
        <LineChart data={data} margin={TIME_SERIES_CHART_MARGIN}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            dataKey="day"
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
            tick={{ fill: tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatSeriesValue}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={(day) => `Day ${day}`}
            formatter={(value) => [
              `${formatSeriesValue(Number(value))}${units ? ` ${units}` : ""}`,
              "Daily mean",
            ]}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: stroke, stroke: stroke, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 font-mono text-xs leading-normal text-editor-fg-tertiary">
        {values.length.toLocaleString()} hourly steps · {data.length} daily means
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}
