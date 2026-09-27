"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/initMaplibre";
import { buildBakedReliefStyle } from "@/lib/map/reliefStyle";
import type { Theme } from "@/lib/theme";

const TILE_PX = 512;

declare global {
  interface Window {
    renderReliefTile?: (z: number, x: number, y: number) => Promise<string>;
  }
}

function tileCenter(z: number, x: number, y: number): [number, number] {
  const n = 2 ** z;
  const lon = ((x + 0.5) / n) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return [lon, lat];
}

function nextRender(map: MapLibreMap) {
  return new Promise<void>((resolve) => {
    map.once("render", () => resolve());
    map.triggerRepaint();
  });
}

export function ReliefRenderer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme: Theme = params.get("theme") === "dark" ? "dark" : "light";
    const quality = Number(params.get("quality") ?? 0.9);
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: buildBakedReliefStyle(theme),
      pixelRatio: 1,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    const ready = new Promise<void>((resolve) =>
      map.once("load", () => resolve()),
    );

    window.renderReliefTile = async (z, x, y) => {
      await ready;
      map.jumpTo({ center: tileCenter(z, x, y), zoom: z });
      // Not `idle`: it fires once per burst of activity, so a tile that is
      // ready quickly can miss it. Poll the load state instead.
      await nextRender(map);
      while (!map.loaded() || !map.areTilesLoaded()) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await nextRender(map);
      return map.getCanvas().toDataURL("image/webp", quality);
    };

    return () => {
      delete window.renderReliefTile;
      map.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: TILE_PX, height: TILE_PX, position: "fixed", inset: 0 }}
    />
  );
}
