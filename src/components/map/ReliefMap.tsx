"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import type { Map as MapLibreMap, MapLibreEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/initMaplibre";
import {
  describeGeolocationError,
  requestPosition,
  type UserPosition,
} from "@/lib/map/geolocate";
import { buildReliefStyle } from "@/lib/map/reliefStyle";
import { attachSmoothWheelZoom } from "@/lib/map/smoothWheelZoom";
import {
  DEFAULT_MAP_VIEW,
  VIEW_MODE_TRANSITION_MS,
  viewStateForMode,
} from "@/lib/map/viewState";
import type { MapViewMode } from "@/types/map";
import { useTheme } from "@/providers/ThemeProvider";
import { EditorViewTabs } from "@/components/layout/EditorViewTabs";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MapToolbar } from "@/components/layout/MapToolbar";
import { UserPositionMarker } from "@/components/map/UserPositionMarker";
import { MapControls } from "@/components/map/MapControls";

const LOCATE_ZOOM = 8;
const LOCATE_FLY_MS = 1000;
const LOCATE_ERROR_VISIBLE_MS = 6000;

// A longer, softer glide after release than MapLibre's defaults
// (linearity 0.3, deceleration 2500, maxSpeed 1400).
const DRAG_PAN = {
  linearity: 0.4,
  deceleration: 1600,
  maxSpeed: 1800,
  easing: (t: number) => 1 - (1 - t) ** 3,
};

export function ReliefMap() {
  const { theme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const detachWheelZoomRef = useRef<(() => void) | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>("sphere");
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const isSphere = viewMode === "sphere";

  // `touchZoomRotate` covers both pinch-zoom and two-finger rotate, so it
  // stays enabled and only its rotation half follows the projection.
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

  const handleMapLoad = useCallback(
    (event: MapLibreEvent) => {
      applyTouchRotation(event.target);
      detachWheelZoomRef.current?.();
      detachWheelZoomRef.current = attachSmoothWheelZoom(event.target);
    },
    [applyTouchRotation],
  );

  useEffect(() => () => detachWheelZoomRef.current?.(), []);

  const handleViewModeChange = useCallback((mode: MapViewMode) => {
    setViewMode(mode);
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const target = viewStateForMode(
      {
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      },
      mode,
    );
    map.easeTo({
      center: [target.longitude, target.latitude],
      zoom: target.zoom,
      bearing: target.bearing ?? 0,
      pitch: target.pitch ?? 0,
      duration: VIEW_MODE_TRANSITION_MS,
    });
  }, []);

  const handleLocate = useCallback(async () => {
    setLocating(true);
    try {
      const position = await requestPosition();
      setUserPosition(position);
      setLocateError(null);
      const map = mapRef.current;
      map?.flyTo({
        center: [position.lon, position.lat],
        zoom: Math.max(map.getZoom(), LOCATE_ZOOM),
        duration: LOCATE_FLY_MS,
      });
    } catch (error) {
      setLocateError(describeGeolocationError(error));
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (!locateError) return;
    const timer = window.setTimeout(
      () => setLocateError(null),
      LOCATE_ERROR_VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [locateError]);

  return (
    <div className="editor-shell relative h-dvh w-full overflow-hidden bg-editor-bg-primary">
      <Map
        ref={mapRef}
        mapStyle={buildReliefStyle(theme)}
        projection={{ type: isSphere ? "globe" : "mercator" }}
        initialViewState={DEFAULT_MAP_VIEW}
        minZoom={0}
        maxZoom={18}
        // Let tiles for the levels passed on the way in keep loading, so
        // detail fills in during the zoom instead of all at once after it.
        cancelPendingTileRequestsWhileZooming={false}
        scrollZoom={false}
        dragPan={DRAG_PAN}
        dragRotate={isSphere}
        pitchWithRotate={isSphere}
        touchZoomRotate
        touchPitch={isSphere}
        maxPitch={isSphere ? 85 : 0}
        onLoad={handleMapLoad}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {userPosition ? <UserPositionMarker position={userPosition} /> : null}
      </Map>

      <div className="absolute left-3 top-3 z-30">
        <MapToolbar />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 px-4">
        <div className="pointer-events-auto rounded-editor-sm shadow-editor">
          <EditorViewTabs value={viewMode} onChange={handleViewModeChange} />
        </div>
        {locateError ? (
          <div
            role="status"
            className="pointer-events-auto flex max-w-[400px] items-center gap-2 rounded-editor-sm border border-editor-border bg-editor-bg-base py-1.5 pl-3 pr-1.5 text-sm text-editor-fg-primary shadow-editor"
          >
            <span className="min-w-0 flex-1">{locateError}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setLocateError(null)}
              className="grid size-6 flex-shrink-0 place-items-center rounded-full text-editor-fg-tertiary transition-colors hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <div className="absolute right-4 top-3 z-30 flex items-center gap-2 max-[520px]:top-14">
        <ThemeToggle />
      </div>

      <div className="absolute bottom-6 right-4 z-30">
        <MapControls
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onLocate={handleLocate}
          locating={locating}
        />
      </div>
    </div>
  );
}
