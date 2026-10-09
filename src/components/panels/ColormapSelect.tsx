"use client";

import {
  COLORMAPS,
  colormapFor,
  fingerprintColorScale,
  type ColormapId,
  type Palette,
} from "@/lib/map/fingerprintScale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/providers/ThemeProvider";

const PALETTES: Palette[] = ["science", "flux"];

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
  (Object.keys(COLORMAPS) as ColormapId[]).map((id) => [
    id,
    swatchGradient(id),
  ]),
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
  value: Palette;
  onChange: (palette: Palette) => void;
};

export function ColormapSelect({ value, onChange }: ColormapSelectProps) {
  const { isLight } = useTheme();
  const selected = colormapFor(value, isLight);
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Palette)}>
      <SelectTrigger aria-label="Palette">
        <SelectValue>
          <Swatch id={selected} />
          {COLORMAPS[selected].label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PALETTES.map((palette) => {
          const id = colormapFor(palette, isLight);
          return (
            <SelectItem
              key={palette}
              value={palette}
              title={COLORMAPS[id].description}
            >
              <Swatch id={id} />
              {COLORMAPS[id].label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
