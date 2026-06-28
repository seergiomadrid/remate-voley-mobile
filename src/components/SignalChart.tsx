import React from "react";
import Svg, { Path, Circle, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import { theme } from "@/theme";
import type { TracePayload } from "@/analysis/persist";

interface Props {
  arm: TracePayload;
  torso: TracePayload | null;
  width: number;
  height?: number;
}

/** Construye un path suave (Catmull-Rom → Bézier) a partir de puntos [x,y]. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function SignalChart({ arm, torso, width, height = 250 }: Props) {
  const padL = 36, padR = 8, padT = 14, padB = 18;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = height - padT - padB;
  const n = arm.gyro.length;
  if (n < 2) return <Svg width={width} height={height} />;

  let gMax = Math.max(2200, ...arm.gyro, torso ? Math.max(...torso.gyro) : 0);
  gMax = Math.ceil(gMax / 500) * 500;

  const X = (i: number, len = n) => padL + (i / (len - 1)) * plotW;
  const Y = (g: number) => padT + plotH - (g / gMax) * plotH;

  const armPts: [number, number][] = arm.gyro.map((v, i) => [X(i), Y(v)]);
  const armLine = smoothPath(armPts);
  const armArea = `${armLine} L${X(n - 1).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z`;
  const torsoLine = torso ? smoothPath(torso.gyro.map((v, i) => [X(i, torso.gyro.length), Y(v)])) : "";

  const grid: number[] = [];
  for (let g = 0; g <= gMax; g += 500) grid.push(g);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="armFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.arm} stopOpacity={0.34} />
          <Stop offset="1" stopColor={theme.arm} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* zona de saturación */}
      {gMax >= 2000 && (
        <Rect x={padL} y={Y(gMax)} width={plotW} height={Y(2000) - Y(gMax)} fill={theme.bad} opacity={0.06} />
      )}
      {/* grid */}
      {grid.map((g) => (
        <React.Fragment key={g}>
          <Line x1={padL} y1={Y(g)} x2={width - padR} y2={Y(g)} stroke="rgba(17,27,46,0.06)" strokeWidth={1} />
          <SvgText x={2} y={Y(g) + 3} fontSize={10} fill={theme.faint}>{g}</SvgText>
        </React.Fragment>
      ))}
      {gMax >= 2000 && (
        <Line x1={padL} y1={Y(2000)} x2={width - padR} y2={Y(2000)} stroke={theme.bad} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.5} />
      )}

      {/* tronco */}
      {torso && <Path d={torsoLine} stroke={theme.torso} strokeWidth={2} fill="none" />}
      {/* brazo */}
      <Path d={armArea} fill="url(#armFill)" />
      <Path d={armLine} stroke={theme.arm} strokeWidth={2.6} fill="none" strokeLinejoin="round" />

      {/* picos */}
      {arm.peaks.map((p, i) =>
        p >= 0 && p < n ? (
          <Circle key={`ap${i}`} cx={X(p)} cy={Y(arm.gyro[p]!)} r={5.5} fill={theme.arm} stroke="#fff" strokeWidth={2} />
        ) : null,
      )}
    </Svg>
  );
}
