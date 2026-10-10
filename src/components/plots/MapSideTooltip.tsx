"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { formatSeriesValue } from "@/lib/plots/chartTheme";
import { Button } from "@/components/ui/button";

const DESKTOP_QUERY = "(width >= 48rem)";
const TOOLTIP_GAP = 12;

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
  clientY: number,
): TooltipAnchor | null {
  const panel = plot?.closest("[data-slot=card]");
  if (!panel) return null;
  return {
    left: panel.getBoundingClientRect().right + TOOLTIP_GAP,
    top: clientY,
  };
}

export type TooltipPoint = { label: string; shortLabel: string; value: number };

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
      {change ? <span className="text-muted-foreground">{change}</span> : null}
    </>
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
      className="fixed z-40 grid min-w-40 -translate-y-4 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl"
      style={anchor}
    >
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
