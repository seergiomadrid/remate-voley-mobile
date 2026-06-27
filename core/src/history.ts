/**
 * Estadísticas entre sesiones (histórico): récords, tendencias y carga ACWR
 * (acute:chronic workload ratio) para prevención de lesiones.
 */

import { mean } from "./signal/stats.js";

export interface SessionLoadPoint {
  /** Marca de tiempo de la sesión (epoch ms). */
  dateMs: number;
  /** Carga de la sesión (SessionAggregates.load). */
  load: number;
}

export interface AcwrResult {
  /** Carga aguda: total de los últimos 7 días. */
  acute: number;
  /** Carga crónica: media semanal de los últimos 28 días. */
  chronic: number;
  /** Ratio agudo:crónico. Zona "óptima" ≈ 0.8–1.3; >1.5 = riesgo elevado. */
  ratio: number | null;
  zone: "baja" | "optima" | "elevada" | "desconocida";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calcula el ACWR a una fecha de referencia (por defecto, la última sesión). */
export function computeAcwr(points: SessionLoadPoint[], referenceMs?: number): AcwrResult {
  if (points.length === 0) {
    return { acute: 0, chronic: 0, ratio: null, zone: "desconocida" };
  }
  const ref = referenceMs ?? Math.max(...points.map((p) => p.dateMs));

  const acute = points
    .filter((p) => p.dateMs > ref - 7 * DAY_MS && p.dateMs <= ref)
    .reduce((s, p) => s + p.load, 0);

  const chronicTotal = points
    .filter((p) => p.dateMs > ref - 28 * DAY_MS && p.dateMs <= ref)
    .reduce((s, p) => s + p.load, 0);
  const chronic = chronicTotal / 4; // media semanal de 4 semanas

  let ratio: number | null = null;
  let zone: AcwrResult["zone"] = "desconocida";
  if (chronic > 0) {
    ratio = acute / chronic;
    zone = ratio < 0.8 ? "baja" : ratio <= 1.3 ? "optima" : "elevada";
  }
  return { acute, chronic, ratio, zone };
}

export interface TrendPoint {
  dateMs: number;
  value: number;
}

/** Media móvil de una serie temporal (para suavizar tendencias en el dashboard). */
export function rollingMean(points: TrendPoint[], window: number): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.dateMs - b.dateMs);
  return sorted.map((p, i) => {
    const lo = Math.max(0, i - window + 1);
    const slice = sorted.slice(lo, i + 1).map((x) => x.value);
    return { dateMs: p.dateMs, value: mean(slice) };
  });
}
