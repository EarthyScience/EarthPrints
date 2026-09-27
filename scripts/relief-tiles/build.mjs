// Pre-renders the relief (ocean, tint, hillshade) into raster tiles and packs
// them as one PMTiles archive per theme.
//
//   npm run dev                       # the renderer page runs on the dev server
//   node scripts/relief-tiles/build.mjs [--themes light,dark] [--maxzoom 6]
//
// Rendered tiles are cached in out/relief-tiles/<theme>/, so an interrupted
// run resumes where it stopped. Archives land in out/relief-tiles/ as
// relief-<theme>-v<RELIEF_TILES_VERSION>.pmtiles, ready to upload.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { TILE_TYPE_WEBP, writePmtiles } from "./pmtiles.mjs";

const { values: args } = parseArgs({
  options: {
    themes: { type: "string", default: "light,dark" },
    maxzoom: { type: "string", default: "6" },
    tabs: { type: "string", default: "4" },
    quality: { type: "string", default: "0.9" },
    server: { type: "string", default: "http://localhost:3000" },
    out: { type: "string", default: "out/relief-tiles" },
  },
});

// Archive names carry the version the map requests, read from the style so
// the two cannot drift apart.
const RELIEF_TILES_VERSION = (
  await readFile("src/lib/map/reliefStyle.ts", "utf8")
).match(/RELIEF_TILES_VERSION = (\d+)/)?.[1];
if (!RELIEF_TILES_VERSION) throw new Error("RELIEF_TILES_VERSION not found");

const MAX_ZOOM = Number(args.maxzoom);
const TABS = Number(args.tabs);
const TILE_PX = 512;
// A tile request occasionally never settles, which would stall its tab.
const TILE_TIMEOUT_MS = 30_000;
const TILE_ATTEMPTS = 3;

function* pyramid(maxZoom) {
  for (let z = 0; z <= maxZoom; z++) {
    for (let x = 0; x < 2 ** z; x++) {
      for (let y = 0; y < 2 ** z; y++) yield { z, x, y };
    }
  }
}

const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function renderTheme(browser, theme) {
  const dir = join(args.out, theme);
  const tiles = [...pyramid(MAX_ZOOM)];
  const pending = [];
  for (const tile of tiles) {
    tile.path = join(dir, `${tile.z}/${tile.x}/${tile.y}.webp`);
    if (!(await exists(tile.path))) pending.push(tile);
  }
  console.log(`${theme}: ${tiles.length} tiles, ${pending.length} to render`);

  let done = 0;
  const started = Date.now();
  const worker = async () => {
    const page = await browser.newPage({
      viewport: { width: TILE_PX, height: TILE_PX },
    });
    const open = async () => {
      await page.goto(
        `${args.server}/relief-render?theme=${theme}&quality=${args.quality}`,
      );
      await page.waitForFunction(() => window.renderReliefTile, null, {
        timeout: 120_000,
      });
    };
    const render = async (tile) => {
      for (let attempt = 1; ; attempt++) {
        let timer;
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("timed out")),
            TILE_TIMEOUT_MS,
          );
        });
        try {
          return await Promise.race([
            page.evaluate(
              ({ z, x, y }) => window.renderReliefTile(z, x, y),
              tile,
            ),
            timeout,
          ]);
        } catch (error) {
          if (attempt === TILE_ATTEMPTS) throw error;
          console.warn(`  retrying ${tile.z}/${tile.x}/${tile.y}: ${error}`);
          await open();
        } finally {
          clearTimeout(timer);
        }
      }
    };
    await open();
    for (let tile = pending.shift(); tile; tile = pending.shift()) {
      const dataUrl = await render(tile);
      await mkdir(dirname(tile.path), { recursive: true });
      await writeFile(tile.path, Buffer.from(dataUrl.split(",")[1], "base64"));
      if (++done % 250 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${done} rendered, ${rate.toFixed(1)} tiles/s`);
      }
    }
    await page.close();
  };
  await Promise.all(Array.from({ length: TABS }, worker));

  const archive = writePmtiles(
    await Promise.all(
      tiles.map(async (tile) => ({ ...tile, data: await readFile(tile.path) })),
    ),
    {
      tileType: TILE_TYPE_WEBP,
      metadata: {
        name: `EarthPrints relief (${theme})`,
        attribution: "© Mapterhorn",
        tileSize: TILE_PX,
      },
    },
  );
  const archivePath = join(
    args.out,
    `relief-${theme}-v${RELIEF_TILES_VERSION}.pmtiles`,
  );
  await writeFile(archivePath, archive);
  console.log(
    `${theme}: wrote ${archivePath} (${(archive.length / 1e6).toFixed(1)} MB)`,
  );
}

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
try {
  for (const theme of args.themes.split(",")) await renderTheme(browser, theme);
} finally {
  await browser.close();
}
