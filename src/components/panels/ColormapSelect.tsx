"use client";

import {
  COLORMAPS,
  colormapFor,
  fingerprintRampGradient,
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

const PALETTE_LABELS: Record<Palette, string> = {
  science: "Science",
  flux: "Flux",
};

const SWATCHES = Object.fromEntries(
  (Object.keys(COLORMAPS) as ColormapId[]).map((id) => [
    id,
    fingerprintRampGradient(id, 1, 1, 16),
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
          {PALETTE_LABELS[value]}
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
              {PALETTE_LABELS[palette]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
