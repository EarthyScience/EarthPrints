"use client";

import type { BinUnit } from "@/lib/plots/timeBins";
import type { LineResolution } from "@/lib/plots/lineSeries";
import type { SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

export function ScaleField({ display }: { display: SeriesDisplay }) {
  const disabled = display.isEmptyCell;

  if (display.plotView === "line") {
    return (
      <FieldSet>
        <FieldLegend variant="label">Line resolution</FieldLegend>
        <SegmentedTabs<LineResolution>
          value={display.lineResolution}
          onChange={display.setLineResolution}
          options={display.lineResolutions}
          disabled={disabled}
          aria-label="Line resolution"
        />
      </FieldSet>
    );
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">Fingerprint scale</FieldLegend>
      <SegmentedTabs<BinUnit>
        value={display.fingerprintScale}
        onChange={display.setFingerprintScale}
        options={display.fingerprintScales}
        disabled={disabled}
        aria-label="Fingerprint scale"
      />
    </FieldSet>
  );
}
