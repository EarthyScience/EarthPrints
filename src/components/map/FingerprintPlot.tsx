"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatSeriesValue,
  TIME_SERIES_PLOT_HEIGHT,
  timeSeriesChartTheme,
} from "@/components/map/timeSeriesChartConfig";
import {
  dayIndexTicks,
  FINGERPRINT_HOUR_TICKS,
  fingerprintColorScale,
  fingerprintLegendStops,
  symmetricAbsMax,
} from "@/lib/map/fingerprintScale";
import { useTheme } from "@/providers/ThemeProvider";

type FingerprintPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
};

/** Canvas gutters (CSS px): hour labels on the left, day labels along the bottom. */
const AXIS_LEFT = 30;
const AXIS_BOTTOM = 18;
const AXIS_TOP = 4;
const AXIS_RIGHT = 4;

/**
 * Fingerprint plot: an hour-of-day (y, 0 at the bottom) by day (x) heatmap of the
 * pixel's flux, colored by a diverging scale centered on zero. Consumes the same
 * flat `[day x hoursPerDay]` `Float32Array` the line chart receives and indexes
 * `values[day * hoursPerDay + hour]` instead of averaging over the hour axis.
 */
export function FingerprintPlot({
  values,
  units,
  hoursPerDay = 24,
}: FingerprintPlotProps) {
  const { isLight } = useTheme();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);

  const nDays = Math.floor(values.length / hoursPerDay);
  const absMax = useMemo(() => symmetricAbsMax(values), [values]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.floor(next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || nDays === 0) return;

    const height = TIME_SERIES_PLOT_HEIGHT;
    const dpr =
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const plotW = Math.max(1, width - AXIS_LEFT - AXIS_RIGHT);
    const plotH = Math.max(1, height - AXIS_TOP - AXIS_BOTTOM);
    const rowY = (hourFromTop: number) =>
      AXIS_TOP + Math.floor((hourFromTop * plotH) / hoursPerDay);

    const scale = fingerprintColorScale(isLight);

    // Walk destination pixel columns and nearest-sample the day axis, so the draw
    // cost is bounded by plotW (not nDays) whether we up- or down-scale.
    for (let px = 0; px < plotW; px++) {
      const day = Math.min(nDays - 1, Math.floor((px / plotW) * nDays));
      const base = day * hoursPerDay;
      for (let hour = 0; hour < hoursPerDay; hour++) {
        const color = scale(values[base + hour] as number, absMax);
        if (color === "transparent") continue;
        // Hour 0 sits at the bottom, so it occupies the last row from the top.
        const fromTop = hoursPerDay - 1 - hour;
        const yTop = rowY(fromTop);
        const yBot = rowY(fromTop + 1);
        ctx.fillStyle = color;
        ctx.fillRect(AXIS_LEFT + px, yTop, 1, Math.max(1, yBot - yTop));
      }
    }

    // Axis labels.
    const { tick } = timeSeriesChartTheme(isLight);
    ctx.fillStyle = tick;
    ctx.font =
      "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const hour of FINGERPRINT_HOUR_TICKS) {
      const fromTop = hoursPerDay - 1 - hour;
      const yMid = (rowY(fromTop) + rowY(fromTop + 1)) / 2;
      ctx.fillText(String(hour), AXIS_LEFT - 6, yMid);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelY = AXIS_TOP + plotH + 4;
    for (const day of dayIndexTicks(nDays)) {
      const px = nDays <= 1 ? 0 : (day / (nDays - 1)) * plotW;
      const x = Math.max(
        AXIS_LEFT + 8,
        Math.min(AXIS_LEFT + plotW - 8, AXIS_LEFT + px),
      );
      ctx.fillText(String(day + 1), x, labelY);
    }
  }, [values, absMax, nDays, hoursPerDay, isLight, width]);

  if (nDays === 0) return null;

  const legend = fingerprintLegendStops(isLight);

  return (
    <div ref={wrapperRef} className="w-full min-w-0">
      <canvas ref={canvasRef} className="w-full" role="img" aria-label="Diurnal fingerprint heatmap" />
      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-editor-fg-tertiary">
          {formatSeriesValue(-absMax)}
        </span>
        <span
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${legend.uptake}, ${legend.mid}, ${legend.release})`,
          }}
          aria-hidden="true"
        />
        <span className="font-mono text-[11px] tabular-nums text-editor-fg-tertiary">
          {formatSeriesValue(absMax)}
        </span>
      </div>
      <p className="mt-2 font-mono text-xs leading-normal text-editor-fg-tertiary">
        {nDays.toLocaleString()} days × {hoursPerDay} hours · hour of day (0 at
        bottom){units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}
