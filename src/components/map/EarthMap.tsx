"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Map, {
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { geoPointToZarrGrid } from "@/lib/map/geogrid";
import { brightenDarkMapPlaceLabels } from "@/lib/map/mapLabels";
import type {
  Map as MapLibreMap,
  MapLibreEvent,
  MapStyleDataEvent,
} from "maplibre-gl";
import {
  DEFAULT_MAP_VIEW,
  MAP_BASE_STYLES,
  SELECTION_FOCUS_TRANSITION_MS,
  viewStateFocusedOnCell,
  viewStateForMode,
} from "@/lib/map/viewState";
import { openZarrStore } from "@/lib/zarr/store";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import type {
  GridSpec,
  MapSelection,
  MapViewMode,
  MapViewState,
} from "@/types/map";
import { useTheme } from "@/providers/ThemeProvider";
import {
  EditorShell,
  EDITOR_CONTROLS_ID,
} from "@/components/layout/EditorShell";
import { Nav } from "@/components/layout/Nav";
import {
  applySidebarState,
  clampSidebarWidth,
  getServerSidebarState,
  getSidebarState,
  setSidebarState,
  subscribeSidebarState,
} from "@/lib/sidebar";
import { MapSideControls } from "@/components/map/MapSideControls";
import { MapSearch } from "@/components/map/MapSearch";
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

const AUTO_ZOOM_STORAGE_KEY = "earthprints:auto_zoom";

function getInitialAutoZoom(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(AUTO_ZOOM_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
  return true;
}

export function EarthMap() {
  const { isLight } = useTheme();
  const readerPromiseRef = useRef<Promise<ZarrChunkReader> | null>(null);
  const requestIdRef = useRef(0);
  // Aborts the previous series load so a superseded pick stops downloading
  // rather than finishing a chunk nobody will read.
  const seriesAbortRef = useRef<AbortController | null>(null);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW);
  const [viewMode, setViewMode] = useState<MapViewMode>("2d");
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [autoZoom, setAutoZoom] = useState<boolean>(getInitialAutoZoom);
  const [showPatch, setShowPatch] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  // The boot script has already painted the stored layout onto the root
  // element; this subscribes React to the same source rather than re-reading
  // localStorage in an effect after first paint.
  const sidebar = useSyncExternalStore(
    subscribeSidebarState,
    getSidebarState,
    getServerSidebarState,
  );
  const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
  const [cachedYears, setCachedYears] = useState<Set<number>>(new Set());
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesProgress, setSeriesProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesValues, setSeriesValues] = useState<Float32Array | null>(null);
  const [seriesUnits, setSeriesUnits] = useState<string | null>(null);
  const [gridSpec, setGridSpec] = useState<GridSpec>(DEFAULT_GRID_SPEC);

  const isSphere = viewMode === "sphere";
  const mapStyle = isLight ? MAP_BASE_STYLES.light : MAP_BASE_STYLES.dark;

  const ensureReader = useCallback(() => {
    if (!readerPromiseRef.current) {
      readerPromiseRef.current = openZarrStore()
        .then((ds) => new ZarrChunkReader(ds))
        .catch((error) => {
          readerPromiseRef.current = null;
          throw error;
        });
    }
    return readerPromiseRef.current;
  }, []);

  // The stored width is what the reader asked for; a window too narrow to
  // honour it borrows from the panel without forgetting the preference.
  useEffect(() => {
    const reclamp = () => {
      applySidebarState({
        width: clampSidebarWidth(sidebar.width, window.innerWidth),
        collapsed: sidebar.collapsed,
      });
    };
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [sidebar]);

  useEffect(() => {
    const node = mapStageRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMapSize({ width, height });
      const map = mapRef.current;
      if (!map) return;
      // Resizing the drawing buffer clears it, and on its own maplibre only
      // repaints on the next frame. Dragging the seam resizes the stage every
      // frame, so every frame would paint an empty canvas: the map strobes.
      // redraw() renders synchronously, filling the canvas in the same frame
      // the observer runs in. This is the pairing maplibre uses internally for
      // its own (50ms-throttled) container observer.
      map.resize();
      map.redraw();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureReader()
      .then((reader) => reader.getGridSpec())
      .then((spec) => {
        if (!cancelled) setGridSpec(spec);
      })
      .catch(() => {
        // Keep DEFAULT_GRID_SPEC on failure; time-series loads surface errors.
      });
    return () => {
      cancelled = true;
    };
  }, [ensureReader]);

  const loadTimeSeriesForYears = useCallback(
    async (nextSelection: MapSelection, years: number[]) => {
      const requestId = ++requestIdRef.current;
      seriesAbortRef.current?.abort();
      const abort = new AbortController();
      seriesAbortRef.current = abort;
      setLoadingSeries(true);
      setSeriesProgress(null);
      setSeriesError(null);
      setSeriesValues(null);
      setSeriesUnits(null);

      try {
        const reader = await ensureReader();
        setCachedYears(new Set(reader.getCachedYears(nextSelection.grid)));

        const { values, units } = await reader.getTimeSeriesForYears(
          nextSelection.grid,
          years,
          undefined,
          (loaded, total) => {
            if (requestId !== requestIdRef.current) return;
            setSeriesProgress({ loaded, total });
          },
          abort.signal,
        );

        if (requestId !== requestIdRef.current) return;

        setSeriesValues(values);
        setSeriesUnits(units ?? null);
        setCachedYears(new Set(reader.getCachedYears(nextSelection.grid)));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        // A newer pick already took over; its own load owns the panel.
        if (error instanceof Error && error.name === "AbortError") return;
        setSeriesError(
          error instanceof Error
            ? error.message
            : "Could not load the Zarr time series.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingSeries(false);
          setSeriesProgress(null);
        }
      }
    },
    [ensureReader],
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

  const handleYearsSelect = useCallback(
    (years: number[]) => {
      setSelectedYears(years);
      if (selection) {
        void loadTimeSeriesForYears(selection, years);
      }
    },
    [selection, loadTimeSeriesForYears],
  );

  const handlePick = useCallback(
    (lon: number, lat: number) => {
      const nextSelection: MapSelection = {
        click: { lon, lat },
        grid: geoPointToZarrGrid({ lon, lat }, gridSpec),
      };

      setSelection(nextSelection);
      if (autoZoom) {
        const focused = viewStateFocusedOnCell(
          viewState,
          nextSelection.grid,
          viewMode,
        );
        flyToView(focused, SELECTION_FOCUS_TRANSITION_MS);
      }
      void loadTimeSeriesForYears(nextSelection, selectedYears);
    },
    [autoZoom, flyToView, gridSpec, selectedYears, loadTimeSeriesForYears, viewMode, viewState],
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

  const handleZoomToSelection = useCallback(() => {
    if (!selection) return;
    const focused = viewStateFocusedOnCell(viewState, selection.grid, viewMode);
    flyToView(focused, SELECTION_FOCUS_TRANSITION_MS);
  }, [flyToView, selection, viewMode, viewState]);

  const handleToggleAutoZoom = useCallback(() => {
    setAutoZoom((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(AUTO_ZOOM_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const handleTogglePatch = useCallback(() => {
    setShowPatch((previous) => !previous);
  }, []);

  const handleSidebarWidthChange = useCallback(
    (width: number) => {
      setSidebarState({ width, collapsed: sidebar.collapsed });
    },
    [sidebar.collapsed],
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarState({ width: sidebar.width, collapsed: !sidebar.collapsed });
  }, [sidebar.collapsed, sidebar.width]);

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

  // `touchZoomRotate` is a single MapLibre handler covering both pinch-zoom
  // and two-finger rotate. Disabling it to keep the flat map unrotated also
  // removed pinch-zoom on touch devices, so it stays enabled and only its
  // rotation half is toggled with the projection.
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
      applyDarkMapLabelColors(event);
      applyTouchRotation(event.target);
      if (isSphere) {
        event.target.setProjection({ type: "globe" });
      }
      event.target.resize();
    },
    [applyDarkMapLabelColors, applyTouchRotation, isSphere],
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
      controlsOpen={controlsOpen}
      onCloseControls={() => setControlsOpen(false)}
      sidebarWidth={sidebar.width}
      sidebarCollapsed={sidebar.collapsed}
      onSidebarWidthChange={handleSidebarWidthChange}
      header={
        <Nav
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          hasSelection={selection !== null}
          onZoomToSelection={handleZoomToSelection}
          autoZoom={autoZoom}
          onToggleAutoZoom={handleToggleAutoZoom}
          showPatch={showPatch}
          onTogglePatch={handleTogglePatch}
          sidebarCollapsed={sidebar.collapsed}
          onToggleSidebar={handleToggleSidebar}
        />
      }
      sidebar={
        <MapReadout
          selection={selection}
          gridSpec={gridSpec}
          selectedYears={selectedYears}
          cachedYears={cachedYears}
          onSelectYears={handleYearsSelect}
          loadingSeries={loadingSeries}
          seriesProgress={seriesProgress}
          seriesError={seriesError}
          seriesValues={seriesValues}
          seriesUnits={seriesUnits}
        />
      }
      preview={
        <div
          className="map-stage absolute inset-0 overflow-hidden rounded-[inherit]"
          ref={mapStageRef}
        >
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
            touchZoomRotate
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
                gridSpec={gridSpec}
                viewState={viewState}
                mapSize={mapSize}
                isLight={isLight}
                isSphere={isSphere}
                showPatch={showPatch}
              />
            ) : null}
          </Map>
          <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2">
            <MapSearch
              onSelect={handlePick}
              className="pointer-events-auto w-full min-[901px]:max-w-[400px]"
            />
          </div>
          <MapSideControls
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            hasSelection={selection !== null}
            onZoomToSelection={handleZoomToSelection}
            autoZoom={autoZoom}
            onToggleAutoZoom={handleToggleAutoZoom}
            showPatch={showPatch}
            onTogglePatch={handleTogglePatch}
            controlsOpen={controlsOpen}
            onToggleControls={() => setControlsOpen((open) => !open)}
            controlsId={EDITOR_CONTROLS_ID}
          />
        </div>
      }
    />
  );
}
