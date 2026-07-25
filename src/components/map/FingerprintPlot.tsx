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
  formatDayTick,
  formatIsoDate,
  symmetricAbsMax,
  yearRangesInWindow,
} from "@/lib/map/fingerprintScale";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import { useTheme } from "@/providers/ThemeProvider";

type FingerprintPlotProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
};

/**
 * Canvas gutters (CSS px). The left gutter widens when transposed, since date
 * labels ("Mon 'yy") sit on the left then, versus 2-digit hours by default.
 */
const AXIS_LEFT_DEFAULT = 34;
const AXIS_LEFT_TRANSPOSED = 54;
const AXIS_BOTTOM = 18;
const AXIS_TOP = 4;
const AXIS_RIGHT = 6;

const axisLeftFor = (transposed: boolean) =>
  transposed ? AXIS_LEFT_TRANSPOSED : AXIS_LEFT_DEFAULT;

type HoverCell = {
  left: number;
  top: number;
  day: number;
  hour: number;
  value: number;
  absoluteDay: number;
};

/**
 * Fingerprint plot: an hour-of-day by day heatmap of the pixel's flux, colored by
 * a diverging scale centered on zero. Consumes the same flat
 * `[day x hoursPerDay]` `Float32Array` the line chart receives and indexes
 * `values[day * hoursPerDay + hour]` instead of averaging over the hour axis.
 *
 * Controls: flip the axes (hour<->day), single out one calendar year of the
 * loaded window, and hover a cell to read its date/hour/value.
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
  const [transposed, setTransposed] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [hover, setHover] = useState<HoverCell | null>(null);

  const nDays = Math.floor(values.length / hoursPerDay);
  const absMax = useMemo(() => symmetricAbsMax(values), [values]);

  // The window always ends at the last day of the archive, so its first day sits
  // `totalDays - nDays` into the absolute time axis.
  const baseDay = ZARR_TIME.totalDays - nDays;
  const years = useMemo(
    () => yearRangesInWindow(baseDay, nDays),
    [baseDay, nDays],
  );

  // Local day range currently in view: the whole window, or one selected year.
  const activeYear = years.find((range) => range.year === selectedYear) ?? null;
  const dayLo = activeYear ? activeYear.startDay : 0;
  const dayHi = activeYear ? activeYear.endDay : nDays - 1;
  const nSel = Math.max(1, dayHi - dayLo + 1);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0]?.contentRect.width ?? 0));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Drop a stale year selection when the window no longer covers it.
  useEffect(() => {
    if (selectedYear !== null && !years.some((r) => r.year === selectedYear)) {
      setSelectedYear(null);
    }
  }, [years, selectedYear]);

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

    const axisLeft = axisLeftFor(transposed);
    const plotW = Math.max(1, width - axisLeft - AXIS_RIGHT);
    const plotH = Math.max(1, height - AXIS_TOP - AXIS_BOTTOM);
    const scale = fingerprintColorScale(isLight);

    // Map a local day index (dayLo..dayHi) to a fill color at the given hour.
    const cellColor = (dayLocal: number, hour: number) =>
      scale(values[dayLocal * hoursPerDay + hour] as number, absMax);

    if (!transposed) {
      // x = day, y = hour (hour 0 at the bottom).
      const rowY = (fromTop: number) =>
        AXIS_TOP + Math.floor((fromTop * plotH) / hoursPerDay);
      for (let px = 0; px < plotW; px++) {
        const dayLocal = Math.min(dayHi, dayLo + Math.floor((px / plotW) * nSel));
        for (let hour = 0; hour < hoursPerDay; hour++) {
          const color = cellColor(dayLocal, hour);
          if (color === "transparent") continue;
          const fromTop = hoursPerDay - 1 - hour;
          const yTop = rowY(fromTop);
          const yBot = rowY(fromTop + 1);
          ctx.fillStyle = color;
          ctx.fillRect(axisLeft + px, yTop, 1, Math.max(1, yBot - yTop));
        }
      }
    } else {
      // x = hour (0 at the left), y = day (first day at the top).
      const colX = (hour: number) =>
        axisLeft + Math.floor((hour * plotW) / hoursPerDay);
      for (let py = 0; py < plotH; py++) {
        const dayLocal = Math.min(dayHi, dayLo + Math.floor((py / plotH) * nSel));
        for (let hour = 0; hour < hoursPerDay; hour++) {
          const color = cellColor(dayLocal, hour);
          if (color === "transparent") continue;
          const xLeft = colX(hour);
          const xRight = colX(hour + 1);
          ctx.fillStyle = color;
          ctx.fillRect(xLeft, AXIS_TOP + py, Math.max(1, xRight - xLeft), 1);
        }
      }
    }

    // Axis labels.
    const { tick } = timeSeriesChartTheme(isLight);
    ctx.fillStyle = tick;
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

    const dayTicks = dayIndexTicks(nSel).map((offset) => dayLo + offset);
    const dayFrac = (dayLocal: number) =>
      nSel <= 1 ? 0 : (dayLocal - dayLo) / (nSel - 1);

    if (!transposed) {
      // Hours down the left, dates along the bottom.
      const rowY = (fromTop: number) =>
        AXIS_TOP + (fromTop * plotH) / hoursPerDay;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const hour of FINGERPRINT_HOUR_TICKS) {
        const fromTop = hoursPerDay - 1 - hour;
        ctx.fillText(String(hour), axisLeft - 6, (rowY(fromTop) + rowY(fromTop + 1)) / 2);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const dayLocal of dayTicks) {
        const x = clampLabelX(axisLeft + dayFrac(dayLocal) * plotW, plotW, axisLeft);
        ctx.fillText(formatDayTick(baseDay + dayLocal), x, AXIS_TOP + plotH + 4);
      }
    } else {
      // Dates down the left, hours along the bottom.
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const dayLocal of dayTicks) {
        const y = AXIS_TOP + dayFrac(dayLocal) * plotH;
        ctx.fillText(
          formatDayTick(baseDay + dayLocal),
          axisLeft - 6,
          Math.max(AXIS_TOP + 6, Math.min(AXIS_TOP + plotH - 6, y)),
        );
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const hour of FINGERPRINT_HOUR_TICKS) {
        const x = axisLeft + ((hour + 0.5) * plotW) / hoursPerDay;
        ctx.fillText(String(hour), x, AXIS_TOP + plotH + 4);
      }
    }
  }, [
    values,
    absMax,
    nDays,
    nSel,
    dayLo,
    dayHi,
    baseDay,
    hoursPerDay,
    isLight,
    width,
    transposed,
  ]);

  if (nDays === 0) return null;

  const legend = fingerprintLegendStops(isLight);

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const axisLeft = axisLeftFor(transposed);
    const plotW = Math.max(1, width - axisLeft - AXIS_RIGHT);
    const plotH = Math.max(1, TIME_SERIES_PLOT_HEIGHT - AXIS_TOP - AXIS_BOTTOM);
    const inX = x - axisLeft;
    const inY = y - AXIS_TOP;
    if (inX < 0 || inX >= plotW || inY < 0 || inY >= plotH) {
      setHover(null);
      return;
    }

    let dayLocal: number;
    let hour: number;
    if (!transposed) {
      dayLocal = Math.min(dayHi, dayLo + Math.floor((inX / plotW) * nSel));
      hour = hoursPerDay - 1 - Math.min(hoursPerDay - 1, Math.floor((inY / plotH) * hoursPerDay));
    } else {
      hour = Math.min(hoursPerDay - 1, Math.floor((inX / plotW) * hoursPerDay));
      dayLocal = Math.min(dayHi, dayLo + Math.floor((inY / plotH) * nSel));
    }

    setHover({
      left: x,
      top: y,
      day: dayLocal,
      hour,
      value: values[dayLocal * hoursPerDay + hour] as number,
      absoluteDay: baseDay + dayLocal,
    });
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTransposed((prev) => !prev)}
          className="rounded-md border border-editor-border px-2 py-0.5 text-[11.5px] font-semibold text-editor-fg-secondary transition-colors hover:text-editor-fg-primary"
          aria-pressed={transposed}
          title="Swap the hour and day axes"
        >
          ⇄ Flip axes
        </button>
        {years.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Year">
            <YearChip
              label="All"
              active={selectedYear === null}
              onClick={() => setSelectedYear(null)}
            />
            {years.map((range) => (
              <YearChip
                key={range.year}
                label={String(range.year)}
                active={selectedYear === range.year}
                onClick={() => setSelectedYear(range.year)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div ref={wrapperRef} className="relative w-full min-w-0">
        <canvas
          ref={canvasRef}
          className="w-full"
          role="img"
          aria-label="Diurnal fingerprint heatmap"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-editor-border bg-editor-bg-primary px-2 py-1 font-mono text-[11px] leading-tight text-editor-fg-secondary shadow-md"
            style={{
              left: Math.max(48, Math.min(width - 48, hover.left)),
              top: Math.max(0, hover.top - 52),
            }}
          >
            <div className="text-editor-fg-primary">
              {formatIsoDate(hover.absoluteDay)} · {String(hover.hour).padStart(2, "0")}:00
            </div>
            <div>
              {Number.isFinite(hover.value)
                ? `${formatSeriesValue(hover.value)}${units ? ` ${units}` : ""}`
                : "no data"}
            </div>
          </div>
        ) : null}
      </div>

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
        {nSel.toLocaleString()} days × {hoursPerDay} hours
        {units ? ` · ${units}` : ""}
      </p>
    </div>
  );
}

/** Keep a bottom-axis date label inside the plot width. */
function clampLabelX(x: number, plotW: number, axisLeft: number): number {
  return Math.max(axisLeft + 12, Math.min(axisLeft + plotW - 12, x));
}

function YearChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors ${
        active
          ? "bg-accent text-white"
          : "text-editor-fg-tertiary hover:text-editor-fg-secondary"
      }`}
    >
      {label}
    </button>
  );
}
