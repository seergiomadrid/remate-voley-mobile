/**
 * Tubería de alto nivel: de streams crudos a análisis completo de sesión.
 * Es la función que usan tanto la app móvil como el análisis offline.
 */

import { computeAggregates } from "./metrics/session.js";
import { scoreRep } from "./metrics/quality.js";
import { buildReps } from "./metrics/sequencing.js";
import { generateTips } from "./coaching.js";
import { prepareStreams } from "./prepare.js";
import { findPeaks } from "./signal/peaks.js";
import { max as arrMax } from "./signal/stats.js";
import { estimateClockOffset } from "./sync.js";
import { SPIKE_MIN_DPS, SPIKE_REL_FRACTION, SPIKE_REFRACTORY_MS } from "./constants.js";
import type { ResampledStream, SensorStream, SessionAnalysis } from "./types.js";

export interface AnalyzeOptions {
  /** Distancia mínima entre remates (ms). Por defecto 300. */
  refractoryMs?: number;
  /** Ventana de análisis por swing (ms). Por defecto 300. */
  windowMs?: number;
  /** Factor k del umbral adaptativo de picos. Por defecto 1.2. */
  peakK?: number;
  /** Offset de reloj forzado (ms). Si se omite, se estima por correlación. */
  forcedOffsetMs?: number;
}

/** Resultado en memoria: incluye las series preparadas para graficar. */
export interface AnalyzeResult extends SessionAnalysis {
  prepared: {
    arm: ResampledStream;
    torso: ResampledStream | null;
    armPeaks: number[];
    torsoPeaks: number[];
  };
  syncConfidence: number;
}

export function analyzeSession(
  arm: SensorStream,
  torso: SensorStream | null,
  opts: AnalyzeOptions = {},
): AnalyzeResult {
  const refractoryMs = opts.refractoryMs ?? SPIKE_REFRACTORY_MS;
  const windowMs = opts.windowMs ?? 300;

  let offsetMs = opts.forcedOffsetMs ?? 0;
  let syncConfidence = 1;
  if (torso && opts.forcedOffsetMs === undefined) {
    const sync = estimateClockOffset(arm, torso);
    offsetMs = sync.offsetMs;
    syncConfidence = sync.confidence;
  }

  const { arm: ra, torso: rt } = prepareStreams(arm, torso, offsetMs);
  const step = 1000 / ra.fs;
  const minDistance = Math.max(1, Math.round(refractoryMs / step));

  // Detección de REMATES (brazo): umbral relativo al pico máximo de la sesión.
  // Un remate real está muy por encima de los movimientos de aproximación/armado.
  const armMax = arrMax(ra.gyroSmooth);
  const spikeHeight = Math.max(SPIKE_MIN_DPS, SPIKE_REL_FRACTION * armMax);
  const armPeaks = findPeaks(ra.gyroSmooth, { height: spikeHeight, minDistance })
    // Descarta picos en zonas de hueco (interpolación tras desconexión, no medida).
    .filter((i) => !ra.gap[i]);
  // Picos de torso solo para visualización (umbral moderado, refractario corto).
  const torsoPeaks = rt
    ? findPeaks(rt.gyroSmooth, { k: 1.2, minDistance: Math.max(1, Math.round(800 / step)) })
    : [];

  const reps = buildReps(ra, rt, armPeaks, torsoPeaks, windowMs);
  for (const r of reps) r.score = scoreRep(r);
  const aggregates = computeAggregates(reps);
  const tips = generateTips(aggregates, reps);

  return {
    reps,
    aggregates,
    tips,
    clockOffsetMs: offsetMs,
    syncConfidence,
    effectiveFs: { ARM: arm.fs, TORSO: torso?.fs ?? 0 },
    prepared: { arm: ra, torso: rt, armPeaks, torsoPeaks },
  };
}
