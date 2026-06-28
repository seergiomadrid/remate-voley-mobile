import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/theme";

interface Props {
  min: number; max: number;   // extremos de la escala
  a: number; b: number;       // zona ideal [a,b]
  value: number;              // valor del usuario
  color: string;              // color de la zona ideal
  invert?: boolean;           // ideal a la izquierda
}

/** Barra que muestra dónde cae tu valor respecto a la zona ideal. */
export function RangeBar({ min, max, a, b, value, color, invert }: Props) {
  const span = max - min || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  const zoneL = pct(a), zoneW = Math.max(2, pct(b) - pct(a));
  const mark = pct(value);
  return (
    <View style={{ marginTop: 12 }}>
      <View style={styles.track}>
        <View style={[styles.zone, { left: `${zoneL}%`, width: `${zoneW}%`, backgroundColor: color + "44" }]} />
        <View style={[styles.marker, { left: `${mark}%` }]} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.lbl}>{invert ? "ideal ◀" : String(min)}</Text>
        <Text style={styles.lbl}>{invert ? "" : "ideal ▶"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 7, borderRadius: 999, backgroundColor: theme.bg2, overflow: "hidden", position: "relative" },
  zone: { position: "absolute", top: 0, bottom: 0, borderRadius: 999 },
  marker: { position: "absolute", top: -3, width: 3, height: 13, borderRadius: 2, backgroundColor: theme.text, marginLeft: -1.5 },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  lbl: { fontSize: 10.5, color: theme.faint },
});
