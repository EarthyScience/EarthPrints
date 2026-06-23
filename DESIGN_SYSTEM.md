# EarthPrints Design System

Single source of truth for visual consistency across marketing pages, the map, and canvas/WebGL code.

## File map

| File | Purpose |
|---|---|
| `src/styles/tokens.css` | CSS custom properties (colors, spacing, type, motion, map chrome) |
| `src/styles/primitives.css` | Reusable UI patterns (`.island`, `.ds-kicker`, …) |
| `src/lib/design-system/tokens.ts` | Same values for TypeScript / canvas / deck.gl |
| `src/app/globals.css` | Page-specific layout; imports tokens + primitives |

## Colors

Black / white surfaces with a teal accent:

- **Light mode accent:** `#006C66` (`--accent-solid`, `--accent`)
- **Dark mode accent:** `#52D4C8` (`--accent` on dark backgrounds)

Use semantic tokens, not raw hex, in new CSS:

| Token | Use for |
|---|---|
| `--text` | Primary copy |
| `--text-secondary` | Body subtitles, hints |
| `--text-muted` | Large labels only (18px+) |
| `--text-dim` | Decorative only — never body text |
| `--accent` | Links, active states, data highlights |
| `--surface` / `--surface-2` | Nested backgrounds, hovers |
| `--elevated-bg` + `--elevated-border` | Floating panels and chips |

## Spacing & radius

```css
--space-1 … --space-6     /* 4px → 24px */
--space-page-x              /* horizontal inset for map chrome */
--radius-sm | md | lg | pill
```

## Typography primitives

| Class | Use for |
|---|---|
| `.ds-brand-word` | “EarthPrints” wordmark (nav, map chip, footer) |
| `.ds-title` | Panel headings (“Pixel location”) |
| `.ds-kicker` | Uppercase dataset / status pills (`FLUXCOM-X NEE`) |
| `.ds-label` | Form section labels (`History window`) |
| `.ds-hint` | Secondary explanatory copy |

Pair layout-specific classes when needed: `className="ds-title map-readout-title"`.

## Surfaces

| Class | Use for |
|---|---|
| `.island` / `.map-island` | Glass panels on the map (readout, menu) |
| `.elevated-chip` / `.map-nav-chip` | Top chrome pills (brand, menu trigger) |
| `.ds-nav-link` | Vertical nav items in map menu |

## Map layout tokens

```css
--map-chrome-top / --map-chrome-height   /* top row reserved for brand + menu */
--map-panel-top                          /* panels start below chrome */
```

Do not place content over the top-left brand chip.

## TypeScript usage

```ts
import { accentRgb, primitives } from "@/lib/design-system/tokens";

// deck.gl layer color
getLineColor: [...accentRgb.onDark, 255]

// React class names
<aside className={`map-readout ${primitives.island}`} />
```

Legacy imports from `@/lib/constants/theme` still work — they re-export from the design system.

## Adding new UI

1. Check `primitives.css` for an existing pattern before writing one-off styles.
2. Use tokens for spacing, radius, and color — avoid magic numbers in `globals.css`.
3. If a pattern appears twice, add a `.ds-*` primitive and document it in this file.
