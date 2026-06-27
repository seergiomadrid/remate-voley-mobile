/** Modelo de datos compartido por toda la librería. */

/** Identificador de la ubicación del sensor. Extensible a 'PELVIS' (3er sensor). */
export type SensorId = "ARM" | "TORSO" | "PELVIS";

/** Bits de estado por muestra (saturación de cada sensor). */
export interface SampleFlags {
  gyroSaturated: boolean;
  accSaturated: boolean;
}

/** Una muestra cruda de un IMU, en el reloj local de su placa. */
export interface SensorSample {
  /** Timestamp en ms desde el arranque de la placa (reloj local, sin sincronizar). */
  t: number;
  ax: number; // g
  ay: number; // g
  az: number; // g
  gx: number; // dps
  gy: number; // dps
  gz: number; // dps
  /** Magnitud resultante de aceleración (g). */
  accMag: number;
  /** Magnitud resultante de velocidad angular (dps). */
  gyroMag: number;
  flags: SampleFlags;
}

/** Stream de un sensor: muestras + metadatos. */
export interface SensorStream {
  sensor: SensorId;
  samples: SensorSample[];
  /** Frecuencia de muestreo estimada (Hz). */
  fs: number;
  /** Tensión de batería más reciente (V), si está disponible. */
  batteryV?: number;
  /** Porcentaje de batería más reciente, si está disponible. */
  batteryPct?: number;
}

/** Serie temporal uniforme tras remuestreo y sincronización. */
export interface ResampledStream {
  sensor: SensorId;
  /** Base de tiempo común y uniforme (ms en el reloj de referencia). */
  t: Float64Array;
  fs: number;
  accMag: Float64Array;
  gyroMag: Float64Array;
  /** gyroMag suavizado (filtro de fase cero). */
  gyroSmooth: Float64Array;
  /** accMag suavizado. */
  accSmooth: Float64Array;
  /** true si alguna muestra de la ventana original estaba saturada. */
  gyroSaturated: Uint8Array;
  accSaturated: Uint8Array;
}

/** Métricas de un swing detectado en un único sensor. */
export interface SwingMetrics {
  /** Instante del pico en la base de tiempo común (ms). */
  peakTimeMs: number;
  /** Pico de velocidad angular resultante (dps). */
  peakGyroDps: number;
  /** true si el pico está saturado (subestimado). */
  peakGyroSaturated: boolean;
  /** Pico de aceleración resultante en la ventana (g). */
  peakAccG: number;
  peakAccSaturated: boolean;
  /** Tiempo desde el inicio del gesto hasta el pico (ms) → explosividad. */
  timeToPeakMs: number;
  /** Anchura de la parte alta del pico (ms) → latigazo vs empuje. */
  peakWidthMs: number;
  /** Clasificación de la forma del gesto. */
  shape: "latigazo" | "intermedio" | "empuje" | "no_clasificado";
}

/** Resultado de la detección de contacto con el balón (sensor de brazo). */
export interface ContactInfo {
  /** Instante de contacto estimado (ms en base común), o null si no se detecta. */
  contactTimeMs: number | null;
  /** Pico de aceleración en el contacto (g). */
  contactAccG: number;
  /** Tiempo desde el pico de velocidad angular del brazo al contacto (ms). */
  peakToContactMs: number | null;
}

/** Métricas de salto derivadas del sensor de torso. */
export interface JumpMetrics {
  /** Tiempo de vuelo (s), o null si no se detecta un salto en la rep. */
  flightTimeS: number | null;
  /** Altura estimada (cm) por tiempo de vuelo: h = g·t²/8. */
  jumpHeightCm: number | null;
  /** Pico de aceleración en el despegue (g). */
  takeoffAccG: number | null;
  /** Pico de aceleración en el aterrizaje (g) → carga de impacto. */
  landingAccG: number | null;
}

/** Una repetición (remate) emparejando torso y brazo. */
export interface Rep {
  index: number;
  /** Instante de referencia de la rep (pico de brazo, ms en base común). */
  timeMs: number;
  arm: SwingMetrics;
  torso: SwingMetrics | null;
  contact: ContactInfo;
  jump: JumpMetrics;
  /** Lag torso→brazo (ms). Positivo = torso antes (secuencia proximal→distal correcta). */
  sequencingLagMs: number | null;
  /** true si el orden proximal→distal es correcto y dentro del rango bueno. */
  sequencingOk: boolean;
}

/** Estadísticas agregadas de una sesión. */
export interface SessionAggregates {
  repCount: number;
  // Brazo
  armPeakBestDps: number;
  armPeakMeanDps: number;
  armPeakStdDps: number;
  /** Coeficiente de variación del pico de brazo (%). Menor = más consistente. */
  armConsistencyCvPct: number;
  /** Nº de reps con pico de brazo saturado (medida poco fiable). */
  armSaturatedCount: number;
  // Salto
  jumpBestCm: number | null;
  jumpMeanCm: number | null;
  // Secuenciación
  sequencingMeanLagMs: number | null;
  sequencingOkPct: number;
  // Fatiga: % de caída del pico de brazo entre el primer y el último tercio de la sesión.
  fatigueDropPct: number | null;
  /** Carga de la sesión (suma de intensidad ~ volumen×intensidad). */
  load: number;
  /** Índice compuesto de calidad de remate (0–100). */
  qualityIndex: number;
}

/** Un consejo del motor de feedback. */
export interface CoachingTip {
  severity: "info" | "good" | "warn";
  category: "secuenciacion" | "explosividad" | "consistencia" | "fatiga" | "salto" | "tecnica";
  message: string;
}

/** Resultado completo del análisis de una sesión. */
export interface SessionAnalysis {
  reps: Rep[];
  aggregates: SessionAggregates;
  tips: CoachingTip[];
  /** Offset de reloj aplicado: t_torso_común = t_torso_local + offsetMs. */
  clockOffsetMs: number;
  /** Frecuencia de muestreo efectiva estimada por sensor (Hz). */
  effectiveFs: Record<string, number>;
}
