"use client";

import { useMemo, useRef, useState, type Ref } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatSeriesValue,
  TIME_SERIES_CHART_MARGIN,
  TIME_SERIES_PLOT_HEIGHT,
} from "@/lib/plots/chartTheme";
import { dailyMeanSeries, type DailyMeanPoint } from "@/lib/zarr/series";
import {
  anchorBesidePanel,
  MapSideTooltip,
  PinnedTooltip,
  pinPosition,
  togglePin,
  useDesktop,
  type PinPosition,
  type TooltipAnchor,
  type TooltipPoint,
} from "@/components/plots/MapSideTooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const CHART_CONFIG = {
  value: { label: "Daily mean", color: "var(--brand)" },
} satisfies ChartConfig;

type Readout = TooltipAnchor & PinPosition & { index: number };

const sameDay = (a: Readout, b: Readout) => a.index === b.index;

function dayPoint(point: DailyMeanPoint | undefined): TooltipPoint | undefined {
  if (!point) return undefined;
  const label = `Day ${point.day}`;
  return { label, shortLabel: label.toLowerCase(), value: point.value };
}

type TimeSeriesPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
  height?: number;
  width?: number;
  pinLimit?: number;
  ref?: Ref<HTMLDivElement>;
};

export function TimeSeriesPlot({
  values,
  units,
  hoursPerDay = 24,
  height = TIME_SERIES_PLOT_HEIGHT,
  width,
  pinLimit = 1,
  ref,
}: TimeSeriesPlotProps) {
  const data = useMemo(
    () => dailyMeanSeries(values, hoursPerDay),
    [values, hoursPerDay],
  );

  const desktop = useDesktop();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Readout | null>(null);
  const [pins, setPins] = useState<Readout[]>([]);
  const [pinnedData, setPinnedData] = useState(data);
  if (pinnedData !== data) {
    setPinnedData(data);
    setPins([]);
  }

  if (data.length === 0) return null;

  const readoutAt = (
    index: unknown,
    clientX: number,
    clientY: number,
  ): Readout | null => {
    const wrapper = wrapperRef.current;
    const anchor = anchorBesidePanel(wrapper, clientX, clientY);
    const at = Number(index);
    if (index == null || !Number.isInteger(at) || !anchor || !wrapper) {
      return null;
    }
    return { ...anchor, ...pinPosition(wrapper, clientX, clientY), index: at };
  };

  const separate = pinLimit > 1;
  const pinned = separate ? null : (pins[0] ?? null);
  const lastPin = pins.at(-1);
  const shown = pinned ?? hover;
  const shownPoint = shown ? dayPoint(data[shown.index]) : undefined;

  return (
    <div ref={wrapperRef} className="relative grid gap-2">
      <ChartContainer
        ref={ref}
        config={CHART_CONFIG}
        initialDimension={{ width: width ?? 320, height }}
        className="aspect-auto w-full"
        style={{ height, width }}
      >
        <LineChart
          data={data}
          margin={TIME_SERIES_CHART_MARGIN}
          onMouseMove={(state, event) =>
            setHover(readoutAt(state.activeIndex, event.clientX, event.clientY))
          }
          onMouseLeave={() => setHover(null)}
          // Recharts reports no active index on click, so pin the hovered day.
          onClick={() => {
            if (desktop && hover) {
              setPins((current) =>
                togglePin(current, hover, pinLimit, sameDay),
              );
            }
          }}
        >
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
          {desktop
            ? pins.map((pin) => (
                <ReferenceLine
                  key={pin.index}
                  x={data[pin.index]?.day}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                />
              ))
            : null}
          <ChartTooltip
            content={
              desktop ? (
                () => null
              ) : (
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    `Day ${payload[0]?.payload.day ?? ""}`
                  }
                  formatter={(value) =>
                    `${formatSeriesValue(Number(value))}${units ? ` ${units}` : ""}`
                  }
                />
              )
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
      {desktop && separate
        ? pins.map((pin) => {
            const point = dayPoint(data[pin.index]);
            if (!point) return null;
            return (
              <PinnedTooltip
                key={pin.index}
                point={point}
                previous={dayPoint(data[pin.index - 1])}
                position={pin}
                units={units}
                onClose={() =>
                  setPins((current) =>
                    current.filter((other) => !sameDay(other, pin)),
                  )
                }
              />
            );
          })
        : null}
      {desktop &&
      separate &&
      hover &&
      shownPoint &&
      !pins.some((pin) => sameDay(pin, hover)) ? (
        <MapSideTooltip
          point={shownPoint}
          previous={
            lastPin
              ? dayPoint(data[lastPin.index])
              : dayPoint(data[hover.index - 1])
          }
          anchor={hover}
          units={units}
        />
      ) : null}
      {desktop && !separate && shown && shownPoint ? (
        <MapSideTooltip
          point={shownPoint}
          previous={dayPoint(data[shown.index - 1])}
          compared={
            pinned && hover && hover.index !== pinned.index
              ? dayPoint(data[hover.index])
              : undefined
          }
          anchor={shown}
          units={units}
          onClose={pinned ? () => setPins([]) : undefined}
        />
      ) : null}
      <p className="text-muted-foreground">
        {values.length.toLocaleString()} hourly steps · {data.length} daily
        means
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}
