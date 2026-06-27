/**
 * Parser del protocolo binario del nuevo firmware (ver docs/ble-protocol.md).
 *
 * Trama:
 *   byte 0:        magic = 0xA1
 *   byte 1:        type  (0x01 DATA, 0x02 STATUS, 0x03 SYNC_ACK)
 *   byte 2:        payloadLen (uint8)
 *   byte 3..:      payload (payloadLen bytes)
 *   último byte:   crc8 sobre [type, payloadLen, payload]
 *
 * Payload DATA: seq u8, t0_ms u32, dt_us u16, count u8, luego count× muestra.
 * Muestra (13 bytes): int16 gx, gy, gz, ax, ay, az, uint8 flags (LE).
 *   bit0 = gyro saturado, bit1 = accel saturado.
 * Payload STATUS: battery_mv u16, battery_pct u8.
 *
 * El parser es streaming: se le inyectan chunks de notificaciones BLE (que no
 * tienen por qué alinearse con tramas) y emite los ítems completos decodificados.
 */

import {
  ACCEL_SENSITIVITY_G_PER_LSB,
  GYRO_SENSITIVITY_DPS_PER_LSB,
} from "../constants.js";
import type { SensorSample } from "../types.js";

export const FRAME_MAGIC = 0xa1;
export const TYPE_DATA = 0x01;
export const TYPE_STATUS = 0x02;
export const TYPE_SYNC_ACK = 0x03;

export type ParsedItem =
  | { type: "data"; seq: number; samples: SensorSample[] }
  | { type: "status"; batteryV: number; batteryPct: number }
  | { type: "syncAck" };

/** CRC-8 (poly 0x07, init 0x00) — debe coincidir con el firmware. */
export function crc8(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    crc ^= bytes[i]!;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function magnitude3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function decodeDataPayload(buf: Uint8Array, off: number, len: number): ParsedItem | null {
  const view = new DataView(buf.buffer, buf.byteOffset + off, len);
  const seq = view.getUint8(0);
  const t0 = view.getUint32(1, true);
  const dtUs = view.getUint16(5, true);
  const count = view.getUint8(7);
  const headerLen = 8;
  if (headerLen + count * 13 > len) return null; // payload incompleto/corrupto

  const samples: SensorSample[] = [];
  for (let i = 0; i < count; i++) {
    const b = headerLen + i * 13;
    const gxRaw = view.getInt16(b, true);
    const gyRaw = view.getInt16(b + 2, true);
    const gzRaw = view.getInt16(b + 4, true);
    const axRaw = view.getInt16(b + 6, true);
    const ayRaw = view.getInt16(b + 8, true);
    const azRaw = view.getInt16(b + 10, true);
    const flags = view.getUint8(b + 12);

    const gx = gxRaw * GYRO_SENSITIVITY_DPS_PER_LSB;
    const gy = gyRaw * GYRO_SENSITIVITY_DPS_PER_LSB;
    const gz = gzRaw * GYRO_SENSITIVITY_DPS_PER_LSB;
    const ax = axRaw * ACCEL_SENSITIVITY_G_PER_LSB;
    const ay = ayRaw * ACCEL_SENSITIVITY_G_PER_LSB;
    const az = azRaw * ACCEL_SENSITIVITY_G_PER_LSB;

    samples.push({
      t: t0 + (i * dtUs) / 1000,
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      accMag: magnitude3(ax, ay, az),
      gyroMag: magnitude3(gx, gy, gz),
      flags: {
        gyroSaturated: (flags & 0x01) !== 0,
        accSaturated: (flags & 0x02) !== 0,
      },
    });
  }
  return { type: "data", seq, samples };
}

/** Crea un parser streaming con buffer interno para tramas fragmentadas. */
export function createBinaryParser() {
  let buffer = new Uint8Array(0);

  function append(chunk: Uint8Array): void {
    const merged = new Uint8Array(buffer.length + chunk.length);
    merged.set(buffer, 0);
    merged.set(chunk, buffer.length);
    buffer = merged;
  }

  return {
    /** Inyecta un chunk y devuelve los ítems completos decodificados. */
    push(chunk: Uint8Array): ParsedItem[] {
      append(chunk);
      const out: ParsedItem[] = [];
      let i = 0;
      while (i < buffer.length) {
        // Buscar magic.
        if (buffer[i] !== FRAME_MAGIC) {
          i++;
          continue;
        }
        if (i + 3 > buffer.length) break; // falta cabecera
        const type = buffer[i + 1]!;
        const payloadLen = buffer[i + 2]!;
        const frameLen = 3 + payloadLen + 1; // magic+type+len + payload + crc
        if (i + frameLen > buffer.length) break; // trama incompleta, esperar más

        const crcCalc = crc8(buffer, i + 1, i + 3 + payloadLen);
        const crcGot = buffer[i + 3 + payloadLen]!;
        if (crcCalc !== crcGot) {
          i++; // crc inválido → reencuadrar desde el siguiente byte
          continue;
        }

        const payOff = i + 3;
        if (type === TYPE_DATA) {
          const item = decodeDataPayload(buffer, payOff, payloadLen);
          if (item) out.push(item);
        } else if (type === TYPE_STATUS) {
          const view = new DataView(buffer.buffer, buffer.byteOffset + payOff, payloadLen);
          out.push({
            type: "status",
            batteryV: view.getUint16(0, true) / 1000,
            batteryPct: view.getUint8(2),
          });
        } else if (type === TYPE_SYNC_ACK) {
          out.push({ type: "syncAck" });
        }
        i += frameLen;
      }
      buffer = buffer.slice(i);
      return out;
    },
    reset(): void {
      buffer = new Uint8Array(0);
    },
  };
}
