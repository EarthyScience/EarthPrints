"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import type { Map as MapLibreMap, MapLibreEvent } from "maplibre-gl";
import { X } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/initMaplibre";
import { geoPointToZarrGrid } from "@/lib/map/geogrid";
import {
  readConnectionHint,
  shouldWarmCache,
  type UserPosition,
} from "@/lib/map/geolocate";
import { buildReliefStyle } from "@/lib/map/reliefStyle";
import { attachSmoothWheelZoom } from "@/lib/map/smoothWheelZoom";
import {
  DEFAULT_MAP_VIEW,
  SELECTION_FOCUS_TRANSITION_MS,
  VIEW_MODE_TRANSITION_MS,
  viewStateFocusedOnCell,
  viewStateForMode,
} from "@/lib/map/viewState";
import type { GridCell, MapViewMode, MapViewState } from "@/types/map";
import { useTheme } from "@/providers/ThemeProvider";
import { useCellSeries } from "@/hooks/useCellSeries";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useMapSettings } from "@/hooks/useMapSettings";
import { MapToolbar, type ToolbarPanel } from "@/components/layout/MapToolbar";
import { MapControls } from "@/components/map/MapControls";
import { MapSearch } from "@/components/map/MapSearch";
import { MapTour } from "@/components/map/MapTour";
import { GlobeSelectionOverlay } from "@/components/map/GlobeSelectionOverlay";
import { UserPositionMarker } from "@/components/map/UserPositionMarker";
import { CellPanel } from "@/components/panels/CellPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const DRAG_PAN = {
  linearity: 0.4,
  deceleration: 1600,
  maxSpeed: 1800,
  easing: (t: number) => 1 - (1 - t) ** 3,
};

function readViewState(map: MapRef): MapViewState {
  const center = map.getCenter();
  return {
    longitude: center.lng,
    latitude: center.lat,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export function ReliefMap() {
  const { theme, isLight } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const detachWheelZoomRef = useRef<(() => void) | null>(null);
  const didAutoLocateRef = useRef(false);
  const [viewMode, setViewMode] = useState<MapViewMode>("sphere");
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [openPanel, setOpenPanel] = useState<ToolbarPanel | null>(null);
  /** The first cell came from the user's location rather than a click. */
  const [pickedForUser, setPickedForUser] = useState(false);
  const [dragging, setDragging] = useState(false);

  const series = useCellSeries();
  const settings = useMapSettings();
  const geolocation = useGeolocation();
  const isSphere = viewMode === "sphere";

  const applyTouchRotation = useCallback(
    (map: MapLibreMap) => {
      if (isSphere) {
        map.touchZoomRotate.enableRotation();
      } else {
        map.touchZoomRotate.disableRotation();
      }
    },
    [isSphere],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map) applyTouchRotation(map);
  }, [applyTouchRotation]);

  const measure = useCallback((map: MapLibreMap) => {
    const container = map.getContainer();
    setMapSize({
      width: container.clientWidth,
      height: container.clientHeight,
    });
  }, []);

  const handleMapLoad = useCallback(
    (event: MapLibreEvent) => {
      applyTouchRotation(event.target);
      measure(event.target);
      detachWheelZoomRef.current?.();
      detachWheelZoomRef.current = attachSmoothWheelZoom(event.target);
    },
    [applyTouchRotation, measure],
  );

  useEffect(() => () => detachWheelZoomRef.current?.(), []);

  const flyToCell = useCallback(
    (cell: GridCell) => {
      const map = mapRef.current;
      if (!map) return;
      const target = viewStateFocusedOnCell(readViewState(map), cell, viewMode);
      map.flyTo({
        center: [target.longitude, target.latitude],
        zoom: target.zoom,
        bearing: target.bearing ?? 0,
        pitch: target.pitch ?? 0,
        duration: SELECTION_FOCUS_TRANSITION_MS,
      });
    },
    [viewMode],
  );

  const pick = useCallback(
    (lon: number, lat: number, options?: { fly?: boolean }) => {
      const selection = series.select(lon, lat);
      setOpenPanel("chart");
      if (options?.fly ?? settings.autoZoom) flyToCell(selection.grid);
    },
    [flyToCell, series, settings.autoZoom],
  );

  // Refs, because the permission dialog can take seconds and the map moves.
  const pickRef = useRef(pick);
  const pickPositionRef = useRef<(position: UserPosition) => void>(() => {});
  useEffect(() => {
    pickRef.current = pick;
    pickPositionRef.current = (position) => {
      if (series.selection) return;
      // A record is tens of megabytes, too much to fetch unasked on a metered
      // or slow link, so there the map only centres on the user.
      if (!shouldWarmCache(readConnectionHint())) {
        flyToCell(geoPointToZarrGrid(position, series.gridSpec));
        return;
      }
      setPickedForUser(true);
      pick(position.lon, position.lat, { fly: true });
    };
  }, [flyToCell, pick, series.gridSpec, series.selection]);

  const { request: requestPosition } = geolocation;

  useEffect(() => {
    if (didAutoLocateRef.current) return;
    didAutoLocateRef.current = true;
    void requestPosition(false).then((position) => {
      if (position) pickPositionRef.current(position);
    });
  }, [requestPosition]);

  // Flies even with auto-zoom off: going there is the point of the button.
  const handleLocate = useCallback(async () => {
    const position = geolocation.position ?? (await requestPosition(true));
    if (!position) return;
    pickRef.current(position.lon, position.lat, { fly: true });
  }, [geolocation.position, requestPosition]);

  const handleViewModeChange = useCallback((mode: MapViewMode) => {
    setViewMode(mode);
    const map = mapRef.current;
    if (!map) return;
    const target = viewStateForMode(readViewState(map), mode);
    map.easeTo({
      center: [target.longitude, target.latitude],
      zoom: target.zoom,
      bearing: target.bearing ?? 0,
      pitch: target.pitch ?? 0,
      duration: VIEW_MODE_TRANSITION_MS,
    });
  }, []);

  const handleMove = useCallback((event: ViewStateChangeEvent) => {
    setViewState(event.viewState);
  }, []);

  const handleClick = useCallback(
    (event: MapMouseEvent) => pick(event.lngLat.lng, event.lngLat.lat),
    [pick],
  );

  const selection = series.selection;

  return (
    <div className="editor-shell relative h-dvh w-full overflow-hidden bg-background">
      <div data-tour="map" className="absolute inset-0 bg-map-space">
        <Map
          ref={mapRef}
          mapStyle={buildReliefStyle(theme)}
          projection={{ type: isSphere ? "globe" : "mercator" }}
          initialViewState={DEFAULT_MAP_VIEW}
          minZoom={0}
          maxZoom={18}
          cancelPendingTileRequestsWhileZooming={false}
          scrollZoom={false}
          dragPan={DRAG_PAN}
          dragRotate={isSphere}
          pitchWithRotate={isSphere}
          touchZoomRotate
          touchPitch={isSphere}
          maxPitch={isSphere ? 85 : 0}
          onLoad={handleMapLoad}
          onResize={(event) => measure(event.target)}
          onMove={handleMove}
          onClick={handleClick}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => setDragging(false)}
          cursor={dragging ? "grabbing" : "crosshair"}
          attributionControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {selection && mapSize.width > 0 && mapSize.height > 0 ? (
            <GlobeSelectionOverlay
              cell={selection.grid}
              gridSpec={series.gridSpec}
              viewState={viewState}
              mapSize={mapSize}
              isLight={isLight}
              isSphere={isSphere}
              patchWindow={settings.showPatch ? series.patchWindow : null}
            />
          ) : null}
          {geolocation.position ? (
            <UserPositionMarker position={geolocation.position} />
          ) : null}
        </Map>
        <div
          aria-hidden="true"
          data-tour="map-foot"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex max-md:z-40 flex-wrap items-start gap-2">
        <div className="pointer-events-auto relative">
          <MapToolbar openPanel={openPanel} onOpenPanelChange={setOpenPanel} />
          <div className="absolute left-0 top-full mt-2 max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:z-10 max-md:mt-0">
            {openPanel === "chart" ? (
              <CellPanel
                series={series}
                timeBasis={settings.timeBasis}
                onClose={() => setOpenPanel(null)}
              />
            ) : null}
            {openPanel === "settings" ? (
              <SettingsPanel
                settings={settings}
                patchWindow={series.patchWindow}
                onPatchWindowChange={series.setPatchWindow}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onClose={() => setOpenPanel(null)}
              />
            ) : null}
            {openPanel === "help" ? (
              <HelpPanel onClose={() => setOpenPanel(null)} />
            ) : null}
          </div>
        </div>

        <div className="pointer-events-auto order-first grid w-full gap-2 md:absolute md:left-1/2 md:w-[360px] md:-translate-x-1/2">
          <MapSearch onSelect={pick} />
          {geolocation.error ? (
            <Alert role="status" className="bg-background">
              <AlertDescription>{geolocation.error}</AlertDescription>
              <AlertAction>
                <Button
                  variant="outline"
                  size="icon-xs"
                  aria-label="Dismiss"
                  onClick={geolocation.clearError}
                >
                  <X />
                </Button>
              </AlertAction>
            </Alert>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-6 right-4 z-30 max-md:right-3 max-md:bottom-[calc(max(--spacing(3),env(safe-area-inset-bottom))+--spacing(16))]">
        <MapControls
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onLocate={handleLocate}
          locating={geolocation.locating}
          onZoomToSelection={
            selection ? () => flyToCell(selection.grid) : undefined
          }
        />
      </div>

      <MapTour
        pickedForUser={pickedForUser}
        hasSelection={selection !== null}
        loadingSeries={series.loading}
        seriesValues={series.values}
        panelOpen={openPanel === "chart"}
        onPanelOpenChange={(open) => setOpenPanel(open ? "chart" : null)}
      />
    </div>
  );
}
