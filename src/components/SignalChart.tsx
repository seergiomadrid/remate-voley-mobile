import React from "react";
import { View } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { theme } from "@/theme";
import type { TracePayload } from "@/analysis/persist";

interface Props {
  arm: TracePayload;
  torso: TracePayload | null;
  width: number;
  height?: number;
}

export function SignalChart({ arm, torso, width, height = 240 }: Props) {
  const padL = 40, padR = 10, padT = 12, padB = 22;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = height - padT - padB;

  const t = arm.t;
  if (t.length < 2) return <View style={{ height }} />;
  const tMin = t[0]!, tMax = t[t.length - 1]!;
  let gMax = Math.max(...arm.gyro, torso ? Math.max(...torso.gyro) : 0, 200);
  gMax = Math.ceil(gMax / 250) * 250;

  const xOf = (tt: number) => padL + ((tt - tMin) / (tMax - tMin || 1)) * plotW;
  const yOf = (g: number) => padT + plotH - (g / gMax) * plotH;

  const linePath = (tr: TracePayload) =>
    tr.t.map((tt, i) => `${i === 0 ? "M" : "L"}${xOf(tt).toFixed(1)} ${yOf(tr.gyro[i]!).toFixed(1)}`).join(" ");
  const areaPath = (tr: TracePayload) =>
    `${linePath(tr)} L${xOf(tr.t[tr.t.length - 1]!).toFixed(1)} ${yOf(0).toFixed(1)} L${xOf(tr.t[0]!).toFixed(1)} ${yOf(0).toFixed(1)} Z`;

  const gridLines = [];
  for (let g = 0; g <= gMax; g += 250) gridLines.push(g);

  return (
    <Svg width={width} height={height}>
      {gridLines.map((g) => (
        <React.Fragment key={g}>
          <Line x1={padL} y1={yOf(g)} x2={width - padR} y2={yOf(g)} stroke={theme.lineSoft} strokeWidth={1} />
          <SvgText x={padL - 6} y={yOf(g) + 4} fontSize={10} fill={theme.faint} textAnchor="end">
            {g}
          </SvgText>
        </React.Fragment>
      ))}
      {gMax >= 2000 && (
        <>
          <Line x1={padL} y1={yOf(2000)} x2={width - padR} y2={yOf(2000)} stroke={theme.warn} strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
          <SvgText x={padL + 4} y={yOf(2000) - 4} fontSize={9} fill={theme.warn}>saturación 2000</SvgText>
        </>
      )}

      {torso && <Path d={linePath(torso)} stroke={theme.torso} strokeWidth={2} fill="none" />}
      <Path d={areaPath(arm)} fill={theme.arm} opacity={0.12} />
      <Path d={linePath(arm)} stroke={theme.arm} strokeWidth={2} fill="none" />

      {torso?.peaks.map((p, i) =>
        p >= 0 && p < torso.t.length ? (
          <Circle key={`tp${i}`} cx={xOf(torso.t[p]!)} cy={yOf(torso.gyro[p]!)} r={3.5} fill={theme.torso} stroke={theme.ground} strokeWidth={1.5} />
        ) : null,
      )}
      {arm.peaks.map((p, i) =>
        p >= 0 && p < arm.t.length ? (
          <Circle key={`ap${i}`} cx={xOf(arm.t[p]!)} cy={yOf(arm.gyro[p]!)} r={4} fill={theme.arm} stroke={theme.ground} strokeWidth={1.5} />
        ) : null,
      )}
    </Svg>
  );
}
