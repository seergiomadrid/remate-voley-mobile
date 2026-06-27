/** Estadísticas agregadas de una sesión a partir de las repeticiones. */

import { clamp, mean, std } from "../signal/stats.js";
import type { Rep, SessionAggregates } from "../types.js";

const ARM_SPEED_REFERENCE_DPS = 2000; // referencia para normalizar (saturación del sensor)

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
      sequencingMeanLagMs: null,
      sequencingOkPct: 0,
      fatigueDropPct: null,
      load: 0,
      qualityIndex: 0,
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

  // Índice compuesto de calidad (0–100).
  const armSpeedScore = clamp((armPeakMeanDps / ARM_SPEED_REFERENCE_DPS) * 100, 0, 100);
  const consistencyScore = clamp(100 - armConsistencyCvPct, 0, 100);
  const qualityIndex = paired.length
    ? 0.4 * armSpeedScore + 0.3 * sequencingOkPct + 0.3 * consistencyScore
    : 0.6 * armSpeedScore + 0.4 * consistencyScore;

  return {
    repCount,
    armPeakBestDps,
    armPeakMeanDps,
    armPeakStdDps,
    armConsistencyCvPct,
    armSaturatedCount,
    jumpBestCm,
    jumpMeanCm,
    sequencingMeanLagMs,
    sequencingOkPct,
    fatigueDropPct,
    load,
    qualityIndex,
  };
}
