"use client";

import { useMemo, type Ref } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  formatSeriesValue,
  TIME_SERIES_CHART_MARGIN,
  TIME_SERIES_PLOT_HEIGHT,
} from "@/lib/plots/chartTheme";
import { dailyMeanSeries } from "@/lib/zarr/series";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const CHART_CONFIG = {
  value: { label: "Daily mean", color: "var(--brand)" },
} satisfies ChartConfig;

type TimeSeriesPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
  height?: number;
  width?: number;
  ref?: Ref<HTMLDivElement>;
};

export function TimeSeriesPlot({
  values,
  units,
  hoursPerDay = 24,
  height = TIME_SERIES_PLOT_HEIGHT,
  width,
  ref,
}: TimeSeriesPlotProps) {
  const data = useMemo(
    () => dailyMeanSeries(values, hoursPerDay),
    [values, hoursPerDay],
  );

  if (data.length === 0) return null;

  return (
    <div className="grid gap-2">
      <ChartContainer
        ref={ref}
        config={CHART_CONFIG}
        initialDimension={{ width: width ?? 320, height }}
        className="aspect-auto w-full"
        style={{ height, width }}
      >
        <LineChart data={data} margin={TIME_SERIES_CHART_MARGIN}>
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            dataKey="day"
            domain={[1, data.length]}
            tickLine={false}
            axisLine={false}
            tickCount={6}
            label={{
              value: "Day in window",
              position: "insideBottom",
              offset: -12,
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatSeriesValue}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  `Day ${payload[0]?.payload.day ?? ""}`
                }
                formatter={(value) =>
                  `${formatSeriesValue(Number(value))}${units ? ` ${units}` : ""}`
                }
              />
            }
          />
          <Line
            type="linear"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="text-muted-foreground">
        {values.length.toLocaleString()} hourly steps · {data.length} daily
        means
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}
