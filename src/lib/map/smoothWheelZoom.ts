import type {
  LngLat,
  Map as MapLibreMap,
  MapLibreEvent,
  PointLike,
} from "maplibre-gl";

// Wheel pixels per zoom level. A mouse notch (~100px) moves half a level.
const PIXELS_PER_ZOOM_LEVEL = 200;
const PIXELS_PER_LINE = 33;
// Trackpad pinch arrives as ctrl+wheel with much smaller deltas.
const PINCH_MULTIPLIER = 8;
// Time constant of the glide toward the target zoom.
const GLIDE_TAU_MS = 90;
const SETTLE_EPSILON = 0.002;
const OWN_EVENT = { smoothWheelZoom: true };
// Pointing at space, `unproject` returns a location on the far side of the
// globe. Anchoring to it spins the globe away, so only anchor on locations
// comfortably on the visible face.
const MAX_ANCHOR_DISTANCE_DEG = 70;
// A single frame never needs a bigger correction than this; anything larger
// means the anchor cannot be held, and applying it would jump the map.
const MAX_CORRECTION_PX = 60;

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

type LonLat = [number, number];

function toVector([lon, lat]: LonLat): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  return [
    Math.cos(phi) * Math.cos(lambda),
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
  ];
}

export function angularDistanceDeg(a: LonLat, b: LonLat): number {
  const [ax, ay, az] = toVector(a);
  const [bx, by, bz] = toVector(b);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  return (Math.acos(dot) * 180) / Math.PI;
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
  let anchor: { lngLat: LngLat; point: [number, number] } | null = null;
  let frame = 0;
  let lastTime = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    target = null;
  };

  // `easeTo({ around })` is ignored under the globe projection, so keep the
  // cursor's location in place by hand: zoom, then shift the centre by how
  // far that location drifted on screen. Zooming out on the globe stays
  // centred, since a shrinking globe cannot keep a point under the cursor.
  const zoomAround = (zoom: number) => {
    const zoomingOut = zoom < map.getZoom();
    map.jumpTo({ zoom }, OWN_EVENT);
    if (!anchor) return;
    if (zoomingOut && map.getProjection().type === "globe") return;
    const drifted = map.project(anchor.lngLat);
    const dx = drifted.x - anchor.point[0];
    const dy = drifted.y - anchor.point[1];
    if (Math.hypot(dx, dy) > MAX_CORRECTION_PX) return;
    const centre = map.project(map.getCenter());
    const shifted: PointLike = [centre.x + dx, centre.y + dy];
    map.jumpTo({ center: map.unproject(shifted) }, OWN_EVENT);
  };

  const tick = (time: number) => {
    if (target === null) return stop();
    const current = map.getZoom();
    const done = Math.abs(target - current) < SETTLE_EPSILON;
    zoomAround(done ? target : glideStep(current, target, time - lastTime));
    lastTime = time;
    if (done) return stop();
    frame = requestAnimationFrame(tick);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const point: [number, number] = [
      event.clientX - rect.left,
      event.clientY - rect.top,
    ];
    const lngLat = map.unproject(point);
    const onVisibleFace =
      map.getProjection().type !== "globe" ||
      angularDistanceDeg(lngLat.toArray(), map.getCenter().toArray()) <
        MAX_ANCHOR_DISTANCE_DEG;
    anchor = onVisibleFace ? { lngLat, point } : null;
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
