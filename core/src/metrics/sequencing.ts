/**
 * Ensamblado de repeticiones (remates) y secuenciación cinética torso→brazo.
 *
 * El sello de un remate eficiente es la secuencia proximal→distal: el tronco
 * alcanza su pico de rotación ANTES que el brazo, transfiriendo energía hacia la
 * mano. Con relojes ya sincronizados, lag = t_pico_brazo − t_pico_torso:
 *   lag > 0 → torso primero (correcto).
 */

import {
  PAIR_MAX_DELAY_MS,
  SEQUENCING_GOOD_MAX_MS,
  SEQUENCING_GOOD_MIN_MS,
} from "../constants.js";
import type { JumpMetrics, Rep, ResampledStream } from "../types.js";
import { detectContact } from "./contact.js";
import { detectJump } from "./jump.js";
import { swingMetricsAt } from "./swing.js";

/** Empareja de forma única cada pico de brazo con el pico de torso más cercano. */
function pairPeaks(
  armT: ArrayLike<number>,
  armPeaks: number[],
  torsoT: ArrayLike<number> | null,
  torsoPeaks: number[],
  maxDelayMs: number,
): Map<number, number> {
  const map = new Map<number, number>();
  if (!torsoT || torsoPeaks.length === 0) return map;

  const candidates: { ai: number; ti: number; absDelay: number }[] = [];
  for (const ai of armPeaks) {
    for (const ti of torsoPeaks) {
      const delay = Math.abs(armT[ai]! - torsoT[ti]!);
      if (delay <= maxDelayMs) candidates.push({ ai, ti, absDelay: delay });
    }
  }
  candidates.sort((a, b) => a.absDelay - b.absDelay);

  const usedArm = new Set<number>();
  const usedTorso = new Set<number>();
  for (const c of candidates) {
    if (usedArm.has(c.ai) || usedTorso.has(c.ti)) continue;
    usedArm.add(c.ai);
    usedTorso.add(c.ti);
    map.set(c.ai, c.ti);
  }
  return map;
}

export function buildReps(
  arm: ResampledStream,
  torso: ResampledStream | null,
  armPeaks: number[],
  torsoPeaks: number[],
  windowMs = 300,
): Rep[] {
  const pairing = pairPeaks(arm.t, armPeaks, torso?.t ?? null, torsoPeaks, PAIR_MAX_DELAY_MS);

  const reps: Rep[] = [];
  let idx = 0;
  for (const ai of armPeaks) {
    const armSwing = swingMetricsAt(arm, ai, windowMs);
    const contact = detectContact(arm, ai);

    let torsoSwing = null;
    let lag: number | null = null;
    let seqOk = false;
    let jump: JumpMetrics = { flightTimeS: null, jumpHeightCm: null, takeoffAccG: null, landingAccG: null };

    if (torso) {
      const ti = pairing.get(ai);
      if (ti !== undefined) {
        torsoSwing = swingMetricsAt(torso, ti, windowMs);
        lag = arm.t[ai]! - torso.t[ti]!;
        seqOk = lag >= SEQUENCING_GOOD_MIN_MS && lag <= SEQUENCING_GOOD_MAX_MS;
      }
      jump = detectJump(torso, arm.t[ai]!);
    }

    reps.push({
      index: idx++,
      timeMs: arm.t[ai]!,
      arm: armSwing,
      torso: torsoSwing,
      contact,
      jump,
      sequencingLagMs: lag,
      sequencingOk: seqOk,
    });
  }
  return reps;
}
