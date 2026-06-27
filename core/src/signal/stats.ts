/** Utilidades estadísticas básicas. */

export function mean(xs: ArrayLike<number>): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i]!;
  return s / xs.length;
}

export function std(xs: ArrayLike<number>, sample = true): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i]! - m;
    s += d * d;
  }
  return Math.sqrt(s / (sample ? n - 1 : n));
}

export function max(xs: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < xs.length; i++) if (xs[i]! > m) m = xs[i]!;
  return m;
}

export function min(xs: ArrayLike<number>): number {
  let m = Infinity;
  for (let i = 0; i < xs.length; i++) if (xs[i]! < m) m = xs[i]!;
  return m;
}

export function sum(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i]!;
  return s;
}

/** Mediana (copia y ordena). */
export function median(xs: ArrayLike<number>): number {
  const a = Array.from(xs).sort((p, q) => p - q);
  const n = a.length;
  if (n === 0) return NaN;
  const mid = n >> 1;
  return n % 2 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

/** Regresión lineal simple y = a + b·x. Devuelve pendiente, intercepto y R². */
export function linearRegression(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
): { slope: number; intercept: number; r2: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: ys.length ? ys[0]! : 0, r2: 0 };
  const mx = mean(Array.from({ length: n }, (_, i) => xs[i]!));
  const my = mean(Array.from({ length: n }, (_, i) => ys[i]!));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

/** Restringe un valor a [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
