import React from "react";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { theme } from "@/theme";

interface Props {
  value: number; // 0-100
  color: string;
  size?: number;
}

export function Gauge({ value, color, size = 84 }: Props) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  const cx = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cx} r={r} stroke={theme.line} strokeWidth={8} fill="none" />
      <Circle
        cx={cx}
        cy={cx}
        r={r}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={off}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <SvgText x={cx} y={cx + 7} fontSize={22} fontWeight="800" fill={theme.text} textAnchor="middle">
        {Math.round(value)}
      </SvgText>
    </Svg>
  );
}
