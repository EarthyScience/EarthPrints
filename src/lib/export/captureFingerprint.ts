import {
  asymmetricExtents,
  defaultColormapId,
} from "@/lib/map/fingerprintScale";
import { drawFingerprint, fingerprintLayout } from "@/lib/plots/fingerprint";
import { canvasToPng, type CapturedImage } from "@/lib/export/capture";
import { fingerprintPngWithLegend } from "@/lib/export/fingerprintImage";
import {
  EXPORT_PIXEL_RATIO,
  EXPORT_PLOT_HEIGHT,
  EXPORT_PLOT_WIDTH,
} from "@/lib/export/plotSize";

export type FingerprintCapture = {
  image: CapturedImage;
  standalone: CapturedImage;
};

// The report always uses the default view, whatever the panel shows.
export function captureFingerprint({
  values,
  units,
  hoursPerDay,
  selectedYears,
}: {
  values: Float32Array;
  units: string | null;
  hoursPerDay: number;
  selectedYears: number[];
}): FingerprintCapture {
  const colormapId = defaultColormapId(true);
  const extents = asymmetricExtents(values);
  const canvas = document.createElement("canvas");
  drawFingerprint(
    canvas,
    fingerprintLayout(
      values,
      hoursPerDay,
      selectedYears,
      { width: EXPORT_PLOT_WIDTH, height: EXPORT_PLOT_HEIGHT },
      false,
    ),
    {
      colormapId,
      extents,
      isLight: true,
      pixelRatio: EXPORT_PIXEL_RATIO,
    },
  );

  return {
    image: canvasToPng(canvas),
    standalone: fingerprintPngWithLegend(canvas, {
      ...extents,
      colormapId,
      units,
      pixelRatio: EXPORT_PIXEL_RATIO,
    }),
  };
}
