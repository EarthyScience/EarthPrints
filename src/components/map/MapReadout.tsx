"use client";

import { useState } from "react";
import type { GridSpec, MapSelection } from "@/types/map";
import { formatLatitude, formatLongitude } from "@/lib/map/geogrid";
import { DEFAULT_GRID_SPEC, ZARR_STORE } from "@/lib/constants/store";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import { TimeSeriesPlot } from "@/components/map/TimeSeriesPlot";
import { TimeSeriesPlotLoading } from "@/components/map/TimeSeriesPlotLoading";
import { FingerprintPlot } from "@/components/map/FingerprintPlot";
import { FingerprintPlotLoading } from "@/components/map/FingerprintPlotLoading";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DownloadButton } from "@/components/map/DownloadButton";
import { YearSelector } from "@/components/map/YearSelector";

type PlotView = "line" | "fingerprint";

type SeriesProgress = { loaded: number; total: number };

type MapReadoutProps = {
  selection: MapSelection | null;
  gridSpec?: GridSpec;
  variable?: string;
  selectedYear: number;
  cachedYears?: Set<number>;
  onSelectYear: (year: number) => void;
  loadingSeries: boolean;
  seriesProgress: SeriesProgress | null;
  seriesError: string | null;
  seriesValues: Float32Array | null;
  seriesUnits: string | null;
};

const SECTION_LABEL = "text-[13px] font-semibold text-editor-fg-primary";
const META = "font-mono text-[11px] text-editor-fg-tertiary";

export function MapReadout({
  selection,
  gridSpec = DEFAULT_GRID_SPEC,
  variable = ZARR_STORE.defaultVariable,
  selectedYear,
  cachedYears = new Set(),
  onSelectYear,
  loadingSeries,
  seriesProgress,
  seriesError,
  seriesValues,
  seriesUnits,
}: MapReadoutProps) {
  const [plotView, setPlotView] = useState<PlotView>("line");
  const [fingerprintTransposed, setFingerprintTransposed] = useState(false);

  if (!selection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <div
          className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-editor-border-strong"
          aria-hidden="true"
        >
          <span className="block h-2 w-2 rounded-full bg-accent" />
        </div>
        <p className="text-[13.5px] font-semibold text-editor-fg-secondary">
          Click the map
        </p>
        <p className="text-[12.5px] text-editor-fg-tertiary">
          Pick a point to load its record
        </p>
      </div>
    );
  }

  const patchCells = gridSpec.nativeChunks.lon;
  const patchDeg = Number((patchCells * gridSpec.spatialResolutionDeg).toFixed(2));
  const gridResolution = Number(gridSpec.spatialResolutionDeg.toFixed(2));

  const historyControl = (
    <YearSelector
      selectedYear={selectedYear}
      cachedYears={cachedYears}
      loading={loadingSeries}
      onSelectYear={onSelectYear}
    />
  );

  const chart = (
    <section aria-live="polite" className="flex flex-col flex-1 min-h-0">
      <span className={`${SECTION_LABEL} block shrink-0`}>
        {plotView === "line" ? "Daily mean" : "Diurnal fingerprint"}
      </span>

      {/* View switch left, download right, on the row between title and plot. */}
      <div className="mb-3 mt-2 flex items-center justify-between gap-3 shrink-0">
        <PlotViewToggle view={plotView} onChange={setPlotView} />
        <DownloadButton
          selection={selection}
          gridSpec={gridSpec}
          historyYears={1}
          values={loadingSeries ? null : seriesValues}
          units={seriesUnits}
          selectedYear={selectedYear}
        />
      </div>

      {loadingSeries ? (
        <div className="grid gap-3">
          <SeriesLoader progress={seriesProgress} />
          {plotView === "line" ? (
            <TimeSeriesPlotLoading historyYears={1} />
          ) : (
            <FingerprintPlotLoading transposed={fingerprintTransposed} />
          )}
        </div>
      ) : seriesError ? (
        <p className="text-[13px] leading-[1.55] text-editor-fg-tertiary">
          {seriesError}
        </p>
      ) : seriesValues ? (
        plotView === "line" ? (
          <TimeSeriesPlot
            values={seriesValues}
            units={seriesUnits}
            hoursPerDay={ZARR_TIME.hoursPerDay}
          />
        ) : (
          <FingerprintPlot
            values={seriesValues}
            units={seriesUnits}
            hoursPerDay={ZARR_TIME.hoursPerDay}
            selectedYear={selectedYear}
            transposed={fingerprintTransposed}
            onTransposedChange={setFingerprintTransposed}
          />
        )
      ) : null}
    </section>
  );

  return (
    <div className="flex flex-col divide-y divide-editor-border min-h-full">
      <section className="pb-4 shrink-0">
        <h2 className="font-mono text-[15px] font-semibold leading-none tracking-tight tabular-nums text-editor-fg-primary">
          {formatLongitude(selection.grid.lon)}
          <span className="text-editor-fg-tertiary">, </span>
          {formatLatitude(selection.grid.lat)}
        </h2>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-editor-fg-tertiary">
          {variable} · {ZARR_STORE.kicker} · snapped to the nearest {gridResolution}° cell
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-editor-fg-tertiary">
          Each click downloads a {patchCells}×{patchCells} patch ({patchDeg}° ×{" "}
          {patchDeg}°), drawn as the dashed box. Toggle it with the patch
          button.
        </p>
      </section>

      {/* History drives the chart, so they sit together with no divider. */}
      <div className="flex flex-col flex-1 min-h-0 gap-4 py-4">
        <div className="shrink-0">{historyControl}</div>
        {chart}
      </div>
    </div>
  );
}

function PlotViewToggle({
  view,
  onChange,
}: {
  view: PlotView;
  onChange: (view: PlotView) => void;
}) {
  const options: { id: PlotView; label: string }[] = [
    { id: "line", label: "Line" },
    { id: "fingerprint", label: "Fingerprint" },
  ];
  return (
    <div
      className="inline-flex rounded-md border border-editor-border p-0.5"
      role="tablist"
      aria-label="Plot view"
    >
      {options.map((option) => {
        const active = option.id === view;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`rounded-[5px] px-2 py-0.5 text-[11.5px] font-semibold transition-colors ${
              active
                ? "bg-accent text-white"
                : "text-editor-fg-tertiary hover:text-editor-fg-secondary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function SeriesLoader({ progress }: { progress: SeriesProgress | null }) {
  const hasBytes = progress !== null && progress.total > 0;
  const value = hasBytes ? progress.loaded / progress.total : undefined;
  const pct =
    value === undefined ? null : Math.min(100, Math.round(value * 100));

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-editor-fg-secondary">
          Loading time series
        </span>
        <span className="font-mono text-[12.5px] font-semibold tabular-nums text-accent">
          {pct === null ? "…" : `${pct}%`}
        </span>
      </div>
      <ProgressBar value={value} label="Fetching time series" />
      {hasBytes ? (
        <p className={META}>
          {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
        </p>
      ) : null}
    </div>
  );
}
