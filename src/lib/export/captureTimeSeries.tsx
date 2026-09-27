import { createRoot } from "react-dom/client";
import { TimeSeriesPlot } from "@/components/plots/TimeSeriesPlot";
import {
  createOffscreenHost,
  svgToPng,
  waitUntil,
  whenVisible,
  type CapturedImage,
} from "@/lib/export/capture";
import {
  EXPORT_PIXEL_RATIO,
  EXPORT_PLOT_HEIGHT,
  EXPORT_PLOT_WIDTH,
} from "@/lib/export/plotSize";

// Recharts 3 draws its series in effects after mount, so the chart has to be
// mounted for real and polled until the line exists; static rendering returns
// an empty wrapper.
export async function captureTimeSeries({
  values,
  units,
  hoursPerDay,
}: {
  values: Float32Array;
  units: string | null;
  hoursPerDay: number;
}): Promise<CapturedImage> {
  await whenVisible();

  const host = createOffscreenHost(EXPORT_PLOT_WIDTH);
  host.classList.add("theme-light");
  const root = createRoot(host);
  let chart: HTMLDivElement | null = null;

  try {
    root.render(
      <TimeSeriesPlot
        ref={(node) => {
          chart = node;
        }}
        values={values}
        units={units}
        hoursPerDay={hoursPerDay}
        width={EXPORT_PLOT_WIDTH}
        height={EXPORT_PLOT_HEIGHT}
      />,
    );

    const line = () =>
      chart?.querySelector<SVGPathElement>(".recharts-line-curve") ?? null;
    await waitUntil(() => line() !== null, { label: "time series chart" });

    const svg = line()?.ownerSVGElement;
    if (!svg) throw new Error("Time series chart did not render");
    return await svgToPng(svg, { scale: EXPORT_PIXEL_RATIO });
  } finally {
    root.unmount();
    host.remove();
  }
}
