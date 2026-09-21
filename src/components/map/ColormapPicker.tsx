"use client";

import {
  COLORMAPS,
  fingerprintLegendStopsForColormap,
  type ColormapId,
} from "@/lib/map/fingerprintScale";

type ColormapPickerProps = {
  value: ColormapId;
  onChange: (id: ColormapId) => void;
};

const COLORMAP_IDS: ColormapId[] = ["science-light", "science-dark", "flux"];

/**
 * A row of swatch buttons for selecting the fingerprint heatmap's colour
 * palette. Each button shows a small gradient preview (uptake → mid →
 * release) so the choice is visual rather than purely text-based.
 */
export function ColormapPicker({ value, onChange }: ColormapPickerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Heatmap colour palette"
    >
      <span className="shrink-0 text-[11.5px] font-semibold text-editor-fg-tertiary">
        Palette
      </span>
      {COLORMAP_IDS.map((id) => {
        const active = id === value;
        const stops = fingerprintLegendStopsForColormap(id);
        const { label } = COLORMAPS[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            title={COLORMAPS[id].description}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] font-semibold transition-colors ${
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-editor-border text-editor-fg-tertiary hover:border-editor-border-strong hover:text-editor-fg-secondary"
            }`}
          >
            {/* Gradient swatch */}
            <span
              className="block h-2.5 w-9 flex-shrink-0 rounded-sm"
              style={{
                background: `linear-gradient(to right, ${stops.uptake}, ${stops.mid}, ${stops.release})`,
              }}
              aria-hidden="true"
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
