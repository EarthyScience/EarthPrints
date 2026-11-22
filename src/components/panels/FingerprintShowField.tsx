"use client";

import type { TypicalStat } from "@/lib/plots/fingerprintAnomaly";
import type { BinUnit } from "@/lib/plots/timeBins";
import type { FingerprintShow, SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

const TYPICAL_STATS: { value: TypicalStat; label: string }[] = [
  { value: "mean", label: "Mean" },
  { value: "median", label: "Median" },
  { value: "spread", label: "Std" },
];

const POSITION_NAMES: Record<BinUnit, string> = {
  day: "day of the year",
  week: "week",
  month: "month",
  year: "year",
};

function describe(display: SeriesDisplay): string | null {
  const position = POSITION_NAMES[display.fingerprintScale];
  const hour = display.hasDailyCycle ? " and hour" : "";
  if (display.fingerprintShow === "typical") {
    return display.typicalStat === "spread"
      ? `How much each ${position}${hour} varies between the selected years.`
      : `Each ${position}${hour}, combined across the selected years.`;
  }
  if (display.fingerprintShow === "difference") {
    const same =
      display.fingerprintScale !== "year"
        ? `${position}${hour}`
        : display.hasDailyCycle
          ? "hour"
          : null;
    return same
      ? `Each year minus the mean of the selected years for the same ${same}.`
      : "Each year minus the mean of the selected years.";
  }
  return null;
}

export function FingerprintShowField({ display }: { display: SeriesDisplay }) {
  if (display.plotView !== "fingerprint") return null;
  const disabled = display.isEmptyCell;
  const description = describe(display);

  return (
    <FieldSet>
      <FieldLegend variant="label">Show</FieldLegend>
      <SegmentedTabs<FingerprintShow>
        value={display.fingerprintShow}
        onChange={display.setFingerprintShow}
        options={display.fingerprintShows}
        disabled={disabled}
        aria-label="Show"
      />
      {display.fingerprintShow === "typical" ? (
        <SegmentedTabs<TypicalStat>
          value={display.typicalStat}
          onChange={display.setTypicalStat}
          options={TYPICAL_STATS}
          disabled={disabled}
          aria-label="Typical year statistic"
        />
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </FieldSet>
  );
}
