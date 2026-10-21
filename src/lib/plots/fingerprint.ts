import {
  type ColormapId,
  FINGERPRINT_HOUR_TICKS,
  fingerprintColorScale,
  formatDayTick,
} from "@/lib/map/fingerprintScale";
import { getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";
import { chartTickColor } from "@/lib/plots/chartTheme";
import {
  bandRange,
  type FingerprintMargins,
  fingerprintMargins,
  niceTicks,
} from "@/lib/plots/fingerprintMargins";
import {
  binHourGrid,
  type BinStats,
  monthStartTicks,
  type BinUnit,
  type TimeBin,
  timeBins,
} from "@/lib/plots/timeBins";

const AXIS_LEFT_DEFAULT = 34;
const AXIS_LEFT_TRANSPOSED = 54;
const AXIS_BOTTOM = 18;
const AXIS_TOP = 4;
const AXIS_RIGHT = 6;
const STRIP_GAP = 10;
const STRIP_LABELS = 44;
// Shorter strips would print their value labels on top of each other.
const STRIP_LABELS_MIN = 32;
const STRIP_INSET = 8;

export const FINGERPRINT_STRIP = 56;
export const FINGERPRINT_STRIP_MAX = 280;

const LABEL_FONT =
  "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export type FingerprintExtents = { negMax: number; posMax: number };

/** Hourly values grouped into columns of days, weeks, months or years. */
export type FingerprintGrid = BinStats & {
  unit: BinUnit;
  bins: TimeBin[];
  hoursPerDay: number;
  margins: FingerprintMargins;
};

export function fingerprintGrid(
  values: Float32Array,
  hoursPerDay: number,
  selectedYears: number[] | null,
  unit: BinUnit = "day",
): FingerprintGrid {
  const nDays = Math.floor(values.length / hoursPerDay);
  const { absoluteDays } = getSelectedYearsDayMapping(
    selectedYears,
    undefined,
    nDays,
  );
  const bins = timeBins(absoluteDays.slice(0, nDays), unit);
  const stats = binHourGrid(values, hoursPerDay, bins);
  return {
    ...stats,
    unit,
    bins,
    hoursPerDay,
    margins: fingerprintMargins(stats.mean, bins.length, hoursPerDay),
  };
}

export type FingerprintLayout = {
  grid: FingerprintGrid;
  width: number;
  height: number;
  transposed: boolean;
  margins?: FingerprintStrips;
};

/** Size of each strip in pixels; 0 hides it but keeps its divider. */
export type FingerprintStrips = { top: number; left: number };

const stripSpace = (size: number) => size + STRIP_GAP;

/** Extra height the strips need, so the cells keep their size. */
export function fingerprintStripHeight(margins?: FingerprintStrips): number {
  return margins ? stripSpace(margins.top) : 0;
}

function plotBox({ width, height, transposed, margins }: FingerprintLayout) {
  const labels = transposed ? AXIS_LEFT_TRANSPOSED : AXIS_LEFT_DEFAULT;
  const axisLeft = margins
    ? stripSpace(margins.left) +
      Math.max(labels, margins.top > 0 ? STRIP_LABELS : 0)
    : labels;
  const top = AXIS_TOP + (margins ? stripSpace(margins.top) : 0);
  return {
    axisLeft,
    top,
    plotW: Math.max(1, width - axisLeft - AXIS_RIGHT),
    plotH: Math.max(1, height - top - AXIS_BOTTOM),
  };
}

/** The gap between each strip and the cells, where its divider sits. */
export function fingerprintStripDividers(
  layout: FingerprintLayout,
): { top: StripBox; left: StripBox } | null {
  const { margins } = layout;
  if (!margins) return null;
  const { axisLeft, top, plotW, plotH } = plotBox(layout);
  return {
    top: { x: axisLeft, y: AXIS_TOP + margins.top, w: plotW, h: STRIP_GAP },
    left: { x: margins.left, y: top, w: STRIP_GAP, h: plotH },
  };
}

/** Column index where each year starts, after the first. */
function yearBreaks(bins: readonly TimeBin[]): number[] {
  const breaks: number[] = [];
  for (let col = 1; col < bins.length; col++) {
    if (bins[col]!.year !== bins[col - 1]!.year) breaks.push(col);
  }
  return breaks;
}

/** Tick positions in columns, measured from the plot's leading edge. */
function columnAxisTicks({ grid }: FingerprintLayout) {
  const { bins } = grid;
  const breaks = yearBreaks(bins);
  if (breaks.length > 0 || grid.unit === "year") {
    const starts = [0, ...breaks];
    return starts.map((start, i) => ({
      at: (start + (starts[i + 1] ?? bins.length)) / 2,
      label: `${bins[start]!.year}`,
    }));
  }
  const days = bins.flatMap((bin) =>
    Array.from(
      { length: bin.lastDay - bin.firstDay + 1 },
      (_, i) => bin.firstDay + i,
    ),
  );
  return monthStartTicks(days).map((local) => {
    const col = bins.findIndex((bin) => bin.endLocal >= local);
    const bin = bins[col]!;
    const span = bin.endLocal - bin.startLocal + 1;
    return {
      at: col + (local - bin.startLocal) / span,
      label: formatDayTick(days[local] ?? 0),
    };
  });
}

/**
 * Pixel strips along the time axis, one per column, so a wide column is one
 * rectangle; strips of 1px leave seams at fractional pixel ratios.
 */
function pixelRuns(length: number, nSel: number, colHi: number) {
  const runs: { col: number; start: number; size: number }[] = [];
  for (let px = 0; px < length; px++) {
    const col = Math.min(colHi, Math.floor((px / length) * nSel));
    const last = runs.at(-1);
    if (last && last.col === col) last.size++;
    else runs.push({ col, start: px, size: 1 });
  }
  return runs;
}

type StripBox = { x: number; y: number; w: number; h: number };

function stripBoxes(
  margins: FingerprintStrips,
  { axisLeft, top, plotW, plotH }: ReturnType<typeof plotBox>,
): { top: StripBox; left: StripBox } {
  return {
    top: { x: axisLeft, y: AXIS_TOP, w: plotW, h: margins.top },
    left: {
      x: STRIP_INSET,
      y: top,
      w: Math.max(0, margins.left - STRIP_INSET),
      h: plotH,
    },
  };
}

function stripValuePos(stats: BinStats, box: StripBox, alongX: boolean) {
  const [lo, hi] = bandRange(stats);
  return (value: number) =>
    alongX
      ? box.y + box.h - ((value - lo) / (hi - lo)) * box.h
      : box.x + ((value - lo) / (hi - lo)) * box.w;
}

function formatTick(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * One mean line with a ±std band. `alongX` strips run with the columns and
 * grow upwards; the others run with the rows and grow to the right.
 */
function drawStrip(
  ctx: CanvasRenderingContext2D,
  stats: BinStats,
  centre: (i: number) => number,
  box: StripBox,
  alongX: boolean,
  colors: { accent: string; grid: string },
) {
  const [lo, hi] = bandRange(stats);
  const valuePos = stripValuePos(stats, box, alongX);
  const point = (i: number, value: number): [number, number] =>
    alongX ? [centre(i), valuePos(value)] : [valuePos(value), centre(i)];
  const ticks = niceTicks(lo, hi);

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const tick of ticks) {
    const at = Math.round(valuePos(tick)) + 0.5;
    ctx.beginPath();
    if (alongX) {
      ctx.moveTo(box.x, at);
      ctx.lineTo(box.x + box.w, at);
    } else {
      ctx.moveTo(at, box.y);
      ctx.lineTo(at, box.y + box.h);
    }
    ctx.stroke();
  }

  const runs: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i < stats.mean.length; i++) {
    if (Number.isFinite(stats.mean[i])) {
      run.push(i);
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);

  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.2;
  for (const indices of runs) {
    ctx.beginPath();
    indices.forEach((i, k) => {
      const [x, y] = point(i, stats.mean[i]! + stats.std[i]!);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    for (const i of [...indices].reverse()) {
      ctx.lineTo(...point(i, stats.mean[i]! - stats.std[i]!));
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  for (const indices of runs) {
    ctx.beginPath();
    indices.forEach((i, k) => {
      const [x, y] = point(i, stats.mean[i]!);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (indices.length === 1) {
      const [x, y] = point(indices[0]!, stats.mean[indices[0]!]!);
      ctx.lineTo(alongX ? x + 1 : x, alongX ? y : y + 1);
    }
    ctx.stroke();
  }
  ctx.restore();

  return ticks.map((tick) => ({ label: formatTick(tick), at: valuePos(tick) }));
}

function clampLabelX(x: number, plotW: number, axisLeft: number): number {
  return Math.max(axisLeft + 12, Math.min(axisLeft + plotW - 12, x));
}

export function drawFingerprint(
  canvas: HTMLCanvasElement,
  layout: FingerprintLayout,
  {
    colormapId,
    extents,
    isLight,
    pixelRatio,
    accent = isLight ? "#006c66" : "#52d4c8",
  }: {
    colormapId: ColormapId;
    extents: FingerprintExtents;
    isLight: boolean;
    pixelRatio: number;
    /** Colour of the strips' mean line and band. */
    accent?: string;
  },
): void {
  const { grid, width, height, transposed } = layout;
  const { hoursPerDay } = grid;
  const nCols = grid.bins.length;
  if (width === 0 || nCols === 0) return;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { axisLeft, top, plotW, plotH } = plotBox(layout);
  const nSel = Math.max(1, nCols);
  const colHi = Math.max(0, nCols - 1);
  const breaks = yearBreaks(grid.bins);
  const scale = fingerprintColorScale(colormapId);
  const cellColor = (col: number, hour: number) =>
    scale(
      grid.mean[col * hoursPerDay + hour] as number,
      extents.negMax,
      extents.posMax,
    );
  // Edges on whole device pixels, or neighbouring cells leave a faint seam.
  const snap = (v: number) => Math.round(v * pixelRatio) / pixelRatio;
  const fillCell = (x0: number, y0: number, x1: number, y1: number) => {
    const left = snap(x0);
    const upper = snap(y0);
    ctx.fillRect(left, upper, snap(x1) - left, snap(y1) - upper);
  };
  const dividerColor = isLight
    ? "rgba(0, 0, 0, 0.25)"
    : "rgba(255, 255, 255, 0.25)";

  if (!transposed) {
    const rowY = (fromTop: number) =>
      top + Math.floor((fromTop * plotH) / hoursPerDay);
    for (const { col, start, size } of pixelRuns(plotW, nSel, colHi)) {
      for (let hour = 0; hour < hoursPerDay; hour++) {
        const color = cellColor(col, hour);
        if (color === "transparent") continue;
        const fromTop = hoursPerDay - 1 - hour;
        const yTop = rowY(fromTop);
        const yBot = rowY(fromTop + 1);
        ctx.fillStyle = color;
        fillCell(
          axisLeft + start,
          yTop,
          axisLeft + start + size,
          Math.max(yTop + 1, yBot),
        );
      }
    }

    if (breaks.length > 0) {
      ctx.save();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      for (const start of breaks) {
        const bx = axisLeft + Math.floor((start / nSel) * plotW);
        ctx.beginPath();
        ctx.moveTo(bx, top);
        ctx.lineTo(bx, top + plotH);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else {
    const colX = (hour: number) =>
      axisLeft + Math.floor((hour * plotW) / hoursPerDay);
    for (const { col, start, size } of pixelRuns(plotH, nSel, colHi)) {
      for (let hour = 0; hour < hoursPerDay; hour++) {
        const color = cellColor(col, hour);
        if (color === "transparent") continue;
        const xLeft = colX(hour);
        const xRight = colX(hour + 1);
        ctx.fillStyle = color;
        fillCell(
          xLeft,
          top + start,
          Math.max(xLeft + 1, xRight),
          top + start + size,
        );
      }
    }

    if (breaks.length > 0) {
      ctx.save();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      for (const start of breaks) {
        const by = top + Math.floor((start / nSel) * plotH);
        ctx.beginPath();
        ctx.moveTo(axisLeft, by);
        ctx.lineTo(axisLeft + plotW, by);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.fillStyle = chartTickColor(isLight);
  ctx.font = LABEL_FONT;

  const { margins } = layout;
  if (margins) {
    const colors = {
      accent,
      grid: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)",
    };
    const { top: topBox, left: leftBox } = stripBoxes(margins, {
      axisLeft,
      top,
      plotW,
      plotH,
    });
    const colCentre = (along: number, length: number) => (col: number) =>
      along + ((col + 0.5) / nSel) * length;
    const hourCentre = (hour: number) =>
      transposed
        ? axisLeft + ((hour + 0.5) * plotW) / hoursPerDay
        : top + ((hoursPerDay - 0.5 - hour) * plotH) / hoursPerDay;

    const topTicks =
      margins.top > 0
        ? drawStrip(
            ctx,
            transposed ? grid.margins.byHour : grid.margins.byColumn,
            transposed ? hourCentre : colCentre(axisLeft, plotW),
            topBox,
            true,
            colors,
          )
        : [];
    const leftTicks =
      margins.left > 0
        ? drawStrip(
            ctx,
            transposed ? grid.margins.byColumn : grid.margins.byHour,
            transposed ? colCentre(top, plotH) : hourCentre,
            leftBox,
            false,
            colors,
          )
        : [];
    const labelled = (size: number, ticks: typeof topTicks) =>
      size >= STRIP_LABELS_MIN ? ticks : [];

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const { label, at } of labelled(margins.top, topTicks)) {
      ctx.fillText(label, axisLeft - 6, at);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const { label, at } of labelled(margins.left, leftTicks)) {
      const x = Math.max(leftBox.x + 10, Math.min(leftBox.x + leftBox.w - 10, at));
      ctx.fillText(label, x, top + plotH + 4);
    }
  }

  const ticks = columnAxisTicks(layout);
  const colFrac = (at: number) => at / nSel;

  if (!transposed) {
    const rowY = (fromTop: number) =>
      top + (fromTop * plotH) / hoursPerDay;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const hour of FINGERPRINT_HOUR_TICKS) {
      const fromTop = hoursPerDay - 1 - hour;
      ctx.fillText(
        String(hour),
        axisLeft - 6,
        (rowY(fromTop) + rowY(fromTop + 1)) / 2,
      );
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const { at, label } of ticks) {
      const x = clampLabelX(
        axisLeft + colFrac(at) * plotW,
        plotW,
        axisLeft,
      );
      ctx.fillText(label, x, top + plotH + 4);
    }
  } else {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const { at, label } of ticks) {
      const y = top + colFrac(at) * plotH;
      ctx.fillText(
        label,
        axisLeft - 6,
        Math.max(top + 6, Math.min(top + plotH - 6, y)),
      );
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const hour of FINGERPRINT_HOUR_TICKS) {
      const x = axisLeft + ((hour + 0.5) * plotW) / hoursPerDay;
      ctx.fillText(String(hour), x, top + plotH + 4);
    }
  }
}

/** What sits under the pointer: a cell, or a point on one of the strips. */
export type FingerprintTarget =
  | { kind: "cell"; col: number; hour: number }
  | { kind: "column"; col: number }
  | { kind: "hour"; hour: number };

export function fingerprintTargetAt(
  layout: FingerprintLayout,
  x: number,
  y: number,
): FingerprintTarget | null {
  const { grid, transposed, margins } = layout;
  const { hoursPerDay } = grid;
  const { axisLeft, top, plotW, plotH } = plotBox(layout);
  const inX = x - axisLeft;
  const inY = y - top;
  const nSel = Math.max(1, grid.bins.length);
  const colHi = Math.max(0, grid.bins.length - 1);
  const colAt = (along: number, length: number) =>
    Math.min(colHi, Math.floor((along / length) * nSel));
  const hourAt = (along: number, length: number) =>
    Math.min(hoursPerDay - 1, Math.floor((along / length) * hoursPerDay));
  const inCellsX = inX >= 0 && inX < plotW;
  const inCellsY = inY >= 0 && inY < plotH;

  if (inCellsX && inCellsY) {
    return transposed
      ? { kind: "cell", col: colAt(inY, plotH), hour: hourAt(inX, plotW) }
      : {
          kind: "cell",
          col: colAt(inX, plotW),
          hour: hoursPerDay - 1 - hourAt(inY, plotH),
        };
  }
  if (!margins) return null;

  const inTopStrip = inCellsX && y >= AXIS_TOP && y < AXIS_TOP + margins.top;
  const inLeftStrip = inCellsY && x >= 0 && x < margins.left;
  if (inTopStrip) {
    return transposed
      ? { kind: "hour", hour: hourAt(inX, plotW) }
      : { kind: "column", col: colAt(inX, plotW) };
  }
  if (inLeftStrip) {
    return transposed
      ? { kind: "column", col: colAt(inY, plotH) }
      : { kind: "hour", hour: hoursPerDay - 1 - hourAt(inY, plotH) };
  }
  return null;
}

/** The inverse of `fingerprintTargetAt`; null when the target's strip is hidden. */
export function fingerprintTargetPoint(
  layout: FingerprintLayout,
  target: FingerprintTarget,
): { x: number; y: number } | null {
  const { grid, transposed, margins } = layout;
  const { hoursPerDay } = grid;
  const box = plotBox(layout);
  const { axisLeft, top, plotW, plotH } = box;
  const nSel = Math.max(1, grid.bins.length);
  const colAlong = (col: number, length: number) =>
    ((col + 0.5) / nSel) * length;
  const hourAlong = (hour: number, length: number) =>
    ((hour + 0.5) / hoursPerDay) * length;

  if (target.kind === "cell") {
    return transposed
      ? {
          x: axisLeft + hourAlong(target.hour, plotW),
          y: top + colAlong(target.col, plotH),
        }
      : {
          x: axisLeft + colAlong(target.col, plotW),
          y: top + hourAlong(hoursPerDay - 1 - target.hour, plotH),
        };
  }
  if (!margins) return null;

  const strips = stripBoxes(margins, box);
  const byColumn = target.kind === "column";
  const index = byColumn ? target.col : target.hour;
  const stats = byColumn ? grid.margins.byColumn : grid.margins.byHour;
  const onTop = byColumn !== transposed;
  const strip = onTop ? strips.top : strips.left;
  if (strip.w <= 0 || strip.h <= 0) return null;

  const mean = stats.mean[index] as number;
  const across = Number.isFinite(mean)
    ? stripValuePos(stats, strip, onTop)(mean)
    : onTop
      ? strip.y + strip.h / 2
      : strip.x + strip.w / 2;
  const along = byColumn
    ? colAlong(index, onTop ? plotW : plotH)
    : onTop
      ? hourAlong(index, plotW)
      : hourAlong(hoursPerDay - 1 - index, plotH);

  return onTop
    ? { x: axisLeft + along, y: across }
    : { x: across, y: top + along };
}
