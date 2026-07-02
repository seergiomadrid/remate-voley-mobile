/** Estadísticas agregadas de una sesión a partir de las repeticiones. */

import { mean, std } from "../signal/stats.js";
import { scoreRep, scoreSession } from "./quality.js";
import type { Rep, SessionAggregates } from "../types.js";

export function computeAggregates(reps: Rep[]): SessionAggregates {
  const repCount = reps.length;
  if (repCount === 0) {
    return {
      repCount: 0,
      armPeakBestDps: 0,
      armPeakMeanDps: 0,
      armPeakStdDps: 0,
      armConsistencyCvPct: 0,
      armSaturatedCount: 0,
      jumpBestCm: null,
      jumpMeanCm: null,
      flightTimeMeanS: null,
      contactInFlightMeanPct: null,
      sequencingMeanLagMs: null,
      sequencingOkPct: 0,
      fatigueDropPct: null,
      load: 0,
      qualityIndex: 0,
      qualityCapMax: 0,
    };
  }

  const armPeaks = reps.map((r) => r.arm.peakGyroDps);
  const armPeakBestDps = Math.max(...armPeaks);
  const armPeakMeanDps = mean(armPeaks);
  const armPeakStdDps = std(armPeaks);
  const armConsistencyCvPct = armPeakMeanDps > 0 ? (armPeakStdDps / armPeakMeanDps) * 100 : 0;
  const armSaturatedCount = reps.filter((r) => r.arm.peakGyroSaturated).length;

  // Salto.
  const jumps = reps.map((r) => r.jump.jumpHeightCm).filter((x): x is number => x != null);
  const jumpBestCm = jumps.length ? Math.max(...jumps) : null;
  const jumpMeanCm = jumps.length ? mean(jumps) : null;
  const flights = reps.map((r) => r.jump.flightTimeS).filter((x): x is number => x != null);
  const flightTimeMeanS = flights.length ? mean(flights) : null;
  const timings = reps.map((r) => r.jump.contactInFlightPct).filter((x): x is number => x != null);
  const contactInFlightMeanPct = timings.length ? mean(timings) : null;

  // Secuenciación.
  const paired = reps.filter((r) => r.sequencingLagMs != null);
  const lags = paired.map((r) => r.sequencingLagMs!);
  const sequencingMeanLagMs = lags.length ? mean(lags) : null;
  const sequencingOkPct = paired.length
    ? (paired.filter((r) => r.sequencingOk).length / paired.length) * 100
    : 0;

  // Fatiga: caída del pico de brazo entre el primer y el último tercio.
  let fatigueDropPct: number | null = null;
  if (repCount >= 6) {
    const third = Math.floor(repCount / 3);
    const first = mean(armPeaks.slice(0, third));
    const last = mean(armPeaks.slice(repCount - third));
    fatigueDropPct = first > 0 ? ((first - last) / first) * 100 : null;
  }

  // Carga de la sesión (proxy de volumen×intensidad).
  const load = armPeaks.reduce((s, p) => s + p / 1000, 0);

  // Índice de calidad (modelo élite, estricto y capado por datos medidos).
  // Se asegura que cada rep tenga su nota (el pipeline ya la adjunta).
  for (const r of reps) if (!r.score) r.score = scoreRep(r);
  const sessionQ = scoreSession(reps, reps.map((r) => r.score!));
  const qualityIndex = sessionQ.index;
  const qualityCapMax = sessionQ.capMax;

  return {
    repCount,
    armPeakBestDps,
    armPeakMeanDps,
    armPeakStdDps,
    armConsistencyCvPct,
    armSaturatedCount,
    jumpBestCm,
    jumpMeanCm,
    flightTimeMeanS,
    contactInFlightMeanPct,
    sequencingMeanLagMs,
    sequencingOkPct,
    fatigueDropPct,
    load,
    qualityIndex,
    qualityCapMax,
  };
}
