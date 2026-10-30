"use client";

import { useEffect, useRef, useState } from "react";
import {
  availableYears,
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
  const years = availableYears();
  // Two digits only while every year shares a century, or 1950 and 2050
  // collide, and only for a short full grid: a lone "20", a "00" or a long
  // run of two-digit buttons does not read as years.
  const oneCentury =
    years.length > 7 &&
    years.length <= 25 &&
    years[0]! >= 1000 &&
    years[0]! % 100 !== 0 &&
    Math.floor(years[0]! / 100) === Math.floor(years[years.length - 1]! / 100);

  // Long records scroll; keep the first selected year in view.
  const gridRef = useRef<HTMLDivElement>(null);
  const firstSelected = selectedYears.length > 0 ? Math.min(...selectedYears) : null;
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || firstSelected === null) return;
    const button = grid.querySelector<HTMLElement>(
      `[aria-label="${firstSelected}"]`,
    );
    if (!button) return;
    const top = button.offsetTop;
    if (top < grid.scrollTop || top + button.offsetHeight > grid.scrollTop + grid.clientHeight) {
      grid.scrollTop = top - grid.clientHeight / 2;
    }
  }, [firstSelected, years.length]);

  const handleClick = (year: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedYear !== null) {
      const min = Math.min(lastClickedYear, year);
      const max = Math.max(lastClickedYear, year);
      setLastClickedYear(year);
      onSelectYears(years.filter((y) => y >= min && y <= max));
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
      <div
        ref={gridRef}
        className={`relative grid gap-1 ${oneCentury ? "grid-cols-7" : "grid-cols-5"} ${years.length > 42 ? "max-h-48 overflow-y-auto pr-1" : ""}`}
      >
        {years.map((year) => {
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
              {oneCentury ? year.toString().slice(2) : year}
            </Toggle>
          );
        })}
      </div>
    </Field>
  );
}
