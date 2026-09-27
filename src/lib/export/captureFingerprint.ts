import { symmetricAbsMax } from "@/lib/map/fingerprintScale";
import {
  drawFingerprint,
  fingerprintExtents,
  fingerprintLayout,
} from "@/lib/plots/fingerprint";
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
      colormapId: "science-light",
      extents: fingerprintExtents(values, "science-light"),
      isLight: true,
      pixelRatio: EXPORT_PIXEL_RATIO,
    },
  );

  return {
    image: canvasToPng(canvas),
    standalone: fingerprintPngWithLegend(canvas, {
      absMax: symmetricAbsMax(values),
      units,
      pixelRatio: EXPORT_PIXEL_RATIO,
    }),
  };
}
