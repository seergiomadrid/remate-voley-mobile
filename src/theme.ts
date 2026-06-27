/** Tokens de diseño compartidos (alineados con el dashboard de docs/). */
export const theme = {
  ground: "#0b1120",
  panel: "#131b2e",
  panel2: "#0f1626",
  line: "#233048",
  lineSoft: "#1a2438",
  text: "#eaeef7",
  muted: "#8593ad",
  faint: "#5a6885",
  arm: "#ff7a4d",
  torso: "#3fd0c9",
  good: "#3dd68c",
  warn: "#f2b33d",
  bad: "#f2696d",
  radius: 14,
};

export function severity(kind: "quality" | "seq" | "cv", v: number): "good" | "warn" | "bad" {
  if (kind === "quality") return v >= 75 ? "good" : v >= 50 ? "warn" : "bad";
  if (kind === "seq") return v >= 70 ? "good" : v >= 40 ? "warn" : "bad";
  return v < 12 ? "good" : v <= 22 ? "warn" : "bad"; // cv
}

export function sevColor(s: "good" | "warn" | "bad"): string {
  return s === "good" ? theme.good : s === "bad" ? theme.bad : theme.warn;
}
