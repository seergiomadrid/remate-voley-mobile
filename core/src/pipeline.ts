/**
 * Tubería de alto nivel: de streams crudos a análisis completo de sesión.
 * Es la función que usan tanto la app móvil como el análisis offline.
 */

import { computeAggregates } from "./metrics/session.js";
import { buildReps } from "./metrics/sequencing.js";
import { generateTips } from "./coaching.js";
import { prepareStreams } from "./prepare.js";
import { findPeaks } from "./signal/peaks.js";
import { estimateClockOffset } from "./sync.js";
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
  const refractoryMs = opts.refractoryMs ?? 300;
  const windowMs = opts.windowMs ?? 300;
  const peakK = opts.peakK ?? 1.2;

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

  const armPeaks = findPeaks(ra.gyroSmooth, { k: peakK, minDistance });
  const torsoPeaks = rt ? findPeaks(rt.gyroSmooth, { k: peakK, minDistance }) : [];

  const reps = buildReps(ra, rt, armPeaks, torsoPeaks, windowMs);
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
