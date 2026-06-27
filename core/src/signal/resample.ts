/**
 * Remuestreo a una base de tiempo uniforme por interpolación lineal.
 *
 * Necesario porque (a) el muestreo real es irregular (saltos de 40–138 ms en los
 * datos originales) y (b) hay que alinear los dos sensores en una rejilla común
 * para medir el lag torso→brazo y anchuras de pico en ms de forma consistente.
 */

export interface XY {
  t: ArrayLike<number>; // tiempos crecientes
  v: ArrayLike<number>;
}

/**
 * Interpola `v(t)` en una rejilla uniforme [tStart, tEnd] con paso 1000/fs ms.
 * `t` debe estar ordenado ascendentemente.
 */
export function resampleLinear(
  src: XY,
  tStart: number,
  tEnd: number,
  fs: number,
): { t: Float64Array; v: Float64Array } {
  const step = 1000 / fs;
  const nOut = Math.max(1, Math.floor((tEnd - tStart) / step) + 1);
  const tOut = new Float64Array(nOut);
  const vOut = new Float64Array(nOut);
  const { t, v } = src;
  const nIn = t.length;

  let j = 0;
  for (let i = 0; i < nOut; i++) {
    const ti = tStart + i * step;
    tOut[i] = ti;
    if (nIn === 0) {
      vOut[i] = NaN;
      continue;
    }
    // Avanza j hasta que t[j] <= ti < t[j+1].
    while (j < nIn - 1 && t[j + 1]! <= ti) j++;
    if (ti <= t[0]!) {
      vOut[i] = v[0]!;
    } else if (ti >= t[nIn - 1]!) {
      vOut[i] = v[nIn - 1]!;
    } else {
      const t0 = t[j]!;
      const t1 = t[j + 1]!;
      const frac = t1 === t0 ? 0 : (ti - t0) / (t1 - t0);
      vOut[i] = v[j]! + frac * (v[j + 1]! - v[j]!);
    }
  }
  return { t: tOut, v: vOut };
}

/**
 * Propaga una bandera booleana (p. ej. saturación) a la rejilla uniforme:
 * un punto de la rejilla queda marcado si cae entre dos muestras y alguna de
 * las muestras de su intervalo estaba marcada.
 */
export function resampleFlag(
  t: ArrayLike<number>,
  flag: ArrayLike<boolean>,
  tStart: number,
  tEnd: number,
  fs: number,
): Uint8Array {
  const step = 1000 / fs;
  const nOut = Math.max(1, Math.floor((tEnd - tStart) / step) + 1);
  const out = new Uint8Array(nOut);
  const nIn = t.length;
  let j = 0;
  for (let i = 0; i < nOut; i++) {
    const ti = tStart + i * step;
    if (nIn === 0) continue;
    while (j < nIn - 1 && t[j + 1]! <= ti) j++;
    const left = flag[j] ? 1 : 0;
    const right = j + 1 < nIn && flag[j + 1] ? 1 : 0;
    out[i] = left || right ? 1 : 0;
  }
  return out;
}
