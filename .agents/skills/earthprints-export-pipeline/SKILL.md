---
name: earthprints-export-pipeline
description: >-
  Complete reference for the EarthPrints export pipeline: PDF report, square
  fingerprint badge, XLSX/CSV data tables, and ZIP archive. Covers file
  responsibilities, the colourmap threading pattern, canvas colorbar sampling,
  and the stale-closure trap in DownloadButton useCallback deps. Activate when
  working on any export format or DownloadButton.
---

# EarthPrints — Export Pipeline Reference

## Files

| File | Output | Notes |
|---|---|---|
| `src/lib/export/pdf.ts` | A4 PDF report | Always Science Light palette |
| `src/lib/export/fingerprintSquareLogo.ts` | Square PNG badge (512–2048 px) | Uses selected `colormapId` |
| `src/lib/export/xlsx.ts` | Excel workbook | Raw UTC archive data |
| `src/lib/export/csv.ts` | CSV table | Raw UTC archive data |
| `src/lib/export/zip.ts` | ZIP archive | Bundles all of the above |
| `src/lib/export/rows.ts` | `SeriesRow[]` | Shared tabular data builder |
| `src/lib/export/capture.ts` | `CapturedImage` | Canvas→dataURL for plots |
| `src/lib/export/provenance.ts` | `ExportProvenance` | Metadata (coords, years, units…) |
| `src/lib/export/download.ts` | — | `downloadBlob(blob, filename)` |
| `src/components/map/DownloadButton.tsx` | UI + orchestration | Calls all of the above |
| `src/components/map/ExportStage.tsx` | Off-screen plot render | Headless `FingerprintPlot` for capture |
| `src/components/map/ExportMapStage.tsx` | Off-screen map render | Headless map for capture |

---

## DownloadButton — Exports Available

| Menu item | Function | Colormap |
|---|---|---|
| Download (primary) | `runZipExport` | `colormapId` prop |
| Full Package Archive | `runZipExport` | `colormapId` prop |
| Square Fingerprint Badge | `runSquareBadgeExport(size)` | `colormapId` prop + `isLight` theme |
| Scientific Report | `runPdfExport` | Science Light (hardcoded) |
| Series Data | `runCsvExport` | N/A |

---

## Critical: useCallback Stale Closure

`colormapId` **MUST** appear in the dep arrays of every `useCallback` that
uses it, or the callback captures the initial value and ignores user changes.

```ts
// runZipExport dep array:
[colormapId, displayValues, gridSpec, historyYears, selectedYear,
 selectedYears, selection, timeBasis, timeBasisLabel, units, values]

// runSquareBadgeExport dep array:
[colormapId, displayValues, historyYears, isLight, selectedYear,
 selectedYears, selection, timeBasis, units, values]
```

If any future prop is added to either callback, add it to the dep array too.

---

## Square Badge Colormap Threading

```
MapReadout (colormapId state)
  → <DownloadButton colormapId={colormapId} />
      → buildSquareFingerprintCanvas({ ..., colormapId })
          → fingerprintColorScale(colormapId)
          → asymmetricExtents(values)   [Flux only]
```

### `SquareFingerprintOptions`

```ts
{
  values: Float32Array;
  prov: ExportProvenance;
  units?: string | null;
  absMax?: number;            // auto-computed from values if omitted
  hoursPerDay?: number;
  size?: number;              // px, default 1024
  isLight?: boolean;          // controls bg + text/tick colours
  watermarkText?: string;
  selectedYear?: number | null;
  selectedYears?: number[] | null;
  colormapId?: ColormapId;    // default "science-light"
}
```

---

## Square Badge Colorbar (Canvas)

The badge draws a **vertical** colorbar on the right side. It uses the same
32-stop sampled gradient approach as `FingerprintPlot`:

```ts
// Bar: top = posMax (release), bottom = -negMax (uptake).
// zeroFrac = posMax / (negMax + posMax)  [inverted vs horizontal bar]

const vRamp = ctx.createLinearGradient(0, barTop, 0, barTop + vBarH);
for (let i = 0; i < 32; i++) {
  const t = i / 31; // 0 = top, 1 = bottom
  const value =
    t <= zeroFrac
      ? maxVal * (1 - t / zeroFrac)           // posMax → 0
      : minVal * ((t - zeroFrac) / (1 - zeroFrac)); // 0 → -negMax
  vRamp.addColorStop(t, colorScale(value, extents.negMax, extents.posMax));
}
```

A `"0"` text tick is drawn beside the bar at `barTop + zeroFrac * vBarH`.

---

## PDF Report

The PDF report (`buildReportPdf`) always uses `"science-light"` regardless of
the user's palette selection. This is intentional — the PDF is meant for
scientific publication where the Science palette is the expected convention.

The PDF's legend (`drawLegend`) uses:
```ts
const scale = fingerprintColorScale("science-light");
scale((t * 2 - 1) * absMax, absMax, absMax)
// Symmetric → pass absMax as both negMax and posMax.
```

---

## ExportStage Pattern

`capturePlotsForExport` renders `FingerprintPlot` and `TimeSeriesPlot` into
off-screen DOM nodes at a fixed high DPI (`pixelRatio=3`) using a
`FixedThemeProvider(isLight=true)`. The resulting `dataUrl` is then embedded
in the PDF or ZIP.

Note: the `ExportStage` fingerprint is always light-themed (for PDF
consistency). If you need the export to honour `colormapId`, you would need
to pass `colormapId` into `capturePlotsForExport` and through to the
`FingerprintPlot` instance rendered there.

---

## Adding a New Export Format

1. Create `src/lib/export/myformat.ts` — pure function, no DOM deps.
2. Add to `DownloadButton.tsx`: new `useCallback` with all deps listed.
3. Add menu item in the JSX dropdown.
4. Write tests in `myformat.test.ts`.
5. If the format renders the fingerprint, pass `colormapId` through the full
   chain and add it to the `useCallback` dep array.
