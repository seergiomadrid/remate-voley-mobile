import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { computeAcwr } from "@core";
import { listSessions, getSessionLoads, type SessionSummary } from "@/db/database";
import { theme, severity, sevColor } from "@/theme";

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
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.acwr}>
        <Text style={styles.acwrLabel}>CARGA AGUDA:CRÓNICA (ACWR)</Text>
        <Text style={[styles.acwrValue, { color: zoneColor(acwr.zone) }]}>
          {acwr.ratio != null ? acwr.ratio.toFixed(2) : "—"} <Text style={styles.acwrZone}>{acwr.zone}</Text>
        </Text>
        <Text style={styles.acwrHint}>Zona óptima 0.8–1.3 · &gt;1.5 riesgo de lesión</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay sesiones. Captura tu primer remate.</Text>}
        renderItem={({ item }) => {
          const q = severity("quality", item.qualityIndex);
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/session/${item.id}`)}>
              <View>
                <Text style={styles.date}>{new Date(item.startedAt).toLocaleString()}</Text>
                <Text style={styles.meta}>
                  {item.repCount} remates · mejor {Math.round(item.armPeakBestDps)} °/s · sec {Math.round(item.sequencingOkPct)}%
                </Text>
              </View>
              <View style={[styles.qbadge, { backgroundColor: sevColor(q) + "22" }]}>
                <Text style={[styles.qtext, { color: sevColor(q) }]}>{Math.round(item.qualityIndex)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function zoneColor(zone: string) {
  return zone === "optima" ? theme.good : zone === "elevada" ? theme.bad : theme.muted;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ground },
  acwr: { margin: 16, marginBottom: 0, padding: 14, backgroundColor: theme.panel, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line },
  acwrLabel: { color: theme.muted, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  acwrValue: { fontSize: 30, fontWeight: "800", marginTop: 4 },
  acwrZone: { fontSize: 14, fontWeight: "700" },
  acwrHint: { color: theme.faint, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.panel, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 14 },
  date: { color: theme.text, fontSize: 15, fontWeight: "700" },
  meta: { color: theme.muted, fontSize: 12.5, marginTop: 3 },
  qbadge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  qtext: { fontSize: 17, fontWeight: "800" },
  empty: { color: theme.faint, textAlign: "center", marginTop: 40 },
});
