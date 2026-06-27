/**
 * Construye series uniformes y sincronizadas (ResampledStream) a partir de los
 * streams crudos, aplicando el offset de reloj y el filtrado de fase cero.
 */

import { RESAMPLE_HZ } from "./constants.js";
import { filtfiltLowpass } from "./signal/filter.js";
import { resampleLinear, resampleFlag } from "./signal/resample.js";
import type { ResampledStream, SensorStream } from "./types.js";

/** Frecuencias de corte del paso-bajo (Hz). */
const GYRO_CUTOFF_HZ = 15; // preserva el pico del swing, quita ruido
const ACC_CUTOFF_HZ = 25;

function prepareOne(stream: SensorStream, offsetMs: number, tStart: number, tEnd: number): ResampledStream {
  const fs = RESAMPLE_HZ;
  const s = stream.samples;
  const t = s.map((x) => x.t + offsetMs);
  const gyro = resampleLinear({ t, v: s.map((x) => x.gyroMag) }, tStart, tEnd, fs);
  const acc = resampleLinear({ t, v: s.map((x) => x.accMag) }, tStart, tEnd, fs);
  const gyroSat = resampleFlag(t, s.map((x) => x.flags.gyroSaturated), tStart, tEnd, fs);
  const accSat = resampleFlag(t, s.map((x) => x.flags.accSaturated), tStart, tEnd, fs);

  return {
    sensor: stream.sensor,
    t: gyro.t,
    fs,
    gyroMag: gyro.v,
    accMag: acc.v,
    gyroSmooth: filtfiltLowpass(gyro.v, GYRO_CUTOFF_HZ, fs),
    accSmooth: filtfiltLowpass(acc.v, ACC_CUTOFF_HZ, fs),
    gyroSaturated: gyroSat,
    accSaturated: accSat,
  };
}

/**
 * Prepara arm y torso en una rejilla común (reloj de referencia = ARM).
 * torso se desplaza por offsetMs; arm con offset 0.
 */
export function prepareStreams(
  arm: SensorStream,
  torso: SensorStream | null,
  offsetMs: number,
): { arm: ResampledStream; torso: ResampledStream | null } {
  const armT = arm.samples.map((x) => x.t);
  let tStart = armT.length ? Math.min(...armT) : 0;
  let tEnd = armT.length ? Math.max(...armT) : 0;

  if (torso && torso.samples.length) {
    const torsoT = torso.samples.map((x) => x.t + offsetMs);
    tStart = Math.min(tStart, Math.min(...torsoT));
    tEnd = Math.max(tEnd, Math.max(...torsoT));
  }

  return {
    arm: prepareOne(arm, 0, tStart, tEnd),
    torso: torso ? prepareOne(torso, offsetMs, tStart, tEnd) : null,
  };
}
