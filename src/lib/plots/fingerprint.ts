import {
  type ColormapId,
  dayIndexTicks,
  FINGERPRINT_HOUR_TICKS,
  fingerprintColorScale,
  formatDayTick,
} from "@/lib/map/fingerprintScale";
import {
  getSelectedYearsDayMapping,
  type YearDayMapping,
} from "@/lib/zarr/timeRange";
import { chartTickColor } from "@/lib/plots/chartTheme";

const AXIS_LEFT_DEFAULT = 34;
const AXIS_LEFT_TRANSPOSED = 54;
const AXIS_BOTTOM = 18;
const AXIS_TOP = 4;
const AXIS_RIGHT = 6;

const LABEL_FONT =
  "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export type FingerprintExtents = { negMax: number; posMax: number };

export type FingerprintLayout = {
  values: Float32Array;
  hoursPerDay: number;
  nDays: number;
  mapping: YearDayMapping;
  width: number;
  height: number;
  transposed: boolean;
};

export function fingerprintLayout(
  values: Float32Array,
  hoursPerDay: number,
  selectedYears: number[] | null,
  size: { width: number; height: number },
  transposed: boolean,
): FingerprintLayout {
  const nDays = Math.floor(values.length / hoursPerDay);
  return {
    values,
    hoursPerDay,
    nDays,
    mapping: getSelectedYearsDayMapping(selectedYears, undefined, nDays),
    width: size.width,
    height: size.height,
    transposed,
  };
}

function plotBox({ width, height, transposed }: FingerprintLayout) {
  const axisLeft = transposed ? AXIS_LEFT_TRANSPOSED : AXIS_LEFT_DEFAULT;
  return {
    axisLeft,
    plotW: Math.max(1, width - axisLeft - AXIS_RIGHT),
    plotH: Math.max(1, height - AXIS_TOP - AXIS_BOTTOM),
  };
}

function dayAxisTicks({ mapping, nDays }: FingerprintLayout) {
  if (mapping.yearIntervals.length > 1) {
    return mapping.yearIntervals.map((interval) => ({
      dayLocal: Math.round((interval.startDayLocal + interval.endDayLocal) / 2),
      label: `${interval.year}`,
    }));
  }
  return dayIndexTicks(Math.max(1, nDays)).map((offset) => ({
    dayLocal: offset,
    label: formatDayTick(mapping.absoluteDays[offset] ?? offset),
  }));
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
  const { values, hoursPerDay, nDays, mapping, width, height, transposed } =
    layout;
  if (width === 0 || nDays === 0) return;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { axisLeft, plotW, plotH } = plotBox(layout);
  const nSel = Math.max(1, nDays);
  const dayHi = Math.max(0, nDays - 1);
  const scale = fingerprintColorScale(colormapId);
  const cellColor = (dayLocal: number, hour: number) =>
    scale(
      values[dayLocal * hoursPerDay + hour] as number,
      extents.negMax,
      extents.posMax,
    );
  const dividerColor = isLight
    ? "rgba(0, 0, 0, 0.25)"
    : "rgba(255, 255, 255, 0.25)";

  if (!transposed) {
    const rowY = (fromTop: number) =>
      AXIS_TOP + Math.floor((fromTop * plotH) / hoursPerDay);
    for (let px = 0; px < plotW; px++) {
      const dayLocal = Math.min(dayHi, Math.floor((px / plotW) * nSel));
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

    if (mapping.yearIntervals.length > 1) {
      ctx.save();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      for (const interval of mapping.yearIntervals) {
        if (interval.startDayLocal > 0) {
          const bx =
            axisLeft + Math.floor((interval.startDayLocal / nSel) * plotW);
          ctx.beginPath();
          ctx.moveTo(bx, AXIS_TOP);
          ctx.lineTo(bx, AXIS_TOP + plotH);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  } else {
    const colX = (hour: number) =>
      axisLeft + Math.floor((hour * plotW) / hoursPerDay);
    for (let py = 0; py < plotH; py++) {
      const dayLocal = Math.min(dayHi, Math.floor((py / plotH) * nSel));
      for (let hour = 0; hour < hoursPerDay; hour++) {
        const color = cellColor(dayLocal, hour);
        if (color === "transparent") continue;
        const xLeft = colX(hour);
        const xRight = colX(hour + 1);
        ctx.fillStyle = color;
        ctx.fillRect(xLeft, AXIS_TOP + py, Math.max(1, xRight - xLeft), 1);
      }
    }

    if (mapping.yearIntervals.length > 1) {
      ctx.save();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 1;
      for (const interval of mapping.yearIntervals) {
        if (interval.startDayLocal > 0) {
          const by =
            AXIS_TOP + Math.floor((interval.startDayLocal / nSel) * plotH);
          ctx.beginPath();
          ctx.moveTo(axisLeft, by);
          ctx.lineTo(axisLeft + plotW, by);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  ctx.fillStyle = chartTickColor(isLight);
  ctx.font = LABEL_FONT;

  const ticks = dayAxisTicks(layout);
  const dayFrac = (dayLocal: number) => (nSel <= 1 ? 0 : dayLocal / (nSel - 1));

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
    for (const { dayLocal, label } of ticks) {
      const x = clampLabelX(
        axisLeft + dayFrac(dayLocal) * plotW,
        plotW,
        axisLeft,
      );
      ctx.fillText(label, x, AXIS_TOP + plotH + 4);
    }
  } else {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const { dayLocal, label } of ticks) {
      const y = AXIS_TOP + dayFrac(dayLocal) * plotH;
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
  dayLocal: number;
  hour: number;
  absoluteDay: number;
  value: number;
};

export function fingerprintCellAt(
  layout: FingerprintLayout,
  x: number,
  y: number,
): FingerprintCell | null {
  const { values, hoursPerDay, nDays, mapping, transposed } = layout;
  const { axisLeft, plotW, plotH } = plotBox(layout);
  const inX = x - axisLeft;
  const inY = y - AXIS_TOP;
  if (inX < 0 || inX >= plotW || inY < 0 || inY >= plotH) return null;

  const nSel = Math.max(1, nDays);
  const dayHi = Math.max(0, nDays - 1);
  let dayLocal: number;
  let hour: number;
  if (!transposed) {
    dayLocal = Math.min(dayHi, Math.floor((inX / plotW) * nSel));
    hour =
      hoursPerDay -
      1 -
      Math.min(hoursPerDay - 1, Math.floor((inY / plotH) * hoursPerDay));
  } else {
    hour = Math.min(hoursPerDay - 1, Math.floor((inX / plotW) * hoursPerDay));
    dayLocal = Math.min(dayHi, Math.floor((inY / plotH) * nSel));
  }

  return {
    dayLocal,
    hour,
    absoluteDay: mapping.absoluteDays[dayLocal] ?? dayLocal,
    value: values[dayLocal * hoursPerDay + hour] as number,
  };
}
