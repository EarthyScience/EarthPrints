"use client";

import { createRoot } from "react-dom/client";
import { FingerprintPlot } from "@/components/map/FingerprintPlot";
import { TimeSeriesPlot } from "@/components/map/TimeSeriesPlot";
import {
  canvasToPng,
  nextFrame,
  svgToPng,
  waitUntil,
  type CapturedImage,
} from "@/lib/export/capture";
import { FixedThemeProvider } from "@/providers/ThemeProvider";

/**
 * Stage width in CSS px. The readout sidebar is far narrower than the PDF's
 * 182mm content column, so capturing the on-screen plots would print a cramped
 * chart stretched wide. Rendering offscreen at this width gives the plots a
 * print-appropriate aspect ratio, and it drives the fingerprint's day-axis
 * resolution: roughly 700 columns of heatmap across the page.
 */
export const EXPORT_STAGE_WIDTH = 760;

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
          />
        </div>
        <div data-export-plot="fingerprint">
          <FingerprintPlot
            values={values}
            units={units}
            hoursPerDay={hoursPerDay}
          />
        </div>
      </div>
    </FixedThemeProvider>
  );
}

function createHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    // Offscreen rather than hidden: `display:none` and `visibility:hidden` both
    // stop ResizeObserver from reporting a width, which the plots need to draw.
    left: "-20000px",
    width: `${EXPORT_STAGE_WIDTH}px`,
    background: "#ffffff",
    pointerEvents: "none",
  });
  document.body.appendChild(host);
  return host;
}

/**
 * Mount both plots offscreen, wait for them to paint, and rasterise them.
 * The stage is torn down before this resolves.
 */
export async function capturePlotsForExport(
  props: StageProps,
): Promise<{ timeSeries: CapturedImage; fingerprint: CapturedImage }> {
  const host = createHost();
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
      timeSeries: await svgToPng(svg),
      fingerprint: canvasToPng(canvas),
    };
  } finally {
    root.unmount();
    host.remove();
  }
}
