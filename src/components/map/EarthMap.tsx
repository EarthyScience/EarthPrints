"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { geoPointToZarrGrid } from "@/lib/map/geogrid";
import { brightenDarkMapPlaceLabels } from "@/lib/map/mapLabels";
import type { MapLibreEvent, MapStyleDataEvent } from "maplibre-gl";
import {
  DEFAULT_MAP_VIEW,
  MAP_BASE_STYLES,
  SELECTION_FOCUS_TRANSITION_MS,
  viewStateFocusedOnCell,
  viewStateForMode,
} from "@/lib/map/viewState";
import { openZarrStore } from "@/lib/zarr/store";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import { DEFAULT_HISTORY_YEARS } from "@/lib/zarr/timeRange";
import type { MapSelection, MapViewMode, MapViewState } from "@/types/map";
import { useTheme } from "@/providers/ThemeProvider";
import { EditorShell } from "@/components/layout/EditorShell";
import { Nav } from "@/components/layout/Nav";
import { MapReadout } from "@/components/map/MapReadout";
import { GlobeSelectionOverlay } from "@/components/map/GlobeSelectionOverlay";

function toMapViewState(
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
  },
  mode: MapViewMode,
): MapViewState {
  return {
    longitude: viewState.longitude,
    latitude: viewState.latitude,
    zoom: viewState.zoom,
    bearing: mode === "sphere" ? viewState.bearing : 0,
    pitch: mode === "sphere" ? viewState.pitch : 0,
  };
}

export function EarthMap() {
  const { isLight } = useTheme();
  const readerPromiseRef = useRef<Promise<ZarrChunkReader> | null>(null);
  const requestIdRef = useRef(0);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW);
  const [viewMode, setViewMode] = useState<MapViewMode>("2d");
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [historyYears, setHistoryYears] = useState(DEFAULT_HISTORY_YEARS);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesLength, setSeriesLength] = useState<number | null>(null);
  const [seriesPreview, setSeriesPreview] = useState<number[] | null>(null);
  const [seriesUnits, setSeriesUnits] = useState<string | null>(null);

  const isSphere = viewMode === "sphere";
  const mapStyle = isLight ? MAP_BASE_STYLES.light : MAP_BASE_STYLES.dark;

  useEffect(() => {
    const node = mapStageRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMapSize({ width, height });
      mapRef.current?.resize();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const loadTimeSeries = useCallback(
    async (nextSelection: MapSelection, years: number) => {
      const requestId = ++requestIdRef.current;
      setLoadingSeries(true);
      setSeriesError(null);
      setSeriesLength(null);
      setSeriesPreview(null);
      setSeriesUnits(null);

      try {
        if (!readerPromiseRef.current) {
          readerPromiseRef.current = openZarrStore()
            .then((ds) => new ZarrChunkReader(ds))
            .catch((error) => {
              readerPromiseRef.current = null;
              throw error;
            });
        }

        const reader = await readerPromiseRef.current;

        const { values, units } = await reader.getTimeSeries(
          nextSelection.grid,
          undefined,
          years,
        );

        if (requestId !== requestIdRef.current) return;

        setSeriesLength(values.length);
        setSeriesPreview(Array.from(values.subarray(0, 3)));
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
    },
    [],
  );

  const flyToView = useCallback((next: MapViewState, duration = 0) => {
    mapRef.current?.flyTo({
      center: [next.longitude, next.latitude],
      zoom: next.zoom,
      bearing: next.bearing ?? 0,
      pitch: next.pitch ?? 0,
      duration,
    });
    setViewState(next);
  }, []);

  const handleHistoryYearsChange = useCallback(
    (years: number) => {
      setHistoryYears(years);
      if (selection) {
        void loadTimeSeries(selection, years);
      }
    },
    [selection, loadTimeSeries],
  );

  const handlePick = useCallback(
    (lon: number, lat: number) => {
      const nextSelection: MapSelection = {
        click: { lon, lat },
        grid: geoPointToZarrGrid({ lon, lat }),
      };

      setSelection(nextSelection);
      const focused = viewStateFocusedOnCell(viewState, nextSelection.grid, viewMode);
      flyToView(focused, SELECTION_FOCUS_TRANSITION_MS);
      void loadTimeSeries(nextSelection, historyYears);
    },
    [flyToView, historyYears, loadTimeSeries, viewMode, viewState],
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      handlePick(event.lngLat.lng, event.lngLat.lat);
    },
    [handlePick],
  );

  const handleViewModeChange = useCallback(
    (mode: MapViewMode) => {
      setViewMode(mode);
      const next = viewStateForMode(viewState, mode);
      flyToView(next, SELECTION_FOCUS_TRANSITION_MS);
    },
    [flyToView, viewState],
  );

  const handleMove = useCallback(
    (event: ViewStateChangeEvent) => {
      setViewState(toMapViewState(event.viewState, viewMode));
    },
    [viewMode],
  );

  const applyDarkMapLabelColors = useCallback(
    (event: MapLibreEvent | MapStyleDataEvent) => {
      if (isLight) return;
      brightenDarkMapPlaceLabels(event.target);
    },
    [isLight],
  );

  const handleMapLoad = useCallback(
    (event: MapLibreEvent) => {
      applyDarkMapLabelColors(event);
      if (isSphere) {
        event.target.setProjection({ type: "globe" });
      }
      event.target.resize();
    },
    [applyDarkMapLabelColors, isSphere],
  );

  const handleStyleData = useCallback(
    (event: MapStyleDataEvent) => {
      if (event.dataType !== "style") return;
      applyDarkMapLabelColors(event);
    },
    [applyDarkMapLabelColors],
  );

  return (
    <EditorShell
      header={
        <Nav
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      }
      sidebar={
        <MapReadout
          selection={selection}
          historyYears={historyYears}
          onHistoryYearsChange={handleHistoryYearsChange}
          loadingSeries={loadingSeries}
          seriesError={seriesError}
          seriesLength={seriesLength}
          seriesPreview={seriesPreview}
          seriesUnits={seriesUnits}
        />
      }
      preview={
        <div className="map-stage" ref={mapStageRef}>
          <Map
            ref={mapRef}
            key={viewMode}
            mapStyle={mapStyle}
            initialViewState={DEFAULT_MAP_VIEW}
            longitude={viewState.longitude}
            latitude={viewState.latitude}
            zoom={viewState.zoom}
            bearing={viewState.bearing ?? 0}
            pitch={viewState.pitch ?? 0}
            minZoom={0}
            maxZoom={22}
            dragRotate={isSphere}
            pitchWithRotate={isSphere}
            touchZoomRotate={isSphere}
            touchPitch={isSphere}
            maxPitch={isSphere ? 85 : 0}
            onMove={handleMove}
            onClick={handleMapClick}
            onLoad={handleMapLoad}
            onStyleData={handleStyleData}
            attributionControl={false}
            cursor="crosshair"
            style={{ width: "100%", height: "100%" }}
          >
            {selection && mapSize.width > 0 && mapSize.height > 0 ? (
              <GlobeSelectionOverlay
                cell={selection.grid}
                viewState={viewState}
                mapSize={mapSize}
                isLight={isLight}
                isSphere={isSphere}
              />
            ) : null}
          </Map>
        </div>
      }
    />
  );
}
