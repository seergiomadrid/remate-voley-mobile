/** Punto de entrada de @remate-voley/core. */

export * from "./types.js";
export * from "./constants.js";

// Parsing
export { parseLegacyCsv, estimateFs } from "./parse/legacyCsv.js";
export { createBinaryParser, crc8, FRAME_MAGIC, TYPE_DATA, TYPE_STATUS, TYPE_SYNC_ACK } from "./parse/binary.js";
export type { ParsedItem } from "./parse/binary.js";

// Señal
export { filtfiltLowpass, centeredMovingAverage, butterworthLowpassCoeffs } from "./signal/filter.js";
export { resampleLinear, resampleFlag } from "./signal/resample.js";
export { findPeaks, adaptiveThreshold } from "./signal/peaks.js";
export * as stats from "./signal/stats.js";

// Sincronización y preparación
export { estimateClockOffset, crossCorrelate } from "./sync.js";
export type { SyncResult } from "./sync.js";
export { prepareStreams } from "./prepare.js";

// Métricas
export { swingMetricsAt } from "./metrics/swing.js";
export { detectContact } from "./metrics/contact.js";
export { detectJump } from "./metrics/jump.js";
export { buildReps } from "./metrics/sequencing.js";
export { computeAggregates } from "./metrics/session.js";
export {
  scoreRep, scoreSession, scorePower, scoreChainLag, scoreTorsoMag,
  scoreExplosive, scoreJumpTiming, scoreConsistency, QUALITY_WEIGHTS,
} from "./metrics/quality.js";
export type { SessionQuality } from "./metrics/quality.js";

// Coaching e histórico
export { generateTips } from "./coaching.js";
export { computeAcwr, rollingMean } from "./history.js";
export type { AcwrResult, SessionLoadPoint, TrendPoint } from "./history.js";

// Pipeline
export { analyzeSession } from "./pipeline.js";
export type { AnalyzeOptions, AnalyzeResult } from "./pipeline.js";
