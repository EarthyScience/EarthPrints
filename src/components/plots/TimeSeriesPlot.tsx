"use client";

import { useMemo, useRef, useState, type Ref } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatSeriesValue,
  TIME_SERIES_CHART_MARGIN,
  TIME_SERIES_PLOT_HEIGHT,
} from "@/lib/plots/chartTheme";
import {
  lineSeries,
  type LinePoint,
  type LineResolution,
} from "@/lib/plots/lineSeries";
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
  value: { label: "Mean", color: "var(--brand)" },
} satisfies ChartConfig;

const MEANS_LABEL: Record<Exclude<LineResolution, "hour">, string> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

type Readout = TooltipAnchor & PinPosition & { index: number };

const sameDay = (a: Readout, b: Readout) => a.index === b.index;

function tooltipPoint(point: LinePoint | undefined): TooltipPoint | undefined {
  if (!point) return undefined;
  const { label, shortLabel, value, spread } = point;
  return { label, shortLabel, value, spread };
}

type TimeSeriesPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
  selectedYears: number[];
  resolution?: LineResolution;
  timeBasisSuffix?: string;
  height?: number;
  width?: number;
  pinLimit?: number;
  ref?: Ref<HTMLDivElement>;
};

export function TimeSeriesPlot({
  values,
  units,
  hoursPerDay = 24,
  selectedYears,
  resolution = "day",
  timeBasisSuffix,
  height = TIME_SERIES_PLOT_HEIGHT,
  width,
  pinLimit = 1,
  ref,
}: TimeSeriesPlotProps) {
  const series = useMemo(
    () =>
      lineSeries(
        values,
        hoursPerDay,
        selectedYears,
        resolution,
        timeBasisSuffix,
      ),
    [values, hoursPerDay, selectedYears, resolution, timeBasisSuffix],
  );
  const data = series.points;

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
  const shownPoint = shown ? tooltipPoint(data[shown.index]) : undefined;

  return (
    <div ref={wrapperRef} className="relative grid gap-2">
      <ChartContainer
        ref={ref}
        config={CHART_CONFIG}
        initialDimension={{ width: width ?? 320, height }}
        className="aspect-auto w-full"
        style={{ height, width }}
      >
        <ComposedChart
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
            dataKey="x"
            domain={[0, Math.max(1, series.nDays)]}
            ticks={series.ticks.map((tick) => tick.x)}
            tickFormatter={(x: number) =>
              series.ticks.find((tick) => tick.x === x)?.label ?? ""
            }
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatSeriesValue}
          />
          {series.yearBreaks.map((x) => (
            <ReferenceLine
              key={`year-${x}`}
              x={x}
              stroke="var(--border)"
            />
          ))}
          {desktop
            ? pins.map((pin) => (
                <ReferenceLine
                  key={pin.index}
                  x={data[pin.index]?.x}
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
                    payload[0]?.payload.label ?? ""
                  }
                  formatter={(value) =>
                    `${formatSeriesValue(Number(value))}${units ? ` ${units}` : ""}`
                  }
                />
              )
            }
          />
          {resolution === "hour" ? null : (
            <Area
              type="linear"
              dataKey="band"
              stroke="none"
              fill="var(--color-value)"
              fillOpacity={0.18}
              tooltipType="none"
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="linear"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={resolution === "hour" ? 0.5 : 1.5}
            strokeOpacity={resolution === "hour" ? 0.7 : 1}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      {desktop && separate
        ? pins.map((pin) => {
            const point = tooltipPoint(data[pin.index]);
            if (!point) return null;
            return (
              <PinnedTooltip
                key={pin.index}
                point={point}
                previous={tooltipPoint(data[pin.index - 1])}
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
              ? tooltipPoint(data[lastPin.index])
              : tooltipPoint(data[hover.index - 1])
          }
          anchor={hover}
          units={units}
        />
      ) : null}
      {desktop && !separate && shown && shownPoint ? (
        <MapSideTooltip
          point={shownPoint}
          previous={tooltipPoint(data[shown.index - 1])}
          compared={
            pinned && hover && hover.index !== pinned.index
              ? tooltipPoint(data[hover.index])
              : undefined
          }
          anchor={shown}
          units={units}
          onClose={pinned ? () => setPins([]) : undefined}
        />
      ) : null}
      <p className="text-muted-foreground">
        {values.length.toLocaleString()} hourly steps
        {resolution === "hour"
          ? ""
          : ` · ${series.binCount.toLocaleString()} ${MEANS_LABEL[resolution]} means, band ±1 std`}
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}
