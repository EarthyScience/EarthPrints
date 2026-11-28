export type TemperatureUnit = "K" | "°C" | "°F";

export const TEMPERATURE_UNITS: TemperatureUnit[] = ["K", "°C", "°F"];

// CF and common spellings of each scale, compared lowercased.
const SPELLINGS: Record<TemperatureUnit, string[]> = {
  K: ["k", "kelvin", "kelvins", "degk", "deg_k", "degrees_k"],
  "°C": [
    "°c",
    "degc",
    "deg_c",
    "deg c",
    "celsius",
    "degree_celsius",
    "degrees_celsius",
    "degree celsius",
    "degrees celsius",
  ],
  "°F": [
    "°f",
    "degf",
    "deg_f",
    "fahrenheit",
    "degree_fahrenheit",
    "degrees_fahrenheit",
  ],
};

/** The temperature scale a units string names, or null for anything else. */
export function temperatureUnitOf(units: string | null | undefined): TemperatureUnit | null {
  if (!units) return null;
  const key = units.trim().toLowerCase();
  for (const unit of TEMPERATURE_UNITS) {
    if (SPELLINGS[unit].includes(key)) return unit;
  }
  return null;
}

function toKelvin(value: number, from: TemperatureUnit): number {
  if (from === "°C") return value + 273.15;
  if (from === "°F") return (value - 32) * (5 / 9) + 273.15;
  return value;
}

function fromKelvin(value: number, to: TemperatureUnit): number {
  if (to === "°C") return value - 273.15;
  if (to === "°F") return (value - 273.15) * (9 / 5) + 32;
  return value;
}

export function convertTemperatures(
  values: Float32Array,
  from: TemperatureUnit,
  to: TemperatureUnit,
): Float32Array {
  if (from === to) return values;
  return values.map((value) => fromKelvin(toKelvin(value, from), to));
}
