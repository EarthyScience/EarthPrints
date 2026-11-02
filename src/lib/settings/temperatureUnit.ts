import { TEMPERATURE_UNITS, type TemperatureUnit } from "@/lib/zarr/temperature";

export const TEMPERATURE_UNIT_STORAGE_KEY = "earthprints:temperature-unit";

/** Read the stored temperature unit preference, or `null` if none. */
export function loadTemperatureUnit(): TemperatureUnit | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(TEMPERATURE_UNIT_STORAGE_KEY);
    return TEMPERATURE_UNITS.find((unit) => unit === stored) ?? null;
  } catch {
    // Private-browsing or quota errors; ignore.
    return null;
  }
}

export function saveTemperatureUnit(unit: TemperatureUnit): void {
  try {
    localStorage.setItem(TEMPERATURE_UNIT_STORAGE_KEY, unit);
  } catch {
    // Ignore storage errors.
  }
}
