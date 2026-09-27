"use client";

import { useMemo, useState } from "react";
import { ZARR_TIME, getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";
import {
  formatTimeBasis,
  localHourOffset,
  shiftSeriesToLocalTime,
  type TimeBasis,
} from "@/lib/zarr/localTime";
import { hasFiniteValues } from "@/lib/zarr/series";
import type { ColormapId } from "@/lib/map/fingerprintScale";
import { loadColormap, saveColormap } from "@/lib/settings/colormap";
import { useTheme } from "@/providers/ThemeProvider";
import type { CellSeries } from "@/hooks/useCellSeries";

export type PlotView = "line" | "fingerprint";

export function useSeriesDisplay({
  selection,
  selectedYears,
  values,
  loading,
}: Pick<CellSeries, "selection" | "selectedYears" | "values" | "loading">) {
  const { isLight } = useTheme();
  const [plotView, setPlotView] = useState<PlotView>("line");
  const [transposed, setTransposed] = useState(false);
  const [timeBasis, setTimeBasis] = useState<TimeBasis>("local");
  const [colormapId, setColormapIdState] = useState<ColormapId>(
    () => loadColormap() ?? (isLight ? "science-light" : "science-dark"),
  );

  const setColormapId = (id: ColormapId) => {
    setColormapIdState(id);
    saveColormap(id);
  };

  // Checked before the local-time shift, which blanks a few edge hours.
  const hasPlottableData = useMemo(
    () => values !== null && hasFiniteValues(values),
    [values],
  );
  const isEmptyCell = !loading && values !== null && !hasPlottableData;

  const utcOffsetHours = localHourOffset(selection?.grid.lon ?? 0);
  const timeBasisLabel = formatTimeBasis(timeBasis, utcOffsetHours);

  const displayValues = useMemo(() => {
    if (!values || timeBasis === "utc") return values;
    const { absoluteDays } = getSelectedYearsDayMapping(
      selectedYears,
      undefined,
      Math.floor(values.length / ZARR_TIME.hoursPerDay),
    );
    return shiftSeriesToLocalTime(values, {
      hoursPerDay: ZARR_TIME.hoursPerDay,
      offsetHours: utcOffsetHours,
      absoluteDays,
    });
  }, [values, selectedYears, timeBasis, utcOffsetHours]);

  return {
    plotView,
    setPlotView,
    transposed,
    setTransposed,
    timeBasis,
    setTimeBasis,
    utcOffsetHours,
    timeBasisLabel,
    colormapId,
    setColormapId,
    hasPlottableData,
    isEmptyCell,
    displayValues,
  };
}

export type SeriesDisplay = ReturnType<typeof useSeriesDisplay>;
