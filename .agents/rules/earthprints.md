---
trigger: always_on
---

# EarthPrints — Project Rules

## Stack Quick Reference

- **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS v4**
- Map: **deck.gl** + **MapLibre GL** via `react-map-gl`
- Data: **zarrita.js** (Zarr v3 streaming, browser-native)
- Charts: **Recharts** | PDF: **jsPDF** | Tests: **vitest**
- Absolute imports: `@/` → `src/`

## Before Writing Next.js-Specific Code

Do **not** read the entire docs tree — it is 452 files / ~3 MB.  
Instead, look up only the specific doc for the API you are about to use:

```bash
# Find the relevant doc by keyword, then read just that file:
find node_modules/next/dist/docs -name '*.md' | xargs grep -l 'YOUR_TOPIC' | head -5
```

High-value files to know about:
- `01-app/01-getting-started/05-server-and-client-components.md` — "use client" rules
- `01-app/01-getting-started/06-fetching-data.md` — data fetching patterns
- `01-app/01-getting-started/08-caching.md` — caching semantics
- `01-app/01-getting-started/18-upgrading.md` — breaking changes vs older Next.js

## After Every Non-Trivial Change

```bash
npx tsc --noEmit    # catch type errors before runtime
npm run test        # confirm all 215 tests still pass
```

## Non-Negotiable Invariants

### Colour scale calls
Every call to `fingerprintColorScale(id)` returns a function that takes
`(value, negMax, posMax)` — three arguments, not two.  
For symmetric Science maps pass `absMax` as **both** `negMax` and `posMax`.  
For Flux pass separate values from `asymmetricExtents(values)`.

### Colorbar gradients
Never build a colorbar from 3 endpoint stops. Always sample the actual
`fingerprintColorScale` function at ≥16 evenly-spaced value positions,
using `zeroFrac` (= `negMax / (negMax + posMax)`) as the split pivot so the
"0" label and the gradient colour change coincide exactly.

### useCallback dependency arrays
Every variable captured inside a `useCallback` in `DownloadButton.tsx` must
appear in its dependency array. Missing `colormapId` is a known past bug —
do not repeat it. When in doubt, add the dep; React will deduplicate.

### "use client" directive
All interactive components (anything using `useState`, `useEffect`, `useRef`,
context, or event handlers) must have `"use client"` as the very first line.

### Export palette policy
- Square fingerprint badge: uses the user-selected `colormapId`.
- PDF report: always `"science-light"` (publication convention).
- XLSX / CSV: palette-independent (raw data only).

### Float32Array NaN handling
Ocean cells, bare-ground cells, and edge hours after local-time shifting are
`NaN`. Always guard with `Number.isFinite(v)` before arithmetic.
Never assume all values in a series are finite.

### Canvas HiDPI
Use the `pixelRatio` prop/parameter when sizing canvas contexts.
Never hardcode `devicePixelRatio` or `1` directly in render paths.

## Commit Style

- No `Co-Authored-By: Claude` or any AI trailer in commit messages.
- Do not set author/committer to an AI identity.

## Design Reference

Follow the Lovable design reference (local `*.html` files, gitignored) for all
UI/UX decisions — spacing, colour, motion, component behaviour, layout.
