/** Análisis en lenguaje claro: foco de mejora, notas por remate y rangos ideales. */
import type { SessionPayload } from "@/analysis/persist";

type Rep = SessionPayload["reps"][number];
type Agg = SessionPayload["aggregates"];

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
