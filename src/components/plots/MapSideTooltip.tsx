"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "cn";
import { formatSeriesValue } from "@/lib/plots/chartTheme";
import { Button } from "@/components/ui/button";

const DESKTOP_QUERY = "(width >= 48rem)";
const TOOLTIP_GAP = 12;
const TOOLTIP_ROOM = 220;

function subscribeDesktop(onChange: () => void) {
  const query = matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

export type TooltipAnchor = { left: number; top: number };

export function anchorBesidePanel(
  plot: Element | null,
  clientX: number,
  clientY: number,
): TooltipAnchor | null {
  const panel = plot?.closest("[data-slot=card]");
  if (!panel) return null;
  const besidePanel = panel.getBoundingClientRect().right + TOOLTIP_GAP;
  const left =
    besidePanel + TOOLTIP_ROOM <= window.innerWidth
      ? besidePanel
      : Math.min(clientX + TOOLTIP_GAP, window.innerWidth - TOOLTIP_ROOM);
  return { left, top: clientY };
}

export type PinPosition = { x: number; y: number; flip: boolean };

export function pinFlips(x: number, plotWidth: number): boolean {
  return x + TOOLTIP_GAP + TOOLTIP_ROOM > plotWidth;
}

export function pinPosition(
  plot: Element,
  clientX: number,
  clientY: number,
): PinPosition {
  const rect = plot.getBoundingClientRect();
  const x = clientX - rect.left;
  return {
    x,
    y: clientY - rect.top,
    flip: pinFlips(x, rect.width),
  };
}

export function togglePin<T>(
  pins: T[],
  pin: T,
  limit: number,
  same: (a: T, b: T) => boolean,
): T[] {
  if (pins.some((existing) => same(existing, pin))) {
    return pins.filter((existing) => !same(existing, pin));
  }
  return [...pins, pin].slice(-limit);
}

const tooltipBoxClass =
  "z-40 grid min-w-40 -translate-y-4 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl";

export type TooltipPoint = {
  label: string;
  shortLabel: string;
  value: number;
  spread?: string;
};

function formatChange(point: TooltipPoint, base?: TooltipPoint) {
  if (!base || base.value === 0 || !Number.isFinite(base.value)) return null;
  if (!Number.isFinite(point.value)) return null;
  const change = ((point.value - base.value) / Math.abs(base.value)) * 100;
  return `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}% vs ${base.shortLabel}`;
}

function PointRows({
  point,
  base,
  units,
}: {
  point: TooltipPoint;
  base?: TooltipPoint;
  units?: string | null;
}) {
  const change = formatChange(point, base);
  return (
    <>
      <span className="tabular-nums">
        {Number.isFinite(point.value)
          ? `${formatSeriesValue(point.value)}${units ? ` ${units}` : ""}`
          : "no data"}
      </span>
      {point.spread ? (
        <span className="text-muted-foreground tabular-nums">
          {point.spread}
        </span>
      ) : null}
      {change ? <span className="text-muted-foreground">{change}</span> : null}
    </>
  );
}

function TooltipHeader({
  point,
  onClose,
}: {
  point: TooltipPoint;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">{point.label}</span>
      {onClose ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Unpin"
          className="-mr-1"
          onClick={onClose}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}

export function PinnedTooltip({
  point,
  previous,
  position,
  units,
  onClose,
}: {
  point: TooltipPoint;
  previous?: TooltipPoint;
  position: PinPosition;
  units?: string | null;
  /** Without it the tooltip is a hover readout and lets the pointer through. */
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute",
        tooltipBoxClass,
        position.flip && "-translate-x-full",
        !onClose && "pointer-events-none",
      )}
      style={{
        left: position.flip
          ? position.x - TOOLTIP_GAP
          : position.x + TOOLTIP_GAP,
        top: position.y,
      }}
    >
      <TooltipHeader point={point} onClose={onClose} />
      <PointRows point={point} base={previous} units={units} />
    </div>
  );
}

export function MapSideTooltip({
  point,
  previous,
  compared,
  anchor,
  units,
  onClose,
}: {
  point: TooltipPoint;
  previous?: TooltipPoint;
  compared?: TooltipPoint;
  anchor: TooltipAnchor;
  units?: string | null;
  onClose?: () => void;
}) {
  return createPortal(
    <div
      className={cn("fixed", tooltipBoxClass)}
      style={{ left: anchor.left, top: anchor.top }}
    >
      <TooltipHeader point={point} onClose={onClose} />
      <PointRows point={point} base={previous} units={units} />
      {compared ? (
        <div className="grid gap-1.5 border-t border-border/50 pt-1.5">
          <span className="font-medium">{compared.label}</span>
          <PointRows point={compared} base={point} units={units} />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
