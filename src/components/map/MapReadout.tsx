"use client";

import type { MapSelection } from "@/types/map";
import { formatGeoPoint } from "@/lib/map/geogrid";
import { ZARR_STORE } from "@/lib/constants/store";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import { TimeSeriesPlot } from "@/components/map/TimeSeriesPlot";
import { TimeSeriesPlotLoading } from "@/components/map/TimeSeriesPlotLoading";

const PANEL_CLASS =
  "grid gap-3 rounded-editor-md border border-editor-border bg-editor-bg-secondary p-4 shadow-editor";
const HINT_CLASS = "text-[13px] leading-[1.55] text-editor-fg-tertiary";
const LABEL_CLASS =
  "text-[11px] font-medium uppercase tracking-[0.06em] text-editor-fg-tertiary";

type MapReadoutProps = {
  selection: MapSelection | null;
  historyYears: number;
  onHistoryYearsChange: (years: number) => void;
  loadingSeries: boolean;
  seriesError: string | null;
  seriesValues: Float32Array | null;
  seriesUnits: string | null;
};

export function MapReadout({
  selection,
  historyYears,
  onHistoryYearsChange,
  loadingSeries,
  seriesError,
  seriesValues,
  seriesUnits,
}: MapReadoutProps) {
  const historyLabel =
    historyYears === 1 ? "Last 1 year" : `Last ${historyYears} years`;

  return (
    <>
      <section className={PANEL_CLASS}>
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-editor-fg-primary">
            Pixel location
          </h2>
          <span className="inline-flex flex-shrink-0 items-center rounded-full border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
            {ZARR_STORE.kicker}
          </span>
        </header>
        <p className={HINT_CLASS}>
          Click the map to snap to the {ZARR_STORE.spatialResolutionDeg}° grid
          used by the Zarr Store.
        </p>
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex items-baseline justify-between gap-3">
          <label className={LABEL_CLASS} htmlFor="history-years">
            History window
          </label>
          <span className="font-mono text-[13px] font-semibold text-accent">
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
        <p className={HINT_CLASS}>
          Fetch only the most recent window to keep pixel loads fast.
        </p>
      </section>

      <section className={`${PANEL_CLASS} flex-1`} aria-live="polite">
        {selection ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono [&_dd]:text-[13px] [&_dd]:font-medium [&_dd]:leading-[1.45] [&_dd]:text-editor-fg-secondary [&_div]:grid [&_div]:min-w-0 [&_div]:gap-1 [&_dt]:text-[11px] [&_dt]:font-medium [&_dt]:uppercase [&_dt]:tracking-[0.06em] [&_dt]:text-editor-fg-tertiary">
              <div>
                <dt>Click</dt>
                <dd>{formatGeoPoint(selection.click)}</dd>
              </div>
              <div>
                <dt>Grid cell</dt>
                <dd>{formatGeoPoint(selection.grid)}</dd>
              </div>
              <div>
                <dt>Indices</dt>
                <dd>
                  lon {selection.grid.lonIndex}, lat {selection.grid.latIndex}
                </dd>
              </div>
              <div>
                <dt>Variable</dt>
                <dd>{ZARR_STORE.defaultVariable}</dd>
              </div>
            </dl>

            <section
              className="grid min-w-0 gap-3 pt-4"
              aria-label="Time series"
            >
              <p className={LABEL_CLASS}>Time series</p>
              {loadingSeries && (
                <TimeSeriesPlotLoading historyYears={historyYears} />
              )}
              {!loadingSeries && seriesError && (
                <p className={HINT_CLASS}>{seriesError}</p>
              )}
              {!loadingSeries && !seriesError && seriesValues && (
                <TimeSeriesPlot
                  values={seriesValues}
                  units={seriesUnits}
                  hoursPerDay={ZARR_TIME.hoursPerDay}
                />
              )}
            </section>
          </>
        ) : (
          <p className={HINT_CLASS}>No pixel selected yet.</p>
        )}
      </section>
    </>
  );
}
