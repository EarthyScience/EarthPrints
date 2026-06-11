"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { geoPointToZarrGrid } from "@/lib/map/geogrid";
import { TEAL_ON_DARK_RGB } from "@/lib/constants/theme";
import { DEFAULT_MAP_VIEW, MAP_BASE_STYLES } from "@/lib/map/viewState";
import { fetchZarrTimeSeries, openZarrStore } from "@/lib/zarr/store";
import type { MapSelection } from "@/types/map";
import { useTheme } from "@/providers/ThemeProvider";
import { MapReadout } from "@/components/map/MapReadout";

type EarthMapProps = {
  className?: string;
};

export function EarthMap({ className }: EarthMapProps) {
  const { isLight } = useTheme();
  const dsRef = useRef<Awaited<ReturnType<typeof openZarrStore>> | null>(
    null,
  );
  const requestIdRef = useRef(0);

  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesPreview, setSeriesPreview] = useState<number[] | null>(null);
  const [seriesUnits, setSeriesUnits] = useState<string | null>(null);

  const loadTimeSeries = useCallback(async (nextSelection: MapSelection) => {
    const requestId = ++requestIdRef.current;
    setLoadingSeries(true);
    setSeriesError(null);
    setSeriesPreview(null);
    setSeriesUnits(null);

    try {
      if (!dsRef.current) {
        dsRef.current = await openZarrStore();
      }

      const { values, units } = await fetchZarrTimeSeries(
        dsRef.current,
        nextSelection.grid,
      );

      if (requestId !== requestIdRef.current) return;

      setSeriesPreview(Array.from(values));
      setSeriesUnits(units ?? null);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setSeriesError(
        error instanceof Error
          ? error.message
          : "Could not load the Zarr time series.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingSeries(false);
      }
    }
  }, []);

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (!info.coordinate) return;

      const [lon, lat] = info.coordinate;
      const nextSelection: MapSelection = {
        click: { lon, lat },
        grid: geoPointToZarrGrid({ lon, lat }),
      };

      setSelection(nextSelection);
      void loadTimeSeries(nextSelection);
    },
    [loadTimeSeries],
  );

  const layers = useMemo(() => {
    if (!selection) return [];

    return [
      new ScatterplotLayer({
        id: "selected-grid-cell",
        data: [selection.grid],
        getPosition: (point: MapSelection["grid"]) => [point.lon, point.lat],
        getFillColor: [255, 255, 255, 230],
        getLineColor: [...TEAL_ON_DARK_RGB, 255],
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        stroked: true,
        radiusUnits: "pixels",
        getRadius: 8,
        pickable: false,
      }),
    ];
  }, [selection]);

  return (
    <div className={className ?? "map-shell"}>
      <div className="map-stage">
        <DeckGL
          initialViewState={DEFAULT_MAP_VIEW}
          controller
          layers={layers}
          onClick={handleClick}
          getCursor={() => "crosshair"}
        >
          <Map
            mapStyle={isLight ? MAP_BASE_STYLES.light : MAP_BASE_STYLES.dark}
            attributionControl={false}
            reuseMaps
          />
        </DeckGL>
      </div>

      <MapReadout
        selection={selection}
        loadingSeries={loadingSeries}
        seriesError={seriesError}
        seriesPreview={seriesPreview}
        seriesUnits={seriesUnits}
      />
    </div>
  );
}
