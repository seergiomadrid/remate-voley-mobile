/**
 * Modelo de calidad del remate anclado a valores de ÉLITE profesional.
 *
 * Filosofía: 100 = remate de jugador profesional en todos los componentes.
 * Un 90+ debe ser raro; un buen remate amateur ronda 55–75. Los componentes
 * NO medidos (tronco desconectado, sin salto detectado) no puntúan y CAPAN el
 * máximo alcanzable: no se asume que lo no medido se hizo bien.
 *
 * Anclas biomecánicas (literatura de deportes overhead / voleibol):
 * - Rotación interna de hombro en élite: 2300–2600 °/s; en muñeca la magnitud
 *   resultante (con pronación) llega más arriba. Escala: 2800 °/s ≈ 100.
 * - Cadena proximal→distal: el tronco alcanza su pico 30–120 ms antes que el
 *   brazo. Rotación de tronco en élite: 600–900 °/s.
 * - Latigazo: tiempo hasta el pico < 100 ms en gestos élite.
 * - Contacto con el balón cerca del punto más alto del salto (~50 % del vuelo).
 */

import { mean, std } from "../signal/stats.js";
import type { Rep, RepScore, RepScoreComponent } from "../types.js";

/** Interpolación lineal por tramos sobre anclas [x, score]. */
function piecewise(x: number, anchors: [number, number][]): number {
  if (x <= anchors[0]![0]) return anchors[0]![1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i]!;
    const [x0, y0] = anchors[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return anchors[anchors.length - 1]![1];
}

const clamp01 = (v: number) => Math.max(0, Math.min(100, v));

/** Potencia de brazo: pico (estimado si satura) frente a la escala élite. */
export function scorePower(estPeakDps: number): number {
  return clamp01(piecewise(estPeakDps, [
    [500, 0], [900, 12], [1300, 30], [1700, 50], [2000, 63], [2300, 74], [2600, 86], [2800, 94], [3000, 100],
  ]));
}

/** Timing de la cadena: lag tronco→brazo (ms). Ideal 40–90 ms. */
export function scoreChainLag(lagMs: number): number {
  return clamp01(piecewise(lagMs, [
    [-100, 0], [-30, 0], [0, 25], [10, 50], [30, 85], [40, 100], [90, 100], [130, 70], [180, 35], [250, 0],
  ]));
}

/** Contribución del tronco: pico de rotación (dps). Élite 600–900. */
export function scoreTorsoMag(torsoPeakDps: number): number {
  return clamp01(piecewise(torsoPeakDps, [
    [0, 0], [150, 12], [300, 38], [450, 58], [600, 78], [750, 92], [900, 100],
  ]));
}

/** Explosividad: tiempo hasta el pico (ms). Élite < 100 ms. */
export function scoreExplosive(timeToPeakMs: number): number {
  return clamp01(piecewise(timeToPeakMs, [
    [60, 100], [90, 88], [120, 70], [160, 45], [220, 20], [300, 0],
  ]));
}

/** Timing del golpe dentro del vuelo (%). Ideal 45–55 (punto más alto). */
export function scoreJumpTiming(pct: number): number {
  return clamp01(piecewise(pct, [
    [10, 0], [25, 35], [38, 80], [45, 97], [47, 100], [53, 100], [55, 97], [62, 80], [75, 35], [90, 0],
  ]));
}

/** Pesos de cada componente en la nota del remate. */
export const QUALITY_WEIGHTS = { power: 0.35, chain: 0.3, explosive: 0.15, jumpTiming: 0.2 } as const;

export type { RepScore, RepScoreComponent };

function adviceFor(rep: Rep, s: RepScore): string {
  const missing: string[] = [];
  if (s.components.chain.score == null) missing.push("tronco");
  if (s.components.jumpTiming.score == null) missing.push("salto");

  const parts: string[] = [];
  switch (s.weakest) {
    case "power": {
      const v = Math.round(rep.arm.estPeakGyroDps);
      parts.push(`Pico de ${v} °/s: lejos del rango élite (≥2600). Trabaja el latigazo final de antebrazo y muñeca, acelerando en el último tramo del gesto.`);
      break;
    }
    case "chain": {
      const lag = rep.sequencingLagMs;
      const torso = rep.torso?.peakGyroDps ?? 0;
      if (lag != null && lag < 10) {
        parts.push(`El brazo llegó ${lag <= 0 ? "antes que" : "casi a la vez que"} el tronco (${Math.round(lag)} ms): estás golpeando "solo de brazo". Inicia la rotación del tronco antes y deja que el brazo la siga.`);
      } else if (lag != null && lag > 130) {
        parts.push(`El brazo tardó ${Math.round(lag)} ms tras el tronco: la energía de la rotación se pierde antes del golpe. Encadena el brazo justo después del giro.`);
      } else if (torso < 450) {
        parts.push(`El tronco solo rotó a ${Math.round(torso)} °/s (élite: 600–900). Genera el golpe desde el giro de cadera y tronco, no solo con el hombro.`);
      } else {
        parts.push("Ajusta el encadenado tronco→brazo hacia un lag de 40–90 ms.");
      }
      break;
    }
    case "explosive": {
      parts.push(`Armado lento: ${Math.round(rep.arm.timeToPeakMs)} ms hasta el pico (élite <100). Piensa en un gesto corto y explosivo, no en empujar el balón.`);
      break;
    }
    case "jumpTiming": {
      const p = rep.jump.contactInFlightPct!;
      if (p < 45) parts.push(`Golpeas subiendo (${Math.round(p)} % del vuelo): retrasa ligeramente el golpe para contactar en el punto más alto.`);
      else parts.push(`Golpeas cayendo (${Math.round(p)} % del vuelo): adelanta el armado para llegar al balón en el punto más alto.`);
      break;
    }
    default:
      if (!missing.length) parts.push("Remate sólido en todos los componentes medidos.");
  }
  if (missing.length) {
    parts.push(`Sin datos de ${missing.join(" y ")}: la nota está capada a ${Math.round(s.capMax)}.`);
  }
  return parts.join(" ");
}

/** Puntúa un remate. Los componentes no medidos capan el máximo alcanzable. */
export function scoreRep(rep: Rep): RepScore {
  const power: RepScoreComponent = {
    score: scorePower(rep.arm.estPeakGyroDps),
    value: rep.arm.estPeakGyroDps,
  };
  const chain: RepScoreComponent =
    rep.torso && rep.sequencingLagMs != null
      ? {
          score: 0.6 * scoreChainLag(rep.sequencingLagMs) + 0.4 * scoreTorsoMag(rep.torso.peakGyroDps),
          value: rep.sequencingLagMs,
        }
      : { score: null, value: null };
  const explosive: RepScoreComponent = Number.isFinite(rep.arm.timeToPeakMs)
    ? { score: scoreExplosive(rep.arm.timeToPeakMs), value: rep.arm.timeToPeakMs }
    : { score: null, value: null };
  const jumpTiming: RepScoreComponent =
    rep.jump.contactInFlightPct != null
      ? { score: scoreJumpTiming(rep.jump.contactInFlightPct), value: rep.jump.contactInFlightPct }
      : { score: null, value: null };

  const comps = { power, chain, explosive, jumpTiming };
  let raw = 0;
  let capMax = 0;
  let weakest: RepScore["weakest"] = null;
  let weakestScore = Infinity;
  (Object.keys(QUALITY_WEIGHTS) as (keyof typeof QUALITY_WEIGHTS)[]).forEach((k) => {
    const c = comps[k];
    const w = QUALITY_WEIGHTS[k];
    if (c.score != null) {
      raw += w * c.score;
      capMax += w * 100;
      if (c.score < weakestScore) {
        weakestScore = c.score;
        weakest = k;
      }
    }
  });

  const score: RepScore = {
    total: Math.min(raw, capMax),
    capMax,
    components: comps,
    weakest,
    advice: "",
  };
  score.advice = adviceFor(rep, score);
  return score;
}

export interface SessionQuality {
  /** Índice de sesión 0–100 (estricto, capado por datos disponibles). */
  index: number;
  /** Máximo alcanzable con los datos de esta sesión. */
  capMax: number;
  /** Puntuación de consistencia (CV del pico), 0–100. */
  consistencyScore: number;
}

/** Consistencia estricta: CV del pico de brazo. Élite ≤6 %. */
export function scoreConsistency(cvPct: number): number {
  return clamp01(piecewise(cvPct, [
    [4, 100], [8, 90], [12, 75], [18, 55], [25, 35], [35, 10], [45, 0],
  ]));
}

/** Índice de sesión: media de notas por remate + consistencia, sin superar el cap. */
export function scoreSession(reps: Rep[], repScores: RepScore[]): SessionQuality {
  if (!reps.length || !repScores.length) return { index: 0, capMax: 0, consistencyScore: 0 };
  const meanRep = mean(repScores.map((s) => s.total));
  const capMax = mean(repScores.map((s) => s.capMax));
  const peaks = reps.map((r) => r.arm.estPeakGyroDps);
  const m = mean(peaks);
  const cv = m > 0 ? (std(peaks) / m) * 100 : 100;
  const consistencyScore = reps.length >= 3 ? scoreConsistency(cv) : 50; // con <3 remates no se acredita consistencia
  const index = Math.min(0.85 * meanRep + 0.15 * consistencyScore, capMax);
  return { index, capMax, consistencyScore };
}
