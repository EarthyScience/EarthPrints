"use client";

import { createRoot } from "react-dom/client";
import { FingerprintPlot } from "@/components/map/FingerprintPlot";
import { TimeSeriesPlot } from "@/components/map/TimeSeriesPlot";
import {
  canvasToPng,
  createOffscreenHost,
  nextFrame,
  svgToPng,
  waitUntil,
  whenVisible,
  type CapturedImage,
} from "@/lib/export/capture";
import { fingerprintPngWithLegend } from "@/lib/export/fingerprintImage";
import { symmetricAbsMax } from "@/lib/map/fingerprintScale";
import { FixedThemeProvider } from "@/providers/ThemeProvider";

/**
 * Stage width in CSS px. The readout sidebar is far narrower than the PDF's
 * 182mm content column, so capturing the on-screen plots would print a cramped
 * chart stretched wide. Rendering offscreen at this width gives the plots a
 * print-appropriate aspect ratio, and it drives the fingerprint's day-axis
 * resolution: roughly 700 columns of heatmap across the page.
 */
export const EXPORT_STAGE_WIDTH = 760;

/**
 * Plot height in CSS px for the export, taller than the sidebar's 220. The PDF
 * prints each plot at the full 182mm content width, so the capture's aspect
 * ratio is what sets its printed height: 760x290 lands at ~69mm per plot, which
 * is the tallest pair that still leaves the legend clear of the page footer.
 */
export const EXPORT_PLOT_HEIGHT = 290;

/**
 * Backing-store pixels per CSS pixel for both captures. Pinned rather than
 * taken from the display, so a report and its images come out identically sharp
 * whoever generated them, and high enough that the heatmap's day columns and
 * the chart's labels survive being printed at full page width.
 */
const EXPORT_PIXEL_RATIO = 3;

type StageProps = {
  values: Float32Array;
  units?: string | null;
  hoursPerDay?: number;
};

/**
 * Both plots at export size. The fingerprint mounts fresh, so it captures in its
 * default state (whole window, hour on the y axis) rather than mirroring any
 * flip or year the user has selected on screen.
 */
function ExportStage({ values, units, hoursPerDay }: StageProps) {
  return (
    <FixedThemeProvider theme="light">
      <div style={{ width: EXPORT_STAGE_WIDTH }}>
        <div data-export-plot="line">
          <TimeSeriesPlot
            values={values}
            units={units}
            hoursPerDay={hoursPerDay}
            height={EXPORT_PLOT_HEIGHT}
          />
        </div>
        <div data-export-plot="fingerprint">
          <FingerprintPlot
            values={values}
            units={units}
            hoursPerDay={hoursPerDay}
            height={EXPORT_PLOT_HEIGHT}
            pixelRatio={EXPORT_PIXEL_RATIO}
          />
        </div>
      </div>
    </FixedThemeProvider>
  );
}

export type PlotCaptures = {
  timeSeries: CapturedImage;
  /** Bare heatmap. The report draws the colour ramp itself, under the plot. */
  fingerprint: CapturedImage;
  /** The same heatmap with the ramp baked in, for the image shipped on its own. */
  fingerprintStandalone: CapturedImage;
};

/**
 * Mount both plots offscreen, wait for them to paint, and rasterise them.
 * The stage is torn down before this resolves.
 */
export async function capturePlotsForExport(
  props: StageProps,
): Promise<PlotCaptures> {
  // Recharts and the fingerprint both size themselves off a ResizeObserver,
  // which a hidden tab never delivers. Mounting there would stage plots that
  // can never measure.
  await whenVisible();

  const host = createOffscreenHost(EXPORT_STAGE_WIDTH);
  const root = createRoot(host);

  const findSvg = () =>
    host.querySelector<SVGSVGElement>('[data-export-plot="line"] svg');
  const findCanvas = () =>
    host.querySelector<HTMLCanvasElement>(
      '[data-export-plot="fingerprint"] canvas',
    );

  try {
    root.render(<ExportStage {...props} />);

    // Recharts measures its container on a resize observation, and the
    // fingerprint sizes its backing store in an effect after the same. Neither
    // emits an event to wait on, so poll for the results of both.
    await waitUntil(
      () => {
        const svg = findSvg();
        const canvas = findCanvas();
        return (
          !!svg &&
          svg.getBoundingClientRect().width > 0 &&
          !!canvas &&
          canvas.width > 0
        );
      },
      { label: "offscreen plots" },
    );

    // One more frame so the fingerprint's draw call lands in the backing store.
    await nextFrame();

    const svg = findSvg();
    const canvas = findCanvas();
    if (!svg || !canvas) throw new Error("Export stage lost its plots");

    return {
      timeSeries: await svgToPng(svg, { scale: EXPORT_PIXEL_RATIO }),
      fingerprint: canvasToPng(canvas),
      fingerprintStandalone: fingerprintPngWithLegend(canvas, {
        absMax: symmetricAbsMax(props.values),
        units: props.units,
        pixelRatio: EXPORT_PIXEL_RATIO,
      }),
    };
  } finally {
    root.unmount();
    host.remove();
  }
}
