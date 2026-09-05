import { describe, expect, it } from "vitest";
import { buildProvenance } from "@/lib/export/provenance";
import { buildReportPdf, type ReportAssets } from "@/lib/export/pdf";
import type { CapturedImage } from "@/lib/export/capture";
import type { MapSelection } from "@/types/map";

/** 1x1 red PNG. jsPDF only needs something it can decode. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const image = (width: number, height: number): CapturedImage => ({
  dataUrl: PNG,
  width,
  height,
});

const SELECTION: MapSelection = {
  click: { lat: 52.058, lon: 15.862 },
  grid: { lat: 52.075, lon: 15.875, latIndex: 758, lonIndex: 3917 },
};

function fixture(map: CapturedImage | null) {
  const values = new Float32Array(24 * 365);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = Math.sin(i / 24) * 3;
  }

  const prov = buildProvenance({
    selection: SELECTION,
    historyYears: 1,
    valueCount: values.length,
    units: "umolCO2 m-2 s-1",
  });

  const assets: ReportAssets = {
    map,
    timeSeries: image(1520, 440),
    fingerprint: image(1520, 620),
  };

  return { prov, assets, values };
}

describe("buildReportPdf", () => {
  it("assembles a one-page report", async () => {
    const { prov, assets, values } = fixture(image(1600, 900));

    const blob = await buildReportPdf({
      prov,
      assets,
      values,
      attribution: "OpenFreeMap, OpenStreetMap contributors",
    });

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  });

  // The map preview is the one asset that can legitimately go missing, when the
  // WebGL buffer cannot be read back.
  it("still renders when the map capture failed", async () => {
    const { prov, assets, values } = fixture(null);

    const blob = await buildReportPdf({ prov, assets, values, attribution: "" });

    expect(blob.size).toBeGreaterThan(1000);
  });

  // A tall, narrow map has to be cropped to fill the box rather than letterboxed,
  // and the clip that does the cropping must be balanced or jsPDF throws.
  it("crops a map whose aspect ratio does not match the box", async () => {
    const { prov, assets, values } = fixture(image(600, 1400));

    const blob = await buildReportPdf({ prov, assets, values, attribution: "" });

    expect(blob.size).toBeGreaterThan(1000);
  });
});
