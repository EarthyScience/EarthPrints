import { describe, expect, it } from "vitest";
import { convertTemperatures, temperatureUnitOf } from "@/lib/zarr/temperature";

describe("temperatureUnitOf", () => {
  it("reads CF and common spellings", () => {
    expect(temperatureUnitOf("K")).toBe("K");
    expect(temperatureUnitOf("kelvin")).toBe("K");
    expect(temperatureUnitOf("degC")).toBe("°C");
    expect(temperatureUnitOf("degrees_Celsius")).toBe("°C");
    expect(temperatureUnitOf("degF")).toBe("°F");
  });

  it("ignores other units", () => {
    expect(temperatureUnitOf("kg m-2 s-1")).toBeNull();
    expect(temperatureUnitOf("Pa")).toBeNull();
    expect(temperatureUnitOf(null)).toBeNull();
  });
});

describe("convertTemperatures", () => {
  it("converts between the three scales", () => {
    const kelvin = Float32Array.of(273.15, 373.15);
    const celsius = convertTemperatures(kelvin, "K", "°C");
    expect(celsius[0]).toBeCloseTo(0, 3);
    expect(celsius[1]).toBeCloseTo(100, 3);
    const fahrenheit = convertTemperatures(kelvin, "K", "°F");
    expect(fahrenheit[0]).toBeCloseTo(32, 3);
    expect(fahrenheit[1]).toBeCloseTo(212, 3);
    expect(convertTemperatures(Float32Array.of(32), "°F", "°C")[0]).toBeCloseTo(0, 4);
  });

  it("keeps gaps and returns the input when nothing changes", () => {
    const values = Float32Array.of(NaN, 280);
    expect(Number.isNaN(convertTemperatures(values, "K", "°C")[0])).toBe(true);
    expect(convertTemperatures(values, "K", "K")).toBe(values);
  });
});
