"use client";

import { useCallback, useState } from "react";
import { captureFingerprint } from "@/lib/export/captureFingerprint";
import { captureMap } from "@/lib/export/captureMap";
import { captureTimeSeries } from "@/lib/export/captureTimeSeries";
import { buildSeriesCsv } from "@/lib/export/csv";
import { downloadBlob } from "@/lib/export/download";
import { buildSquareFingerprintCanvas } from "@/lib/export/fingerprintSquareLogo";
import { buildReportPdf, type ReportAssets } from "@/lib/export/pdf";
import { buildProvenance, exportFileBaseName } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { buildSeriesWorkbook } from "@/lib/export/xlsx";
import { blobToBytes, buildZip, dataUrlToBytes } from "@/lib/export/zip";
import type { TimeBasis } from "@/lib/zarr/localTime";
import type { ColormapId } from "@/lib/map/fingerprintScale";
import { useTheme } from "@/providers/ThemeProvider";
import type { GridSpec, MapSelection } from "@/types/map";

type CellExportInput = {
  selection: MapSelection | null;
  gridSpec: GridSpec;
  selectedYears: number[];
  values: Float32Array | null;
  displayValues: Float32Array | null;
  timeBasis: TimeBasis;
  units: string | null;
  colormapId: ColormapId;
};

export function useCellExport({
  selection,
  gridSpec,
  selectedYears,
  values,
  displayValues,
  timeBasis,
  units,
  colormapId,
}: CellExportInput) {
  const { isLight } = useTheme();
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provenance = useCallback(() => {
    if (!selection || !values) return null;
    return buildProvenance({
      selection,
      historyYears: selectedYears.length,
      selectedYears,
      valueCount: values.length,
      units,
      timeBasis,
    });
  }, [selectedYears, selection, timeBasis, units, values]);

  const capture = useCallback(
    async (hoursPerDay: number) => {
      if (!selection || !values) throw new Error("Nothing to export");
      const plotValues = displayValues ?? values;
      const fingerprint = captureFingerprint({
        values: plotValues,
        units,
        hoursPerDay,
        selectedYears,
      });
      const [mapCapture, timeSeries] = await Promise.all([
        captureMap({ cell: selection.grid, gridSpec }),
        captureTimeSeries({ values: plotValues, units, hoursPerDay }),
      ]);
      const assets: ReportAssets = {
        map: mapCapture.image,
        timeSeries,
        fingerprint: fingerprint.image,
      };
      return { mapCapture, timeSeries, fingerprint, assets };
    },
    [displayValues, gridSpec, selectedYears, selection, units, values],
  );

  const run = useCallback(
    async (label: string, failure: string, task: () => Promise<void>) => {
      setError(null);
      setBusyLabel(label);
      try {
        await task();
      } catch (cause) {
        console.error(failure, cause);
        setError(failure);
      } finally {
        setBusyLabel(null);
      }
    },
    [],
  );

  const exportZip = useCallback(
    () =>
      run("Building ZIP…", "ZIP export failed. Please try again.", async () => {
        const prov = provenance();
        if (!prov || !values) return;
        const base = exportFileBaseName(prov);
        const { mapCapture, timeSeries, fingerprint, assets } = await capture(
          prov.hoursPerDay,
        );

        const squareDataUrl = buildSquareFingerprintCanvas({
          values: displayValues ?? values,
          prov,
          units,
          size: 1024,
          isLight: true,
          selectedYears,
          colormapId,
        }).toDataURL("image/png");

        const rows = buildSeriesRows(values, prov);
        const [pdf, workbook] = await Promise.all([
          buildReportPdf({
            prov,
            assets,
            values: displayValues ?? values,
            attribution: mapCapture.attribution,
          }),
          buildSeriesWorkbook(rows, prov),
        ]);

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
            name: `${base}_badge.png`,
            data: dataUrlToBytes(squareDataUrl),
            stored: true,
          },
          {
            name: `${base}_fingerprint.png`,
            data: dataUrlToBytes(fingerprint.standalone.dataUrl),
            stored: true,
          },
          {
            name: `${base}_timeseries.png`,
            data: dataUrlToBytes(timeSeries.dataUrl),
            stored: true,
          },
        ]);

        downloadBlob(archive, `${base}.zip`);
      }),
    [
      capture,
      colormapId,
      displayValues,
      provenance,
      run,
      selectedYears,
      units,
      values,
    ],
  );

  const exportPdf = useCallback(
    () =>
      run("Rendering PDF…", "PDF export failed.", async () => {
        const prov = provenance();
        if (!prov || !values) return;
        const { mapCapture, assets } = await capture(prov.hoursPerDay);
        const pdf = await buildReportPdf({
          prov,
          assets,
          values: displayValues ?? values,
          attribution: mapCapture.attribution,
        });
        downloadBlob(pdf, `${exportFileBaseName(prov)}.pdf`);
      }),
    [capture, displayValues, provenance, run, values],
  );

  const exportCsv = useCallback(
    () =>
      run("Building CSV…", "CSV export failed.", async () => {
        const prov = provenance();
        if (!prov || !values) return;
        const csv = buildSeriesCsv(buildSeriesRows(values, prov), prov);
        downloadBlob(
          new Blob([csv], { type: "text/csv;charset=utf-8" }),
          `${exportFileBaseName(prov)}.csv`,
        );
      }),
    [provenance, run, values],
  );

  const exportBadge = useCallback(
    (size: number) =>
      run("Generating badge…", "Badge export failed.", async () => {
        const prov = provenance();
        if (!prov || !values) return;
        const canvas = buildSquareFingerprintCanvas({
          values: displayValues ?? values,
          prov,
          units,
          size,
          isLight,
          selectedYears,
          colormapId,
        });
        const yearTag =
          selectedYears.length > 0 ? `_${selectedYears.join("-")}` : "";
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (blob) {
          downloadBlob(
            blob,
            `${exportFileBaseName(prov)}${yearTag}_badge_${size}x${size}.png`,
          );
        }
      }),
    [
      colormapId,
      displayValues,
      isLight,
      provenance,
      run,
      selectedYears,
      units,
      values,
    ],
  );

  return {
    busyLabel,
    error,
    exportZip,
    exportPdf,
    exportCsv,
    exportBadge,
  };
}
