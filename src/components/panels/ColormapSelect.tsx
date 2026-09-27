"use client";

import {
  COLORMAPS,
  fingerprintColorScale,
  type ColormapId,
} from "@/lib/map/fingerprintScale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORMAP_IDS: ColormapId[] = ["science-light", "science-dark", "flux"];

function swatchGradient(id: ColormapId): string {
  const scale = fingerprintColorScale(id);
  const samples = 16;
  const stops = Array.from({ length: samples }, (_, i) => {
    const frac = i / (samples - 1);
    const value = frac <= 0.5 ? -(1 - frac * 2) : frac * 2 - 1;
    return `${scale(value, 1, 1)} ${(frac * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

const SWATCHES = Object.fromEntries(
  COLORMAP_IDS.map((id) => [id, swatchGradient(id)]),
) as Record<ColormapId, string>;

function Swatch({ id }: { id: ColormapId }) {
  return (
    <span
      aria-hidden="true"
      className="h-2.5 w-9 rounded-sm"
      style={{ background: SWATCHES[id] }}
    />
  );
}

type ColormapSelectProps = {
  value: ColormapId;
  onChange: (id: ColormapId) => void;
};

export function ColormapSelect({ value, onChange }: ColormapSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ColormapId)}
    >
      <SelectTrigger aria-label="Palette">
        <SelectValue>
          <Swatch id={value} />
          {COLORMAPS[value].label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {COLORMAP_IDS.map((id) => (
          <SelectItem key={id} value={id} title={COLORMAPS[id].description}>
            <Swatch id={id} />
            {COLORMAPS[id].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
