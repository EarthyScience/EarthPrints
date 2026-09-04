"use client";

import { ALL_AVAILABLE_YEARS } from "@/lib/zarr/timeRange";

type YearSelectorProps = {
  selectedYear: number;
  cachedYears?: Set<number>;
  loading?: boolean;
  onSelectYear: (year: number) => void;
  className?: string;
};

export function YearSelector({
  selectedYear,
  cachedYears = new Set(),
  loading = false,
  onSelectYear,
  className = "",
}: YearSelectorProps) {
  const cachedCount = cachedYears.size;

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
          {selectedYear}
        </span>
      </div>

      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-1"
        role="group"
        aria-label="Select year"
      >
        {ALL_AVAILABLE_YEARS.map((year) => {
          const isSelected = year === selectedYear;
          const isCached = cachedYears.has(year);
          const isLoading = isSelected && loading;

          return (
            <button
              key={year}
              type="button"
              onClick={() => onSelectYear(year)}
              aria-pressed={isSelected}
              disabled={isLoading}
              title={
                isSelected
                  ? `Year ${year} (Selected)`
                  : isCached
                    ? `Year ${year} (Cached in memory)`
                    : `Year ${year} (Click to fetch 4-year block)`
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
