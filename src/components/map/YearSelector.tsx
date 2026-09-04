"use client";

import { useMemo, useState } from "react";
import {
  ALL_AVAILABLE_YEARS,
  formatSelectedYearsLabel,
} from "@/lib/zarr/timeRange";

type YearSelectorProps = {
  selectedYears?: number[];
  selectedYear?: number;
  cachedYears?: Set<number>;
  loading?: boolean;
  onSelectYears?: (years: number[]) => void;
  onSelectYear?: (year: number) => void;
  className?: string;
};

export function YearSelector({
  selectedYears,
  selectedYear,
  cachedYears = new Set(),
  loading = false,
  onSelectYears,
  onSelectYear,
  className = "",
}: YearSelectorProps) {
  const cachedCount = cachedYears.size;

  const activeYears = useMemo(() => {
    if (selectedYears && selectedYears.length > 0) return selectedYears;
    if (selectedYear) return [selectedYear];
    return [ALL_AVAILABLE_YEARS[ALL_AVAILABLE_YEARS.length - 1]!];
  }, [selectedYears, selectedYear]);

  const selectedSet = useMemo(() => new Set(activeYears), [activeYears]);
  const [lastClickedYear, setLastClickedYear] = useState<number | null>(null);

  const handleYearClick = (year: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedYear !== null) {
      const min = Math.min(lastClickedYear, year);
      const max = Math.max(lastClickedYear, year);
      const range = ALL_AVAILABLE_YEARS.filter((y) => y >= min && y <= max);
      setLastClickedYear(year);
      if (onSelectYears) {
        onSelectYears(range);
      } else if (onSelectYear) {
        onSelectYear(year);
      }
      return;
    }

    setLastClickedYear(year);

    if (onSelectYears) {
      if (selectedSet.has(year)) {
        if (activeYears.length > 1) {
          onSelectYears(activeYears.filter((y) => y !== year));
        }
      } else {
        const next = [...activeYears, year].sort((a, b) => a - b);
        onSelectYears(next);
      }
    } else if (onSelectYear) {
      onSelectYear(year);
    }
  };

  const yearsLabel = formatSelectedYearsLabel(activeYears);

  return (
    <section aria-label="Year selection" className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[13px] font-semibold text-editor-fg-primary">
            Year
          </label>
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500/80"
            title="Cached in memory"
            aria-hidden="true"
          />
          {cachedCount > 0 ? (
            <span className="font-mono text-[10.5px] text-editor-fg-tertiary">
              ({cachedCount} cached)
            </span>
          ) : null}
        </div>
        <span className="font-mono text-[12.5px] font-semibold text-accent">
          {yearsLabel}
        </span>
      </div>

      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-1"
        role="group"
        aria-label="Select year"
      >
        {ALL_AVAILABLE_YEARS.map((year) => {
          const isSelected = selectedSet.has(year);
          const isCached = cachedYears.has(year);
          const isLoading = isSelected && loading;

          return (
            <button
              key={year}
              type="button"
              onClick={(e) => handleYearClick(year, e)}
              aria-pressed={isSelected}
              disabled={isLoading}
              title={
                isSelected
                  ? `Year ${year} (Selected · Shift+click for range)`
                  : isCached
                    ? `Year ${year} (Cached in memory · Shift+click for range)`
                    : `Year ${year} (Click to select · Shift+click for range)`
              }
              className={`relative flex items-center justify-center rounded-[5px] py-1 font-mono text-[11px] tabular-nums transition-all ${
                isSelected
                  ? "bg-accent font-bold text-white shadow-xs"
                  : isCached
                    ? "border border-editor-border bg-editor-bg-primary/80 text-editor-fg-primary hover:border-editor-border-strong hover:bg-editor-bg-primary"
                    : "border border-transparent text-editor-fg-tertiary hover:border-editor-border/60 hover:bg-editor-bg-primary/40 hover:text-editor-fg-secondary"
              }`}
            >
              <span>{year.toString().slice(2)}</span>
              {/* Cached indicator dot */}
              {isCached && !isSelected ? (
                <span
                  className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-emerald-500/80"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
