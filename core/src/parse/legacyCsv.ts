/**
 * Parser del formato CSV original (texto por BLE UART).
 *
 * Tolerante a los defectos conocidos de los datos antiguos:
 *  - Cabeceras repetidas.
 *  - Filas con número de columnas incorrecto.
 *  - Registros concatenados sin salto de línea (bug de BLE): "...776.88ARM,11447,..."
 *  - Esquema de 10 columnas (sin batería) o 12 (con battery_v, battery_pct).
 *
 * Se conserva para analizar las capturas existentes y como validación de la
 * tubería frente al nuevo formato binario.
 */

import {
  ACCEL_SATURATION_G,
  GYRO_SATURATION_DPS,
} from "../constants.js";
import type { SensorId, SensorSample, SensorStream } from "../types.js";
import { median } from "../signal/stats.js";

const SENSOR_IDS: SensorId[] = ["ARM", "TORSO", "PELVIS"];

function isSaturatedGyro(gx: number, gy: number, gz: number): boolean {
  return (
    Math.abs(gx) >= GYRO_SATURATION_DPS ||
    Math.abs(gy) >= GYRO_SATURATION_DPS ||
    Math.abs(gz) >= GYRO_SATURATION_DPS
  );
}

function isSaturatedAcc(ax: number, ay: number, az: number): boolean {
  return (
    Math.abs(ax) >= ACCEL_SATURATION_G ||
    Math.abs(ay) >= ACCEL_SATURATION_G ||
    Math.abs(az) >= ACCEL_SATURATION_G
  );
}

/** Inserta saltos de línea antes de tokens de sensor pegados (recupera el bug). */
function normalizeConcatenation(text: string): string {
  return text.replace(/(?<!^)(?<![\r\n])(ARM|TORSO|PELVIS),/g, "\n$1,");
}

/** Parsea el texto CSV legacy y agrupa por sensor. */
export function parseLegacyCsv(text: string): SensorStream[] {
  const normalized = normalizeConcatenation(text);
  const lines = normalized.split(/\r?\n/);

  const bySensor = new Map<SensorId, SensorSample[]>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(",");
    const sensor = parts[0] as SensorId;
    if (!SENSOR_IDS.includes(sensor)) continue; // cabecera u otra cosa
    if (parts.length !== 10 && parts.length !== 12) continue;

    const nums = parts.slice(1).map((p) => Number(p));
    if (nums.some((x) => !Number.isFinite(x))) continue;

    const [t, ax, ay, az, gx, gy, gz, accMag, gyroMag, batV, batPct] = nums as number[];

    const sample: SensorSample = {
      t: t!,
      ax: ax!,
      ay: ay!,
      az: az!,
      gx: gx!,
      gy: gy!,
      gz: gz!,
      accMag: accMag!,
      gyroMag: gyroMag!,
      flags: {
        gyroSaturated: isSaturatedGyro(gx!, gy!, gz!),
        accSaturated: isSaturatedAcc(ax!, ay!, az!),
      },
    };

    const arr = bySensor.get(sensor) ?? [];
    arr.push(sample);
    bySensor.set(sensor, arr);

    // Conserva la última lectura de batería para el stream (si existe).
    if (parts.length === 12) {
      (sample as SensorSample & { _batV?: number; _batPct?: number })._batV = batV;
      (sample as SensorSample & { _batV?: number; _batPct?: number })._batPct = batPct;
    }
  }

  const streams: SensorStream[] = [];
  for (const [sensor, samples] of bySensor) {
    samples.sort((a, b) => a.t - b.t);
    streams.push({
      sensor,
      samples,
      fs: estimateFs(samples),
      batteryV: (samples.at(-1) as { _batV?: number } | undefined)?._batV,
      batteryPct: (samples.at(-1) as { _batPct?: number } | undefined)?._batPct,
    });
  }
  return streams;
}

/** Estima la frecuencia de muestreo a partir de la mediana de los intervalos. */
export function estimateFs(samples: SensorSample[]): number {
  if (samples.length < 2) return 0;
  const dts: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i]!.t - samples[i - 1]!.t;
    if (dt > 0) dts.push(dt);
  }
  const med = median(dts);
  return med > 0 ? 1000 / med : 0;
}
