---
name: earthprints-architecture
description: >-
  Complete architectural map of EarthPrints: module boundaries, data flow, key
  abstractions, and the patterns used throughout the codebase. Activate before
  any non-trivial feature work, refactor, or when a new agent session begins.
---

# EarthPrints — Architecture Reference

## What is EarthPrints?

A browser-native geospatial tool for exploring global climate datasets and
eddy-covariance flux tower measurements. Users click any pixel on a global map
to see that pixel's "fingerprint" — an hour-of-day × day heatmap and daily
time series of NEE flux and other climate variables — alongside the spatial
footprint of nearby flux towers.

**Live:** https://earth-prints.vercel.app  
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · deck.gl · MapLibre GL · zarrita.js · Recharts · jsPDF · vitest

---

## Source Tree

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Root → redirects to /map
│   ├── layout.tsx          # Root layout (fonts, ThemeProvider)
│   ├── globals.css         # Tailwind tokens + CSS variables
│   └── map/                # /map route (the main experience)
├── components/
│   ├── map/                # Core interactive map + plot components
│   ├── layout/             # Shell, sidebars, panels
│   ├── nav/                # Navigation bar
│   ├── about/              # About page components
│   └── ui/                 # Primitive UI (ProgressBar, …)
├── lib/
│   ├── zarr/               # Zarr data layer (streaming, caching, time)
│   ├── map/                # Map geometry, colour scales, labels
│   ├── export/             # PDF, XLSX, CSV, ZIP, PNG export pipeline
│   ├── cache/              # LRU cache
│   ├── constants/          # ZARR_STORE, ZARR_TIME constants
│   ├── settings/           # User preferences (patchWindow, colormap)
│   └── search/             # Geocoding helpers
├── providers/
│   └── ThemeProvider.tsx   # Light/dark theme context
└── types/
    └── map.ts              # GridCell, GridSpec, MapSelection
```

---

## Key Component Hierarchy

```
MapExperience                 (thin shell)
└── EarthMap                  (deck.gl + MapLibre canvas, pixel selection)
    └── MapReadout             (sidebar: state owner for plots + settings)
        ├── PlotViewToggle     (line ↔ fingerprint)
        ├── TimeBasisToggle    (UTC ↔ local solar time)
        ├── YearSelector       (multi-year filter)
        ├── ColormapPicker     (science-light | science-dark | flux)
        ├── DownloadButton     (export menu)
        ├── TimeSeriesPlot     (Recharts daily mean line chart)
        └── FingerprintPlot    (canvas-based hour×day heatmap)
```

### `MapReadout` — state that lives here

| State | Default | Notes |
|---|---|---|
| `plotView` | `"line"` | `"line"` or `"fingerprint"` |
| `timeBasis` | `"local"` | `"utc"` or `"local"` |
| `fingerprintTransposed` | `false` | Swap axes |
| `colormapId` | theme-based | Persisted to localStorage |

---

## Data Flow

```
User clicks map pixel
  → EarthMap fires onSelectCell
  → MapReadout triggers ZarrChunkReader.fetchSeries(cell, years)
      → chunk.worker (Web Worker) decodes Zarr chunks
      → LRU cache: 500 MB ceiling, LRU eviction
  → series: Float32Array (nDays × hoursPerDay)
  → displayValues = shiftSeriesToLocalTime(series, utcOffset)
  → FingerprintPlot renders canvas heatmap
  → TimeSeriesPlot renders Recharts line chart
```

---

## Colour Scale System (`src/lib/map/fingerprintScale.ts`)

Three named palettes — `ColormapId`:

| ID | Description | Extent |
|---|---|---|
| `science-light` | Blue→grey→red (light bg) | Symmetric `absMax` |
| `science-dark` | Lifted blue→grey→red (dark bg) | Symmetric `absMax` |
| `flux` | CET kbc (uptake) + reversed kryw (release) | **Asymmetric** — separate `negMax` / `posMax` |

### API

```ts
fingerprintColorScale(colormapId: ColormapId):
  (value: number, negMax: number, posMax: number) => string

// For symmetric Science maps: pass absMax as both negMax and posMax.
// For Flux: compute with asymmetricExtents(values) → { negMax, posMax }.

symmetricAbsMax(values): number   // max |finite value|
asymmetricExtents(values): { negMax, posMax }  // separate halves

// Colorbar gradient (32-stop, sampled from scale function):
// See FingerprintPlot.tsx legend render section for the pattern.
```

### Flux palette data

`CET_KBC` and `CET_KRYW` are Uint8Array tables of 256 × RGB entries, hardcoded
from the Kovesi/colorcet Python package (`linear_kbc_5_95_c73` and
`linear_kryw_5_100_c67`).

---

## Settings Persistence

| Setting | Key | Module |
|---|---|---|
| Colormap | `earthprints:colormap` | `src/lib/settings/colormap.ts` |
| Patch window | `earthprints:patchWindow` | `src/lib/settings/patchWindow.ts` |

---

## Export Pipeline

See the **earthprints-export-pipeline** skill for full details.

Short summary:
- **PDF** (`pdf.ts`) — jsPDF A4 report, always Science Light palette
- **Square badge** (`fingerprintSquareLogo.ts`) — uses selected `colormapId`
- **XLSX / CSV** (`xlsx.ts`, `csv.ts`) — raw data tables
- **ZIP** (`zip.ts`) — bundles all of the above

`DownloadButton.tsx` orchestrates all exports. The `colormapId` prop must be in
all `useCallback` dependency arrays or the callback will capture a stale value.

---

## Testing

```bash
npm run test           # vitest run (215 tests, ~1 s)
npm run test:watch     # watch mode
npx tsc --noEmit       # type-check without building
```

Tests live alongside their modules (`*.test.ts`). No separate `__tests__` dir.

---

## Conventions

- `"use client"` on every interactive component (Next.js App Router).
- Absolute imports via `@/` alias (maps to `src/`).
- CSS design tokens live in `app/globals.css` as CSS custom properties
  (`--editor-bg-primary`, `--accent`, etc.) consumed by Tailwind utilities.
- Canvas rendering uses `pixelRatio` for HiDPI — never hardcode 1px.
- Export paths always check that `colormapId` is in every `useCallback` dep
  array, or the callback will be stale.
