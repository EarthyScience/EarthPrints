import type { LngLat, Map as MapLibreMap, MapLibreEvent } from "maplibre-gl";

// Wheel pixels per zoom level. A mouse notch (~100px) moves half a level.
const PIXELS_PER_ZOOM_LEVEL = 200;
const PIXELS_PER_LINE = 33;
// Trackpad pinch arrives as ctrl+wheel with much smaller deltas.
const PINCH_MULTIPLIER = 8;
// Time constant of the glide toward the target zoom.
const GLIDE_TAU_MS = 90;
const SETTLE_EPSILON = 0.002;
const OWN_EVENT = { smoothWheelZoom: true };

type WheelLike = Pick<WheelEvent, "deltaY" | "deltaMode" | "ctrlKey">;

export function wheelZoomDelta(event: WheelLike, pageHeight: number): number {
  let pixels = event.deltaY;
  if (event.deltaMode === 1) pixels *= PIXELS_PER_LINE;
  else if (event.deltaMode === 2) pixels *= pageHeight;
  if (event.ctrlKey) pixels *= PINCH_MULTIPLIER;
  return -pixels / PIXELS_PER_ZOOM_LEVEL;
}

export function glideStep(current: number, target: number, dtMs: number) {
  return current + (target - current) * (1 - Math.exp(-dtMs / GLIDE_TAU_MS));
}

/**
 * Replaces MapLibre's scroll zoom, which applies trackpad-classified wheel
 * events instantly and so steps on many mice. Every wheel event moves a
 * target zoom, and the camera glides to it each frame around the cursor.
 */
export function attachSmoothWheelZoom(map: MapLibreMap): () => void {
  map.scrollZoom.disable();
  const container = map.getCanvasContainer();
  let target: number | null = null;
  let around: LngLat | null = null;
  let frame = 0;
  let lastTime = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    target = null;
  };

  const tick = (time: number) => {
    if (target === null || around === null) return stop();
    const current = map.getZoom();
    const done = Math.abs(target - current) < SETTLE_EPSILON;
    const zoom = done ? target : glideStep(current, target, time - lastTime);
    lastTime = time;
    map.easeTo({ zoom, around, duration: 0 }, OWN_EVENT);
    if (done) return stop();
    frame = requestAnimationFrame(tick);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    around = map.unproject([
      event.clientX - rect.left,
      event.clientY - rect.top,
    ]);
    const base = target ?? map.getZoom();
    target = Math.min(
      map.getMaxZoom(),
      Math.max(
        map.getMinZoom(),
        base + wheelZoomDelta(event, window.innerHeight),
      ),
    );
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  // Any other camera move (drag, locate, view switch) takes over.
  const onMoveStart = (
    event: MapLibreEvent & { smoothWheelZoom?: boolean },
  ) => {
    if (!event.smoothWheelZoom) stop();
  };

  container.addEventListener("wheel", onWheel, { passive: false });
  map.on("movestart", onMoveStart);
  return () => {
    stop();
    container.removeEventListener("wheel", onWheel);
    map.off("movestart", onMoveStart);
  };
}
