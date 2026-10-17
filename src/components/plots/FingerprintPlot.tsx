"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  asymmetricExtents,
  COLORMAPS,
  type ColormapId,
  fingerprintColorScale,
} from "@/lib/map/fingerprintScale";
import {
  formatSeriesValue,
  TIME_SERIES_PLOT_HEIGHT,
} from "@/lib/plots/chartTheme";
import {
  drawFingerprint,
  type FingerprintCell,
  fingerprintCellAt,
  fingerprintGrid,
  type FingerprintLayout,
} from "@/lib/plots/fingerprint";
import {
  binCountLabel,
  type BinUnit,
  formatBinLabel,
  formatBinShortLabel,
} from "@/lib/plots/timeBins";
import { shortTimeBasis } from "@/lib/zarr/localTime";
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
  scale?: BinUnit;
  height?: number;
  pinLimit?: number;
};

type Hover = FingerprintCell & {
  left: number;
  top: number;
  flip: boolean;
  anchor: TooltipAnchor | null;
};

const sameCell = (a: Hover, b: Hover) => a.col === b.col && a.hour === b.hour;

export function FingerprintPlot({
  values,
  units,
  hoursPerDay = 24,
  selectedYears,
  timeBasisLabel,
  transposed,
  colormapId,
  scale = "day",
  height: heightOverride,
  pinLimit = 1,
}: FingerprintPlotProps) {
  const { isLight } = useTheme();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pins, setPins] = useState<Hover[]>([]);
  const grid = useMemo(
    () => fingerprintGrid(values, hoursPerDay, selectedYears, scale),
    [values, hoursPerDay, selectedYears, scale],
  );
  const [pinnedGrid, setPinnedGrid] = useState(grid);
  if (pinnedGrid !== grid) {
    setPinnedGrid(grid);
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
  const layout: FingerprintLayout = useMemo(
    () => ({ grid, width, height, transposed }),
    [grid, width, height, transposed],
  );
  const extents = useMemo(() => asymmetricExtents(grid.mean), [grid]);
  const nCols = grid.bins.length;

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

  if (nCols === 0) return null;

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
    col: number,
    hour: number,
    short: "time" | "full",
  ): TooltipPoint | undefined => {
    const bin = grid.bins[col];
    if (!bin || hour < 0) return undefined;
    const at = col * hoursPerDay + hour;
    const count = grid.count[at] ?? 0;
    const time = `${String(hour).padStart(2, "0")}:00`;
    const suffix = timeBasisLabel ? ` ${shortTimeBasis(timeBasisLabel)}` : "";
    return {
      label: `${formatBinLabel(bin, scale)} · ${time}${suffix}`,
      shortLabel:
        short === "time" ? time : `${formatBinShortLabel(bin, scale)} ${time}`,
      value: grid.mean[at] as number,
      spread:
        scale !== "day" && count > 0
          ? `Std ${formatSeriesValue(grid.std[at] as number)} across ${binCountLabel(count, "day")}`
          : undefined,
    };
  };
  const previousOf = (cell: FingerprintCell) =>
    cell.hour > 0
      ? pointAt(cell.col, cell.hour - 1, "time")
      : pointAt(cell.col - 1, hoursPerDay - 1, "full");

  const separate = pinLimit > 1;
  const pinned = separate ? null : (pins[0] ?? null);
  const lastPin = pins.at(-1);
  const shown = pinned ?? hover;
  const hoverPoint =
    hover && !desktop
      ? {
          ...pointAt(hover.col, hover.hour, "full")!,
          left: hover.left,
          top: hover.top,
        }
      : null;
  const comparing =
    pinned &&
    hover &&
    (hover.col !== pinned.col || hover.hour !== pinned.hour);

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
                key={`${pin.col}-${pin.hour}`}
                point={pointAt(pin.col, pin.hour, "full")!}
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
                key={`${pin.col}-${pin.hour}`}
                aria-hidden="true"
                className="pointer-events-none absolute size-2 -translate-1/2 rounded-full bg-foreground ring-2 ring-background"
                style={{ left: pin.left, top: pin.top }}
              />
            ))
          : null}
        {!desktop && hoverPoint ? (
          <div
            className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-full gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl"
            style={{
              left: Math.max(48, Math.min(width - 48, hoverPoint.left)),
              top: Math.max(0, hoverPoint.top - 8),
            }}
          >
            <span className="font-medium">{hoverPoint.label}</span>
            <span className="text-muted-foreground">
              {Number.isFinite(hoverPoint.value)
                ? `${formatSeriesValue(hoverPoint.value)}${units ? ` ${units}` : ""}`
                : "no data"}
            </span>
            {hoverPoint.spread ? (
              <span className="text-muted-foreground">{hoverPoint.spread}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {desktop &&
      separate &&
      hover?.anchor &&
      !pins.some((pin) => sameCell(pin, hover)) ? (
        <MapSideTooltip
          point={pointAt(hover.col, hover.hour, "full")!}
          previous={
            lastPin
              ? pointAt(lastPin.col, lastPin.hour, "full")
              : previousOf(hover)
          }
          anchor={hover.anchor}
          units={units}
        />
      ) : null}
      {desktop && !separate && shown?.anchor ? (
        <MapSideTooltip
          point={pointAt(shown.col, shown.hour, "full")!}
          previous={previousOf(shown)}
          compared={
            comparing ? pointAt(hover.col, hover.hour, "full") : undefined
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
        {binCountLabel(nCols, scale)} × {hoursPerDay} hours
        {timeBasisLabel ? ` · ${timeBasisLabel}` : ""}
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}
