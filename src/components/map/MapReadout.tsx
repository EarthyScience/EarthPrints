"use client";

import type { MapSelection } from "@/types/map";
import { formatGeoPoint } from "@/lib/map/geogrid";
import { ZARR_STORE } from "@/lib/constants/store";
import { ZARR_TIME } from "@/lib/zarr/timeRange";
import { TimeSeriesPlot } from "@/components/map/TimeSeriesPlot";
import { TimeSeriesPlotLoading } from "@/components/map/TimeSeriesPlotLoading";

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
      <section className="editor-panel">
        <header className="editor-panel-header">
          <h2 className="editor-panel-title">Pixel location</h2>
          <span className="editor-panel-badge mono">{ZARR_STORE.kicker}</span>
        </header>
        <p className="editor-panel-hint">
          Click the map to snap to the {ZARR_STORE.spatialResolutionDeg}° grid
          used by the Zarr Store.
        </p>
      </section>

      <section className="editor-panel">
        <div className="editor-panel-row">
          <label className="editor-panel-label" htmlFor="history-years">
            History window
          </label>
          <span className="editor-panel-value mono">{historyLabel}</span>
        </div>
        <input
          id="history-years"
          className="editor-panel-slider"
          type="range"
          min={ZARR_TIME.defaultHistoryYears}
          max={ZARR_TIME.maxHistoryYears}
          step={1}
          value={historyYears}
          onChange={(event) =>
            onHistoryYearsChange(Number(event.currentTarget.value))
          }
        />
        <p className="editor-panel-hint">
          Fetch only the most recent window to keep pixel loads fast.
        </p>
      </section>

      <section className="editor-panel editor-panel-grow" aria-live="polite">
        {selection ? (
          <>
            <dl className="editor-readout-grid mono">
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
              className="editor-readout-series"
              aria-label="Time series"
            >
              <p className="editor-panel-label">Time series</p>
              {loadingSeries && (
                <TimeSeriesPlotLoading historyYears={historyYears} />
              )}
              {!loadingSeries && seriesError && (
                <p className="editor-panel-hint">{seriesError}</p>
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
          <p className="editor-panel-empty">No pixel selected yet.</p>
        )}
      </section>
    </>
  );
}
