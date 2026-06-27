/**
 * Detección de picos con umbral adaptativo y periodo refractario (distancia
 * mínima entre picos). Mejora el find_peaks fijo del análisis original.
 */

import { mean, std } from "./stats.js";

export interface PeakOptions {
  /** Umbral mínimo absoluto. Si se omite, se calcula como mean + k·std. */
  height?: number;
  /** Factor k para el umbral adaptativo (por defecto 1.2, como el original). */
  k?: number;
  /** Distancia mínima entre picos, en muestras. */
  minDistance: number;
}

/** Calcula el umbral adaptativo mean + k·std de la señal. */
export function adaptiveThreshold(x: ArrayLike<number>, k = 1.2): number {
  return mean(x) + k * std(x);
}

/**
 * Devuelve los índices de los máximos locales que superan el umbral, respetando
 * la distancia mínima (se prioriza el de mayor amplitud en caso de conflicto).
 */
export function findPeaks(x: ArrayLike<number>, opts: PeakOptions): number[] {
  const n = x.length;
  const k = opts.k ?? 1.2;
  const height = opts.height ?? adaptiveThreshold(x, k);
  const minDist = Math.max(1, Math.floor(opts.minDistance));

  // Candidatos: máximos locales por encima del umbral.
  const candidates: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const xi = x[i]!;
    if (xi < height) continue;
    if (xi >= x[i - 1]! && xi > x[i + 1]!) candidates.push(i);
  }
  // Mesetas: incluir el centro de un tramo plano por encima del umbral.
  // (Cubierto razonablemente por la condición >= / > anterior.)

  // Ordena por amplitud descendente y aplica supresión por distancia.
  candidates.sort((a, b) => x[b]! - x[a]!);
  const accepted: number[] = [];
  for (const idx of candidates) {
    let ok = true;
    for (const a of accepted) {
      if (Math.abs(a - idx) < minDist) {
        ok = false;
        break;
      }
    }
    if (ok) accepted.push(idx);
  }
  accepted.sort((a, b) => a - b);
  return accepted;
}
