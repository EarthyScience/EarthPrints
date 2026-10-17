"use client";

import { useRef, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import { formatLatitude, formatLongitude } from "@/lib/map/geogrid";
import { formatSelectedYearsLabel } from "@/lib/zarr/timeRange";
import type { TimeBasis } from "@/lib/zarr/localTime";
import type { CellSeries } from "@/hooks/useCellSeries";
import { useSeriesDisplay } from "@/hooks/useSeriesDisplay";
import { CellExport } from "@/components/panels/CellExport";
import { PlotArea, PlotControls } from "@/components/panels/CellView";
import { ScaleField } from "@/components/panels/ScaleField";
import { TimeBasisField } from "@/components/panels/TimeBasisField";
import { YearPicker } from "@/components/panels/YearPicker";
import { SeriesSummary } from "@/components/data/SeriesSummary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

const FADE_DISTANCE = 48;

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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border bg-editor-bg-depth px-2 text-xs text-muted-foreground tabular-nums">
      {children}
    </span>
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
                <CardContent className="grid gap-6">
                  <YearPicker
                    selectedYears={selectedYears}
                    cachedYears={series.cachedYears}
                    loading={series.loading}
                    onSelectYears={series.selectYears}
                  />
                  <ScaleField display={display} />
                  <TimeBasisField
                    value={timeBasis}
                    onChange={onTimeBasisChange}
                  />
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
                      margins
                    />
                  </section>
                </CardContent>
              </Card>

              <SeriesSummary
                series={series}
                display={display}
                className="grid grid-cols-2 gap-3 xl:grid-cols-4"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
