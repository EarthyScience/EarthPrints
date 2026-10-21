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
import {
  colormapFor,
  DEFAULT_PALETTE,
  type Palette,
} from "@/lib/map/fingerprintScale";
import { loadPalette, savePalette } from "@/lib/settings/colormap";
import { useTheme } from "@/providers/ThemeProvider";
import type { BinUnit } from "@/lib/plots/timeBins";
import type { LineResolution } from "@/lib/plots/lineSeries";
import type { CellSeries } from "@/hooks/useCellSeries";

export type PlotView = "line" | "fingerprint";

export function useSeriesDisplay(
  {
    selection,
    selectedYears,
    values,
    loading,
  }: Pick<CellSeries, "selection" | "selectedYears" | "values" | "loading">,
  timeBasis: TimeBasis,
) {
  const { isLight } = useTheme();
  const [plotView, setPlotView] = useState<PlotView>("line");
  const [transposed, setTransposed] = useState(false);
  const [lineResolution, setLineResolution] = useState<LineResolution>("day");
  const [scaleChoice, setFingerprintScale] = useState<BinUnit>("day");
  const canShowYearly = selectedYears.length > 1;
  const fingerprintScale =
    scaleChoice === "year" && !canShowYearly ? "day" : scaleChoice;
  const [palette, setPaletteState] = useState<Palette>(
    () => loadPalette() ?? DEFAULT_PALETTE,
  );
  const colormapId = colormapFor(palette, isLight);

  const setPalette = (next: Palette) => {
    setPaletteState(next);
    savePalette(next);
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
    lineResolution,
    setLineResolution,
    fingerprintScale,
    setFingerprintScale,
    canShowYearly,
    timeBasis,
    utcOffsetHours,
    timeBasisLabel,
    palette,
    setPalette,
    colormapId,
    hasPlottableData,
    isEmptyCell,
    displayValues,
  };
}

export type SeriesDisplay = ReturnType<typeof useSeriesDisplay>;
