import { fbm, hash } from "@/lib/hero/noise";
import { HERO_BASE_COLOR } from "@/lib/constants/theme";

const HERO_SEED = 41.7;

/** Soft cluster hotspots — main group sits behind hero copy. */
const HERO_CLUSTERS: Array<[number, number, number, number]> = [
  [0.38, 0.48, 1.65, 0.62],
  [0.68, 0.22, 2.15, 0.4],
  [0.2, 0.34, 2.35, 0.34],
  [0.78, 0.5, 2.05, 0.36],
  [0.54, 0.7, 2.45, 0.28],
  [0.14, 0.6, 2.7, 0.24],
];

function clusterBand(nx: number, ny: number): number {
  let band = 0;
  for (const [cx, cy, falloff, weight] of HERO_CLUSTERS) {
    const dx = nx - cx;
    const dy = ny - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    band = Math.max(band, Math.max(0, 1 - dist * falloff) * weight);
  }
  return band;
}

function dotPhase(i: number, j: number, salt: number): number {
  return hash(i * 1.17 + salt, j * 0.93 + salt * 0.5, HERO_SEED) * Math.PI * 2;
}

/** Oscillate around the grid anchor; offset is zero at time 0. */
function dotDrift(
  time: number,
  phase: number,
  phaseB: number,
  amp: number,
): { x: number; y: number } {
  return {
    x:
      (Math.sin(time * 0.55 + phase) - Math.sin(phase)) * amp +
      (Math.cos(time * 0.37 + phaseB) - Math.cos(phaseB)) * amp * 0.55,
    y:
      (Math.cos(time * 0.48 + phaseB) - Math.cos(phaseB)) * amp +
      (Math.sin(time * 0.41 + phase) - Math.sin(phase)) * amp * 0.55,
  };
}

function readHeroTokens(isLight: boolean) {
  return {
    baseFill: isLight ? HERO_BASE_COLOR.light : HERO_BASE_COLOR.dark,
    dotFaint: isLight
      ? "rgba(10,10,10,.05)"
      : "rgba(255,255,255,.045)",                        // --grid-line tint
    gridLine: isLight
      ? "rgba(10,10,10,.05)"
      : "rgba(255,255,255,.05)",                         // --grid-line
    tealRgb: isLight
      ? ([0, 108, 102] as [number, number, number])      // --accent-solid / TEAL_RGB
      : ([82, 212, 200] as [number, number, number]),    // --accent / TEAL_ON_DARK_RGB
    tealBrightRgb: isLight
      ? ([0, 131, 123] as [number, number, number])      // --accent-bright light
      : ([125, 245, 232] as [number, number, number]),   // --accent-bright dark
    coldRgb: isLight
      ? ([120, 120, 118] as [number, number, number])    // COLD_RGB.light
      : ([150, 150, 150] as [number, number, number]),   // COLD_RGB.dark
    tealGlowDark: isLight
      ? (t: number) => `rgba(0,108,102,${(t - 0.65) * 0.62})`
      : (t: number) => `rgba(125,245,232,${(t - 0.65) * 0.55})`,
    dotAlphaBase: isLight ? 0.12 : 0.2,
    dotAlphaScale: isLight ? 0.62 : 0.88,
  };
}

export function drawHeroField(
  canvas: HTMLCanvasElement,
  isLight: boolean,
  time = 0,
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
  const tealBright = tok.tealBrightRgb;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * step;
      const y = j * step;

      let n = fbm(i * 0.11 + 0.5, j * 0.13 + 0.5, HERO_SEED);
      const patch = fbm(i * 0.21 + 1.7, j * 0.18 + 0.9, HERO_SEED + 13);
      const band = clusterBand(x / w, y / h);
      n = Math.min(1, n * 0.48 + patch * 0.4 + band * 0.52);

      const t = Math.max(0, (n - 0.3) / 0.7);

      if (t <= 0.02) {
        ctx.fillStyle = tok.dotFaint;
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, 6.283);
        ctx.fill();
        continue;
      }

      const phase = dotPhase(i, j, 0);
      const phaseB = dotPhase(i, j, 1);
      const drift = dotDrift(time, phase, phaseB, 2.4 + t * 3.2);
      const drawX = x + drift.x;
      const drawY = y + drift.y;

      const r = 0.9 + t * 3;
      const mix = Math.pow(t, 1.15);
      const spark = Math.pow(Math.max(0, (t - 0.55) / 0.45), 0.75);
      let cr = Math.round(cold[0] + (teal[0] - cold[0]) * mix);
      let cg = Math.round(cold[1] + (teal[1] - cold[1]) * mix);
      let cb = Math.round(cold[2] + (teal[2] - cold[2]) * mix);
      cr = Math.round(cr + (tealBright[0] - cr) * spark);
      cg = Math.round(cg + (tealBright[1] - cg) * spark);
      cb = Math.round(cb + (tealBright[2] - cb) * spark);
      const a = tok.dotAlphaBase + t * tok.dotAlphaScale;

      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.beginPath();
      ctx.arc(drawX, drawY, r, 0, 6.283);
      ctx.fill();

      if (t > 0.65) {
        ctx.fillStyle = tok.tealGlowDark(t);
        ctx.beginPath();
        ctx.arc(drawX, drawY, r * 2.8, 0, 6.283);
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