export type CapturedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Serialized SVG loses the page stylesheet, so the font has to travel with it. */
const EXPORT_FONT_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** How long to wait for a frame that is not coming before carrying on anyway. */
const FRAME_FALLBACK_MS = 200;

/**
 * Resolve on the next animation frame, or on a timer once it is clear no frame
 * is coming. A hidden tab is served no frames at all, and a loop that waits on
 * one there never turns again, so an export left in the background would sit on
 * "Preparing…" for good rather than finishing or failing.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      resolve();
    };
    const frame = requestAnimationFrame(settle);
    const timer = setTimeout(settle, FRAME_FALLBACK_MS);
  });
}

/**
 * Resolve once the tab is being rendered again. Nothing offscreen lays out,
 * paints, or loads map tiles while the tab is hidden, so an export started
 * there can only wait for the user to come back.
 */
export function whenVisible(): Promise<void> {
  if (!document.hidden) return Promise.resolve();

  return new Promise((resolve) => {
    const onChange = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

/**
 * A container parked off the left edge of the page for the export-only React
 * roots to mount into. Offscreen rather than hidden: `display:none` and
 * `visibility:hidden` both stop ResizeObserver from reporting a size, which
 * every plot and the map need before they will draw.
 *
 * The caller removes it.
 */
export function createOffscreenHost(
  width: number,
  height?: number,
): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "-20000px",
    width: `${width}px`,
    ...(height === undefined ? {} : { height: `${height}px` }),
    background: "#ffffff",
    pointerEvents: "none",
  });
  document.body.appendChild(host);
  return host;
}

/**
 * Poll on animation frames until `predicate` holds. The offscreen plots need a
 * layout pass plus a paint before their SVG/canvas has real dimensions, and
 * there is no event that fires for "Recharts has finished measuring".
 */
export async function waitUntil(
  predicate: () => boolean,
  { timeoutMs = 3000, label = "render" }: { timeoutMs?: number; label?: string } = {},
): Promise<void> {
  let spent = 0;

  while (!predicate()) {
    if (spent > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    const before = performance.now();
    await nextFrame();
    // Time the tab spent hidden does not count against the budget: nothing was
    // being rendered, so the wait is the user's tab switch, not a stall.
    if (!document.hidden) spent += performance.now() - before;
  }
}

function drawToPng(
  source: CanvasImageSource,
  width: number,
  height: number,
  scale: number,
  background: string | null,
): CapturedImage {
  const target = document.createElement("canvas");
  target.width = Math.round(width * scale);
  target.height = Math.round(height * scale);

  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D context for export");

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, target.width, target.height);
  }
  ctx.drawImage(source, 0, 0, target.width, target.height);

  return { dataUrl: target.toDataURL("image/png"), width, height };
}

/**
 * Rasterise a live `<svg>` (the Recharts line chart) to a PNG.
 *
 * Everything Recharts styles comes through as presentation attributes, which
 * survive serialization. The font does not, so it is pinned on the clone.
 */
export async function svgToPng(
  svg: SVGSVGElement,
  { scale = 2, background = "#ffffff" }: { scale?: number; background?: string | null } = {},
): Promise<CapturedImage> {
  const rect = svg.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width === 0 || height === 0) throw new Error("Chart has no size to capture");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.style.fontFamily = EXPORT_FONT_STACK;

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    return drawToPng(image, width, height, scale, background);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Copy a canvas (the fingerprint heatmap, or the map) to a PNG.
 *
 * The source is already at device-pixel resolution, so it is copied at its
 * backing-store size and `scale` is left alone. `background` matters because
 * both sources can carry transparency that would otherwise show as black.
 */
export function canvasToPng(
  canvas: HTMLCanvasElement,
  { background = "#ffffff" }: { background?: string | null } = {},
): CapturedImage {
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Canvas has no size to capture");
  }
  return drawToPng(canvas, canvas.width, canvas.height, 1, background);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterise the chart SVG"));
    image.src = src;
  });
}
