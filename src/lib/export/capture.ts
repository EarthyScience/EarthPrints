export type CapturedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Serialized SVG loses the page stylesheet, so the font has to travel with it. */
const EXPORT_FONT_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
  const deadline = performance.now() + timeoutMs;

  while (!predicate()) {
    if (performance.now() > deadline) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await nextFrame();
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
