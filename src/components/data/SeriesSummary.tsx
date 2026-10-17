"use client";

import { useMemo } from "react";
import { formatIsoDate } from "@/lib/map/fingerprintScale";
import { formatSeriesValue } from "@/lib/plots/chartTheme";
import { dailyMeanSeries } from "@/lib/zarr/series";
import { getSelectedYearsDayMapping, ZARR_TIME } from "@/lib/zarr/timeRange";
import type { CellSeries } from "@/hooks/useCellSeries";
import type { SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { Card, CardContent } from "@/components/ui/card";

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

/** One summary per selected year, read from that year's slice of the series. */
function summarizeByYear(
  values: Float32Array,
  selectedYears: number[],
): { year: number; summary: Summary }[] {
  const hoursPerDay = ZARR_TIME.hoursPerDay;
  const { yearIntervals } = getSelectedYearsDayMapping(
    selectedYears,
    undefined,
    Math.floor(values.length / hoursPerDay),
  );
  return yearIntervals.flatMap(({ year, startDayLocal, endDayLocal }) => {
    const summary = summarize(
      values.subarray(startDayLocal * hoursPerDay, (endDayLocal + 1) * hoursPerDay),
      [year],
    );
    return summary ? [{ year, summary }] : [];
  });
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
          <span className="flex flex-wrap items-baseline gap-x-1 text-2xl font-medium tabular-nums">
            {value}
            {units ? (
              <span className="text-xs font-normal whitespace-nowrap text-muted-foreground">
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

type SeriesSummaryProps = {
  series: CellSeries;
  display: SeriesDisplay;
  className?: string;
};

export function SeriesSummary({
  series,
  display,
  className,
}: SeriesSummaryProps) {
  const { selectedYears, units } = series;
  const values = display.displayValues;

  const summary = useMemo(
    () =>
      values && !display.isEmptyCell ? summarize(values, selectedYears) : null,
    [values, display.isEmptyCell, selectedYears],
  );

  const byYear = useMemo(
    () =>
      values && !display.isEmptyCell && selectedYears.length > 1
        ? summarizeByYear(values, selectedYears)
        : [],
    [values, display.isEmptyCell, selectedYears],
  );

  if (!summary) return null;

  return (
    <section aria-label="Summary" className="grid gap-3">
      <h2 className="text-xs text-muted-foreground">
        Daily means over the selected years
      </h2>
      <div className={className ?? "grid grid-cols-2 gap-3"}>
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
      {byYear.length > 0 ? (
        <YearTable rows={byYear} total={summary} units={units} />
      ) : null}
    </section>
  );
}

function DayCell({ stat }: { stat: DayStat }) {
  return (
    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
      {formatSeriesValue(stat.value)}
      <span className="ml-1.5 text-xs text-muted-foreground">{stat.date}</span>
    </td>
  );
}

function YearTable({
  rows,
  total,
  units,
}: {
  rows: { year: number; summary: Summary }[];
  total: Summary;
  units?: string | null;
}) {
  const row = (label: string, summary: Summary, isTotal = false) => (
    <tr
      key={label}
      className={isTotal ? "border-t font-medium" : "border-t border-border/50"}
    >
      <th scope="row" className="px-3 py-2 text-left font-medium">
        {label}
      </th>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatSeriesValue(summary.mean)}
      </td>
      <DayCell stat={summary.lowest} />
      <DayCell stat={summary.highest} />
      <td className="px-3 py-2 text-right tabular-nums">
        {summary.days.toLocaleString()}
      </td>
    </tr>
  );

  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="px-3 pt-3 text-left text-xs text-muted-foreground">
            Per year{units ? `, ${units}` : ""}
          </caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-normal">
                Year
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Mean
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Lowest day
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Highest day
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Days with data
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ year, summary }) => row(String(year), summary))}
            {row("All years", total, true)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
