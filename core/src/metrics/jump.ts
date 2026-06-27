/**
 * Métricas de salto a partir del sensor de torso (próximo al centro de masas
 * del tronco). En vuelo, el acelerómetro mide ~0 g (caída libre), de forma
 * independiente de la orientación. Se detecta la fase de vuelo por una región
 * sostenida de aceleración baja en torno a la repetición.
 *
 * Aproximación honesta: con un solo IMU el tiempo de vuelo es estimado; sirve
 * como tendencia/relativo. La captura por evento y/o un sensor de cadera lo
 * harían más preciso (ver docs/biomecanica.md).
 */

import { FREEFALL_THRESHOLD_G, G_MS2 } from "../constants.js";
import { max } from "../signal/stats.js";
import type { JumpMetrics, ResampledStream } from "../types.js";

const MIN_FLIGHT_MS = 150;
const MAX_FLIGHT_MS = 1200;

export function detectJump(torso: ResampledStream, repTimeMs: number): JumpMetrics {
  const { t, accMag, fs } = torso;
  const step = 1000 / fs;

  // Buscar en una ventana que cubra el despegue antes del remate y el aterrizaje.
  const lo = Math.max(0, Math.round((repTimeMs - 1200 - t[0]!) / step));
  const hi = Math.min(t.length - 1, Math.round((repTimeMs + 500 - t[0]!) / step));

  // Encontrar el tramo de caída libre más largo dentro de la ventana.
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  for (let i = lo; i <= hi; i++) {
    if (accMag[i]! < FREEFALL_THRESHOLD_G) {
      if (curStart < 0) curStart = i;
    } else {
      if (curStart >= 0) {
        const len = i - curStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = curStart;
        }
        curStart = -1;
      }
    }
  }
  if (curStart >= 0 && hi - curStart > bestLen) {
    bestLen = hi - curStart;
    bestStart = curStart;
  }

  const flightMs = bestLen * step;
  if (bestStart < 0 || flightMs < MIN_FLIGHT_MS || flightMs > MAX_FLIGHT_MS) {
    return { flightTimeS: null, jumpHeightCm: null, takeoffAccG: null, landingAccG: null };
  }

  const flightTimeS = flightMs / 1000;
  const jumpHeightCm = ((G_MS2 * flightTimeS * flightTimeS) / 8) * 100;

  const flightEnd = bestStart + bestLen;
  const takeoffLo = Math.max(0, bestStart - Math.round(150 / step));
  const takeoffAccG = max(accMag.slice(takeoffLo, bestStart + 1));
  const landingHi = Math.min(t.length - 1, flightEnd + Math.round(150 / step));
  const landingAccG = max(accMag.slice(flightEnd, landingHi + 1));

  return { flightTimeS, jumpHeightCm, takeoffAccG, landingAccG };
}
