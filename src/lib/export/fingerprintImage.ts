import {
  fingerprintLegendStops,
} from "@/lib/map/fingerprintScale";
import {
  formatSeriesValue,
  timeSeriesChartTheme,
} from "@/components/map/timeSeriesChartConfig";
import type { CapturedImage } from "./capture";

/**
 * Legend block in CSS px, mirroring the markup under the on-screen canvas:
 * a 12px gap, an 8px bar with 8px between it and its end labels, and a little
 * air before the image edge.
 */
const GAP_TOP = 12;
const BAR_H = 8;
const LABEL_GAP = 8;
const GAP_BOTTOM = 6;
const INSET = 4;
const BLOCK_H = GAP_TOP + BAR_H + GAP_BOTTOM;

/** Same as the axis labels the canvas draws for itself. */
const LABEL_FONT = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type LegendOptions = {
  absMax: number;
  units?: string | null;
  /** Backing-store pixels per CSS pixel in the source canvas. */
  pixelRatio: number;
};

function drawLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  { absMax, units }: Pick<LegendOptions, "absMax" | "units">,
) {
  // The export always renders light, like the report, whatever theme the app
  // is in.
  const stops = fingerprintLegendStops(true);

  ctx.font = LABEL_FONT;
  ctx.fillStyle = timeSeriesChartTheme(true).tick;
  ctx.textBaseline = "middle";

  // Units ride on the upper end. The on-screen legend leaves them to the
  // caption below it, which a standalone image does not have.
  const min = formatSeriesValue(-absMax);
  const max = `${formatSeriesValue(absMax)}${units ? ` ${units}` : ""}`;
  const minW = ctx.measureText(min).width;
  const maxW = ctx.measureText(max).width;
  const middle = top + BAR_H / 2;

  ctx.textAlign = "left";
  ctx.fillText(min, INSET, middle);
  ctx.textAlign = "right";
  ctx.fillText(max, width - INSET, middle);

  const barX = INSET + minW + LABEL_GAP;
  const barW = Math.max(1, width - INSET - maxW - LABEL_GAP - barX);

  const ramp = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  ramp.addColorStop(0, stops.uptake);
  ramp.addColorStop(0.5, stops.mid);
  ramp.addColorStop(1, stops.release);

  ctx.fillStyle = ramp;
  ctx.beginPath();
  ctx.roundRect(barX, top, barW, BAR_H, BAR_H / 2);
  ctx.fill();
}

/**
 * Copy the heatmap and paint its colour scale underneath it.
 *
 * The canvas draws its own axes into its gutters, but the diverging ramp lives
 * in HTML beside it, so a straight copy is a field of colour with nothing to
 * read it against. The report redraws the same ramp in jsPDF; a shared image
 * needs it baked into the pixels.
 */
export function fingerprintPngWithLegend(
  canvas: HTMLCanvasElement,
  { absMax, units, pixelRatio }: LegendOptions,
): CapturedImage {
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Canvas has no size to capture");
  }

  const plotW = canvas.width / pixelRatio;
  const plotH = canvas.height / pixelRatio;
  const height = plotH + BLOCK_H;

  const target = document.createElement("canvas");
  target.width = canvas.width;
  target.height = Math.round(height * pixelRatio);

  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D context for export");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  // Missing pixels are drawn transparent so gaps read as gaps, which against a
  // viewer's dark background would come back as black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, plotW, height);
  ctx.drawImage(canvas, 0, 0, plotW, plotH);

  drawLegend(ctx, plotW, plotH + GAP_TOP, { absMax, units });

  return {
    dataUrl: target.toDataURL("image/png"),
    width: target.width,
    height: target.height,
  };
}
