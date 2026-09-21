---
name: earthprints-fingerprint-plot
description: >-
  Deep reference for the fingerprint heatmap subsystem: FingerprintPlot canvas
  render loop, colour scale API, colourbar construction, asymmetric Flux
  extent, and the ColormapPicker. Activate when modifying visualisation,
  colour maps, axes, or the legend.
---

# EarthPrints — Fingerprint Plot Subsystem

## Files

| File | Role |
|---|---|
| `src/lib/map/fingerprintScale.ts` | Colour scale functions, CET palette data, axis helpers |
| `src/components/map/FingerprintPlot.tsx` | Canvas heatmap component |
| `src/components/map/ColormapPicker.tsx` | Palette selector UI |
| `src/lib/settings/colormap.ts` | localStorage persistence |
| `src/lib/map/fingerprintScale.test.ts` | 20 unit tests |

---

## Data Shape

```
values: Float32Array   length = nDays × hoursPerDay (typically 24)
  index = dayLocal * hoursPerDay + hour
  value = NEE flux (μmol CO₂ m⁻² s⁻¹) — negative = uptake, positive = release
  NaN = missing / ocean / bare ground
```

---

## Colour Scale API

```ts
// Build a colour function for the given palette:
const scale = fingerprintColorScale(colormapId);

// Call it per cell:
const css = scale(value, negMax, posMax);
// returns "transparent" for non-finite values.

// Extent helpers:
const absMax = symmetricAbsMax(values);           // symmetric Science maps
const { negMax, posMax } = asymmetricExtents(values); // Flux only
```

### Palette routing

```
colormapId === "science-light" | "science-dark"
  → lerpRgb(mid, endpoint, |t|)   where t = value / absMax ∈ [−1, 1]
  → pass absMax as BOTH negMax and posMax

colormapId === "flux"
  → negative values: sampleCet(CET_KBC, 1 − |value|/negMax)
                     (kbc[255] = near-zero cyan, kbc[0] = darkest blue)
  → positive values: sampleCet(CET_KRYW, 1 − value/posMax)
                     (kryw[255] = near-zero white, kryw[0] = darkest)
  → pass separate negMax / posMax from asymmetricExtents()
```

---

## Colorbar Construction Pattern

The colorbar must be built by **sampling the scale function** (not from
endpoint stops), so it faithfully mirrors the heatmap for all palettes.

```ts
// 1. Compute zero-crossing fraction (where 0 sits in the bar):
const zeroFrac =
  extents.negMax + extents.posMax > 0
    ? extents.negMax / (extents.negMax + extents.posMax)
    : 0.5;
// Science maps: negMax === posMax → zeroFrac === 0.5 (50%).
// Flux asymmetric: e.g. negMax=1, posMax=3 → zeroFrac === 0.25.

// 2. Sample 32 stops, using zeroFrac as the pivot:
const stops = Array.from({ length: 32 }, (_, i) => {
  const frac = i / 31;
  const value =
    frac <= zeroFrac
      ? zeroFrac > 0 ? -negMax * (1 - frac / zeroFrac) : 0
      : 1 - zeroFrac > 0 ? posMax * ((frac - zeroFrac) / (1 - zeroFrac)) : 0;
  return `${scale(value, negMax, posMax)} ${(frac * 100).toFixed(1)}%`;
});
const gradient = `linear-gradient(to right, ${stops.join(", ")})`;

// 3. Place the "0" label at zeroFrac * 100% (CSS), centred with -translate-x-1/2.
//    Place min label at left-0 and max label at right-0.
```

**Critical rule:** `zeroFrac` must be computed **before** the gradient stops
and used as the split point in both the gradient sampling AND the label
position. Using a hardcoded 0.5 for the gradient split while placing the label
at the true `zeroFrac` causes a visible misalignment.

---

## Canvas Render Loop (FingerprintPlot)

```tsx
// useEffect deps: [values, absMax, extents, colormapId, nDays, nSel,
//                  dayLo, dayHi, dayAxisTicks, hoursPerDay, isLight,
//                  width, height, pixelRatio, transposed]

const scale = fingerprintColorScale(colormapId);
const cellColor = (dayLocal, hour) =>
  scale(values[dayLocal * hoursPerDay + hour], extents.negMax, extents.posMax);
```

---

## ColormapPicker Swatch Pattern

```ts
// Swatches are pre-computed once at module load (no per-render cost):
function swatchGradient(id: ColormapId): string {
  const scale = fingerprintColorScale(id);
  const N = 16;
  const stops = Array.from({ length: N }, (_, i) => {
    const frac = i / (N - 1);
    const value = frac <= 0.5 ? -(1 - frac * 2) : frac * 2 - 1;
    return `${scale(value, 1, 1)} ${(frac * 100).toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
// Symmetric (negMax=posMax=1) because swatches are palette previews,
// not tied to real data extents.
```

---

## Default Colormap Resolution

```ts
// FingerprintPlot: resolves colormapId from prop or theme:
const colormapId: ColormapId =
  colormapIdProp ?? (isLight ? "science-light" : "science-dark");

// MapReadout initialises state:
const [colormapId, setColormapId] = useState<ColormapId>(
  () => loadColormap() ?? (isLight ? "science-light" : "science-dark"),
);
```

---

## Asymmetric Extent — When and Why

Flux uses `asymmetricExtents` because NEE data is intrinsically asymmetric:
uptake magnitudes (negative) and release magnitudes (positive) rarely match.
With a symmetric scale the smaller side wastes half the colour table on values
it can't reach. The asymmetric approach gives each ramp its full dynamic range.

Science maps stay symmetric so that zero remains visually centred, which is the
convention in peer-reviewed flux/climate figures.

---

## Checklist for New Palette

1. Add ID to `ColormapId` union in `fingerprintScale.ts`.
2. Add entry to `COLORMAPS` record (label + description).
3. Add case to `fingerprintColorScale` switch.
4. Add case to `fingerprintLegendStopsForColormap` (optional, only used by
   the canvas export colorbar — can derive from the scale function instead).
5. Add to `COLORMAP_IDS` array in `ColormapPicker.tsx`.
6. Add unit tests to `fingerprintScale.test.ts`.
7. Decide: symmetric or asymmetric extent? Update `FingerprintPlot` extents
   logic and `fingerprintSquareLogo.ts` accordingly.
