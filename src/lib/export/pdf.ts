import type { jsPDF } from "jspdf";
import {
  fingerprintColorScale,
  symmetricAbsMax,
} from "@/lib/map/fingerprintScale";
import { formatSeriesValue } from "@/components/map/timeSeriesChartConfig";
import { formatSelectedYearsLabel } from "@/lib/zarr/timeRange";
import type { CapturedImage } from "./capture";
import { isoDate, type ExportProvenance } from "./provenance";

/** A4 portrait, in mm. */
const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_GAP = 6;
const COL_W = (CONTENT_W - COL_GAP) / 2;
const HEAD_ROW_H = 54;
/** Both head-row columns hang their label and content off these, so the two align. */
const LABEL_DY = 3;
const CONTENT_DY = 7;

type Rgb = [number, number, number];

/**
 * The report always prints light, whatever theme the app is in, so these are
 * the light-theme values rather than anything read from the document.
 */
const INK: Rgb = [10, 10, 10];
const INK_SOFT: Rgb = [110, 110, 106];
const BORDER: Rgb = [220, 220, 214];
const ACCENT: Rgb = [0, 108, 102];

export type ReportAssets = {
  /** Null when the map canvas could not be read back. */
  map: CapturedImage | null;
  timeSeries: CapturedImage;
  fingerprint: CapturedImage;
};

type BuildOptions = {
  prov: ExportProvenance;
  assets: ReportAssets;
  values: Float32Array;
  /** Basemap credit, which the on-screen map hides but a distributed file must carry. */
  attribution?: string;
};

function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lon).toFixed(3)}°${ew}`;
}

/** Pull the channels back out of the `rgb(r, g, b)` strings the colour scale returns. */
function parseRgb(value: string): Rgb {
  const parts = value.match(/\d+/g);
  if (!parts || parts.length < 3) return [128, 128, 128];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/**
 * Scale `image` to fill the box completely, centred, overflowing on whichever
 * axis is proportionally longer. The caller clips to the box.
 */
function coverRect(
  image: CapturedImage,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / image.width, h / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  return {
    x: x + (w - drawW) / 2,
    y: y + (h - drawH) / 2,
    w: drawW,
    h: drawH,
  };
}

function drawSectionLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(text.toUpperCase(), x, y);
}

/** Left column of the head row: what was selected, and from where. Bare text, no frame. */
function drawFacts(
  doc: jsPDF,
  prov: ExportProvenance,
  rowCount: number,
  x: number,
  y: number,
) {
  const yearsLabel =
    prov.selectedYears && prov.selectedYears.length > 0
      ? formatSelectedYearsLabel(prov.selectedYears)
      : prov.selectedYear
        ? String(prov.selectedYear)
        : null;

  const rows: [string, string][] = [
    ["Cell centre", formatLatLon(prov.cell.lat, prov.cell.lon)],
    ["Clicked", formatLatLon(prov.click.lat, prov.click.lon)],
    ["Grid index", `lat ${prov.cell.latIndex}, lon ${prov.cell.lonIndex}`],
    ["Resolution", `${prov.resolutionDeg}deg, hourly`],
    ["Variable", `${prov.variable}${prov.units ? ` (${prov.units})` : ""}`],
    ...(yearsLabel ? [["Years", yearsLabel] as [string, string]] : []),
    ["Window", `${isoDate(prov.windowStart)} to ${isoDate(prov.windowEnd)}`],
    ["Coverage", `${prov.dayCount} days, ${rowCount.toLocaleString()} hours`],
  ];

  drawSectionLabel(doc, "Selection", x, y + LABEL_DY);

  let cursor = y + CONTENT_DY + 3;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK_SOFT);
    doc.text(label, x, cursor);

    doc.setFont("courier", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(value, x + 24, cursor);

    cursor += 5.6;
  }
}

/**
 * Right column of the head row: the label sits above the image, and the image
 * fills the box edge to edge. Cropping the overflow needs a clip, since jsPDF
 * would otherwise let the oversized image bleed across the page.
 */
function drawMapPanel(
  doc: jsPDF,
  map: CapturedImage | null,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  drawSectionLabel(doc, "Map view", x, y + LABEL_DY);

  const boxY = y + CONTENT_DY;
  const boxH = h - CONTENT_DY;

  if (!map) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK_SOFT);
    doc.text("Map preview unavailable", x, boxY + boxH / 2);
    return;
  }

  const fit = coverRect(map, x, boxY, w, boxH);
  doc.saveGraphicsState();
  // The null style matters: without it jsPDF strokes the clip rect, outlining
  // the image with a border the layout is not supposed to have.
  doc.rect(x, boxY, w, boxH, null);
  doc.clip();
  doc.discardPath();
  doc.addImage(map.dataUrl, "PNG", fit.x, fit.y, fit.w, fit.h);
  doc.restoreGraphicsState();
}

/**
 * A plot block: label, the rasterised chart across the full content width, and
 * a caption. Returns the y cursor below the block.
 */
function drawPlot(
  doc: jsPDF,
  image: CapturedImage,
  title: string,
  caption: string,
  y: number,
): number {
  drawSectionLabel(doc, title, MARGIN, y);
  let cursor = y + 3;

  const drawH = CONTENT_W * (image.height / image.width);
  doc.addImage(image.dataUrl, "PNG", MARGIN, cursor, CONTENT_W, drawH);
  cursor += drawH + 4.5;

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK_SOFT);
  doc.text(caption, MARGIN, cursor);

  return cursor + 4;
}

/**
 * Redraw the fingerprint's diverging legend, which lives in HTML beside the
 * canvas rather than inside it. jsPDF has no gradient primitive, so the ramp is
 * sampled into thin bars from the same colour scale the plot uses.
 */
function drawLegend(doc: jsPDF, absMax: number, y: number): number {
  const scale = fingerprintColorScale(true);
  const steps = 96;
  const barW = 70;
  const barH = 2.4;
  const barX = MARGIN + 24;

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    doc.setFillColor(...parseRgb(scale((t * 2 - 1) * absMax, absMax)));
    // Overlap by a hair so no seams show between bars.
    doc.rect(barX + (i * barW) / steps, y, barW / steps + 0.1, barH, "F");
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK_SOFT);
  doc.text(formatSeriesValue(-absMax), MARGIN, y + barH - 0.3);
  doc.text(formatSeriesValue(absMax), barX + barW + 3, y + barH - 0.3);

  return y + barH + 4;
}

function drawFooter(doc: jsPDF, prov: ExportProvenance, attribution?: string) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, pageH - 18, PAGE_W - MARGIN, pageH - 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...INK_SOFT);

  const lines = [
    `Source: ${prov.sourceUrl}`,
    // Nothing to credit when the map could not be drawn, and an empty
    // "Basemap:" reads as a missing value rather than an absent one.
    attribution ? `Basemap: ${attribution}` : null,
    `Generated ${prov.generatedAt.toISOString()} by EarthPrints`,
  ].filter((line): line is string => line !== null);

  let cursor = pageH - 13.5;
  for (const line of lines) {
    doc.text(doc.splitTextToSize(line, CONTENT_W)[0] ?? line, MARGIN, cursor);
    cursor += 3.2;
  }
}

/** Assemble the one-page report. Imports jsPDF lazily to keep it off the map route's first load. */
export async function buildReportPdf({
  prov,
  assets,
  values,
  attribution,
}: BuildOptions): Promise<Blob> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(
    `${prov.variable} at ${formatLatLon(prov.cell.lat, prov.cell.lon)}`,
    MARGIN,
    MARGIN + 4,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...ACCENT);
  doc.text(
    `${prov.dataset} - ${isoDate(prov.windowStart)} to ${isoDate(prov.windowEnd)}`,
    MARGIN,
    MARGIN + 9.5,
  );

  const headY = MARGIN + 14;
  const rowCount = prov.dayCount * prov.hoursPerDay;
  drawFacts(doc, prov, rowCount, MARGIN, headY);
  drawMapPanel(
    doc,
    assets.map,
    MARGIN + COL_W + COL_GAP,
    headY,
    COL_W,
    HEAD_ROW_H,
  );

  let cursor = headY + HEAD_ROW_H + 10;

  cursor = drawPlot(
    doc,
    assets.timeSeries,
    "Daily mean",
    `${rowCount.toLocaleString()} hourly steps, ${prov.dayCount.toLocaleString()} daily means${
      prov.units ? ` - ${prov.units}` : ""
    }`,
    cursor,
  );

  cursor += 6;
  cursor = drawPlot(
    doc,
    assets.fingerprint,
    "Diurnal fingerprint",
    `${prov.dayCount.toLocaleString()} days x ${prov.hoursPerDay} hours${
      prov.units ? ` - ${prov.units}` : ""
    }`,
    cursor,
  );

  drawLegend(doc, symmetricAbsMax(values), cursor);
  drawFooter(doc, prov, attribution);

  return doc.output("blob");
}
