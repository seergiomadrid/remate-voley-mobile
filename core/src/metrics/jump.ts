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

const MIN_FLIGHT_MS = 120;
const MAX_FLIGHT_MS = 1100;
const NONE: JumpMetrics = {
  flightTimeS: null, jumpHeightCm: null, takeoffAccG: null, landingAccG: null, contactInFlightPct: null,
};

/**
 * Detecta el salto alrededor del instante del remate (contactMs) usando el
 * sensor de torso. En vuelo el acelerómetro mide ~0 g (caída libre): se busca
 * el tramo de baja aceleración más largo cerca del remate. Devuelve además
 * dónde cae el remate dentro del vuelo (0 despegue, 50 punto alto, 100 aterrizaje).
 *
 * Estimación honesta con un solo IMU: el vuelo del tronco no es caída libre pura
 * (piernas/brazo añaden aceleración), así que sirve como tendencia. La captura
 * por evento a alta frecuencia lo haría más preciso (ver docs/biomecanica.md).
 */
export function detectJump(torso: ResampledStream, contactMs: number): JumpMetrics {
  const { t, accMag, fs } = torso;
  const step = 1000 / fs;

  // Ventana amplia: despegue bastante antes del contacto y aterrizaje después.
  const lo = Math.max(0, Math.round((contactMs - 900 - t[0]!) / step));
  const hi = Math.min(t.length - 1, Math.round((contactMs + 900 - t[0]!) / step));

  // Tramo de caída libre (baja aceleración) más largo dentro de la ventana.
  // Las muestras en hueco (interpolación tras desconexión) NO cuentan como
  // caída libre: un hueco interpolado a baja aceleración simularía un vuelo falso.
  let bestStart = -1, bestLen = 0, curStart = -1;
  for (let i = lo; i <= hi; i++) {
    if (accMag[i]! < FREEFALL_THRESHOLD_G && !torso.gap[i]) {
      if (curStart < 0) curStart = i;
    } else if (curStart >= 0) {
      if (i - curStart > bestLen) { bestLen = i - curStart; bestStart = curStart; }
      curStart = -1;
    }
  }
  if (curStart >= 0 && hi - curStart > bestLen) { bestLen = hi - curStart; bestStart = curStart; }

  const flightMs = bestLen * step;
  if (bestStart < 0 || flightMs < MIN_FLIGHT_MS || flightMs > MAX_FLIGHT_MS) return NONE;

  const flightTimeS = flightMs / 1000;
  const jumpHeightCm = ((G_MS2 * flightTimeS * flightTimeS) / 8) * 100;

  const flightEnd = bestStart + bestLen;
  const takeoffLo = Math.max(0, bestStart - Math.round(180 / step));
  const takeoffAccG = max(accMag.slice(takeoffLo, bestStart + 1));
  const landingHi = Math.min(t.length - 1, flightEnd + Math.round(180 / step));
  const landingAccG = max(accMag.slice(flightEnd, landingHi + 1));

  // Momento del remate dentro del vuelo (%). Ideal ~50 (punto más alto).
  const flightStartMs = t[bestStart]!;
  let contactInFlightPct: number | null = (contactMs - flightStartMs) / flightMs * 100;
  contactInFlightPct = Math.max(0, Math.min(100, contactInFlightPct));

  return { flightTimeS, jumpHeightCm, takeoffAccG, landingAccG, contactInFlightPct };
}
