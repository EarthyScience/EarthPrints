import type { ZipOptions, Zippable } from "fflate";

export type ZipEntry = {
  /** Path inside the archive. Flat here: no directory separators. */
  name: string;
  data: Uint8Array;
  /**
   * Skip deflate. PDF, XLSX and PNG all carry their own compression, so
   * re-deflating them costs time and wins back almost nothing; the CSV is the
   * only entry worth squeezing.
   */
  stored?: boolean;
};

/** fflate's level scale: 0 stores verbatim, 6 is its default deflate. */
const STORE = 0;
const DEFLATE = 6;

/**
 * Pull the bytes back out of one of the `image/png` data URLs `CapturedImage`
 * carries, so a plot already rasterised for the report can go into the archive
 * without being drawn a second time.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Not a data URL");

  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** The builders hand back Blobs; the zip wants bytes. */
export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Pack the entries into a single archive. Imports fflate lazily, the way the
 * PDF and workbook builders import theirs, to keep it off the map route's
 * first load.
 *
 * `zipSync` rather than the async worker-backed `zip`: only the CSV actually
 * deflates, so the main thread pause is small and predictable, and there is no
 * inlined worker for the bundler to get wrong.
 */
export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const { zipSync } = await import("fflate");

  const files: Zippable = {};
  for (const entry of entries) {
    const options: ZipOptions = { level: entry.stored ? STORE : DEFLATE };
    files[entry.name] = [entry.data, options];
  }

  return new Blob([zipSync(files)], { type: "application/zip" });
}
