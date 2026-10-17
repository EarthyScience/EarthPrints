"use client";

import type { BinUnit } from "@/lib/plots/timeBins";
import type { LineResolution } from "@/lib/plots/lineSeries";
import type { SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

const LINE_RESOLUTIONS = [
  { value: "hour", label: "Hourly" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
] as const;

export function ScaleField({ display }: { display: SeriesDisplay }) {
  const disabled = display.isEmptyCell;

  if (display.plotView === "line") {
    return (
      <FieldSet>
        <FieldLegend variant="label">Line resolution</FieldLegend>
        <SegmentedTabs<LineResolution>
          value={display.lineResolution}
          onChange={display.setLineResolution}
          options={LINE_RESOLUTIONS}
          disabled={disabled}
          aria-label="Line resolution"
        />
      </FieldSet>
    );
  }

  const fingerprintScales = [
    { value: "day", label: "Daily" },
    { value: "week", label: "Weekly" },
    { value: "month", label: "Monthly" },
    {
      value: "year",
      label: "Yearly",
      disabled: !display.canShowYearly,
      title: display.canShowYearly ? undefined : "Pick two or more years",
    },
  ] as const;

  return (
    <FieldSet>
      <FieldLegend variant="label">Fingerprint scale</FieldLegend>
      <SegmentedTabs<BinUnit>
        value={display.fingerprintScale}
        onChange={display.setFingerprintScale}
        options={fingerprintScales}
        disabled={disabled}
        aria-label="Fingerprint scale"
      />
    </FieldSet>
  );
}
