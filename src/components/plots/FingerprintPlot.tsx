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
  fingerprintGrid,
  type FingerprintLayout,
  FINGERPRINT_STRIP_HEIGHT,
  type FingerprintTarget,
  fingerprintTargetAt,
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
  margins?: boolean;
  height?: number;
  pinLimit?: number;
};

type Hover = {
  target: FingerprintTarget;
  left: number;
  top: number;
  flip: boolean;
  anchor: TooltipAnchor | null;
};

function targetKey(target: FingerprintTarget): string {
  if (target.kind === "cell") return `cell-${target.col}-${target.hour}`;
  if (target.kind === "column") return `column-${target.col}`;
  return `hour-${target.hour}`;
}

const sameTarget = (a: Hover, b: Hover) =>
  targetKey(a.target) === targetKey(b.target);

export function FingerprintPlot({
  values,
  units,
  hoursPerDay = 24,
  selectedYears,
  timeBasisLabel,
  transposed,
  colormapId,
  scale = "day",
  margins = false,
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
    (heightOverride ??
      (transposed ? TRANSPOSED_MIN_HEIGHT : TIME_SERIES_PLOT_HEIGHT)) +
    (margins ? FINGERPRINT_STRIP_HEIGHT : 0);
  const layout: FingerprintLayout = useMemo(
    () => ({ grid, width, height, transposed, margins }),
    [grid, width, height, transposed, margins],
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
    const target = fingerprintTargetAt(layout, left, top);
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
    setHover(target ? { target, left, top, flip, anchor } : null);
  };

  const stripPointAt = (
    kind: "column" | "hour",
    index: number,
  ): TooltipPoint | undefined => {
    const stats =
      kind === "column" ? grid.margins.byColumn : grid.margins.byHour;
    if (index < 0 || index >= stats.mean.length) return undefined;
    const count = stats.count[index] ?? 0;
    const std = formatSeriesValue(stats.std[index] as number);
    if (kind === "column") {
      const bin = grid.bins[index]!;
      return {
        label: formatBinLabel(bin, scale),
        shortLabel: formatBinShortLabel(bin, scale),
        value: stats.mean[index] as number,
        spread:
          count > 0
            ? `Std ${std} across ${count} hour${count === 1 ? "" : "s"}`
            : undefined,
      };
    }
    const time = `${String(index).padStart(2, "0")}:00`;
    const suffix = timeBasisLabel ? ` ${shortTimeBasis(timeBasisLabel)}` : "";
    return {
      label: `${time}${suffix}`,
      shortLabel: time,
      value: stats.mean[index] as number,
      spread:
        count > 0 ? `Std ${std} across ${binCountLabel(count, scale)}` : undefined,
    };
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
  const pointFor = ({ target }: Hover) =>
    target.kind === "cell"
      ? pointAt(target.col, target.hour, "full")!
      : target.kind === "column"
        ? stripPointAt("column", target.col)!
        : stripPointAt("hour", target.hour)!;
  const previousFor = ({ target }: Hover) => {
    if (target.kind === "column") return stripPointAt("column", target.col - 1);
    if (target.kind === "hour") return stripPointAt("hour", target.hour - 1);
    return target.hour > 0
      ? pointAt(target.col, target.hour - 1, "time")
      : pointAt(target.col - 1, hoursPerDay - 1, "full");
  };
  // A change against a pin only reads sensibly between like targets.
  const comparable = (a: Hover, b: Hover) => a.target.kind === b.target.kind;

  const separate = pinLimit > 1;
  const pinned = separate ? null : (pins[0] ?? null);
  const lastPin = pins.at(-1);
  const shown = pinned ?? hover;
  const hoverPoint =
    hover && !desktop
      ? { ...pointFor(hover), left: hover.left, top: hover.top }
      : null;
  const comparing =
    pinned && hover && !sameTarget(hover, pinned) && comparable(hover, pinned);

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
                togglePin(current, hover, pinLimit, sameTarget),
              );
            }
          }}
        />
        {desktop && separate
          ? pins.map((pin) => (
              <PinnedTooltip
                key={targetKey(pin.target)}
                point={pointFor(pin)}
                previous={previousFor(pin)}
                position={{ x: pin.left, y: pin.top, flip: pin.flip }}
                units={units}
                onClose={() =>
                  setPins((current) =>
                    current.filter((other) => !sameTarget(other, pin)),
                  )
                }
              />
            ))
          : null}
        {desktop && separate
          ? pins.map((pin) => (
              <span
                key={targetKey(pin.target)}
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
      !pins.some((pin) => sameTarget(pin, hover)) ? (
        <MapSideTooltip
          point={pointFor(hover)}
          previous={
            lastPin && comparable(lastPin, hover)
              ? pointFor(lastPin)
              : previousFor(hover)
          }
          anchor={hover.anchor}
          units={units}
        />
      ) : null}
      {desktop && !separate && shown?.anchor ? (
        <MapSideTooltip
          point={pointFor(shown)}
          previous={previousFor(shown)}
          compared={comparing ? pointFor(hover) : undefined}
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
        {margins ? " · strips show the mean ±1 std of each row and column" : ""}
      </p>
    </div>
  );
}
