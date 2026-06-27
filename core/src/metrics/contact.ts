/**
 * Detección del contacto con el balón a partir del sensor de muñeca.
 *
 * El impacto genera un transitorio agudo de aceleración justo en o tras el pico
 * de velocidad angular del brazo. Se busca el máximo de aceleración en una
 * ventana alrededor del pico de giro.
 */

import type { ContactInfo, ResampledStream } from "../types.js";

const CONTACT_MIN_G = 3.0; // umbral mínimo para considerar contacto

export function detectContact(arm: ResampledStream, armPeakIdx: number): ContactInfo {
  const { t, accMag, fs } = arm;
  const step = 1000 / fs;
  // Ventana: desde 30 ms antes del pico de giro hasta 180 ms después.
  const lo = Math.max(0, armPeakIdx - Math.round(30 / step));
  const hi = Math.min(t.length - 1, armPeakIdx + Math.round(180 / step));

  let bestIdx = -1;
  let bestVal = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (accMag[i]! > bestVal) {
      bestVal = accMag[i]!;
      bestIdx = i;
    }
  }

  if (bestIdx < 0 || bestVal < CONTACT_MIN_G) {
    return { contactTimeMs: null, contactAccG: bestVal === -Infinity ? 0 : bestVal, peakToContactMs: null };
  }

  const contactTimeMs = t[bestIdx]!;
  return {
    contactTimeMs,
    contactAccG: bestVal,
    peakToContactMs: contactTimeMs - t[armPeakIdx]!,
  };
}
