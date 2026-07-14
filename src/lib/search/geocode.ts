// Geocoding helpers for the map search box. Address lookups use Nominatim
// (OpenStreetMap) — keyless and CORS-enabled, matching the keyless OpenFreeMap
// tiles the map already uses. Raw coordinate input is parsed locally.

export type SearchResult = {
  id: string;
  /** Primary line, e.g. "Jena". */
  label: string;
  /** Secondary greyed line, e.g. "Thuringia · Germany" or "Coordinates". */
  detail: string;
  lon: number;
  lat: number;
};

// Accepts "lat, lon", "lat lon", or "lat; lon" with an optional leading sign.
const COORD_PATTERN =
  /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseCoordinates(query: string): SearchResult | null {
  const match = query.match(COORD_PATTERN);
  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return {
    id: `coord:${lat},${lon}`,
    label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    detail: "Coordinates",
    lon,
    lat,
  };
}

type NominatimPlace = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function toResult(place: NominatimPlace): SearchResult {
  const parts = place.display_name.split(", ");
  const label = place.name?.trim() || parts[0] || place.display_name;
  const rest = parts[0] === label ? parts.slice(1) : parts;
  const detail = rest.slice(0, 3).join(" · ");

  return {
    id: `osm:${place.place_id}`,
    label,
    detail,
    lon: Number(place.lon),
    lat: Number(place.lat),
  };
}

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "6",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Search request failed");
  }

  const data = (await response.json()) as NominatimPlace[];
  return data
    .map(toResult)
    .filter((result) => Number.isFinite(result.lon) && Number.isFinite(result.lat));
}
