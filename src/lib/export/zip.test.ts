import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { blobToBytes, buildZip, dataUrlToBytes } from "@/lib/export/zip";

/** 1x1 red PNG, the same fixture the PDF test decodes. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const text = (value: string) => new TextEncoder().encode(value);

async function entriesOf(blob: Blob) {
  return unzipSync(await blobToBytes(blob));
}

describe("dataUrlToBytes", () => {
  it("recovers the PNG signature from a data URL", () => {
    const bytes = dataUrlToBytes(PNG);

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("refuses a string that is not a data URL", () => {
    expect(() => dataUrlToBytes("iVBORw0KGgo")).toThrow("Not a data URL");
  });
});

describe("buildZip", () => {
  it("hands back an archive the browser will save as a zip", async () => {
    const blob = await buildZip([{ name: "a.txt", data: text("hello") }]);
    const bytes = await blobToBytes(blob);

    expect(blob.type).toBe("application/zip");
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("round-trips every entry byte for byte", async () => {
    const csv = text("timestamp_utc,value\n2025-01-01T00:00:00.000Z,1.5\n");
    const png = dataUrlToBytes(PNG);

    const unzipped = await entriesOf(
      await buildZip([
        { name: "series.csv", data: csv },
        { name: "plot.png", data: png, stored: true },
      ]),
    );

    expect(Object.keys(unzipped).sort()).toEqual(["plot.png", "series.csv"]);
    expect(unzipped["series.csv"]).toEqual(csv);
    expect(unzipped["plot.png"]).toEqual(png);
  });

  // Storing the already-compressed entries is the whole reason `stored` exists,
  // so it has to actually reach fflate rather than silently deflate anyway.
  it("stores an entry verbatim when asked, and deflates when not", async () => {
    const repetitive = text("x".repeat(4096));

    const [deflated, stored] = await Promise.all([
      buildZip([{ name: "d", data: repetitive }]),
      buildZip([{ name: "d", data: repetitive, stored: true }]),
    ]);

    expect(stored.size).toBeGreaterThan(repetitive.length);
    expect(deflated.size).toBeLessThan(repetitive.length);
    expect((await entriesOf(stored))["d"]).toEqual(repetitive);
    expect((await entriesOf(deflated))["d"]).toEqual(repetitive);
  });

  it("keeps the export's flat layout, with no enclosing folder", async () => {
    const base = "earthprints_NEE_50.925N_11.575E_2025-01-01_2025-12-31";
    const unzipped = await entriesOf(
      await buildZip([
        { name: `${base}.csv`, data: text("a") },
        { name: `${base}_fingerprint.png`, data: text("b") },
      ]),
    );

    expect(Object.keys(unzipped).every((name) => !name.includes("/"))).toBe(
      true,
    );
  });
});
