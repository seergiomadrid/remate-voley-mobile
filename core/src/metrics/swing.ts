/** Métricas de un swing (gesto) alrededor de un pico de velocidad angular. */

import { max } from "../signal/stats.js";
import type { ResampledStream, SwingMetrics } from "../types.js";

function classifyShape(widthMs: number): SwingMetrics["shape"] {
  if (!Number.isFinite(widthMs)) return "no_clasificado";
  if (widthMs < 100) return "latigazo";
  if (widthMs < 180) return "intermedio";
  return "empuje";
}

function anySaturated(flag: Uint8Array, lo: number, hi: number): boolean {
  for (let i = Math.max(0, lo); i <= Math.min(flag.length - 1, hi); i++) {
    if (flag[i]) return true;
  }
  return false;
}

/**
 * Calcula las métricas de un swing centrado en `peakIdx` de la rejilla `stream`.
 * `windowMs` define la ventana de análisis a cada lado del pico.
 */
export function swingMetricsAt(stream: ResampledStream, peakIdx: number, windowMs = 300): SwingMetrics {
  const { t, gyroSmooth, accMag, fs } = stream;
  const step = 1000 / fs;
  const w = Math.round(windowMs / step);
  const lo = Math.max(0, peakIdx - w);
  const hi = Math.min(t.length - 1, peakIdx + w);

  const peakTimeMs = t[peakIdx]!;
  const peakValue = gyroSmooth[peakIdx]!;

  // Inicio del gesto: retroceder mientras la señal supere el 20 % del pico.
  const lowThr = peakValue * 0.2;
  let startIdx = peakIdx;
  while (startIdx > lo && gyroSmooth[startIdx - 1]! > lowThr) startIdx--;
  const timeToPeakMs = peakTimeMs - t[startIdx]!;

  // Anchura de la parte alta: extender desde el pico mientras > 70 % del pico.
  const highThr = peakValue * 0.7;
  let left = peakIdx;
  let right = peakIdx;
  while (left > lo && gyroSmooth[left - 1]! > highThr) left--;
  while (right < hi && gyroSmooth[right + 1]! > highThr) right++;
  const peakWidthMs = t[right]! - t[left]!;

  // Pico de aceleración en la ventana.
  const accWindow = accMag.slice(lo, hi + 1);
  const peakAccG = max(accWindow);

  // Saturación en torno al pico (±40 ms).
  const satHalf = Math.round(40 / step);
  const peakGyroSaturated = anySaturated(stream.gyroSaturated, peakIdx - satHalf, peakIdx + satHalf);
  const peakAccSaturated = anySaturated(stream.accSaturated, lo, hi);

  return {
    peakTimeMs,
    peakGyroDps: peakValue,
    peakGyroSaturated,
    peakAccG,
    peakAccSaturated,
    timeToPeakMs,
    peakWidthMs,
    shape: classifyShape(peakWidthMs),
  };
}
