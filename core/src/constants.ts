/**
 * Constantes físicas y de configuración del sensor.
 *
 * Hardware: Seeed XIAO nRF52840 Sense → IMU LSM6DS3TR-C.
 * Documentación: docs/biomecanica.md y docs/ble-protocol.md
 */

/** Gravedad estándar (m/s²). */
export const G_MS2 = 9.80665;

/**
 * Rango de fondo de escala del giroscopio configurado en firmware (±2000 dps,
 * el máximo del LSM6DS3). Sensibilidad 70 mdps/LSB → máximo real ≈ 2293.69 dps.
 */
export const GYRO_FS_DPS = 2000;
export const GYRO_SENSITIVITY_DPS_PER_LSB = 0.07; // 70 mdps/LSB
export const GYRO_MAX_DPS = 32767 * GYRO_SENSITIVITY_DPS_PER_LSB; // ≈ 2293.69

/**
 * Rango de fondo de escala del acelerómetro (±16 g, el máximo del LSM6DS3).
 * Sensibilidad 0.488 mg/LSB → máximo real ≈ 15.99 g.
 */
export const ACCEL_FS_G = 16;
export const ACCEL_SENSITIVITY_G_PER_LSB = 0.000488; // 0.488 mg/LSB
export const ACCEL_MAX_G = 32767 * ACCEL_SENSITIVITY_G_PER_LSB; // ≈ 15.99

/**
 * Umbrales de saturación (por componente). Si |valor| supera el umbral, la
 * muestra se marca como saturada y los picos derivados se reportan como cota
 * inferior, no como medida fiable.
 */
export const GYRO_SATURATION_DPS = 2000;
export const ACCEL_SATURATION_G = 15.0;

/** Frecuencia objetivo de remuestreo a base de tiempo común (Hz). */
export const RESAMPLE_HZ = 200;

/**
 * Umbrales biomecánicos de referencia (literatura de deportes overhead).
 * - Rotación interna de hombro en el remate: hasta ~2594 °/s (satura el sensor).
 * - Detección de actividad de brazo: velocidad angular > ~400 °/s.
 */
export const ARM_ACTIVITY_GATE_DPS = 400;

/** Caída libre: |acc| por debajo de este valor indica fase de vuelo del salto. */
export const FREEFALL_THRESHOLD_G = 0.35;

/** Ventana máxima (ms) para emparejar un pico de torso con uno de brazo. */
export const PAIR_MAX_DELAY_MS = 300;

/**
 * Rango de lag torso→brazo considerado buena secuencia proximal→distal (ms).
 * Positivo = el torso alcanza el pico antes que el brazo (correcto).
 */
export const SEQUENCING_GOOD_MIN_MS = 10;
export const SEQUENCING_GOOD_MAX_MS = 150;
