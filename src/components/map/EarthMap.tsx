"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, PolygonLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { PickingInfo, ViewStateChangeParameters } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  geoPointToZarrGrid,
  gridCellToBounds,
  gridCellToGuidePaths,
  gridCellToPolygon,
} from "@/lib/map/geogrid";
import { loadDarkMapStyle, brightenDarkMapPlaceLabels } from "@/lib/map/mapLabels";
import type { MapLibreEvent, MapStyleDataEvent } from "maplibre-gl";
import { viewportToGeoBounds } from "@/lib/map/viewportBounds";
import { TEAL_ON_DARK_RGB, TEAL_RGB } from "@/lib/constants/theme";
import { DEFAULT_MAP_VIEW, MAP_BASE_STYLES, viewStateFocusedOnCell } from "@/lib/map/viewState";
import { openZarrStore } from "@/lib/zarr/store";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import { DEFAULT_HISTORY_YEARS } from "@/lib/zarr/timeRange";
import type { MapSelection, MapViewState } from "@/types/map";
import { useTheme } from "@/providers/ThemeProvider";
import { MapReadout } from "@/components/map/MapReadout";

type EarthMapProps = {
  className?: string;
};

const dashedPathExtension = new PathStyleExtension({ dash: true });

const GUIDE_LINE_COLOR = {
  light: [110, 110, 110, 170] as [number, number, number, number],
  dark: [190, 190, 190, 150] as [number, number, number, number],
};

const SELECTION_CELL_COLOR = {
  light: {
    fill: [...TEAL_RGB, 36] as [number, number, number, number],
    line: [...TEAL_RGB, 255] as [number, number, number, number],
  },
  dark: {
    fill: [255, 255, 255, 48] as [number, number, number, number],
    line: [...TEAL_ON_DARK_RGB, 255] as [number, number, number, number],
  },
};

export function EarthMap({ className }: EarthMapProps) {
  const { isLight } = useTheme();
  const readerPromiseRef = useRef<Promise<ZarrChunkReader> | null>(null);
  const requestIdRef = useRef(0);
  const mapStageRef = useRef<HTMLDivElement>(null);

  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [historyYears, setHistoryYears] = useState(DEFAULT_HISTORY_YEARS);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesLength, setSeriesLength] = useState<number | null>(null);
  const [seriesPreview, setSeriesPreview] = useState<number[] | null>(null);
  const [seriesUnits, setSeriesUnits] = useState<string | null>(null);
  const [darkMapStyle, setDarkMapStyle] = useState<StyleSpecification | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void loadDarkMapStyle()
      .then((style) => {
        if (!cancelled) setDarkMapStyle(style);
      })
      .catch(() => {
        // Fall back to the remote style URL if patching fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = mapStageRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMapSize({ width, height });
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

  const handleHistoryYearsChange = useCallback(
    (years: number) => {
      setHistoryYears(years);
      if (selection) {
        void loadTimeSeries(selection, years);
      }
    },
    [selection, loadTimeSeries],
  );

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (!info.coordinate) return;

      const [lon, lat] = info.coordinate;
      const nextSelection: MapSelection = {
        click: { lon, lat },
        grid: geoPointToZarrGrid({ lon, lat }),
      };

      setSelection(nextSelection);
      setViewState((current) =>
        viewStateFocusedOnCell(current, nextSelection.grid),
      );
      void loadTimeSeries(nextSelection, historyYears);
    },
    [historyYears, loadTimeSeries],
  );

  const handleViewStateChange = useCallback(
    ({ viewState: nextViewState }: ViewStateChangeParameters) => {
      setViewState(nextViewState as MapViewState);
    },
    [],
  );

  const mapStyle = isLight
    ? MAP_BASE_STYLES.light
    : darkMapStyle;

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
    },
    [applyDarkMapLabelColors],
  );

  const handleStyleData = useCallback(
    (event: MapStyleDataEvent) => {
      if (event.dataType !== "style") return;
      applyDarkMapLabelColors(event);
    },
    [applyDarkMapLabelColors],
  );

  const layers = useMemo(() => {
    if (!selection || mapSize.width === 0 || mapSize.height === 0) return [];

    const cellBounds = gridCellToBounds(selection.grid);
    const viewportBounds = viewportToGeoBounds(
      viewState,
      mapSize.width,
      mapSize.height,
    );
    const guidePaths = gridCellToGuidePaths(cellBounds, viewportBounds);
    const guideColor = isLight ? GUIDE_LINE_COLOR.light : GUIDE_LINE_COLOR.dark;
    const cellColor = isLight ? SELECTION_CELL_COLOR.light : SELECTION_CELL_COLOR.dark;

    return [
      new PathLayer({
        id: "selected-grid-cell-guides",
        data: guidePaths,
        getPath: (path) => path,
        pickable: false,
        widthUnits: "pixels",
        getWidth: 1,
        getColor: guideColor,
        extensions: [dashedPathExtension],
        getDashArray: [6, 5],
        dashJustified: true,
      }),
      new PolygonLayer({
        id: "selected-grid-cell",
        data: [selection.grid],
        getPolygon: (cell: MapSelection["grid"]) => [
          gridCellToPolygon(cell).map((point) => [point.lon, point.lat]),
        ],
        filled: true,
        stroked: true,
        pickable: false,
        getFillColor: cellColor.fill,
        getLineColor: cellColor.line,
        getLineWidth: 2,
        lineWidthUnits: "pixels",
      }),
    ];
  }, [isLight, mapSize.height, mapSize.width, selection, viewState]);

  return (
    <div className={className ?? "map-shell"}>
      <div className="map-stage" ref={mapStageRef}>
        <DeckGL
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          controller
          layers={layers}
          onClick={handleClick}
          getCursor={() => "crosshair"}
        >
          {mapStyle ? (
            <Map
              mapStyle={mapStyle}
              attributionControl={false}
              reuseMaps
              onLoad={handleMapLoad}
              onStyleData={handleStyleData}
            />
          ) : null}
        </DeckGL>
      </div>

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
    </div>
  );
}
