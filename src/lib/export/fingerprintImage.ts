import {
  type ColormapId,
  fingerprintRampSamples,
  zeroFrac,
} from "@/lib/map/fingerprintScale";
import { chartTickColor, formatSeriesValue } from "@/lib/plots/chartTheme";
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
const LABEL_FONT =
  "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type LegendOptions = {
  /** Extents from `asymmetricExtents`, both non-negative magnitudes. */
  negMax: number;
  posMax: number;
  colormapId: ColormapId;
  units?: string | null;
  /** Backing-store pixels per CSS pixel in the source canvas. */
  pixelRatio: number;
};

function drawLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  {
    negMax,
    posMax,
    colormapId,
    units,
  }: Pick<LegendOptions, "negMax" | "posMax" | "colormapId" | "units">,
) {
  ctx.font = LABEL_FONT;
  ctx.fillStyle = chartTickColor(true);
  ctx.textBaseline = "middle";

  // Units ride on the upper end. The on-screen legend leaves them to the
  // caption below it, which a standalone image does not have.
  const min = formatSeriesValue(-negMax);
  const max = `${formatSeriesValue(posMax)}${units ? ` ${units}` : ""}`;
  const minW = ctx.measureText(min).width;
  const maxW = ctx.measureText(max).width;
  const middle = top + BAR_H / 2;

  ctx.textAlign = "left";
  ctx.fillText(min, INSET, middle);
  ctx.textAlign = "right";
  ctx.fillText(max, width - INSET, middle);

  const barX = INSET + minW + LABEL_GAP;
  const barW = Math.max(1, width - INSET - maxW - LABEL_GAP - barX);

  // Sampled from the real scale rather than from three endpoint swatches, so
  // the bar matches the heatmap for every palette.
  const ramp = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  for (const sample of fingerprintRampSamples(colormapId, negMax, posMax)) {
    ramp.addColorStop(sample.frac, sample.color);
  }

  ctx.fillStyle = ramp;
  ctx.beginPath();
  ctx.roundRect(barX, top, barW, BAR_H, BAR_H / 2);
  ctx.fill();

  // With the halves scaled independently, zero is rarely at the middle, so the
  // bar carries a tick where the neutral colour actually falls.
  const pivot = zeroFrac(negMax, posMax);
  if (pivot > 0.02 && pivot < 0.98) {
    ctx.fillStyle = chartTickColor(true);
    ctx.fillRect(barX + pivot * barW - 0.5, top - 1, 1, BAR_H + 2);
  }
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
  { negMax, posMax, colormapId, units, pixelRatio }: LegendOptions,
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

  drawLegend(ctx, plotW, plotH + GAP_TOP, {
    negMax,
    posMax,
    colormapId,
    units,
  });

  return {
    dataUrl: target.toDataURL("image/png"),
    width: target.width,
    height: target.height,
  };
}
