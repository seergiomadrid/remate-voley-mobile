import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { computeAcwr } from "@core";
import { listSessions, getSessionLoads, type SessionSummary } from "@/db/database";
import { Ring } from "@/components/Ring";
import { theme, verdict } from "@/theme";

export default function SessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [acwr, setAcwr] = useState<{ ratio: number | null; zone: string }>({ ratio: null, zone: "desconocida" });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const s = await listSessions();
        const loads = await getSessionLoads();
        if (!active) return;
        setSessions(s);
        setAcwr(computeAcwr(loads));
      })();
      return () => { active = false; };
    }, []),
  );

  const zColor = acwr.zone === "optima" ? theme.good : acwr.zone === "elevada" ? theme.bad : theme.warn;
  const best = sessions.reduce((m, s) => Math.max(m, s.armPeakBestDps), 0);

  return (
    <FlatList
      style={styles.screen}
      data={sessions}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 12 }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 2 }}>
          {/* ACWR hero */}
          <View style={styles.acwr}>
            <View style={{ flex: 1 }}>
              <Text style={styles.acwrLabel}>CARGA DE ENTRENAMIENTO</Text>
              <Text style={[styles.acwrValue, { color: zColor }]}>
                {acwr.ratio != null ? acwr.ratio.toFixed(2) : "—"}
              </Text>
              <Text style={styles.acwrZone}>Zona {acwr.zone}</Text>
              <Text style={styles.acwrHint}>Óptimo 0.8–1.3 · más de 1.5 = riesgo de lesión</Text>
            </View>
            <Ring value={Math.min(acwr.ratio ?? 0, 2)} max={2} size={84} color={zColor}
              big={acwr.ratio != null ? acwr.ratio.toFixed(1) : "—"} small="ACWR" />
          </View>
          {/* PR strip */}
          {best > 0 && (
            <View style={styles.pr}>
              <Text style={styles.prIcon}>🏆</Text>
              <Text style={styles.prText}>Tu récord: <Text style={styles.prVal}>{Math.round(best)}°/s</Text> de pico de brazo</Text>
            </View>
          )}
          {sessions.length > 0 && <Text style={styles.secTitle}>Historial</Text>}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>Aún no hay sesiones.{"\n"}Captura tu primer remate.</Text>}
      renderItem={({ item }) => {
        const qv = verdict("quality", item.qualityIndex);
        const isPr = item.armPeakBestDps >= best && best > 0;
        return (
          <Pressable style={styles.row} onPress={() => router.push(`/session/${item.id}`)}>
            <Ring value={item.qualityIndex} size={54} stroke={6} color={qv.color} big={Math.round(item.qualityIndex)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{new Date(item.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</Text>
              <Text style={styles.meta}>{item.repCount} remates · mejor {Math.round(item.armPeakBestDps)}°/s</Text>
              <View style={styles.tagsRow}>
                <View style={[styles.miniTag, { backgroundColor: qv.color + "1f" }]}><Text style={[styles.miniTagText, { color: qv.color }]}>{qv.label}</Text></View>
                <View style={styles.miniTag}><Text style={styles.miniTagMuted}>sec {Math.round(item.sequencingOkPct)}%</Text></View>
                {isPr ? <Text style={styles.prBadge}>🏆 PR</Text> : null}
              </View>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        );
      }}
    />
  );
}

const card = { backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.hair, shadowColor: "#1a2238", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  acwr: { ...card, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 26 },
  acwrLabel: { color: theme.muted, fontSize: 11, letterSpacing: 1, fontWeight: "800" },
  acwrValue: { fontSize: 36, fontWeight: "800", marginTop: 4, letterSpacing: -1.5 },
  acwrZone: { fontSize: 14, fontWeight: "700", color: theme.text, textTransform: "capitalize" },
  acwrHint: { color: theme.faint, fontSize: 11.5, marginTop: 4, lineHeight: 16 },

  pr: { ...card, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF7ED", borderColor: tintBorder() },
  prIcon: { fontSize: 18 },
  prText: { color: theme.text, fontSize: 13.5, flex: 1 },
  prVal: { fontWeight: "800", color: theme.arm },

  secTitle: { fontSize: 15, fontWeight: "800", color: theme.text, marginTop: 6, marginLeft: 2 },

  row: { ...card, padding: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  date: { color: theme.text, fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  meta: { color: theme.muted, fontSize: 12.5, marginTop: 2 },
  tagsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 },
  miniTag: { backgroundColor: theme.bg2, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  miniTagText: { fontSize: 11, fontWeight: "800" },
  miniTagMuted: { fontSize: 11, color: theme.muted, fontWeight: "600" },
  prBadge: { fontSize: 11, fontWeight: "800", color: theme.arm },
  chev: { fontSize: 26, color: theme.faint, fontWeight: "300" },

  empty: { color: theme.faint, textAlign: "center", marginTop: 50, fontSize: 14, lineHeight: 22 },
});

function tintBorder() { return "rgba(248,98,58,0.22)"; }
