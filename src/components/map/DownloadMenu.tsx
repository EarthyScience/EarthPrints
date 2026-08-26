"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DownloadIcon } from "@/icons/DownloadIcon";
import { capturePlotsForExport } from "@/components/map/ExportStage";
import { canvasToPng } from "@/lib/export/capture";
import { buildSeriesCsv } from "@/lib/export/csv";
import { downloadBlob, downloadText } from "@/lib/export/download";
import type { MapSnapshot } from "@/lib/export/mapSnapshot";
import { buildReportPdf, type ReportAssets } from "@/lib/export/pdf";
import { buildProvenance, exportFileBaseName } from "@/lib/export/provenance";
import { buildSeriesRows } from "@/lib/export/rows";
import { buildSeriesWorkbook } from "@/lib/export/xlsx";
import type { MapSelection } from "@/types/map";

type ExportFormat = "pdf" | "csv" | "xlsx";

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "pdf", label: "PDF report", hint: "Map preview and both plots" },
  { id: "csv", label: "CSV table", hint: "Hourly values, one row per hour" },
  { id: "xlsx", label: "Excel table", hint: "Same rows, typed timestamps" },
];

type DownloadMenuProps = {
  selection: MapSelection;
  historyYears: number;
  values: Float32Array | null;
  units: string | null;
  getMapSnapshot?: () => MapSnapshot | null;
};

export function DownloadMenu({
  selection,
  historyYears,
  values,
  units,
  getMapSnapshot,
}: DownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const runExport = useCallback(
    async (format: ExportFormat) => {
      if (!values) return;

      setOpen(false);
      setError(null);
      setBusy(format);
      try {
        const prov = buildProvenance({
          selection,
          historyYears,
          valueCount: values.length,
          units,
        });
        const base = exportFileBaseName(prov);

        if (format === "pdf") {
          // Rasterise the map first, and synchronously: capturing the plots
          // spans several frames, and the drawing buffer only holds the most
          // recent one, so a repaint in between would swap it out underneath us.
          const snapshot = getMapSnapshot?.() ?? null;
          const map = snapshot ? canvasToPng(snapshot.canvas) : null;

          const plots = await capturePlotsForExport({
            values,
            units,
            hoursPerDay: prov.hoursPerDay,
          });
          const assets: ReportAssets = { map, ...plots };

          const blob = await buildReportPdf({
            prov,
            assets,
            values,
            attribution: snapshot?.attribution ?? "",
          });
          downloadBlob(blob, `${base}.pdf`);
          return;
        }

        const rows = buildSeriesRows(values, prov);
        if (format === "csv") {
          downloadText(
            buildSeriesCsv(rows, prov),
            `${base}.csv`,
            "text/csv;charset=utf-8",
          );
        } else {
          downloadBlob(await buildSeriesWorkbook(rows, prov), `${base}.xlsx`);
        }
      } catch (cause) {
        console.error("Export failed", cause);
        setError("Export failed. Try again.");
      } finally {
        setBusy(null);
      }
    },
    [getMapSnapshot, historyYears, selection, units, values],
  );

  const disabled = !values || busy !== null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex items-center gap-1.5 rounded-md border border-editor-border px-2 py-1 text-[11.5px] font-semibold text-editor-fg-secondary transition-colors hover:border-editor-border-strong hover:text-editor-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <DownloadIcon />
        {busy ? "Preparing…" : "Download"}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Download format"
          className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-editor-sm border border-editor-border bg-editor-bg-depth shadow-editor"
        >
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="menuitem"
              onClick={() => void runExport(format.id)}
              className="grid w-full gap-0.5 px-3 py-2 text-left transition-colors hover:bg-editor-bg-secondary"
            >
              <span className="text-[12.5px] font-semibold text-editor-fg-primary">
                {format.label}
              </span>
              <span className="text-[11.5px] text-editor-fg-tertiary">
                {format.hint}
              </span>
            </button>
          ))}
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
