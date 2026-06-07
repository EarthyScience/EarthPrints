export function hash(x: number, y: number, s: number): number {
  let n = x * 374761393 + y * 668265263 + s * 982451653;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return ((n >>> 0) % 100000) / 100000;
}

export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const tl = hash(xi, yi, s);
  const tr = hash(xi + 1, yi, s);
  const bl = hash(xi, yi + 1, s);
  const br = hash(xi + 1, yi + 1, s);
  const u = smooth(xf);
  const v = smooth(yf);
  return tl + (tr - tl) * u + (bl + (br - bl) * u - (tl + (tr - tl) * u)) * v;
}

export function fbm(x: number, y: number, s: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    v += a * vnoise(x * f, y * f, s + i * 23);
    f *= 2;
    a *= 0.5;
  }
  return v;
}
