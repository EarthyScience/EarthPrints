"use client";

import type { TypicalStat } from "@/lib/plots/fingerprintAnomaly";
import type { BinUnit } from "@/lib/plots/timeBins";
import type { FingerprintShow, SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

const TYPICAL_STATS: { value: TypicalStat; label: string }[] = [
  { value: "mean", label: "Mean" },
  { value: "median", label: "Median" },
  { value: "spread", label: "Spread" },
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
      ? `How much each ${position}${hour} varies between the selected years, as the standard deviation.`
      : `Each ${position}${hour}, combined across the selected years.`;
  }
  if (display.fingerprintShow === "difference") {
    const same =
      display.fingerprintScale !== "year"
        ? `${position}${hour}`
        : display.hasDailyCycle
          ? "hour"
          : null;
    const typical = same
      ? `the mean of the selected years for the same ${same}`
      : "the mean of the selected years";
    return `Each year minus the typical year, ${typical}. Below 0 is lower than typical, above 0 is higher.`;
  }
  return null;
}

/** Why an option is greyed out; a tooltip alone never reaches touch screens. */
function blockedReason(display: SeriesDisplay): string | null {
  if (!display.canShowYearly) return "Typical year and Difference need two or more years.";
  if (display.fingerprintScale === "year") {
    return "Typical year needs a daily, weekly or monthly scale.";
  }
  return null;
}

export function FingerprintShowField({ display }: { display: SeriesDisplay }) {
  if (display.plotView !== "fingerprint") return null;
  const disabled = display.isEmptyCell;
  const description = describe(display);
  const blocked = disabled ? null : blockedReason(display);

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
      {blocked ? <FieldDescription>{blocked}</FieldDescription> : null}
    </FieldSet>
  );
}
