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
  TORSO_MIN_DPS,
} from "../constants.js";
import type { JumpMetrics, Rep, ResampledStream } from "../types.js";
import { detectContact } from "./contact.js";
import { detectJump } from "./jump.js";
import { swingMetricsAt } from "./swing.js";

const NO_JUMP: JumpMetrics = {
  flightTimeS: null, jumpHeightCm: null, takeoffAccG: null, landingAccG: null, contactInFlightPct: null,
};

/**
 * Para un remate (pico de brazo en t_arm), localiza el pico de rotación del
 * tronco que lo precede: argmax de la velocidad angular del torso en la ventana
 * [t_arm − maxDelay, t_arm + 50 ms]. Más robusto que emparejar listas de picos.
 */
function torsoPeakBefore(torso: ResampledStream, tArmMs: number, maxDelayMs: number): number | null {
  const step = 1000 / torso.fs;
  const lo = Math.max(0, Math.round((tArmMs - maxDelayMs - torso.t[0]!) / step));
  const hi = Math.min(torso.t.length - 1, Math.round((tArmMs + 50 - torso.t[0]!) / step));
  let bestI = -1, bestV = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (torso.gyroSmooth[i]! > bestV) { bestV = torso.gyroSmooth[i]!; bestI = i; }
  }
  return bestI >= 0 && bestV >= TORSO_MIN_DPS ? bestI : null;
}

export function buildReps(
  arm: ResampledStream,
  torso: ResampledStream | null,
  armPeaks: number[],
  _torsoPeaks: number[],
  windowMs = 300,
): Rep[] {
  const reps: Rep[] = [];
  let idx = 0;
  for (const ai of armPeaks) {
    const armSwing = swingMetricsAt(arm, ai, windowMs);
    const contact = detectContact(arm, ai);

    let torsoSwing = null;
    let lag: number | null = null;
    let seqOk = false;
    let jump: JumpMetrics = NO_JUMP;

    if (torso) {
      const ti = torsoPeakBefore(torso, arm.t[ai]!, PAIR_MAX_DELAY_MS);
      if (ti !== null) {
        torsoSwing = swingMetricsAt(torso, ti, windowMs);
        lag = arm.t[ai]! - torso.t[ti]!;
        seqOk = lag >= SEQUENCING_GOOD_MIN_MS && lag <= SEQUENCING_GOOD_MAX_MS;
      }
      // El instante de contacto (o el pico de brazo) es el momento del remate.
      jump = detectJump(torso, contact.contactTimeMs ?? arm.t[ai]!);
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
