/** Sistema de diseño — tema claro luminoso (alineado con docs/cloud-dashboard.html). */
export const theme = {
  // superficies
  bg: "#F4F6FB",
  bg2: "#EBEFF6", // gris suave para tracks / insets
  surface: "#FFFFFF",
  surface2: "#F4F6FB",
  hair: "rgba(17,27,46,0.08)",
  hair2: "rgba(17,27,46,0.15)",
  // texto
  text: "#141C2E",
  muted: "#5D6B86",
  faint: "#94A0B6",
  // acentos
  arm: "#F8623A",
  arm2: "#FF8A3D",
  torso: "#0FAE9F",
  violet: "#6A5BE0",
  // semánticos
  good: "#15A65B",
  warn: "#E08A00",
  bad: "#E5484D",
  // geometría
  radius: 22,
  radiusSm: 14,

  // alias legacy (para pantallas no rediseñadas) → ahora en claro
  ground: "#F4F6FB",
  panel: "#FFFFFF",
  panel2: "#EBEFF6",
  line: "rgba(17,27,46,0.08)",
  lineSoft: "rgba(17,27,46,0.06)",
};

export type Sev = "good" | "warn" | "bad" | "na";

/** Fondo translúcido a partir de un color de acento (hex de 6 dígitos). */
export function tint(hex: string, alpha = "22"): string {
  return hex.length === 7 ? hex + alpha : hex;
}

export function sevColor(s: Sev): string {
  return s === "good" ? theme.good : s === "bad" ? theme.bad : s === "warn" ? theme.warn : theme.faint;
}

export interface Verdict { key: Sev; label: string; color: string; }

/** Veredicto en lenguaje claro para cada tipo de métrica. */
export function verdict(kind: "quality" | "seq" | "cv" | "ttp" | "peak", v: number | null): Verdict {
  if (v == null || isNaN(v)) return { key: "na", label: "—", color: theme.faint };
  let k: Sev;
  if (kind === "quality") k = v >= 72 ? "good" : v >= 48 ? "warn" : "bad";
  else if (kind === "seq") k = v >= 60 ? "good" : v >= 30 ? "warn" : "bad";
  else if (kind === "cv") k = v <= 15 ? "good" : v <= 28 ? "warn" : "bad";
  else if (kind === "ttp") k = v <= 120 ? "good" : v <= 180 ? "warn" : "bad";
  else k = v >= 2000 ? "good" : v >= 1300 ? "warn" : "bad"; // peak
  const labels: Record<Exclude<Sev, "na">, string> = { good: "Bien", warn: "Mejorable", bad: "A trabajar" };
  // etiquetas específicas para potencia
  if (kind === "peak") {
    return { key: k, label: k === "good" ? "Potente" : k === "warn" ? "Correcto" : "Suave", color: sevColor(k) };
  }
  return { key: k, label: labels[k], color: sevColor(k) };
}

/** Compat: severidad simple usada por pantallas antiguas. */
export function severity(kind: "quality" | "seq" | "cv", v: number): Exclude<Sev, "na"> {
  const r = verdict(kind, v).key;
  return r === "na" ? "warn" : r;
}
