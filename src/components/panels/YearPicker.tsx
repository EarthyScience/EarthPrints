"use client";

import { useState } from "react";
import {
  ALL_AVAILABLE_YEARS,
  formatSelectedYearsLabel,
} from "@/lib/zarr/timeRange";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";

type YearPickerProps = {
  selectedYears: number[];
  cachedYears: Set<number>;
  loading: boolean;
  onSelectYears: (years: number[]) => void;
};

export function YearPicker({
  selectedYears,
  cachedYears,
  loading,
  onSelectYears,
}: YearPickerProps) {
  const [lastClickedYear, setLastClickedYear] = useState<number | null>(null);
  const selected = new Set(selectedYears);

  const handleClick = (year: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedYear !== null) {
      const min = Math.min(lastClickedYear, year);
      const max = Math.max(lastClickedYear, year);
      setLastClickedYear(year);
      onSelectYears(ALL_AVAILABLE_YEARS.filter((y) => y >= min && y <= max));
      return;
    }

    setLastClickedYear(year);
    if (selected.has(year)) {
      if (selectedYears.length > 1) {
        onSelectYears(selectedYears.filter((y) => y !== year));
      }
    } else {
      onSelectYears([...selectedYears, year].sort((a, b) => a - b));
    }
  };

  return (
    <Field data-tour="years">
      <FieldLabel>Years {formatSelectedYearsLabel(selectedYears)}</FieldLabel>
      <FieldDescription>
        Shift+click for a range. Outlined years are cached
        {cachedYears.size > 0 ? ` (${cachedYears.size})` : ""}.
      </FieldDescription>
      <div className="grid grid-cols-7 gap-1">
        {ALL_AVAILABLE_YEARS.map((year) => {
          const isSelected = selected.has(year);
          // Other years stay clickable mid-load so they can be dropped at once.
          const isLocked = isSelected && loading && selectedYears.length === 1;

          return (
            <Toggle
              key={year}
              size="sm"
              variant={cachedYears.has(year) ? "outline" : "default"}
              pressed={isSelected}
              disabled={isLocked}
              onClick={(event) => handleClick(year, event)}
              aria-label={String(year)}
              className="aria-pressed:bg-brand/15 aria-pressed:text-brand"
            >
              {year.toString().slice(2)}
            </Toggle>
          );
        })}
      </div>
    </Field>
  );
}
