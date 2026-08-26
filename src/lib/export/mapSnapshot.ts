import type { StyleSpecification } from "maplibre-gl";

/** Used when the style has not loaded, or carries no attribution of its own. */
const FALLBACK_ATTRIBUTION =
  "OpenFreeMap, OpenMapTiles, OpenStreetMap contributors";

export type MapSnapshot = {
  canvas: HTMLCanvasElement;
  attribution: string;
};

/** Style attributions ship as HTML anchors; a PDF footer wants the words only. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gather the basemap credits owed by the tiles in the current style.
 *
 * The on-screen map hides its attribution control, but a PDF is a file that
 * leaves the app, so the credit has to travel in it.
 */
export function collectAttribution(
  sources?: StyleSpecification["sources"],
): string {
  if (!sources) return FALLBACK_ATTRIBUTION;

  const credits = new Set<string>();
  for (const source of Object.values(sources)) {
    const raw = (source as { attribution?: string }).attribution;
    const text = raw ? plainText(raw) : "";
    if (text) credits.add(text);
  }

  return credits.size > 0
    ? Array.from(credits).join(", ")
    : FALLBACK_ATTRIBUTION;
}
