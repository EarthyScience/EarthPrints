"use client";

import type { MapSelection } from "@/types/map";
import { formatCoordinate, formatGeoPoint } from "@/lib/map/geogrid";
import { ZARR_STORE } from "@/lib/constants/store";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import { TimeSeriesPlot } from "@/components/map/TimeSeriesPlot";
import { TimeSeriesPlotLoading } from "@/components/map/TimeSeriesPlotLoading";
import { ProgressBar } from "@/components/ui/ProgressBar";

type SeriesProgress = { loaded: number; total: number };

type MapReadoutProps = {
  selection: MapSelection | null;
  historyYears: number;
  onHistoryYearsChange: (years: number) => void;
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
  historyYears,
  onHistoryYearsChange,
  loadingSeries,
  seriesProgress,
  seriesError,
  seriesValues,
  seriesUnits,
}: MapReadoutProps) {
  const historyLabel =
    historyYears === 1 ? "Last 1 year" : `Last ${historyYears} years`;

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

  const patchCells = ZARR_STORE.nativeChunks.lon;
  const patchDeg = patchCells * ZARR_STORE.spatialResolutionDeg;

  const historyControl = (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <label className={SECTION_LABEL} htmlFor="history-years">
          History window
        </label>
        <span className="font-mono text-[12.5px] font-semibold text-accent">
          {historyLabel}
        </span>
      </div>
      <input
        id="history-years"
        className="w-full cursor-pointer [accent-color:var(--accent)]"
        type="range"
        min={ZARR_TIME.defaultHistoryYears}
        max={ZARR_TIME.maxHistoryYears}
        step={1}
        value={historyYears}
        onChange={(event) =>
          onHistoryYearsChange(Number(event.currentTarget.value))
        }
      />
    </section>
  );

  const chart = (
    <section aria-live="polite">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className={SECTION_LABEL}>Daily mean</span>
        {!loadingSeries && !seriesError && seriesValues && seriesUnits ? (
          <span className={META}>{seriesUnits}</span>
        ) : null}
      </div>

      {loadingSeries ? (
        <div className="grid gap-3">
          <SeriesLoader progress={seriesProgress} />
          <TimeSeriesPlotLoading historyYears={historyYears} />
        </div>
      ) : seriesError ? (
        <p className="text-[13px] leading-[1.55] text-editor-fg-tertiary">
          {seriesError}
        </p>
      ) : seriesValues ? (
        <TimeSeriesPlot
          values={seriesValues}
          units={seriesUnits}
          hoursPerDay={ZARR_TIME.hoursPerDay}
        />
      ) : null}
    </section>
  );

  return (
    <div className="flex flex-col divide-y divide-editor-border">
      <section className="pb-4">
        <h2 className="font-mono text-[20px] leading-none tracking-tight tabular-nums text-editor-fg-primary">
          {formatCoordinate(selection.click.lat)}
          <span className="text-editor-fg-tertiary">, </span>
          {formatCoordinate(selection.click.lon)}
        </h2>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-editor-fg-tertiary">
          {ZARR_STORE.kicker} · snapped to the nearest{" "}
          {ZARR_STORE.spatialResolutionDeg}° cell
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-editor-fg-tertiary">
          Each click downloads a {patchCells}×{patchCells} patch ({patchDeg}° ×{" "}
          {patchDeg}°), drawn as the dashed box. Toggle it with the patch
          button.
        </p>
      </section>

      {/* History drives the chart, so they sit together with no divider. */}
      <div className="grid gap-4 py-4">
        {historyControl}
        {chart}
      </div>

      <section className="pt-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact label="Grid cell" value={formatGeoPoint(selection.grid)} />
          <Fact
            label="Array index"
            value={`lon ${selection.grid.lonIndex} · lat ${selection.grid.latIndex}`}
          />
        </dl>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-[11.5px] text-editor-fg-tertiary">{label}</dt>
      <dd className="font-mono text-[13px] tabular-nums text-editor-fg-secondary">
        {value}
      </dd>
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
