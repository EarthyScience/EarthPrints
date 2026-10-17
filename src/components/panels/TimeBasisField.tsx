"use client";

import type { TimeBasis } from "@/lib/zarr/localTime";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

const TIME_BASES = [
  { value: "local", label: "Local" },
  { value: "utc", label: "UTC" },
] as const;

type TimeBasisFieldProps = {
  value: TimeBasis;
  onChange: (basis: TimeBasis) => void;
};

export function TimeBasisField({ value, onChange }: TimeBasisFieldProps) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Plot hours in</FieldLegend>
      <SegmentedTabs<TimeBasis>
        value={value}
        onChange={onChange}
        options={TIME_BASES}
        aria-label="Plot hours in"
      />
    </FieldSet>
  );
}
