export type CapturedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

const EXPORT_FONT_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const FRAME_FALLBACK_MS = 200;

// Hidden tabs get no animation frames, so a timer stands in for them.
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

// Offscreen rather than hidden: display:none stops ResizeObserver reporting a size.
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

export async function waitUntil(
  predicate: () => boolean,
  {
    timeoutMs = 3000,
    label = "render",
  }: { timeoutMs?: number; label?: string } = {},
): Promise<void> {
  let spent = 0;

  while (!predicate()) {
    if (spent > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    const before = performance.now();
    await nextFrame();
    if (!document.hidden) spent += performance.now() - before;
  }
}

const PAINT_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "opacity",
  "font-size",
  "font-weight",
] as const;

// A serialized SVG loses CSS variables and classes, so paint is inlined.
function inlinePaint(source: SVGSVGElement, clone: SVGSVGElement) {
  const from = source.querySelectorAll("*");
  const to = clone.querySelectorAll("*");
  from.forEach((element, index) => {
    const target = to[index];
    if (!target) return;
    const style = getComputedStyle(element);
    for (const property of PAINT_PROPERTIES) {
      target.setAttribute(property, style.getPropertyValue(property));
    }
  });
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

export async function svgToPng(
  svg: SVGSVGElement,
  {
    scale = 2,
    background = "#ffffff",
  }: { scale?: number; background?: string | null } = {},
): Promise<CapturedImage> {
  const rect = svg.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width === 0 || height === 0)
    throw new Error("Chart has no size to capture");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlinePaint(svg, clone);
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
    image.onerror = () =>
      reject(new Error("Could not rasterise the chart SVG"));
    image.src = src;
  });
}
