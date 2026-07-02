/**
 * Análisis en lenguaje claro sobre el payload de sesión: notas por remate con
 * el modelo élite del core (mismas curvas, importadas), foco de mejora y
 * reconsolidación de sesiones antiguas sobredetectadas.
 */
import {
  scorePower, scoreChainLag, scoreTorsoMag, scoreExplosive, scoreJumpTiming,
  scoreConsistency, QUALITY_WEIGHTS,
} from "@core";
import type { SessionPayload, RepScorePayload } from "@/analysis/persist";

type Rep = SessionPayload["reps"][number];

const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ---------- reconsolidación (sesiones antiguas con sobreconteo) ---------- */

/** Mismo criterio que el motor: umbral = max(1100, 0.55·pico) + refractario 3 s. */
export function consolidateReps(reps: Rep[]): Rep[] {
  if (!reps.length) return reps;
  const mx = Math.max(...reps.map((r) => r.armPeakDps));
  const thr = Math.max(1100, 0.55 * mx);
  const cands = reps.filter((r) => r.armPeakDps >= thr).sort((a, b) => b.armPeakDps - a.armPeakDps);
  const kept: Rep[] = [];
  for (const r of cands) if (kept.every((k) => Math.abs(r.timeMs - k.timeMs) > 3000)) kept.push(r);
  kept.sort((a, b) => a.timeMs - b.timeMs);
  return kept.map((r, i) => ({ ...r, index: i }));
}

/** ¿La sesión está sobredetectada? (el filtro reduce a menos del 60 %). */
export function isOverDetected(reps: Rep[]): boolean {
  const c = consolidateReps(reps);
  return c.length > 0 && c.length < reps.length * 0.6;
}

/* ---------- nota por remate (modelo élite, mismas curvas que el core) ---------- */

export function scorePayloadRep(r: Rep): RepScorePayload {
  if (r.score) return r.score; // sesiones nuevas ya traen la nota del motor

  const est = r.armEstPeakDps ?? r.armPeakDps;
  const power = scorePower(est);
  const chain = r.lagMs != null && r.torsoPeakDps != null
    ? 0.6 * scoreChainLag(r.lagMs) + 0.4 * scoreTorsoMag(r.torsoPeakDps)
    : null;
  const explosive = Number.isFinite(r.armTimeToPeakMs) ? scoreExplosive(r.armTimeToPeakMs) : null;
  const jumpTiming = r.contactInFlightPct != null ? scoreJumpTiming(r.contactInFlightPct) : null;

  const comps: [keyof typeof QUALITY_WEIGHTS, number | null][] = [
    ["power", power], ["chain", chain], ["explosive", explosive], ["jumpTiming", jumpTiming],
  ];
  let raw = 0, capMax = 0;
  let weakest: string | null = null, weakestScore = Infinity;
  for (const [k, s] of comps) {
    if (s == null) continue;
    raw += QUALITY_WEIGHTS[k] * s;
    capMax += QUALITY_WEIGHTS[k] * 100;
    if (s < weakestScore) { weakestScore = s; weakest = k; }
  }

  const score: RepScorePayload = {
    total: Math.round(Math.min(raw, capMax)),
    capMax: Math.round(capMax),
    power: Math.round(power),
    chain: chain != null ? Math.round(chain) : null,
    explosive: explosive != null ? Math.round(explosive) : null,
    jumpTiming: jumpTiming != null ? Math.round(jumpTiming) : null,
    weakest,
    advice: "",
  };
  score.advice = adviceForPayload(r, score);
  return score;
}

function adviceForPayload(r: Rep, s: RepScorePayload): string {
  const missing: string[] = [];
  if (s.chain == null) missing.push("tronco");
  if (s.jumpTiming == null) missing.push("salto");
  const parts: string[] = [];
  switch (s.weakest) {
    case "power":
      parts.push(`Pico de ${Math.round(r.armEstPeakDps ?? r.armPeakDps)} °/s: lejos del rango élite (≥2600). Trabaja el latigazo final de antebrazo y muñeca.`);
      break;
    case "chain":
      if (r.lagMs != null && r.lagMs < 10) parts.push(`El brazo llegó ${r.lagMs <= 0 ? "antes que" : "casi a la vez que"} el tronco (${Math.round(r.lagMs)} ms): golpeas "solo de brazo". Inicia la rotación del tronco antes.`);
      else if (r.lagMs != null && r.lagMs > 130) parts.push(`El brazo tardó ${Math.round(r.lagMs)} ms tras el tronco: la energía del giro se pierde. Encadena el brazo justo después.`);
      else if ((r.torsoPeakDps ?? 0) < 450) parts.push(`El tronco solo rotó a ${Math.round(r.torsoPeakDps ?? 0)} °/s (élite: 600–900). Genera el golpe desde la cadera y el tronco.`);
      else parts.push("Ajusta el encadenado tronco→brazo hacia un lag de 40–90 ms.");
      break;
    case "explosive":
      parts.push(`Armado lento: ${Math.round(r.armTimeToPeakMs)} ms hasta el pico (élite <100). Gesto corto y explosivo, no empujar.`);
      break;
    case "jumpTiming": {
      const p = r.contactInFlightPct!;
      parts.push(p < 45
        ? `Golpeas subiendo (${Math.round(p)} % del vuelo): retrasa el golpe hasta el punto más alto.`
        : `Golpeas cayendo (${Math.round(p)} % del vuelo): adelanta el armado para llegar arriba.`);
      break;
    }
    default:
      if (!missing.length) parts.push("Remate sólido en todos los componentes medidos.");
  }
  if (missing.length) parts.push(`Sin datos de ${missing.join(" y ")}: nota capada a ${s.capMax}.`);
  return parts.join(" ");
}

/* ---------- índice de sesión estricto ---------- */

export interface StrictSession {
  index: number;
  capMax: number;
  consistencyScore: number;
  repScores: RepScorePayload[];
}

export function strictSession(reps: Rep[]): StrictSession {
  if (!reps.length) return { index: 0, capMax: 0, consistencyScore: 0, repScores: [] };
  const repScores = reps.map(scorePayloadRep);
  const meanRep = avg(repScores.map((s) => s.total));
  const capMax = avg(repScores.map((s) => s.capMax));
  const peaks = reps.map((r) => r.armEstPeakDps ?? r.armPeakDps);
  const m = avg(peaks);
  const cv = m > 0 ? (Math.sqrt(avg(peaks.map((v) => (v - m) ** 2))) / m) * 100 : 100;
  const consistencyScore = reps.length >= 3 ? scoreConsistency(cv) : 50;
  return {
    index: Math.min(0.85 * meanRep + 0.15 * consistencyScore, capMax),
    capMax,
    consistencyScore,
    repScores,
  };
}

/* ---------- foco de mejora y textos ---------- */

export interface Focus { tag: string; title: string; body: string; }

export function buildFocus(repScores: RepScorePayload[]): Focus {
  const meanOf = (k: "power" | "chain" | "explosive" | "jumpTiming") => {
    const xs = repScores.map((s) => s[k]).filter((v): v is number => v != null);
    return xs.length ? avg(xs) : null;
  };
  const entries: [Focus, number | null][] = [
    [{ tag: "Foco principal", title: "Secuencia tronco → brazo", body: "Tu cadena cinética es lo que más margen tiene. El tronco debe girar primero y el brazo seguirlo como un látigo (40–90 ms después). Inicia el golpe desde la rotación de cadera y tronco, no desde el hombro." }, meanOf("chain")],
    [{ tag: "Foco principal", title: "Explosividad del armado", body: "Tu gesto tarda demasiado en llegar al pico. Piensa en un armado corto y un latigazo final rápido: la potencia nace de acelerar el último tramo, no de empujar el balón." }, meanOf("explosive")],
    [{ tag: "Foco principal", title: "Timing del salto", body: "No estás golpeando en el punto más alto del vuelo. Ajusta la batida y el armado para contactar el balón cerca del 50 % del salto, con el brazo extendido arriba." }, meanOf("jumpTiming")],
    [{ tag: "Foco principal", title: "Potencia de brazo", body: "Hay margen de velocidad en la muñeca. Trabaja el latigazo final (antebrazo y muñeca) y la transferencia desde el tronco: la élite supera los 2600 °/s." }, meanOf("power")],
  ];
  const measured = entries.filter(([, v]) => v != null) as [Focus, number][];
  if (!measured.length) {
    return { tag: "Datos incompletos", title: "Captura con ambos sensores", body: "No hay componentes suficientes medidos para priorizar. Asegura la conexión de ambos sensores y repite la serie." };
  }
  measured.sort((a, b) => a[1] - b[1]);
  const [focus, score] = measured[0]!;
  if (score >= 80) {
    return { tag: "Nivel alto", title: "Pulir y consolidar", body: "Tus componentes medidos están a buen nivel. El siguiente salto es la consistencia: repetir este patrón bajo fatiga y en juego real." };
  }
  return focus;
}

/** Veredicto de sesión, objetivo y sin inflar. */
export const QUALITY_VERDICT = (q: number): string =>
  q >= 90 ? "Nivel élite en lo medido. Excepcional."
  : q >= 75 ? "Remate de alto nivel. Pule los detalles."
  : q >= 60 ? "Base sólida con margen claro en componentes concretos."
  : q >= 45 ? "En construcción: hay déficits técnicos medibles que corregir."
  : "Lejos aún del patrón objetivo. Trabaja los focos indicados.";

export interface Range { min: number; max: number; a: number; b: number; invert?: boolean; }
/** Rangos para las barras (escala élite). */
export const RANGES = {
  peak: { min: 500, max: 3000, a: 2300, b: 3000 } as Range,
  seq: { min: 0, max: 100, a: 60, b: 100 } as Range,
  cv: { min: 0, max: 50, a: 0, b: 8, invert: true } as Range,
  ttp: { min: 50, max: 300, a: 50, b: 100, invert: true } as Range,
};

/** Frase descriptiva de un remate (fallback si no hay advice del motor). */
export function repNote(r: Rep): string {
  const s = scorePayloadRep(r);
  return s.advice || "—";
}

export interface JumpStats { bestCm: number | null; meanFlightS: number | null; meanTimingPct: number | null; }
export function jumpStats(reps: Rep[]): JumpStats {
  const jh = reps.map((r) => r.jumpHeightCm).filter((x): x is number => x != null);
  const fl = reps.map((r) => r.flightTimeS).filter((x): x is number => x != null);
  const ti = reps.map((r) => r.contactInFlightPct).filter((x): x is number => x != null);
  return {
    bestCm: jh.length ? Math.max(...jh) : null,
    meanFlightS: fl.length ? avg(fl) : null,
    meanTimingPct: ti.length ? avg(ti) : null,
  };
}
