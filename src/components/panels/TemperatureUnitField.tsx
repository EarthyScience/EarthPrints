"use client";

import type { SeriesDisplay } from "@/hooks/useSeriesDisplay";
import type { TemperatureUnit } from "@/lib/zarr/temperature";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

export function TemperatureUnitField({ display }: { display: SeriesDisplay }) {
  if (!display.temperatureUnit) return null;
  return (
    <FieldSet>
      <FieldLegend variant="label">Temperature in</FieldLegend>
      <SegmentedTabs<TemperatureUnit>
        value={display.temperatureUnit}
        onChange={display.setTemperatureUnit}
        options={display.temperatureUnits.map((unit) => ({
          value: unit,
          label: unit,
        }))}
        aria-label="Temperature in"
      />
    </FieldSet>
  );
}
