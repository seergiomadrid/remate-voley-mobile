import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { theme } from "@/theme";

interface Props {
  value: number;       // 0..max
  max?: number;
  size?: number;
  stroke?: number;
  color: string;
  big?: string | number;
  small?: string;
}

/** Anillo de progreso con valor central. */
export function Ring({ value, max = 100, size = 88, stroke = 9, color, big, small }: Props) {
  const r = (size - stroke - 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const off = c * (1 - pct);
  const cx = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke={theme.hair} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      {(big != null || small) && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          {big != null && (
            <Text style={{ color: theme.text, fontSize: size * 0.32, fontWeight: "800", letterSpacing: -1 }}>{big}</Text>
          )}
          {small ? (
            <Text style={{ color: theme.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{small}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
