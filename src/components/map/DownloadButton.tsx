"use client";

import { useCallback, useState } from "react";
import { DownloadIcon } from "@/icons/DownloadIcon";
import { captureMapForExport } from "@/components/map/ExportMapStage";
import { capturePlotsForExport } from "@/components/map/ExportStage";
import { buildSeriesCsv } from "@/lib/export/csv";
import { downloadBlob } from "@/lib/export/download";
import { buildReportPdf, type ReportAssets } from "@/lib/export/pdf";
import { buildProvenance, exportFileBaseName } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { buildSeriesWorkbook } from "@/lib/export/xlsx";
import { blobToBytes, buildZip, dataUrlToBytes } from "@/lib/export/zip";
import type { GridSpec, MapSelection } from "@/types/map";

type DownloadButtonProps = {
  selection: MapSelection;
  gridSpec: GridSpec;
  historyYears: number;
  values: Float32Array | null;
  units: string | null;
};

export function DownloadButton({
  selection,
  gridSpec,
  historyYears,
  values,
  units,
}: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runExport = useCallback(async () => {
    if (!values) return;

    setError(null);
    setBusy(true);
    try {
      const prov = buildProvenance({
        selection,
        historyYears,
        valueCount: values.length,
        units,
      });
      const base = exportFileBaseName(prov);

      // Both stages mount offscreen and are independent, so the map's tiles
      // download while the plots lay out.
      const [mapCapture, plots] = await Promise.all([
        captureMapForExport({ cell: selection.grid, gridSpec }),
        capturePlotsForExport({
          values,
          units,
          hoursPerDay: prov.hoursPerDay,
        }),
      ]);
      const assets: ReportAssets = {
        map: mapCapture.image,
        timeSeries: plots.timeSeries,
        fingerprint: plots.fingerprint,
      };

      const rows = buildSeriesRows(values, prov);
      const [pdf, workbook] = await Promise.all([
        buildReportPdf({
          prov,
          assets,
          values,
          attribution: mapCapture.attribution,
        }),
        buildSeriesWorkbook(rows, prov),
      ]);

      // Everything but the CSV is compressed already, so only it is worth
      // deflating. Every name carries the full stem: extracted loose among
      // other downloads they still say which pixel and window they came from.
      const archive = await buildZip([
        { name: `${base}.pdf`, data: await blobToBytes(pdf), stored: true },
        {
          name: `${base}.xlsx`,
          data: await blobToBytes(workbook),
          stored: true,
        },
        {
          name: `${base}.csv`,
          data: new TextEncoder().encode(buildSeriesCsv(rows, prov)),
        },
        {
          name: `${base}_fingerprint.png`,
          data: dataUrlToBytes(plots.fingerprintStandalone.dataUrl),
          stored: true,
        },
        {
          name: `${base}_timeseries.png`,
          data: dataUrlToBytes(plots.timeSeries.dataUrl),
          stored: true,
        },
      ]);

      downloadBlob(archive, `${base}.zip`);
    } catch (cause) {
      console.error("Export failed", cause);
      setError("Export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, [gridSpec, historyYears, selection, units, values]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!values || busy}
        onClick={() => void runExport()}
        title="Downloads a zip: PDF report, Excel and CSV tables, and both plots as images"
        className="inline-flex items-center gap-1.5 rounded-md border border-editor-border px-2 py-1 text-[11.5px] font-semibold text-editor-fg-secondary transition-colors hover:border-editor-border-strong hover:text-editor-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <DownloadIcon />
        {busy ? "Preparing…" : "Download"}
      </button>

      {error ? (
        <p
          role="status"
          className="absolute right-0 top-full mt-1.5 whitespace-nowrap text-[11.5px] text-editor-fg-tertiary"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
