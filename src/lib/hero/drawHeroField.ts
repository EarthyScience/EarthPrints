import { fbm } from "@/lib/hero/noise";

const HERO_SEED = 41.7;

function readHeroTokens(isLight: boolean) {
  return {
    baseFill: isLight ? "#F4F4F2" : "#070707",          // --bg-deep
    dotFaint: isLight
      ? "rgba(10,10,10,.05)"
      : "rgba(255,255,255,.045)",                        // --grid-line tint
    gridLine: isLight
      ? "rgba(10,10,10,.05)"
      : "rgba(255,255,255,.05)",                         // --grid-line
    tealRgb: isLight
      ? ([0, 108, 102] as [number, number, number])      // --accent-solid / TEAL_RGB
      : ([82, 212, 200] as [number, number, number]),    // --accent / TEAL_ON_DARK_RGB
    coldRgb: isLight
      ? ([120, 120, 118] as [number, number, number])    // COLD_RGB.light
      : ([150, 150, 150] as [number, number, number]),   // COLD_RGB.dark
    tealGlowDark: isLight
      ? (t: number) => `rgba(0,108,102,${(t - 0.8) * 0.5})`    // TEAL_RGB
      : (t: number) => `rgba(82,212,200,${(t - 0.8) * 0.45})`, // TEAL_ON_DARK_RGB
    dotAlphaBase: isLight ? 0.1 : 0.16,
    dotAlphaScale: isLight ? 0.55 : 0.72,
  };
}

export function drawHeroField(
  canvas: HTMLCanvasElement,
  isLight: boolean,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const tok = readHeroTokens(isLight);

  ctx.fillStyle = tok.baseFill;
  ctx.fillRect(0, 0, w, h);

  const step = Math.max(17, Math.round(w / 74));
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;

  const cold = tok.coldRgb;
  const teal = tok.tealRgb;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * step;
      const y = j * step;

      let n = fbm(i * 0.11 + 0.5, j * 0.13 + 0.5, HERO_SEED);
      const dx = x / w - 0.24;
      const dy = y / h - 0.78;
      const band = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.5);
      n = Math.min(1, n * 0.85 + band * 0.5);

      const t = Math.max(0, (n - 0.34) / 0.66);

      if (t <= 0.02) {
        ctx.fillStyle = tok.dotFaint;
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, 6.283);
        ctx.fill();
        continue;
      }

      const r = 0.9 + t * 2.6;
      const mix = Math.pow(t, 1.3);
      const cr = Math.round(cold[0] + (teal[0] - cold[0]) * mix);
      const cg = Math.round(cold[1] + (teal[1] - cold[1]) * mix);
      const cb = Math.round(cold[2] + (teal[2] - cold[2]) * mix);
      const a = tok.dotAlphaBase + t * tok.dotAlphaScale;

      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();

      if (t > 0.8) {
        ctx.fillStyle = tok.tealGlowDark(t);
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, 6.283);
        ctx.fill();
      }
    }
  }

  ctx.strokeStyle = tok.gridLine;
  ctx.lineWidth = 1;

  for (let gx = 0; gx <= w; gx += w / 12) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }

  for (let gy = 0; gy <= h; gy += h / 6) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }
}