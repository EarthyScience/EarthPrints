"use client";

import type { MapSelection } from "@/types/map";
import { formatGeoPoint } from "@/lib/map/geogrid";
import { ESDC_TEST_DATASET } from "@/lib/constants/esdc";

type MapReadoutProps = {
  selection: MapSelection | null;
  loadingSeries: boolean;
  seriesError: string | null;
  seriesPreview: number[] | null;
  seriesUnits: string | null;
};

export function MapReadout({
  selection,
  loadingSeries,
  seriesError,
  seriesPreview,
  seriesUnits,
}: MapReadoutProps) {
  return (
    <aside className="map-readout" aria-live="polite">
      <p className="map-readout-kicker mono">{ESDC_TEST_DATASET.kicker}</p>
      <h2 className="map-readout-title">Pixel location</h2>
      <p className="map-readout-hint">
        Click the map to snap to the {ESDC_TEST_DATASET.spatialResolutionDeg}°
        grid used by the Zarr archive.
      </p>

      {selection ? (
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
            <dd>{ESDC_TEST_DATASET.defaultVariable}</dd>
          </div>
          <div className="map-readout-span">
            <dt>Time series</dt>
            <dd>
              {loadingSeries && "Fetching from Zarr…"}
              {!loadingSeries && seriesError && seriesError}
              {!loadingSeries &&
                !seriesError &&
                seriesPreview &&
                `${seriesPreview.length} steps · first ${seriesPreview
                  .slice(0, 3)
                  .map((value) => value.toFixed(2))
                  .join(", ")}${seriesUnits ? ` ${seriesUnits}` : ""}`}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="map-readout-empty">No pixel selected yet.</p>
      )}
    </aside>
  );
}
