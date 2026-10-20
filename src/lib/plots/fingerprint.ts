import {
  type ColormapId,
  FINGERPRINT_HOUR_TICKS,
  fingerprintColorScale,
  formatDayTick,
} from "@/lib/map/fingerprintScale";
import { getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";
import { chartTickColor } from "@/lib/plots/chartTheme";
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

const LABEL_FONT =
  "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export type FingerprintExtents = { negMax: number; posMax: number };

/** Hourly values grouped into columns of days, weeks, months or years. */
export type FingerprintGrid = BinStats & {
  unit: BinUnit;
  bins: TimeBin[];
  hoursPerDay: number;
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
  return { ...binHourGrid(values, hoursPerDay, bins), unit, bins, hoursPerDay };
}

export type FingerprintLayout = {
  grid: FingerprintGrid;
  width: number;
  height: number;
  transposed: boolean;
};

function plotBox({ width, height, transposed }: FingerprintLayout) {
  const axisLeft = transposed ? AXIS_LEFT_TRANSPOSED : AXIS_LEFT_DEFAULT;
  return {
    axisLeft,
    plotW: Math.max(1, width - axisLeft - AXIS_RIGHT),
    plotH: Math.max(1, height - AXIS_TOP - AXIS_BOTTOM),
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
  }: {
    colormapId: ColormapId;
    extents: FingerprintExtents;
    isLight: boolean;
    pixelRatio: number;
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

  const { axisLeft, plotW, plotH } = plotBox(layout);
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
    const top = snap(y0);
    ctx.fillRect(left, top, snap(x1) - left, snap(y1) - top);
  };
  const dividerColor = isLight
    ? "rgba(0, 0, 0, 0.25)"
    : "rgba(255, 255, 255, 0.25)";

  if (!transposed) {
    const rowY = (fromTop: number) =>
      AXIS_TOP + Math.floor((fromTop * plotH) / hoursPerDay);
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
        ctx.moveTo(bx, AXIS_TOP);
        ctx.lineTo(bx, AXIS_TOP + plotH);
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
          AXIS_TOP + start,
          Math.max(xLeft + 1, xRight),
          AXIS_TOP + start + size,
        );
      }
    }

    if (breaks.length > 0) {
      ctx.save();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      for (const start of breaks) {
        const by = AXIS_TOP + Math.floor((start / nSel) * plotH);
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

  const ticks = columnAxisTicks(layout);
  const colFrac = (at: number) => at / nSel;

  if (!transposed) {
    const rowY = (fromTop: number) =>
      AXIS_TOP + (fromTop * plotH) / hoursPerDay;
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
      ctx.fillText(label, x, AXIS_TOP + plotH + 4);
    }
  } else {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const { at, label } of ticks) {
      const y = AXIS_TOP + colFrac(at) * plotH;
      ctx.fillText(
        label,
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
}

export type FingerprintCell = {
  col: number;
  hour: number;
};

export function fingerprintCellAt(
  layout: FingerprintLayout,
  x: number,
  y: number,
): FingerprintCell | null {
  const { grid, transposed } = layout;
  const { hoursPerDay } = grid;
  const { axisLeft, plotW, plotH } = plotBox(layout);
  const inX = x - axisLeft;
  const inY = y - AXIS_TOP;
  if (inX < 0 || inX >= plotW || inY < 0 || inY >= plotH) return null;

  const nCols = grid.bins.length;
  const nSel = Math.max(1, nCols);
  const colHi = Math.max(0, nCols - 1);
  if (!transposed) {
    return {
      col: Math.min(colHi, Math.floor((inX / plotW) * nSel)),
      hour:
        hoursPerDay -
        1 -
        Math.min(hoursPerDay - 1, Math.floor((inY / plotH) * hoursPerDay)),
    };
  }
  return {
    col: Math.min(colHi, Math.floor((inY / plotH) * nSel)),
    hour: Math.min(hoursPerDay - 1, Math.floor((inX / plotW) * hoursPerDay)),
  };
}
