/**
 * Sincronización de relojes entre las dos placas.
 *
 * Cada placa cuenta el tiempo desde su propio arranque, así que comparar
 * `t_ms` entre placas (como hacía el análisis original) no es válido. Aquí se
 * estima el offset de reloj por correlación cruzada de la actividad (gyroMag).
 *
 * Flujo recomendado en la app:
 *   1) Enviar comando SYNC → ambas placas ponen su reloj a 0 casi a la vez
 *      (alineación gruesa).
 *   2) El usuario junta/golpea las dos placas (doble toque) → impulso compartido.
 *   3) Esta función afina el offset correlacionando el patrón de picos.
 *
 * Convención: t_torso_común = t_torso_local + offsetMs (referencia = reloj ARM).
 */

import { RESAMPLE_HZ } from "./constants.js";
import { resampleLinear } from "./signal/resample.js";
import { mean, std } from "./signal/stats.js";
import type { SensorStream } from "./types.js";

function toZeroBasedGyro(stream: SensorStream, fs: number): { t0: number; v: Float64Array } {
  const s = stream.samples;
  if (s.length === 0) return { t0: 0, v: new Float64Array(0) };
  const t0 = s[0]!.t;
  const tEnd = s[s.length - 1]!.t;
  const src = { t: s.map((x) => x.t), v: s.map((x) => x.gyroMag) };
  const { v } = resampleLinear(src, t0, tEnd, fs);
  return { t0, v };
}

/** Normaliza (z-score) para que la correlación no dependa de la amplitud. */
function zscore(x: Float64Array): Float64Array {
  const m = mean(x);
  const sd = std(x) || 1;
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = (x[i]! - m) / sd;
  return out;
}

/**
 * Correlación cruzada normalizada. Devuelve el desfase `d` (en muestras) que
 * maximiza Σ a[k]·b[k+d] y la puntuación, buscando en |d| ≤ maxLag.
 */
export function crossCorrelate(
  a: Float64Array,
  b: Float64Array,
  maxLag: number,
): { lag: number; score: number } {
  const za = zscore(a);
  const zb = zscore(b);
  let bestLag = 0;
  let bestScore = -Infinity;
  for (let d = -maxLag; d <= maxLag; d++) {
    let s = 0;
    let count = 0;
    for (let k = 0; k < za.length; k++) {
      const j = k + d;
      if (j < 0 || j >= zb.length) continue;
      s += za[k]! * zb[j]!;
      count++;
    }
    if (count < 3) continue;
    const score = s / count;
    if (score > bestScore) {
      bestScore = score;
      bestLag = d;
    }
  }
  return { lag: bestLag, score: bestScore };
}

export interface SyncResult {
  offsetMs: number;
  /** Calidad de la correlación (−1..1). Por debajo de ~0.3 la sync es dudosa. */
  confidence: number;
}

/**
 * Estima el offset de reloj entre arm (referencia) y torso.
 * @param maxLagMs Búsqueda máxima de desfase (ms).
 */
export function estimateClockOffset(
  arm: SensorStream,
  torso: SensorStream,
  maxLagMs = 1500,
): SyncResult {
  const fs = RESAMPLE_HZ;
  const A = toZeroBasedGyro(arm, fs);
  const B = toZeroBasedGyro(torso, fs);
  if (A.v.length < 4 || B.v.length < 4) return { offsetMs: 0, confidence: 0 };

  const step = 1000 / fs;
  const maxLag = Math.round(maxLagMs / step);
  const { lag: d, score } = crossCorrelate(A.v, B.v, maxLag);

  // offsetMs = (armT0 - torsoT0) - d·step   (ver derivación en docs/biomecanica.md)
  const offsetMs = A.t0 - B.t0 - d * step;
  return { offsetMs, confidence: score };
}
