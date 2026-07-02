/**
 * Motor de consejos basado en reglas, fundamentado en el principio
 * proximal→distal y en los umbrales de la literatura (ver docs/biomecanica.md).
 * Traduce las métricas en feedback accionable.
 */

import { mean } from "./signal/stats.js";
import type { CoachingTip, Rep, SessionAggregates } from "./types.js";

export function generateTips(aggregates: SessionAggregates, reps: Rep[]): CoachingTip[] {
  const tips: CoachingTip[] = [];
  if (aggregates.repCount === 0) {
    tips.push({
      severity: "info",
      category: "tecnica",
      message: "No se detectaron remates en esta sesión. Revisa la colocación de los sensores y la sincronización.",
    });
    return tips;
  }

  // Secuenciación cinética.
  const paired = reps.filter((r) => r.sequencingLagMs != null);
  if (paired.length > 0) {
    if (aggregates.sequencingOkPct >= 70) {
      tips.push({
        severity: "good",
        category: "secuenciacion",
        message: `Buena cadena cinética: en el ${aggregates.sequencingOkPct.toFixed(0)} % de los remates el tronco lidera al brazo (secuencia proximal→distal correcta).`,
      });
    } else if ((aggregates.sequencingMeanLagMs ?? 0) <= 0) {
      tips.push({
        severity: "warn",
        category: "secuenciacion",
        message: "El brazo tiende a adelantarse al tronco. Trabaja el latigazo iniciando la rotación desde el tronco y dejando que el brazo llegue después.",
      });
    } else {
      tips.push({
        severity: "warn",
        category: "secuenciacion",
        message: `Solo el ${aggregates.sequencingOkPct.toFixed(0)} % de los remates muestran una secuencia torso→brazo dentro del rango óptimo. Busca un lag de tronco a brazo más consistente.`,
      });
    }
  }

  // Consistencia.
  if (aggregates.armConsistencyCvPct > 20) {
    tips.push({
      severity: "warn",
      category: "consistencia",
      message: `Tus picos de brazo varían bastante (CV ${aggregates.armConsistencyCvPct.toFixed(0)} %). Busca repetir la misma mecánica en cada remate.`,
    });
  } else if (aggregates.armConsistencyCvPct < 8 && aggregates.repCount >= 3) {
    tips.push({
      severity: "good",
      category: "consistencia",
      message: `Mecánica muy consistente (CV ${aggregates.armConsistencyCvPct.toFixed(0)} %).`,
    });
  }

  // Explosividad (tiempo al pico). Élite < 100 ms.
  const ttp = reps.map((r) => r.arm.timeToPeakMs).filter((x) => Number.isFinite(x));
  if (ttp.length) {
    const meanTtp = mean(ttp);
    if (meanTtp > 140) {
      tips.push({
        severity: "warn",
        category: "explosividad",
        message: `El gesto tarda de media ${meanTtp.toFixed(0)} ms en alcanzar el pico (élite: <100 ms). Piensa en un armado corto y explosivo, no en empujar.`,
      });
    }
  }

  // Timing del golpe dentro del salto.
  if (aggregates.contactInFlightMeanPct != null) {
    const t = aggregates.contactInFlightMeanPct;
    if (t < 40) {
      tips.push({
        severity: "warn",
        category: "salto",
        message: `Golpeas de media al ${t.toFixed(0)} % del vuelo (subiendo). Retrasa el golpe para contactar en el punto más alto (~50 %).`,
      });
    } else if (t > 60) {
      tips.push({
        severity: "warn",
        category: "salto",
        message: `Golpeas de media al ${t.toFixed(0)} % del vuelo (cayendo). Adelanta el armado para llegar al balón en el punto más alto (~50 %).`,
      });
    }
  }

  // Datos incompletos: el índice queda capado.
  if (aggregates.qualityCapMax < 99 && aggregates.repCount > 0) {
    tips.push({
      severity: "info",
      category: "tecnica",
      message: `Faltan componentes por medir (tronco o salto) en parte de los remates: el índice de calidad queda capado a ${aggregates.qualityCapMax.toFixed(0)}. Revisa la conexión de ambos sensores.`,
    });
  }

  // Fatiga.
  if (aggregates.fatigueDropPct != null && aggregates.fatigueDropPct > 12) {
    tips.push({
      severity: "warn",
      category: "fatiga",
      message: `Tu pico de brazo cae un ${aggregates.fatigueDropPct.toFixed(0)} % hacia el final de la sesión. Gestiona el volumen para sostener la calidad.`,
    });
  }

  // Saturación del sensor.
  if (aggregates.armSaturatedCount > 0) {
    tips.push({
      severity: "info",
      category: "tecnica",
      message: `${aggregates.armSaturatedCount} remate(s) saturaron el giroscopio (>2000 °/s): tu velocidad real de brazo es aún mayor que la mostrada.`,
    });
  }

  // Salto.
  if (aggregates.jumpBestCm != null) {
    tips.push({
      severity: "info",
      category: "salto",
      message: `Mejor salto estimado: ${aggregates.jumpBestCm.toFixed(0)} cm de tiempo de vuelo.`,
    });
  }

  return tips;
}
