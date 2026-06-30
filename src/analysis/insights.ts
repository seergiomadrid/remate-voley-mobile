/** Análisis en lenguaje claro: foco de mejora, notas por remate y rangos ideales. */
import type { SessionPayload } from "@/analysis/persist";

type Rep = SessionPayload["reps"][number];
type Agg = SessionPayload["aggregates"];

const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Reconsolida remates de sesiones antiguas con sobreconteo (mismo criterio que
 * el motor: umbral = max(1100, 0.55·pico) + refractario 3 s). Idempotente para
 * sesiones nuevas ya correctas.
 */
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

/** ¿La sesión está sobredetectada? (el filtro reduce a menos del 60%). */
export function isOverDetected(reps: Rep[]): boolean {
  const c = consolidateReps(reps);
  return c.length > 0 && c.length < reps.length * 0.6;
}

/** Recalcula los agregados clave desde un conjunto de remates. */
export function recomputeAggregates(reps: Rep[], base: Agg): Agg {
  const pk = reps.map((r) => r.armPeakDps);
  const meanP = avg(pk);
  const m = meanP;
  const cv = m > 0 ? (Math.sqrt(avg(pk.map((v) => (v - m) ** 2))) / m) * 100 : 0;
  const paired = reps.filter((r) => r.lagMs != null);
  const okPct = paired.length ? (paired.filter((r) => r.sequencingOk).length / paired.length) * 100 : 0;
  const useSeq = paired.length >= 2;
  const speed = clamp((meanP / 2000) * 100, 0, 100);
  const cons = clamp(100 - cv, 0, 100);
  const quality = useSeq ? 0.4 * speed + 0.3 * okPct + 0.3 * cons : 0.6 * speed + 0.4 * cons;
  const jh = reps.map((r) => r.jumpHeightCm).filter((x): x is number => x != null);
  return {
    ...base,
    repCount: reps.length,
    armPeakBestDps: Math.max(...pk),
    armPeakMeanDps: meanP,
    armConsistencyCvPct: cv,
    sequencingOkPct: okPct,
    sequencingMeanLagMs: paired.length ? avg(paired.map((r) => r.lagMs!)) : null,
    load: pk.reduce((s, p) => s + p / 1000, 0),
    qualityIndex: quality,
    jumpBestCm: jh.length ? Math.max(...jh) : null,
  };
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

/** Frase descriptiva de un remate concreto. */
export function repNote(r: Rep): string {
  const power = r.armPeakDps >= 2000
    ? "Remate muy potente" + (r.armSaturated ? " (saturó el sensor)" : "")
    : r.armPeakDps >= 1200 ? "Remate potente" : "Remate suave";
  let seq: string;
  if (r.lagMs == null) seq = "no se detectó el tronco en este remate";
  else if (r.lagMs >= 10 && r.lagMs <= 150) seq = `buena secuencia: el tronco lideró y el brazo lo siguió (${r.lagMs} ms)`;
  else if (r.lagMs < 10) seq = `el brazo se adelantó al tronco (${r.lagMs} ms): pierdes potencia de la cadena`;
  else seq = `el brazo tardó mucho tras el tronco (+${r.lagMs} ms): se rompe la conexión`;
  return `${power}. ${seq.charAt(0).toUpperCase()}${seq.slice(1)}.`;
}

export interface Focus { tag: string; title: string; body: string; }

/** Elige el área de mejora prioritaria de la sesión. */
export function buildFocus(a: Agg): Focus {
  if (a.sequencingOkPct < 40) return {
    tag: "Foco principal", title: "Secuencia tronco → brazo",
    body: "Tu cadena cinética es lo que más margen tiene. En un buen remate el tronco gira primero y el brazo lo sigue como un látigo (10–150 ms después). Trabaja iniciar el golpe desde la rotación del tronco, no solo con el brazo.",
  };
  if (a.armConsistencyCvPct > 28) return {
    tag: "Foco principal", title: "Consistencia del gesto",
    body: "Tus remates varían bastante entre sí. Busca repetir la misma mecánica: misma carrera, mismo armado y mismo punto de contacto. La regularidad es la base para luego subir potencia.",
  };
  if (a.armPeakMeanDps < 1500) return {
    tag: "Foco principal", title: "Potencia y explosividad",
    body: "Hay margen para golpear más fuerte. Trabaja la velocidad del armado y el latigazo final de muñeca; la potencia nace de acelerar en el último tramo, no de empujar.",
  };
  return {
    tag: "Vas muy bien", title: "Mantén y pule",
    body: "Tu técnica es sólida. Sigue afinando la consistencia y la sincronización para subir el último escalón.",
  };
}

/** Media de time-to-peak de la sesión (explosividad). */
export function avgTimeToPeak(p: SessionPayload): number {
  const xs = p.reps.map((r) => r.armTimeToPeakMs).filter((v) => v != null && !isNaN(v));
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}

export const QUALITY_VERDICT = (q: number): string =>
  q >= 72 ? "Gran sesión, técnica sólida." : q >= 48 ? "Buena base, con margen claro de mejora." : "Sesión para construir técnica desde la base.";

export interface Range { min: number; max: number; a: number; b: number; invert?: boolean; }
/** Rangos ideales para la barra visual de cada métrica. */
export const RANGES = {
  peak: { min: 500, max: 2200, a: 1300, b: 2200 } as Range,
  seq: { min: 0, max: 100, a: 60, b: 100 } as Range,
  cv: { min: 0, max: 50, a: 0, b: 15, invert: true } as Range,
  ttp: { min: 50, max: 260, a: 50, b: 120, invert: true } as Range,
};
