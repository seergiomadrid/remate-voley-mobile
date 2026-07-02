/** Construye el payload serializable de una sesión a partir del análisis. */
import type { AnalyzeResult, ResampledStream, RepScore } from "@core";

export interface TracePayload {
  t: number[];
  gyro: number[];
  acc: number[];
  peaks: number[];
}

/** Nota serializada de un remate (modelo élite). */
export interface RepScorePayload {
  total: number;
  capMax: number;
  power: number | null;
  chain: number | null;
  explosive: number | null;
  jumpTiming: number | null;
  weakest: string | null;
  advice: string;
}

export interface SessionPayload {
  startedAtIso: string;
  startedAtMs: number;
  aggregates: AnalyzeResult["aggregates"];
  tips: AnalyzeResult["tips"];
  clockOffsetMs: number;
  syncConfidence: number;
  reps: {
    index: number;
    timeMs: number;
    armPeakDps: number;
    armEstPeakDps: number;
    armSaturated: boolean;
    armTimeToPeakMs: number;
    armShape: string;
    torsoPeakDps: number | null;
    lagMs: number | null;
    sequencingOk: boolean;
    jumpHeightCm: number | null;
    flightTimeS: number | null;
    contactInFlightPct: number | null;
    contactAccG: number;
    score: RepScorePayload | null;
  }[];
  traces: { arm: TracePayload; torso: TracePayload | null };
}

function packScore(s: RepScore | undefined): RepScorePayload | null {
  if (!s) return null;
  const r1 = (v: number | null) => (v != null ? Math.round(v) : null);
  return {
    total: Math.round(s.total),
    capMax: Math.round(s.capMax),
    power: r1(s.components.power.score),
    chain: r1(s.components.chain.score),
    explosive: r1(s.components.explosive.score),
    jumpTiming: r1(s.components.jumpTiming.score),
    weakest: s.weakest,
    advice: s.advice,
  };
}

function downsample(stream: ResampledStream, peaks: number[], maxPoints = 600): TracePayload {
  const n = stream.t.length;
  const k = Math.max(1, Math.ceil(n / maxPoints));
  const t: number[] = [];
  const gyro: number[] = [];
  const acc: number[] = [];
  for (let i = 0; i < n; i += k) {
    t.push(Math.round(stream.t[i]!));
    gyro.push(Math.round(stream.gyroSmooth[i]!));
    acc.push(Math.round(stream.accMag[i]! * 100) / 100);
  }
  return { t, gyro, acc, peaks: peaks.map((p) => Math.round(p / k)) };
}

export function buildSessionPayload(result: AnalyzeResult, startedAtMs: number): SessionPayload {
  return {
    startedAtIso: new Date(startedAtMs).toISOString(),
    startedAtMs,
    aggregates: result.aggregates,
    tips: result.tips,
    clockOffsetMs: Math.round(result.clockOffsetMs),
    syncConfidence: Math.round(result.syncConfidence * 100) / 100,
    reps: result.reps.map((r) => ({
      index: r.index,
      timeMs: Math.round(r.timeMs),
      armPeakDps: Math.round(r.arm.peakGyroDps),
      armEstPeakDps: Math.round(r.arm.estPeakGyroDps),
      armSaturated: r.arm.peakGyroSaturated,
      armTimeToPeakMs: Math.round(r.arm.timeToPeakMs),
      armShape: r.arm.shape,
      torsoPeakDps: r.torso ? Math.round(r.torso.peakGyroDps) : null,
      lagMs: r.sequencingLagMs != null ? Math.round(r.sequencingLagMs) : null,
      sequencingOk: r.sequencingOk,
      jumpHeightCm: r.jump.jumpHeightCm != null ? Math.round(r.jump.jumpHeightCm) : null,
      flightTimeS: r.jump.flightTimeS != null ? Math.round(r.jump.flightTimeS * 100) / 100 : null,
      contactInFlightPct: r.jump.contactInFlightPct != null ? Math.round(r.jump.contactInFlightPct) : null,
      contactAccG: Math.round(r.contact.contactAccG * 10) / 10,
      score: packScore(r.score),
    })),
    traces: {
      arm: downsample(result.prepared.arm, result.prepared.armPeaks),
      torso: result.prepared.torso ? downsample(result.prepared.torso, result.prepared.torsoPeaks) : null,
    },
  };
}
