/**
 * Filtros de señal. Sustituyen la media móvil ingenua del análisis original por
 * un paso-bajo Butterworth de fase cero (filtfilt), que elimina el ruido sin
 * desplazar temporalmente los picos (crítico para medir tiempos al ms).
 */

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * Coeficientes de un Butterworth paso-bajo de 2º orden (Q = 1/√2) por
 * transformada bilineal. fc = frecuencia de corte (Hz), fs = muestreo (Hz).
 */
export function butterworthLowpassCoeffs(fc: number, fs: number): BiquadCoeffs {
  const K = Math.tan((Math.PI * fc) / fs);
  const Q = Math.SQRT1_2; // 0.70710678 → Butterworth
  const norm = 1 / (1 + K / Q + K * K);
  const b0 = K * K * norm;
  const b1 = 2 * b0;
  const b2 = b0;
  const a1 = 2 * (K * K - 1) * norm;
  const a2 = (1 - K / Q + K * K) * norm;
  return { b0, b1, b2, a1, a2 };
}

/** Aplica un biquad hacia delante (introduce desfase; usar dentro de filtfilt). */
function applyBiquadForward(x: ArrayLike<number>, c: BiquadCoeffs): Float64Array {
  const n = x.length;
  const y = new Float64Array(n);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i]!;
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

/**
 * Filtro de fase cero (filtfilt): aplica el biquad hacia delante y hacia atrás,
 * con padding por reflexión para reducir transitorios en los bordes.
 */
export function filtfiltLowpass(x: ArrayLike<number>, fc: number, fs: number): Float64Array {
  const n = x.length;
  if (n < 9) return Float64Array.from(x as ArrayLike<number>);

  const c = butterworthLowpassCoeffs(Math.min(fc, fs / 2 - 1), fs);
  const pad = Math.min(n - 1, 12);

  // Padding por reflexión alrededor del primer/último valor.
  const ext = new Float64Array(n + 2 * pad);
  const x0 = x[0]!;
  const xn = x[n - 1]!;
  for (let i = 0; i < pad; i++) ext[i] = 2 * x0 - x[pad - i]!;
  for (let i = 0; i < n; i++) ext[pad + i] = x[i]!;
  for (let i = 0; i < pad; i++) ext[pad + n + i] = 2 * xn - x[n - 2 - i]!;

  // Forward.
  const fwd = applyBiquadForward(ext, c);
  // Backward (reverse, filter, reverse).
  fwd.reverse();
  const bwd = applyBiquadForward(fwd, c);
  bwd.reverse();

  return bwd.slice(pad, pad + n);
}

/** Media móvil centrada (ventana forzada a impar → fase cero). */
export function centeredMovingAverage(x: ArrayLike<number>, window: number): Float64Array {
  const n = x.length;
  const w = window % 2 === 0 ? window + 1 : window;
  const half = (w - 1) / 2;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < n) {
        s += x[j]!;
        count++;
      }
    }
    y[i] = s / count;
  }
  return y;
}
