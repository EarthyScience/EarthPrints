// Minimal PMTiles v3 writer: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const HEADER_BYTES = 127;
const ROOT_DIRECTORY_MAX_BYTES = 16384 - HEADER_BYTES;
const LEAF_ENTRIES = 4096;
const COMPRESSION_NONE = 1;
const COMPRESSION_GZIP = 2;
export const TILE_TYPE_WEBP = 4;

export function zxyToTileId(z, x, y) {
  let base = 0;
  for (let level = 0; level < z; level++) base += 4 ** level;
  let d = 0;
  const n = 2 ** z;
  let tx = x;
  let ty = y;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (tx & s) > 0 ? 1 : 0;
    const ry = (ty & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        tx = s - 1 - tx;
        ty = s - 1 - ty;
      }
      [tx, ty] = [ty, tx];
    }
  }
  return base + d;
}

function varints(values) {
  const bytes = [];
  for (let value of values) {
    while (value >= 0x80) {
      bytes.push((value % 0x80) | 0x80);
      value = Math.floor(value / 0x80);
    }
    bytes.push(value);
  }
  return Buffer.from(bytes);
}

function serializeDirectory(entries) {
  const values = [entries.length];
  let lastId = 0;
  for (const entry of entries) {
    values.push(entry.tileId - lastId);
    lastId = entry.tileId;
  }
  for (const entry of entries) values.push(entry.runLength);
  for (const entry of entries) values.push(entry.length);
  entries.forEach((entry, i) => {
    const previous = entries[i - 1];
    const contiguous =
      previous && entry.offset === previous.offset + previous.length;
    values.push(contiguous ? 0 : entry.offset + 1);
  });
  return gzipSync(varints(values));
}

function buildDirectories(entries) {
  const root = serializeDirectory(entries);
  if (root.length <= ROOT_DIRECTORY_MAX_BYTES) {
    return { root, leaves: Buffer.alloc(0) };
  }
  const rootEntries = [];
  const leafChunks = [];
  let leafOffset = 0;
  for (let i = 0; i < entries.length; i += LEAF_ENTRIES) {
    const leaf = serializeDirectory(entries.slice(i, i + LEAF_ENTRIES));
    rootEntries.push({
      tileId: entries[i].tileId,
      offset: leafOffset,
      length: leaf.length,
      runLength: 0,
    });
    leafChunks.push(leaf);
    leafOffset += leaf.length;
  }
  return {
    root: serializeDirectory(rootEntries),
    leaves: Buffer.concat(leafChunks),
  };
}

function header(fields) {
  const buf = Buffer.alloc(HEADER_BYTES);
  buf.write("PMTiles", 0, "ascii");
  buf.writeUInt8(3, 7);
  const u64 = [
    fields.rootOffset,
    fields.rootLength,
    fields.metadataOffset,
    fields.metadataLength,
    fields.leavesOffset,
    fields.leavesLength,
    fields.dataOffset,
    fields.dataLength,
    fields.addressedTiles,
    fields.tileEntries,
    fields.tileContents,
  ];
  u64.forEach((value, i) => buf.writeBigUInt64LE(BigInt(value), 8 + i * 8));
  let at = 96;
  for (const byte of [
    1,
    COMPRESSION_GZIP,
    COMPRESSION_NONE,
    fields.tileType,
    fields.minZoom,
    fields.maxZoom,
  ]) {
    buf.writeUInt8(byte, at++);
  }
  for (const degrees of [-180, -85.0511287, 180, 85.0511287]) {
    buf.writeInt32LE(Math.round(degrees * 1e7), at);
    at += 4;
  }
  buf.writeUInt8(0, at++);
  buf.writeInt32LE(0, at);
  buf.writeInt32LE(0, at + 4);
  return buf;
}

/**
 * tiles: [{ z, x, y, data: Buffer }]. Identical tiles (open ocean) are
 * stored once, and consecutive identical tiles collapse into one entry.
 */
export function writePmtiles(tiles, { tileType, metadata }) {
  const sorted = tiles
    .map((tile) => ({ ...tile, tileId: zxyToTileId(tile.z, tile.x, tile.y) }))
    .sort((a, b) => a.tileId - b.tileId);

  const chunks = [];
  const offsetsByHash = new Map();
  const entries = [];
  let dataLength = 0;
  for (const tile of sorted) {
    const hash = createHash("sha256").update(tile.data).digest("hex");
    let offset = offsetsByHash.get(hash);
    if (offset === undefined) {
      offset = dataLength;
      offsetsByHash.set(hash, offset);
      chunks.push(tile.data);
      dataLength += tile.data.length;
    }
    const last = entries.at(-1);
    if (
      last &&
      last.offset === offset &&
      last.tileId + last.runLength === tile.tileId
    ) {
      last.runLength++;
    } else {
      entries.push({
        tileId: tile.tileId,
        offset,
        length: tile.data.length,
        runLength: 1,
      });
    }
  }

  const { root, leaves } = buildDirectories(entries);
  const meta = gzipSync(Buffer.from(JSON.stringify(metadata)));
  const zooms = sorted.map((tile) => tile.z);
  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + root.length;
  const leavesOffset = metadataOffset + meta.length;
  const dataOffset = leavesOffset + leaves.length;

  return Buffer.concat([
    header({
      rootOffset,
      rootLength: root.length,
      metadataOffset,
      metadataLength: meta.length,
      leavesOffset,
      leavesLength: leaves.length,
      dataOffset,
      dataLength,
      addressedTiles: sorted.length,
      tileEntries: entries.length,
      tileContents: chunks.length,
      tileType,
      minZoom: Math.min(...zooms),
      maxZoom: Math.max(...zooms),
    }),
    root,
    meta,
    leaves,
    ...chunks,
  ]);
}
