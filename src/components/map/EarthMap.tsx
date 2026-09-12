"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Map, {
  Marker,
  type MapMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { geoPointToZarrGrid } from "@/lib/map/geogrid";
import {
  describeAccuracy,
  describeGeolocationError,
  readConnectionHint,
  requestPosition,
  shouldWarmCache,
  type UserPosition,
} from "@/lib/map/geolocate";
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
import { MapTour } from "@/components/map/MapTour";
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

// A Marker rather than a deck layer: it needs no viewport maths and sits
// correctly on both the flat map and the globe. It ignores pointer events, so
// picking the cell underneath still works.
const UserPositionMarker = ({ position }: { position: UserPosition }) => (
  <Marker
    longitude={position.lon}
    latitude={position.lat}
    anchor="center"
    style={{ pointerEvents: "none" }}
  >
    <span
      role="img"
      aria-label={describeAccuracy(position.accuracy)}
      className="block size-3.5 rounded-full border-2 border-white bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_25%,transparent),0_1px_4px_rgba(0,0,0,0.35)]"
    />
  </Marker>
);

const AUTO_ZOOM_STORAGE_KEY = "earthprints:auto_zoom";
const LOCATE_ERROR_VISIBLE_MS = 6000;

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
  // The background load of the visitor's own cell. Any real pick aborts it:
  // the decode worker runs one job at a time, so a warm-up left running would
  // hold a click's load behind it.
  const warmAbortRef = useRef<AbortController | null>(null);
  const didAutoLocateRef = useRef(false);

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
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

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
    (lon: number, lat: number, options?: { fly?: boolean }) => {
      const nextSelection: MapSelection = {
        click: { lon, lat },
        grid: geoPointToZarrGrid({ lon, lat }, gridSpec),
      };

      warmAbortRef.current?.abort();
      setSelection(nextSelection);
      if (options?.fly ?? autoZoom) {
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

  // Locating awaits the browser, which can take seconds while the permission
  // dialog is open; reading the pick through a ref flies from where the map is
  // by then, not from where it was when the button was pressed.
  const handlePickRef = useRef(handlePick);
  useEffect(() => {
    handlePickRef.current = handlePick;
  }, [handlePick]);

  // Centres the map on the visitor, the way Google Maps opens on you. It only
  // moves the camera; nothing is selected. A visitor who already picked a cell
  // while the permission dialog was open stays where they are.
  const centerOnPosition = useCallback(
    (position: UserPosition) => {
      if (selection) return;
      const cell = geoPointToZarrGrid(position, gridSpec);
      flyToView(
        viewStateFocusedOnCell(viewState, cell, viewMode),
        SELECTION_FOCUS_TRANSITION_MS,
      );
    },
    [flyToView, gridSpec, selection, viewMode, viewState],
  );
  const centerOnPositionRef = useRef(centerOnPosition);
  useEffect(() => {
    centerOnPositionRef.current = centerOnPosition;
  }, [centerOnPosition]);

  // `interactive` is a press of the locate button: it shows the busy state and
  // reports failures. The request on load does neither, since Chrome leaves an
  // unanswered permission prompt open indefinitely and the button would sit
  // disabled for as long as the visitor ignores it.
  const requestUserPosition = useCallback(
    async (interactive: boolean): Promise<UserPosition | null> => {
      if (interactive) setLocating(true);
      try {
        const position = await requestPosition();
        setUserPosition(position);
        setLocateError(null);
        return position;
      } catch (error) {
        if (interactive) setLocateError(describeGeolocationError(error));
        return null;
      } finally {
        if (interactive) setLocating(false);
      }
    },
    [],
  );

  // Fetches the visitor's cell and throws the result away: the reader keeps
  // the decoded series, so pressing the locate button later is instant. The
  // selection and the panel are left alone.
  const warmUserCell = useCallback(
    async (position: UserPosition, years: number[]) => {
      if (!shouldWarmCache(readConnectionHint())) return;
      warmAbortRef.current?.abort();
      const abort = new AbortController();
      warmAbortRef.current = abort;
      try {
        const reader = await ensureReader();
        const spec = await reader.getGridSpec();
        if (abort.signal.aborted) return;
        await reader.getTimeSeriesForYears(
          geoPointToZarrGrid(position, spec),
          years,
          undefined,
          undefined,
          abort.signal,
        );
      } catch {
        // Best effort. A real pick reports its own errors.
      } finally {
        if (warmAbortRef.current === abort) warmAbortRef.current = null;
      }
    },
    [ensureReader],
  );

  // Ask once on load. Allowing it centres the map on the position and warms
  // that cell. A dismissed dialog is not reported as an error.
  useEffect(() => {
    if (didAutoLocateRef.current) return;
    didAutoLocateRef.current = true;
    void requestUserPosition(false).then((position) => {
      if (!position) return;
      centerOnPositionRef.current(position);
      void warmUserCell(position, selectedYears);
    });
  }, [requestUserPosition, warmUserCell, selectedYears]);

  useEffect(() => () => warmAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!locateError) return;
    const timer = window.setTimeout(
      () => setLocateError(null),
      LOCATE_ERROR_VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [locateError]);

  // Moves the map even when auto-zoom is off: going there is the point of
  // pressing it. Without a known position this is also what brings the
  // permission dialog back for a visitor who dismissed it on load.
  const handleLocate = useCallback(async () => {
    const position = userPosition ?? (await requestUserPosition(true));
    if (!position) return;
    handlePickRef.current(position.lon, position.lat, { fly: true });
  }, [requestUserPosition, userPosition]);

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
          onLocate={handleLocate}
          locating={locating}
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
          data-tour="map"
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
            {userPosition ? (
              <UserPositionMarker position={userPosition} />
            ) : null}
          </Map>
          {/* Anchor only: something at the foot of the map for the guide to
              hang a card on, so the card does not cover the map it is asking
              you to tap. */}
          <div
            aria-hidden="true"
            data-tour="map-foot"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          />
          <MapTour
            hasSelection={selection !== null}
            loadingSeries={loadingSeries}
            seriesValues={seriesValues}
            panelOpen={controlsOpen}
            onPanelOpenChange={setControlsOpen}
          />
          <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-2 px-2">
            <MapSearch
              onSelect={handlePick}
              className="pointer-events-auto w-full min-[901px]:max-w-[400px]"
            />
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
          <MapSideControls
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            hasSelection={selection !== null}
            onZoomToSelection={handleZoomToSelection}
            onLocate={handleLocate}
            locating={locating}
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
