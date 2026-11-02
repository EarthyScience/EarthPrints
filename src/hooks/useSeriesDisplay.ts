"use client";

import { useMemo, useState } from "react";
import { getSelectedYearsDayMapping } from "@/lib/zarr/timeRange";
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
import {
  loadTemperatureUnit,
  saveTemperatureUnit,
} from "@/lib/settings/temperatureUnit";
import {
  convertTemperatures,
  temperatureUnitOf,
  TEMPERATURE_UNITS,
  type TemperatureUnit,
} from "@/lib/zarr/temperature";
import { useTheme } from "@/providers/ThemeProvider";
import type { BinUnit } from "@/lib/plots/timeBins";
import type { LineResolution } from "@/lib/plots/lineSeries";
import type { CellSeries } from "@/hooks/useCellSeries";
import type { TimeAxis } from "@/lib/zarr/timeAxis";

type TimeSpan = TimeAxis["span"];

export type PlotView = "line" | "fingerprint";

const RANK: Record<LineResolution | BinUnit, number> = {
  hour: 0,
  day: 1,
  week: 2,
  month: 3,
  year: 4,
};

const LINE_RESOLUTIONS: { value: LineResolution; label: string }[] = [
  { value: "hour", label: "Hourly" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const FINGERPRINT_SCALES: {
  value: BinUnit;
  label: string;
  disabled?: boolean;
  title?: string;
}[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function finestResolution(
  slotsPerDay: number,
  span: TimeSpan,
): LineResolution {
  if (span === "month" || span === "year") return "month";
  if (span === "days") return "day";
  return slotsPerDay > 1 ? "hour" : "day";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function useSeriesDisplay(
  {
    selection,
    selectedYears,
    values,
    loading,
    slotsPerDay,
    timeSpan,
    stepLabel,
    units,
  }: Pick<
    CellSeries,
    | "selection"
    | "selectedYears"
    | "values"
    | "loading"
    | "slotsPerDay"
    | "timeSpan"
    | "stepLabel"
    | "units"
  >,
  requestedTimeBasis: TimeBasis,
) {
  const { isLight } = useTheme();
  const [plotView, setPlotView] = useState<PlotView>("line");
  const [transposed, setTransposed] = useState(false);
  const [lineChoice, setLineResolution] = useState<LineResolution>("day");
  const [scaleChoice, setFingerprintScale] = useState<BinUnit>("day");
  const canShowYearly = selectedYears.length > 1;

  // Nothing finer than the store's own step is offered, and the finest
  // option carries the step's name ("6-hourly", "8-daily").
  const finest = finestResolution(slotsPerDay, timeSpan);
  const stepName = capitalize(stepLabel);
  const lineResolutions = LINE_RESOLUTIONS.filter(
    (option) => RANK[option.value] >= RANK[finest],
  ).map((option) =>
    option.value === finest ? { ...option, label: stepName } : option,
  );
  const lineResolution =
    RANK[lineChoice] >= RANK[finest] ? lineChoice : finest;
  const finestScale: BinUnit = finest === "hour" ? "day" : finest;
  const fingerprintScales = FINGERPRINT_SCALES.filter(
    (option) => RANK[option.value] >= RANK[finestScale],
  ).map((option) =>
    option.value === "year" && !canShowYearly
      ? { ...option, disabled: true, title: "Pick two or more years" }
      : option,
  );
  const allowedScale =
    RANK[scaleChoice] >= RANK[finestScale] ? scaleChoice : finestScale;
  const fingerprintScale =
    allowedScale === "year" && !canShowYearly ? finestScale : allowedScale;

  // Shifting to local time moves whole slots, so it is only honest when a
  // slot is an hour or less; a 6-hourly store would label Tokyo UTC+12.
  const canUseLocalTime = slotsPerDay >= 24;
  const timeBasis: TimeBasis = canUseLocalTime ? requestedTimeBasis : "utc";
  const [palette, setPaletteState] = useState<Palette>(
    () => loadPalette() ?? DEFAULT_PALETTE,
  );
  const colormapId = colormapFor(palette, isLight);

  const setPalette = (next: Palette) => {
    setPaletteState(next);
    savePalette(next);
  };

  // Temperatures can be shown in another scale; everything downstream
  // (plots, summary, exports) sees the converted values and their unit.
  const storedTemperature = temperatureUnitOf(units);
  const [temperatureChoice, setTemperatureChoice] =
    useState<TemperatureUnit | null>(() => loadTemperatureUnit());
  const temperatureUnit = storedTemperature
    ? (temperatureChoice ?? storedTemperature)
    : null;
  const setTemperatureUnit = (next: TemperatureUnit) => {
    setTemperatureChoice(next);
    saveTemperatureUnit(next);
  };
  const shownUnits = temperatureUnit ?? units;
  const convertedValues = useMemo(
    () =>
      values && storedTemperature && temperatureUnit
        ? convertTemperatures(values, storedTemperature, temperatureUnit)
        : values,
    [values, storedTemperature, temperatureUnit],
  );

  // Checked before the local-time shift, which blanks a few edge hours.
  const hasPlottableData = useMemo(
    () => values !== null && hasFiniteValues(values),
    [values],
  );
  const isEmptyCell = !loading && values !== null && !hasPlottableData;

  // The shift moves whole slots, so a 6-hourly store rounds to 6 hours.
  const utcOffsetSlots = localHourOffset(selection?.grid.lon ?? 0, slotsPerDay);
  const utcOffsetHours = (utcOffsetSlots * 24) / slotsPerDay;
  const timeBasisLabel = formatTimeBasis(timeBasis, utcOffsetHours);

  const displayValues = useMemo(() => {
    if (!convertedValues || timeBasis === "utc") return convertedValues;
    const { absoluteDays } = getSelectedYearsDayMapping(
      selectedYears,
      undefined,
      Math.floor(convertedValues.length / slotsPerDay),
    );
    return shiftSeriesToLocalTime(convertedValues, {
      hoursPerDay: slotsPerDay,
      offsetHours: utcOffsetSlots,
      absoluteDays,
    });
  }, [convertedValues, selectedYears, timeBasis, utcOffsetSlots, slotsPerDay]);

  return {
    plotView,
    setPlotView,
    transposed,
    setTransposed,
    lineResolution,
    setLineResolution,
    lineResolutions,
    fingerprintScale,
    setFingerprintScale,
    fingerprintScales,
    canShowYearly,
    canUseLocalTime,
    timeBasis,
    utcOffsetHours,
    timeBasisLabel,
    palette,
    setPalette,
    colormapId,
    hasPlottableData,
    isEmptyCell,
    /** The series in the shown unit, on the UTC clock. */
    values: convertedValues,
    displayValues,
    units: shownUnits,
    temperatureUnit,
    temperatureUnits: temperatureUnit ? TEMPERATURE_UNITS : [],
    setTemperatureUnit,
  };
}

export type SeriesDisplay = ReturnType<typeof useSeriesDisplay>;
