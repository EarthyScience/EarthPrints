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
  FINGERPRINT_STRIP,
  FINGERPRINT_STRIP_MAX,
  fingerprintStripDividers,
  fingerprintStripHeight,
  type FingerprintStrips,
  type FingerprintTarget,
  fingerprintTargetAt,
  fingerprintTargetPoint,
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
  pinFlips,
  pinPosition,
  togglePin,
  useDesktop,
  type TooltipAnchor,
  type TooltipPoint,
} from "@/components/plots/MapSideTooltip";

const LEGEND_STOPS = 32;
const TRANSPOSED_MIN_HEIGHT = 380;
// A strip dropped shorter than this is too small to read, so it closes.
const STRIP_SNAP = 24;
const STRIP_KEY_STEP = 8;
const DRAG_START = 3;
// The left strip takes its width from the cells, so it may only use part of the plot.
const LEFT_STRIP_SHARE = 0.4;

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

type StripSide = keyof FingerprintStrips;

/** The full-length edge between a strip and the cells: drag to resize, drag to the edge or tap to hide. */
function StripDivider({
  side,
  size,
  max,
  box,
  onResize,
}: {
  side: StripSide;
  size: number;
  max: number;
  box: { x: number; y: number; w: number; h: number };
  onResize: (size: number) => void;
}) {
  const drag = useRef<{ from: number; size: number; moved: boolean } | null>(
    null,
  );
  const vertical = side === "left";
  const coord = (event: React.PointerEvent) =>
    vertical ? event.clientX : event.clientY;
  const clamp = (value: number) =>
    Math.max(0, Math.min(max, Math.round(value)));
  const toggle = () => onResize(size > 0 ? 0 : FINGERPRINT_STRIP);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={`Resize the ${side} strip`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={size}
      title={size > 0 ? "Drag to resize, tap to hide" : "Drag or tap to show"}
      className={`group absolute flex touch-none items-center justify-center outline-none ${vertical ? "cursor-col-resize" : "cursor-row-resize"}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onPointerDown={(event) => {
        drag.current = { from: coord(event), size, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const delta = coord(event) - current.from;
        if (!current.moved && Math.abs(delta) < DRAG_START) return;
        current.moved = true;
        onResize(clamp(current.size + delta));
      }}
      onPointerUp={() => {
        const current = drag.current;
        drag.current = null;
        if (!current) return;
        if (!current.moved) toggle();
        else if (size < STRIP_SNAP) onResize(0);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        const grow = vertical ? "ArrowRight" : "ArrowDown";
        const shrink = vertical ? "ArrowLeft" : "ArrowUp";
        if (event.key === grow) onResize(clamp(size + STRIP_KEY_STEP));
        else if (event.key === shrink) onResize(clamp(size - STRIP_KEY_STEP));
        else if (event.key === "Enter" || event.key === " ") toggle();
        else return;
        event.preventDefault();
      }}
    >
      <span
        className={`rounded-full bg-muted-foreground/40 transition-[background-color,width,height] group-hover:bg-foreground/70 group-focus-visible:bg-foreground/70 group-active:bg-foreground ${vertical ? "h-full w-px group-hover:w-0.5 group-active:w-0.5" : "h-px w-full group-hover:h-0.5 group-active:h-0.5"}`}
      />
    </div>
  );
}

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
  const [strips, setStrips] = useState<FingerprintStrips>({
    top: FINGERPRINT_STRIP,
    left: FINGERPRINT_STRIP,
  });
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

  const shownStrips = margins ? strips : undefined;
  const height =
    (heightOverride ??
      (transposed ? TRANSPOSED_MIN_HEIGHT : TIME_SERIES_PLOT_HEIGHT)) +
    fingerprintStripHeight(shownStrips);
  const layout: FingerprintLayout = useMemo(
    () => ({ grid, width, height, transposed, margins: shownStrips }),
    [grid, width, height, transposed, shownStrips],
  );
  const dividers = width > 0 ? fingerprintStripDividers(layout) : null;
  const resizeStrip = (side: StripSide, size: number) => {
    if (strips[side] === size) return;
    setStrips((current) => ({ ...current, [side]: size }));
    setPins([]);
    setHover(null);
  };
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
  // Pins store their target, not the click, so they follow it when the layout changes.
  const placedPins = pins.flatMap((pin) => {
    const at = fingerprintTargetPoint(layout, pin.target);
    return at
      ? [{ ...pin, left: at.x, top: at.y, flip: pinFlips(at.x, width) }]
      : [];
  });

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
        {dividers
          ? (["top", "left"] as const).map((side) => (
              <StripDivider
                key={side}
                side={side}
                size={strips[side]}
                max={
                  side === "left"
                    ? Math.min(
                        FINGERPRINT_STRIP_MAX,
                        Math.floor(width * LEFT_STRIP_SHARE),
                      )
                    : FINGERPRINT_STRIP_MAX
                }
                box={dividers[side]}
                onResize={(size) => resizeStrip(side, size)}
              />
            ))
          : null}
        {desktop && separate
          ? placedPins.map((pin) => (
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
          ? placedPins.map((pin) => (
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
        {desktop &&
        separate &&
        hover &&
        !pins.some((pin) => sameTarget(pin, hover)) ? (
          <PinnedTooltip
            point={pointFor(hover)}
            previous={
              lastPin && comparable(lastPin, hover)
                ? pointFor(lastPin)
                : previousFor(hover)
            }
            position={{ x: hover.left, y: hover.top, flip: hover.flip }}
            units={units}
          />
        ) : null}
      </div>
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
