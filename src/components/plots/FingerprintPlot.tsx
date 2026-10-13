"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  asymmetricExtents,
  COLORMAPS,
  type ColormapId,
  fingerprintColorScale,
  formatIsoDate,
} from "@/lib/map/fingerprintScale";
import {
  formatSeriesValue,
  TIME_SERIES_PLOT_HEIGHT,
} from "@/lib/plots/chartTheme";
import {
  drawFingerprint,
  type FingerprintCell,
  fingerprintCellAt,
  fingerprintLayout,
} from "@/lib/plots/fingerprint";
import { useTheme } from "@/providers/ThemeProvider";
import {
  anchorBesidePanel,
  MapSideTooltip,
  PinnedTooltip,
  pinPosition,
  togglePin,
  useDesktop,
  type TooltipAnchor,
  type TooltipPoint,
} from "@/components/plots/MapSideTooltip";

const LEGEND_STOPS = 32;
const TRANSPOSED_MIN_HEIGHT = 380;

type FingerprintPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
  selectedYears: number[];
  timeBasisLabel?: string;
  transposed: boolean;
  colormapId: ColormapId;
  height?: number;
  pinLimit?: number;
};

type Hover = FingerprintCell & {
  left: number;
  top: number;
  flip: boolean;
  anchor: TooltipAnchor | null;
};

const sameCell = (a: Hover, b: Hover) =>
  a.dayLocal === b.dayLocal && a.hour === b.hour;

export function FingerprintPlot({
  values,
  units,
  hoursPerDay = 24,
  selectedYears,
  timeBasisLabel,
  transposed,
  colormapId,
  height: heightOverride,
  pinLimit = 1,
}: FingerprintPlotProps) {
  const { isLight } = useTheme();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pins, setPins] = useState<Hover[]>([]);
  const [pinnedValues, setPinnedValues] = useState(values);
  if (pinnedValues !== values) {
    setPinnedValues(values);
    setPins([]);
  }
  const desktop = useDesktop();

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const height =
    heightOverride ??
    (transposed ? TRANSPOSED_MIN_HEIGHT : TIME_SERIES_PLOT_HEIGHT);
  const layout = useMemo(
    () =>
      fingerprintLayout(
        values,
        hoursPerDay,
        selectedYears,
        { width, height },
        transposed,
      ),
    [values, hoursPerDay, selectedYears, width, height, transposed],
  );
  const extents = useMemo(() => asymmetricExtents(values), [values]);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawFingerprint(canvasRef.current, layout, {
      colormapId,
      extents,
      isLight,
      pixelRatio: window.devicePixelRatio || 1,
    });
  }, [layout, colormapId, extents, isLight]);

  const legend = useMemo(() => {
    const total = extents.negMax + extents.posMax;
    const zeroFrac = total > 0 ? extents.negMax / total : 0.5;
    const scale = fingerprintColorScale(colormapId);
    const stops = Array.from({ length: LEGEND_STOPS }, (_, i) => {
      const frac = i / (LEGEND_STOPS - 1);
      const value =
        frac <= zeroFrac
          ? zeroFrac > 0
            ? -extents.negMax * (1 - frac / zeroFrac)
            : 0
          : 1 - zeroFrac > 0
            ? extents.posMax * ((frac - zeroFrac) / (1 - zeroFrac))
            : 0;
      return `${scale(value, extents.negMax, extents.posMax)} ${(frac * 100).toFixed(1)}%`;
    });
    return {
      gradient: `linear-gradient(to right, ${stops.join(", ")})`,
      zeroPct: zeroFrac * 100,
    };
  }, [colormapId, extents]);

  if (layout.nDays === 0) return null;

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = event.clientX - rect.left;
    const top = event.clientY - rect.top;
    const cell = fingerprintCellAt(layout, left, top);
    const anchor = anchorBesidePanel(
      wrapperRef.current,
      event.clientX,
      event.clientY,
    );
    const { flip } = pinPosition(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    setHover(cell ? { ...cell, left, top, flip, anchor } : null);
  };

  const pointAt = (
    dayLocal: number,
    hour: number,
    short: "time" | "full",
  ): TooltipPoint | undefined => {
    if (dayLocal < 0 || hour < 0) return undefined;
    const day = layout.mapping.absoluteDays[dayLocal] ?? dayLocal;
    const time = `${String(hour).padStart(2, "0")}:00`;
    const suffix = timeBasisLabel ? ` ${hoverBasisSuffix(timeBasisLabel)}` : "";
    return {
      label: `${formatIsoDate(day)} · ${time}${suffix}`,
      shortLabel: short === "time" ? time : `${formatIsoDate(day)} ${time}`,
      value: layout.values[dayLocal * hoursPerDay + hour] as number,
    };
  };
  const previousOf = (cell: FingerprintCell) =>
    cell.hour > 0
      ? pointAt(cell.dayLocal, cell.hour - 1, "time")
      : pointAt(cell.dayLocal - 1, hoursPerDay - 1, "full");

  const separate = pinLimit > 1;
  const pinned = separate ? null : (pins[0] ?? null);
  const lastPin = pins.at(-1);
  const shown = pinned ?? hover;
  const comparing =
    pinned &&
    hover &&
    (hover.dayLocal !== pinned.dayLocal || hover.hour !== pinned.hour);

  return (
    <div className="grid gap-2">
      <div ref={wrapperRef} className="relative w-full" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="block size-full"
          role="img"
          aria-label="Diurnal fingerprint heatmap"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={() => {
            if (desktop && hover?.anchor) {
              setPins((current) =>
                togglePin(current, hover, pinLimit, sameCell),
              );
            }
          }}
        />
        {desktop && separate
          ? pins.map((pin) => (
              <PinnedTooltip
                key={`${pin.dayLocal}-${pin.hour}`}
                point={pointAt(pin.dayLocal, pin.hour, "full")!}
                previous={previousOf(pin)}
                position={{ x: pin.left, y: pin.top, flip: pin.flip }}
                units={units}
                onClose={() =>
                  setPins((current) =>
                    current.filter((other) => !sameCell(other, pin)),
                  )
                }
              />
            ))
          : null}
        {desktop && separate
          ? pins.map((pin) => (
              <span
                key={`${pin.dayLocal}-${pin.hour}`}
                aria-hidden="true"
                className="pointer-events-none absolute size-2 -translate-1/2 rounded-full bg-foreground ring-2 ring-background"
                style={{ left: pin.left, top: pin.top }}
              />
            ))
          : null}
        {!desktop && hover ? (
          <div
            className="pointer-events-none absolute grid -translate-x-1/2 gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl"
            style={{
              left: Math.max(48, Math.min(width - 48, hover.left)),
              top: Math.max(0, hover.top - 52),
            }}
          >
            <span className="font-medium">
              {formatIsoDate(hover.absoluteDay)} ·{" "}
              {String(hover.hour).padStart(2, "0")}:00
              {timeBasisLabel ? ` ${hoverBasisSuffix(timeBasisLabel)}` : ""}
            </span>
            <span className="text-muted-foreground">
              {Number.isFinite(hover.value)
                ? `${formatSeriesValue(hover.value)}${units ? ` ${units}` : ""}`
                : "no data"}
            </span>
          </div>
        ) : null}
      </div>
      {desktop &&
      separate &&
      hover?.anchor &&
      !pins.some((pin) => sameCell(pin, hover)) ? (
        <MapSideTooltip
          point={pointAt(hover.dayLocal, hover.hour, "full")!}
          previous={
            lastPin
              ? pointAt(lastPin.dayLocal, lastPin.hour, "full")
              : previousOf(hover)
          }
          anchor={hover.anchor}
          units={units}
        />
      ) : null}
      {desktop && !separate && shown?.anchor ? (
        <MapSideTooltip
          point={pointAt(shown.dayLocal, shown.hour, "full")!}
          previous={previousOf(shown)}
          compared={
            comparing ? pointAt(hover.dayLocal, hover.hour, "full") : undefined
          }
          anchor={shown.anchor}
          units={units}
          onClose={pinned ? () => setPins([]) : undefined}
        />
      ) : null}

      <div className="grid gap-1">
        <div
          className="h-2 w-full rounded-full"
          style={{ background: legend.gradient }}
          aria-hidden="true"
          title={COLORMAPS[colormapId].label}
        />
        <div className="relative h-4 text-xs text-muted-foreground tabular-nums">
          <span className="absolute left-0">
            {formatSeriesValue(-extents.negMax)}
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${legend.zeroPct.toFixed(1)}%` }}
          >
            0
          </span>
          <span className="absolute right-0">
            {formatSeriesValue(extents.posMax)}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground">
        {Math.max(1, layout.nDays).toLocaleString()} days × {hoursPerDay} hours
        {timeBasisLabel ? ` · ${timeBasisLabel}` : ""}
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}

function hoverBasisSuffix(timeBasisLabel: string): string {
  return timeBasisLabel.startsWith("local") ? "local" : timeBasisLabel;
}
