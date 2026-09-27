"use client";

import {
  COLORMAPS,
  fingerprintColorScale,
  type ColormapId,
} from "@/lib/map/fingerprintScale";

type ColormapPickerProps = {
  value: ColormapId;
  onChange: (id: ColormapId) => void;
};

const COLORMAP_IDS: ColormapId[] = ["science-light", "science-dark", "flux"];

/**
 * Build a CSS linear-gradient preview for a given colormap ID.
 * Uses 16 samples from the actual scale function (same as the colorbar) so
 * the swatch faithfully represents every palette, including Flux.
 *
 * Extents are symmetric (negMax = posMax = 1, zero at 50%) because the swatch
 * is a palette preview, not tied to any real dataset range.
 */
function swatchGradient(id: ColormapId): string {
  const scale = fingerprintColorScale(id);
  const N = 16;
  const stops = Array.from({ length: N }, (_, i) => {
    const frac = i / (N - 1); // 0 → 1
    // Map 0→0.5 to -1→0 and 0.5→1 to 0→1 (symmetric, negMax=posMax=1).
    const value = frac <= 0.5 ? -(1 - frac * 2) : frac * 2 - 1;
    return `${scale(value, 1, 1)} ${(frac * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

// Pre-compute once — palette swatches never change at runtime.
const SWATCH_GRADIENTS = Object.fromEntries(
  COLORMAP_IDS.map((id) => [id, swatchGradient(id)]),
) as Record<ColormapId, string>;

/**
 * A row of swatch buttons for selecting the fingerprint heatmap's colour
 * palette. Each button shows a small gradient preview sampled from the
 * actual colour scale so the swatch matches the rendered colorbar exactly.
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
                ? "border-brand bg-brand/10 text-brand"
                : "border-editor-border text-editor-fg-tertiary hover:border-editor-border-strong hover:text-editor-fg-secondary"
            }`}
          >
            {/* Gradient swatch — mirrors the colorbar */}
            <span
              className="block h-2.5 w-9 flex-shrink-0 rounded-sm"
              style={{ background: SWATCH_GRADIENTS[id] }}
              aria-hidden="true"
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
