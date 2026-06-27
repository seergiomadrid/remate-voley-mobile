/** Conversión base64 <-> bytes (react-native-ble-plx usa base64 en los valores). */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < CHARS.length; i++) t[CHARS.charCodeAt(i)] = i;
  return t;
})();

export function base64ToBytes(b64: string): Uint8Array {
  let len = b64.length;
  if (len === 0) return new Uint8Array(0);
  let padding = 0;
  if (b64[len - 1] === "=") padding++;
  if (b64[len - 2] === "=") padding++;
  const outLen = (len * 3) / 4 - padding;
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e0 = LOOKUP[b64.charCodeAt(i)]!;
    const e1 = LOOKUP[b64.charCodeAt(i + 1)]!;
    const e2 = LOOKUP[b64.charCodeAt(i + 2)]!;
    const e3 = LOOKUP[b64.charCodeAt(i + 3)]!;
    if (p < outLen) out[p++] = (e0 << 2) | (e1 >> 4);
    if (p < outLen) out[p++] = ((e1 & 15) << 4) | (e2 >> 2);
    if (p < outLen) out[p++] = ((e2 & 3) << 6) | e3;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63] + CHARS[(n >> 6) & 63] + CHARS[n & 63];
  }
  if (i < bytes.length) {
    const rem = bytes.length - i;
    const b0 = bytes[i]!;
    const b1 = rem > 1 ? bytes[i + 1]! : 0;
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += rem > 1 ? CHARS[(b1 & 15) << 2] : "=";
    out += "=";
  }
  return out;
}

export function strToBase64(s: string): string {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  return bytesToBase64(bytes);
}
