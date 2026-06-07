# EarthPrints

> **POC Research** — Browser-based exploration and insight generation for environmental fingerprints and Flux tower footprints.

EarthPrints brings together global climate datasets and eddy-covariance flux tower measurements into an interactive, browser-native geospatial tool. The core idea: click any pixel on a global map and instantly see that pixel's environmental "fingerprint" — a composite view of climate variables over time — alongside the spatial footprint of nearby flux towers.

### Two pillars

| Pillar | What it is | Data source |
|---|---|---|
| **Climate Fingerprints** | Per-pixel time-series of global variables (temperature, precipitation, NEE, …) rendered as heatmaps / charts | In-house Zarr archives, streamed via `zarrita.js` |
| **Flux Tower Footprints** | Probabilistic source-area footprints from eddy-covariance towers, visualised as heatmaps overlaid on the map | Pre-computed outputs + optional on-the-fly computation via [Kljun FFP](https://footprint.kljun.net/) |

---

## Features

- **Global map tiles** — GPU-accelerated rendering with [deck.gl](https://deck.gl)
- **Climate variable overlays** — stream and slice multidimensional Zarr arrays in-browser with [zarrita.js](https://github.com/manzt/zarrita.js)
- **Click-to-pick pixel selection** — point-and-click to select any grid cell
- **On-demand data fetch** — lazy-load only the slices you need
- **Array reshaping & computation** — TypeScript (and optionally WebGPU) for in-browser array math
- **Popup heatmap / time-series** — interactive charts rendered per selected pixel
- **Export** — download selected data slices or rendered visualisations

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Map & GPU rendering | [deck.gl](https://deck.gl) |
| Zarr streaming | [zarrita.js](https://github.com/manzt/zarrita.js) |
| Array compute | TypeScript / WebGPU (TBD) |
| Charting | TBD (e.g. Observable Plot, Recharts) |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (or pnpm / yarn / bun)

### Install

```bash
git clone https://github.com/EarthyScience/EarthPrints.git
cd EarthPrints
npm install
```

### Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other commands

```bash
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint
```

---

## CI/CD

Pull requests targeting `main` must pass required checks before merge is allowed.

| Workflow | Trigger | Purpose |
|---|---|---|
| **CI** | Pull request | Lint, build, and optional Vercel preview deploy |
| **Deploy to Vercel** | Push to `main` | Production deploy after verify passes |
| **Branch protection** | Push to `main` (when workflow changes) | Keeps `main` protected with required checks |
| **Dependabot** | Weekly schedule | Opens dependency update PRs |

### Required checks

Merges to `main` are blocked unless this check passes:

- **Lint and build** — ESLint + production build (`CI` workflow)

Dependabot PRs follow the same rule: they cannot merge until **Lint and build** passes.

Preview deployments are informational only and do not block merge.

### Repository secrets

Production and preview deploys require these GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Branch protection

The `Branch protection` workflow applies a ruleset to the default branch that requires:

- Pull requests before merging
- Passing **Lint and build**
- No direct pushes or force-pushes to `main`

Run it manually from **Actions → Branch protection → Run workflow** if the ruleset is missing after the first merge to `main`.

In **Settings → Actions → General**, allow workflows to write repository administration settings so branch protection can be managed automatically.

---

## Data Sources

- **Flux tower footprint model** — Kljun et al. (2015), online calculator: https://footprint.kljun.net/
- **FLUXNET / global flux tower dataset** — Zenodo archive: https://zenodo.org/records/816236
- **Global climate variables** — in-house Zarr archives (temperature, precipitation, NEE, and more)
- **Flux tower footprint paper** — https://www.nature.com/articles/s41597-024-03291-3

---

## Roadmap

- [ ] Deck.gl base map with tile layer
- [ ] Zarr overlay for at least one climate variable
- [ ] Click-pick pixel interaction
- [ ] Fingerprint heatmap popup
- [ ] Flux tower footprint overlay
- [ ] On-the-fly footprint computation (time permitting)
- [ ] Spectral / math analysis (SpectraScope-style, time permitting)
- [ ] Export (CSV / PNG)

---

## Project Structure

```
src/
├── app/               # Next.js App Router pages & layouts
├── components/        # Reusable UI components
├── lib/               # Data fetching, Zarr helpers, array compute
└── types/             # Shared TypeScript types
```

---

## References

- Kljun, N. et al. (2015). A simple two-dimensional parameterisation for Flux Footprint Prediction (FFP). *Geoscientific Model Development*, 8, 3695–3713.
- FLUXNET global dataset — https://zenodo.org/records/816236
- Flux tower footprint dataset paper — https://www.nature.com/articles/s41597-024-03291-3
