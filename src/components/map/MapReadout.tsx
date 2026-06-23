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
    <aside className="map-readout map-panel map-panel--left map-island" aria-live="polite">
      <div className="map-readout-heading">
        <h2 className="ds-title map-readout-title">Pixel location</h2>
        <p className="ds-kicker map-readout-kicker mono">{ZARR_STORE.kicker}</p>
      </div>
      <p className="ds-hint map-readout-hint">
        Click the map to snap to the {ZARR_STORE.spatialResolutionDeg}°
        grid used by the Zarr Store.
      </p>

      <div className="map-readout-control">
        <div className="map-readout-control-header">
          <label className="ds-label map-readout-control-label" htmlFor="history-years">
            History window
          </label>
          <span className="map-readout-control-value mono">{historyLabel}</span>
        </div>
        <input
          id="history-years"
          className="map-readout-slider"
          type="range"
          min={ZARR_TIME.defaultHistoryYears}
          max={ZARR_TIME.maxHistoryYears}
          step={1}
          value={historyYears}
          onChange={(event) =>
            onHistoryYearsChange(Number(event.currentTarget.value))
          }
        />
        <p className="ds-hint map-readout-hint">
          Fetch only the most recent window to keep pixel loads fast.
        </p>
      </div>

      <div className="map-readout-selection">
        {selection ? (
          <>
            <dl className="map-readout-grid mono">
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

            <section className="map-readout-series-section" aria-label="Time series">
              <p className="ds-label map-readout-series-label">Time series</p>
              <div className="map-readout-series">
                {loadingSeries && (
                  <TimeSeriesPlotLoading historyYears={historyYears} />
                )}
                {!loadingSeries && seriesError && (
                  <p className="ds-hint map-readout-series-status">{seriesError}</p>
                )}
                {!loadingSeries && !seriesError && seriesValues && (
                  <TimeSeriesPlot
                    values={seriesValues}
                    units={seriesUnits}
                    hoursPerDay={ZARR_TIME.hoursPerDay}
                  />
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="ds-hint map-readout-empty">No pixel selected yet.</p>
        )}
      </div>
    </aside>
  );
}
