"use client";

import { useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { formatLatitude, formatLongitude } from "@/lib/map/geogrid";
import { formatSelectedYearsLabel } from "@/lib/zarr/timeRange";
import { TIME_SERIES_PLOT_HEIGHT } from "@/lib/plots/chartTheme";
import { shortTimeBasis, type TimeBasis } from "@/lib/zarr/localTime";
import type { CellSeries, SeriesProgress } from "@/hooks/useCellSeries";
import type { PlotView, SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { TimeSeriesPlot } from "@/components/plots/TimeSeriesPlot";
import { FingerprintPlot } from "@/components/plots/FingerprintPlot";
import { useDesktop } from "@/components/plots/MapSideTooltip";
import { TimeBasisField } from "@/components/panels/TimeBasisField";
import { YearPicker } from "@/components/panels/YearPicker";
import { SeriesSummary } from "@/components/data/SeriesSummary";
import { ColormapSelect } from "@/components/panels/ColormapSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";

type CellViewProps = {
  series: CellSeries;
  display: SeriesDisplay;
  timeBasis: TimeBasis;
  onTimeBasisChange: (basis: TimeBasis) => void;
  openDetails?: boolean;
};

export function CellView({
  series,
  display,
  timeBasis,
  onTimeBasisChange,
  openDetails = false,
}: CellViewProps) {
  const desktop = useDesktop();
  const { selection, patchWindow } = series;
  const [detailsOpen, setDetailsOpen] = useState(openDetails);
  const [prevOpenDetails, setPrevOpenDetails] = useState(openDetails);
  if (openDetails !== prevOpenDetails) {
    setPrevOpenDetails(openDetails);
    if (openDetails) setDetailsOpen(true);
  }
  if (!selection) return null;

  return (
    <div className="grid gap-4">
      <Collapsible.Root
        open={desktop || detailsOpen}
        onOpenChange={setDetailsOpen}
        className="grid"
      >
        <div data-tour="record" className="flex items-start gap-3">
          <div className="grid flex-1 gap-1">
            <CardTitle>
              {formatLongitude(selection.grid.lon)},{" "}
              {formatLatitude(selection.grid.lat)}
            </CardTitle>
            {desktop ? (
              <span className="text-sm text-muted-foreground">
                Years {formatSelectedYearsLabel(series.selectedYears)}
              </span>
            ) : (
              <Collapsible.Trigger className="group flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                Details · Years {formatSelectedYearsLabel(series.selectedYears)}
                <ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" />
              </Collapsible.Trigger>
            )}
          </div>
        </div>
        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="grid gap-4 pt-3">
            <CardDescription>
              {describeRecord(series)} The dashed box marks the{" "}
              {Math.min(patchWindow, series.gridSpec.nativeChunks.lat)}×
              {Math.min(patchWindow, series.gridSpec.nativeChunks.lon)} cells
              around it kept in memory.
            </CardDescription>
            <YearPicker
              selectedYears={series.selectedYears}
              cachedYears={series.cachedYears}
              loading={series.loading}
              onSelectYears={series.selectYears}
            />
            {desktop || !display.canUseLocalTime ? null : (
              <TimeBasisField value={timeBasis} onChange={onTimeBasisChange} />
            )}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>

      <section aria-live="polite" data-tour="plot" className="grid gap-3">
        <PlotControls display={display} />

        <PlotArea series={series} display={display} />
      </section>

      {desktop ? null : <SeriesSummary series={series} display={display} />}
    </div>
  );
}

/** "Hourly net ecosystem exchange for this 0.05° cell." */
export function describeRecord(series: CellSeries): string {
  const { dataset } = series;
  const name = dataset ? (dataset.longName ?? dataset.variable) : "net ecosystem exchange";
  const step = dataset?.time.stepLabel ?? "hourly";
  const resolution = formatResolution(series.gridSpec.spatialResolutionDeg);
  // Lowercase a sentence-case name ("Net ecosystem exchange"), but leave
  // acronyms ("NEE") and title case ("Gross Primary Productivity") alone.
  const lowered = /^[A-Z][a-z]*(?:[\s-][a-z0-9][^\s]*)*$/.test(name)
    ? `${name.charAt(0).toLowerCase()}${name.slice(1)}`
    : name;
  const repeatsStep = lowered.toLowerCase().includes(step.toLowerCase());
  const phrase = repeatsStep ? lowered : `${step} ${lowered}`;
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} for this ${resolution} cell.`;
}

export function formatResolution(degrees: number): string {
  return `${Number(degrees.toPrecision(3))}°`;
}

function emptyCellMessage(series: CellSeries): string {
  const isFluxcom = !series.dataset || series.dataset.variable === "NEE";
  return isFluxcom
    ? "No data at this cell. NEE is estimated over vegetated land, so ocean and bare-ground cells are empty. Pick a cell over land."
    : "No data at this cell for the selected years. The dataset may not cover it, for example over ocean or outside its mask. Pick another cell or other years.";
}

const activeTriggerClass =
  "data-active:bg-brand/15 data-active:text-brand dark:data-active:bg-brand/15 dark:data-active:text-brand";

export function PlotControls({ display }: { display: SeriesDisplay }) {
  const disabled = display.isEmptyCell;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={display.plotView}
        onValueChange={(value) => display.setPlotView(value as PlotView)}
      >
        <TabsList>
          <TabsTrigger
            value="line"
            disabled={disabled}
            className={activeTriggerClass}
          >
            Line
          </TabsTrigger>
          <TabsTrigger
            value="fingerprint"
            disabled={disabled}
            className={activeTriggerClass}
          >
            Fingerprint
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {display.plotView === "fingerprint" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            pressed={display.transposed}
            onPressedChange={display.setTransposed}
            disabled={disabled}
            title="Swap the hour and day axes"
            variant="outline"
            className="dark:bg-input/30 dark:hover:bg-input/50 aria-pressed:bg-brand/15 aria-pressed:text-brand dark:aria-pressed:bg-brand/15"
          >
            <ArrowLeftRight />
            Flip axes
          </Toggle>
          <ColormapSelect
            value={display.palette}
            onChange={display.setPalette}
          />
        </div>
      ) : null}
    </div>
  );
}

type PlotAreaProps = {
  series: CellSeries;
  display: SeriesDisplay;
  height?: number;
  pinLimit?: number;
  margins?: boolean;
};

export function PlotArea({
  series,
  display,
  height,
  pinLimit,
  margins,
}: PlotAreaProps) {
  if (series.loading) {
    return (
      <div className="grid gap-3">
        <SeriesProgress progress={series.progress} />
        <Skeleton style={{ height: height ?? TIME_SERIES_PLOT_HEIGHT }} />
      </div>
    );
  }

  if (series.error) {
    return (
      <Alert>
        <AlertDescription className="grid gap-3">
          <span>{series.error}</span>
          {series.partialOffer ? (
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={series.loadPartial}
            >
              Load the first {formatDays(series.partialOffer.days)} (up to{" "}
              {formatBytes(series.partialOffer.bytes)})
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  if (display.isEmptyCell) {
    return (
      <Alert>
        <AlertDescription>{emptyCellMessage(series)}</AlertDescription>
      </Alert>
    );
  }

  if (!display.displayValues) return null;

  const plot = display.plotView === "line" ? (
    <TimeSeriesPlot
      values={display.displayValues}
      units={series.units}
      hoursPerDay={series.slotsPerDay}
      selectedYears={series.selectedYears}
      resolution={display.lineResolution}
      timeBasisSuffix={shortTimeBasis(display.timeBasisLabel)}
      stepCount={series.stepCount}
      height={height}
      pinLimit={pinLimit}
    />
  ) : (
    <FingerprintPlot
      values={display.displayValues}
      units={series.units}
      hoursPerDay={series.slotsPerDay}
      selectedYears={series.selectedYears}
      timeBasisLabel={display.timeBasisLabel}
      transposed={display.transposed}
      colormapId={display.colormapId}
      scale={display.fingerprintScale}
      margins={margins}
      height={height}
      pinLimit={pinLimit}
    />
  );

  if (series.coveredDays === null) return plot;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Showing the first {formatDays(series.coveredDays)} of the selection. The
        rest would take more downloads than one load allows.
      </p>
      {plot}
    </div>
  );
}

function formatDays(days: number): string {
  const whole = Math.max(1, Math.round(days));
  return `${whole.toLocaleString("en-US")} day${whole === 1 ? "" : "s"}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function SeriesProgress({ progress }: { progress: SeriesProgress | null }) {
  const hasBytes = progress !== null && progress.total > 0;
  const value = hasBytes
    ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
    : null;

  return (
    <Progress value={value}>
      <ProgressLabel>
        Loading time series
        {hasBytes
          ? ` · ${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}`
          : ""}
      </ProgressLabel>
      <ProgressValue>
        {() => (value === null ? "…" : `${value}%`)}
      </ProgressValue>
    </Progress>
  );
}
