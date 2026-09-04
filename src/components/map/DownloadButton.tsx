"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon } from "@/icons/DownloadIcon";
import { captureMapForExport } from "@/components/map/ExportMapStage";
import { capturePlotsForExport } from "@/components/map/ExportStage";
import { buildSeriesCsv } from "@/lib/export/csv";
import { downloadBlob } from "@/lib/export/download";
import {
  buildSquareFingerprintCanvas,
  SQUARE_LOGO_PRESETS,
} from "@/lib/export/fingerprintSquareLogo";
import { buildReportPdf, type ReportAssets } from "@/lib/export/pdf";
import { buildProvenance, exportFileBaseName } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { buildSeriesWorkbook } from "@/lib/export/xlsx";
import { blobToBytes, buildZip, dataUrlToBytes } from "@/lib/export/zip";
import { useTheme } from "@/providers/ThemeProvider";
import type { GridSpec, MapSelection } from "@/types/map";

type DownloadButtonProps = {
  selection: MapSelection;
  gridSpec: GridSpec;
  historyYears: number;
  values: Float32Array | null;
  units: string | null;
  selectedYear?: number | null;
  selectedYears?: number[] | null;
};

export function DownloadButton({
  selection,
  gridSpec,
  historyYears,
  values,
  units,
  selectedYear = null,
  selectedYears = null,
}: DownloadButtonProps) {
  const { isLight } = useTheme();
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Preparing…");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBadgeSizes, setShowBadgeSizes] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setShowBadgeSizes(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setShowBadgeSizes(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Full ZIP archive export (PDF, Excel, CSV, standard plots, and square badge)
  const runZipExport = useCallback(async () => {
    if (!values) return;

    setError(null);
    setBusy(true);
    setBusyLabel("Building ZIP…");
    setMenuOpen(false);
    try {
      const prov = buildProvenance({
        selection,
        historyYears,
        selectedYear,
        selectedYears,
        valueCount: values.length,
        units,
      });
      const base = exportFileBaseName(prov);

      const [mapCapture, plots] = await Promise.all([
        captureMapForExport({ cell: selection.grid, gridSpec }),
        capturePlotsForExport({
          values,
          units,
          hoursPerDay: prov.hoursPerDay,
          selectedYear,
          selectedYears,
        }),
      ]);

      const squareCanvas = buildSquareFingerprintCanvas({
        values,
        prov,
        units,
        size: 1024,
        isLight: true,
        selectedYear,
        selectedYears,
      });
      const squareDataUrl = squareCanvas.toDataURL("image/png");

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
      console.error("ZIP export failed", cause);
      setError("ZIP export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [gridSpec, historyYears, selectedYear, selectedYears, selection, units, values]);

  // Single Workbook export
  const runWorkbookExport = useCallback(async () => {
    if (!values) return;

    setError(null);
    setBusy(true);
    setBusyLabel("Building XLSX…");
    setMenuOpen(false);
    try {
      const prov = buildProvenance({
        selection,
        historyYears,
        selectedYear,
        selectedYears,
        valueCount: values.length,
        units,
      });
      const base = exportFileBaseName(prov);
      const rows = buildSeriesRows(values, prov);
      const workbook = await buildSeriesWorkbook(rows, prov);
      downloadBlob(workbook, `${base}.xlsx`);
    } catch (cause) {
      console.error("Workbook export failed", cause);
      setError("Excel export failed.");
    } finally {
      setBusy(false);
    }
  }, [historyYears, selectedYear, selectedYears, selection, units, values]);

  // Standalone Square Badge export
  const runSquareBadgeExport = useCallback(
    (targetSize: number) => {
      if (!values) return;

      setError(null);
      setBusy(true);
      setBusyLabel("Generating badge…");
      setMenuOpen(false);
      setShowBadgeSizes(false);

      try {
        const prov = buildProvenance({
          selection,
          historyYears,
          selectedYear,
          selectedYears,
          valueCount: values.length,
          units,
        });
        const base = exportFileBaseName(prov);

        const canvas = buildSquareFingerprintCanvas({
          values,
          prov,
          units,
          size: targetSize,
          isLight,
          selectedYear,
          selectedYears,
        });

        const yearTag =
          selectedYears && selectedYears.length > 0
            ? `_${selectedYears.join("-")}`
            : selectedYear
              ? `_${selectedYear}`
              : "";
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(
              blob,
              `${base}${yearTag}_badge_${targetSize}x${targetSize}.png`,
            );
          }
        }, "image/png");
      } catch (cause) {
        console.error("Badge export failed", cause);
        setError("Badge export failed.");
      } finally {
        setBusy(false);
      }
    },
    [historyYears, isLight, selectedYear, selectedYears, selection, units, values],
  );

  // Single PDF export
  const runPdfExport = useCallback(async () => {
    if (!values) return;

    setError(null);
    setBusy(true);
    setBusyLabel("Rendering PDF…");
    setMenuOpen(false);
    try {
      const prov = buildProvenance({
        selection,
        historyYears,
        selectedYear,
        selectedYears,
        valueCount: values.length,
        units,
      });
      const base = exportFileBaseName(prov);

      const [mapCapture, plots] = await Promise.all([
        captureMapForExport({ cell: selection.grid, gridSpec }),
        capturePlotsForExport({
          values,
          units,
          hoursPerDay: prov.hoursPerDay,
          selectedYear,
          selectedYears,
        }),
      ]);
      const assets: ReportAssets = {
        map: mapCapture.image,
        timeSeries: plots.timeSeries,
        fingerprint: plots.fingerprint,
      };

      const pdf = await buildReportPdf({
        prov,
        assets,
        values,
        attribution: mapCapture.attribution,
      });

      downloadBlob(pdf, `${base}.pdf`);
    } catch (cause) {
      console.error("PDF export failed", cause);
      setError("PDF export failed.");
    } finally {
      setBusy(false);
    }
  }, [gridSpec, historyYears, selectedYear, selectedYears, selection, units, values]);

  // Single CSV export
  const runCsvExport = useCallback(() => {
    if (!values) return;
    setMenuOpen(false);
    const prov = buildProvenance({
      selection,
      historyYears,
      selectedYear,
      selectedYears,
      valueCount: values.length,
      units,
    });
    const base = exportFileBaseName(prov);
    const rows = buildSeriesRows(values, prov);
    const csv = buildSeriesCsv(rows, prov);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${base}.csv`);
  }, [historyYears, selectedYear, selectedYears, selection, units, values]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <div className="inline-flex rounded-md border border-editor-border shadow-xs">
        <button
          type="button"
          disabled={!values || busy}
          onClick={() => void runZipExport()}
          title="Downloads full zip: PDF report, Excel & CSV tables, and all plot graphics"
          className="inline-flex items-center gap-1.5 rounded-l-md px-2 py-1 text-[11.5px] font-semibold text-editor-fg-secondary transition-colors hover:bg-editor-bg-secondary hover:text-editor-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DownloadIcon />
          {busy ? busyLabel : "Download"}
        </button>

        <button
          type="button"
          disabled={!values || busy}
          onClick={() => {
            setMenuOpen((prev) => !prev);
            setShowBadgeSizes(false);
          }}
          aria-expanded={menuOpen}
          aria-label="Download options"
          title="More download formats & square badge"
          className="border-l border-editor-border px-1.5 py-1 text-[10px] text-editor-fg-tertiary transition-colors hover:bg-editor-bg-secondary hover:text-editor-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          ▾
        </button>
      </div>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-editor-border bg-editor-bg-primary p-1 shadow-lg backdrop-blur-md"
        >
          <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-editor-fg-tertiary">
            Export Options
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => void runZipExport()}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-editor-fg-secondary hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
          >
            <span>Full Package Archive</span>
            <span className="font-mono text-[10px] text-editor-fg-tertiary">
              .zip
            </span>
          </button>

          <div className="my-1 border-t border-editor-border" />

          <div className="relative">
            <button
              type="button"
              role="menuitem"
              onClick={() => setShowBadgeSizes((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-editor-fg-secondary hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
            >
              <span>Square Fingerprint Badge</span>
              <span className="font-mono text-[10px] text-accent">
                {showBadgeSizes ? "▲ .png" : "▼ .png"}
              </span>
            </button>

            {showBadgeSizes ? (
              <div className="my-1 ml-2 space-y-0.5 border-l-2 border-accent/40 pl-2">
                <div className="py-0.5 text-[10px] text-editor-fg-tertiary">
                  Select resolution:
                </div>
                {SQUARE_LOGO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void runSquareBadgeExport(preset.size)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11.5px] text-editor-fg-secondary hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
                  >
                    <span>{preset.label}</span>
                    <span className="font-mono text-[10px] text-editor-fg-tertiary">
                      {preset.size}px
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="my-1 border-t border-editor-border" />

          <button
            type="button"
            role="menuitem"
            onClick={() => void runPdfExport()}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-editor-fg-secondary hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
          >
            <span>Scientific Report</span>
            <span className="font-mono text-[10px] text-editor-fg-tertiary">
              .pdf
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={runCsvExport}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-editor-fg-secondary hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
          >
            <span>Series Data</span>
            <span className="font-mono text-[10px] text-editor-fg-tertiary">
              .csv
            </span>
          </button>
        </div>
      ) : null}

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
