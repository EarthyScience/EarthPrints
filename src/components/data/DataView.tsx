"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import { formatLatitude, formatLongitude } from "@/lib/map/geogrid";
import { formatIsoDate } from "@/lib/map/fingerprintScale";
import { formatSeriesValue } from "@/lib/plots/chartTheme";
import { dailyMeanSeries } from "@/lib/zarr/series";
import {
  formatSelectedYearsLabel,
  getSelectedYearsDayMapping,
  ZARR_TIME,
} from "@/lib/zarr/timeRange";
import type { TimeBasis } from "@/lib/zarr/localTime";
import type { CellSeries } from "@/hooks/useCellSeries";
import { useSeriesDisplay } from "@/hooks/useSeriesDisplay";
import { CellExport } from "@/components/panels/CellExport";
import { PlotArea, PlotControls } from "@/components/panels/CellView";
import { YearPicker } from "@/components/panels/YearPicker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

const FADE_DISTANCE = 48;

const TIME_BASES = [
  { value: "local", label: "Local" },
  { value: "utc", label: "UTC" },
] as const;

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function usePlotHeight() {
  return useSyncExternalStore(
    subscribeResize,
    () => Math.round(Math.min(560, Math.max(260, window.innerHeight * 0.5))),
    () => 360,
  );
}

type DayStat = { value: number; date: string };

type Summary = {
  mean: number;
  lowest: DayStat;
  highest: DayStat;
  days: number;
};

function summarize(
  values: Float32Array,
  selectedYears: number[],
): Summary | null {
  const hoursPerDay = ZARR_TIME.hoursPerDay;
  const daily = dailyMeanSeries(values, hoursPerDay);
  if (daily.length === 0) return null;
  const { absoluteDays } = getSelectedYearsDayMapping(
    selectedYears,
    undefined,
    Math.floor(values.length / hoursPerDay),
  );
  const dateOf = (day: number) =>
    formatIsoDate(absoluteDays[day - 1] ?? day - 1);

  let sum = 0;
  let lowest = daily[0];
  let highest = daily[0];
  for (const point of daily) {
    sum += point.value;
    if (point.value < lowest.value) lowest = point;
    if (point.value > highest.value) highest = point;
  }
  return {
    mean: sum / daily.length,
    lowest: { value: lowest.value, date: dateOf(lowest.day) },
    highest: { value: highest.value, date: dateOf(highest.day) },
    days: daily.length,
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border bg-editor-bg-depth px-2 text-xs text-muted-foreground tabular-nums">
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  units,
  note,
}: {
  label: string;
  value: string;
  units?: string | null;
  note?: string;
}) {
  return (
    <Card className="gap-0">
      <CardContent className="grid min-h-28 content-between gap-6">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="grid gap-0.5">
          <span className="text-2xl font-medium tabular-nums">
            {value}
            {units ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {units}
              </span>
            ) : null}
          </span>
          {note ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {note}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type DataViewProps = {
  series: CellSeries;
  timeBasis: TimeBasis;
  onTimeBasisChange: (basis: TimeBasis) => void;
  onClose: () => void;
};

export function DataView({
  series,
  timeBasis,
  onTimeBasisChange,
  onClose,
}: DataViewProps) {
  const display = useSeriesDisplay(series, timeBasis);
  const fadeRef = useRef<HTMLDivElement>(null);
  const plotHeight = usePlotHeight();
  const { selection, selectedYears, units } = series;
  const values = display.displayValues;

  const summary = useMemo(
    () =>
      values && !display.isEmptyCell ? summarize(values, selectedYears) : null,
    [values, display.isEmptyCell, selectedYears],
  );

  return (
    <div
      className="absolute inset-0 z-20 overflow-y-auto bg-editor-bg-depth"
      // Styled directly so scrolling does not re-render the charts.
      onScroll={(event) => {
        const fade = fadeRef.current;
        if (!fade) return;
        const progress = event.currentTarget.scrollTop / FADE_DISTANCE;
        fade.style.opacity = String(Math.min(1, progress));
      }}
    >
      <div
        ref={fadeRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-10 h-25 bg-linear-to-b from-editor-bg-depth from-55% to-transparent opacity-0 max-md:hidden"
      />
      <div className="mx-auto grid max-w-7xl gap-6 px-3 pt-28 pb-40 md:px-6 md:pt-20 md:pb-60">
        {selection ? (
          <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="grid content-start gap-3 max-lg:order-last">
              <Card>
                <CardContent>
                  <YearPicker
                    selectedYears={selectedYears}
                    cachedYears={series.cachedYears}
                    loading={series.loading}
                    onSelectYears={series.selectYears}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <FieldSet>
                    <FieldLegend variant="label">Plot hours in</FieldLegend>
                    <SegmentedTabs<TimeBasis>
                      value={timeBasis}
                      onChange={onTimeBasisChange}
                      options={TIME_BASES}
                      aria-label="Plot hours in"
                    />
                  </FieldSet>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <CellExport series={series} display={display} />
                </CardContent>
              </Card>
            </aside>
            <div className="grid min-w-0 gap-6">
              <Card>
                <CardContent className="grid gap-6">
                  <header className="grid items-start gap-4 max-md:pr-10">
                    <div className="grid gap-1">
                      <CardTitle>
                        {formatLongitude(selection.grid.lon)},{" "}
                        {formatLatitude(selection.grid.lat)}
                      </CardTitle>
                      <CardDescription>
                        Net ecosystem exchange, 0.05° cell
                      </CardDescription>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        <Chip>
                          Years {formatSelectedYearsLabel(selectedYears)}
                        </Chip>
                        {units ? <Chip>{units}</Chip> : null}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="order-first justify-self-start md:hidden"
                    >
                      <ArrowLeft />
                      Map
                    </Button>
                  </header>
                  <section aria-live="polite" className="grid gap-3">
                    <PlotControls display={display} />
                    <PlotArea
                      series={series}
                      display={display}
                      height={plotHeight}
                      pinLimit={2}
                    />
                  </section>
                </CardContent>
              </Card>

              {summary ? (
                <section aria-label="Summary" className="grid gap-3">
                  <h2 className="text-xs text-muted-foreground">
                    Daily means over the selected years
                  </h2>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <StatCard
                      label="Mean"
                      value={formatSeriesValue(summary.mean)}
                      units={units}
                    />
                    <StatCard
                      label="Lowest day"
                      value={formatSeriesValue(summary.lowest.value)}
                      units={units}
                      note={summary.lowest.date}
                    />
                    <StatCard
                      label="Highest day"
                      value={formatSeriesValue(summary.highest.value)}
                      units={units}
                      note={summary.highest.date}
                    />
                    <StatCard
                      label="Days with data"
                      value={summary.days.toLocaleString()}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
