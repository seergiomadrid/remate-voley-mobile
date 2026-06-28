import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getSessionPayload } from "@/db/database";
import { getCloudConfig, uploadSession } from "@/cloud/supabase";
import type { SessionPayload } from "@/analysis/persist";
import { SignalChart } from "@/components/SignalChart";
import { Gauge } from "@/components/Gauge";
import { theme, severity, sevColor } from "@/theme";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [p, setP] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      setP(await getSessionPayload(Number(id)));
      setLoading(false);
    })();
  }, [id]);

  async function doUpload(payload: SessionPayload, name: string) {
    setUploading(true);
    try {
      await uploadSession(name, payload);
      Alert.alert("Subido", `La sesión "${name}" está en la nube.`);
    } catch (e: any) {
      Alert.alert("No se pudo subir", e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  async function onUploadPress() {
    if (!p) return;
    const cfg = await getCloudConfig();
    if (!cfg) {
      Alert.alert("Configura la nube", "Primero introduce los datos de tu proyecto Supabase.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Configurar", onPress: () => router.push("/cloud") },
      ]);
      return;
    }
    const defName = `Sesión ${new Date(p.startedAtMs).toLocaleDateString()}`;
    if (Platform.OS === "ios") {
      Alert.prompt("Nombre de la sesión", "¿Cómo quieres llamarla en la nube?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Subir", onPress: (name) => doUpload(p, (name && name.trim()) || defName) },
      ], "plain-text", defName);
    } else {
      doUpload(p, defName);
    }
  }

  if (loading) return <ActivityIndicator color={theme.arm} style={{ marginTop: 40 }} />;
  if (!p) return <Text style={styles.empty}>Sesión no encontrada.</Text>;

  const a = p.aggregates;
  const qC = severity("quality", a.qualityIndex);
  const seqC = severity("seq", a.sequencingOkPct);
  const cvC = severity("cv", a.armConsistencyCvPct);
  const paired = p.reps.filter((r) => r.lagMs != null);
  const maxAbsLag = Math.max(120, ...paired.map((r) => Math.abs(r.lagMs!)));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={styles.meta}>
        {new Date(p.startedAtMs).toLocaleString()} · {a.repCount} remates · sync {p.clockOffsetMs} ms
      </Text>

      <Pressable style={styles.uploadBtn} onPress={onUploadPress} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color={theme.arm} />
        ) : (
          <Text style={styles.uploadText}>☁  Subir a la nube</Text>
        )}
      </Pressable>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <View style={[styles.card, styles.kpi]}>
          <Text style={styles.label}>Calidad</Text>
          <Gauge value={a.qualityIndex} color={sevColor(qC)} />
        </View>
        <View style={{ flex: 1, gap: 14 }}>
          <Kpi label="Pico de brazo" value={`${Math.round(a.armPeakBestDps)}`} unit="°/s" sub={`media ${Math.round(a.armPeakMeanDps)}`} accent={theme.arm} />
          <Kpi label="Secuencia OK" value={`${Math.round(a.sequencingOkPct)}`} unit="%" sub={`lag ${a.sequencingMeanLagMs != null ? Math.round(a.sequencingMeanLagMs) : "—"} ms`} accent={sevColor(seqC)} />
        </View>
      </View>
      <View style={styles.kpiRow}>
        <Kpi label="Consistencia (CV)" value={`${Math.round(a.armConsistencyCvPct)}`} unit="%" sub="menor es mejor" accent={sevColor(cvC)} flex />
        <Kpi label="Carga" value={a.load.toFixed(1)} unit="" sub={a.fatigueDropPct != null ? `fatiga ${a.fatigueDropPct > 0 ? "↓" : "↑"}${Math.abs(Math.round(a.fatigueDropPct))}%` : "—"} accent={theme.text} flex />
      </View>

      {/* Chart */}
      <View style={styles.card}>
        <Text style={styles.label}>Velocidad angular</Text>
        <SignalChart arm={p.traces.arm} torso={p.traces.torso} width={width - 32 - 28} />
        <View style={styles.legend}>
          <LegendDot color={theme.arm} label="Brazo" />
          {p.traces.torso ? <LegendDot color={theme.torso} label="Torso" /> : null}
        </View>
      </View>

      {/* Sequencing */}
      {paired.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>Secuencia torso → brazo</Text>
          {paired.map((r) => {
            const ok = r.sequencingOk;
            const w = (Math.abs(r.lagMs!) / maxAbsLag) * 46;
            const color = ok ? theme.good : theme.bad;
            return (
              <View key={r.index} style={styles.seqRow}>
                <Text style={styles.seqIdx}>#{r.index + 1}</Text>
                <View style={styles.seqTrack}>
                  <View style={[styles.seqMid]} />
                  <View style={[styles.seqBar, { left: `${r.lagMs! >= 0 ? 50 : 50 - w}%`, width: `${w}%`, backgroundColor: color + "44", borderColor: color }]} />
                </View>
                <Text style={[styles.seqVal, { color }]}>{r.lagMs! > 0 ? "+" : ""}{r.lagMs} ms</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Tips */}
      <View style={styles.card}>
        <Text style={styles.label}>Consejos</Text>
        {p.tips.map((t, i) => (
          <View key={i} style={[styles.tip, { borderLeftColor: t.severity === "good" ? theme.good : t.severity === "warn" ? theme.warn : theme.torso }]}>
            <Text style={styles.tipCat}>{t.category}</Text>
            <Text style={styles.tipMsg}>{t.message}</Text>
          </View>
        ))}
      </View>

      {/* Rep table */}
      <View style={styles.card}>
        <Text style={styles.label}>Remates</Text>
        <View style={[styles.trow, styles.thead]}>
          <Text style={[styles.th, { flex: 0.6 }]}>#</Text>
          <Text style={styles.th}>Brazo</Text>
          <Text style={styles.th}>Torso</Text>
          <Text style={styles.th}>Lag</Text>
          <Text style={styles.th}>Sec</Text>
        </View>
        {p.reps.map((r) => (
          <View key={r.index} style={styles.trow}>
            <Text style={[styles.td, { flex: 0.6 }]}>{r.index + 1}</Text>
            <Text style={styles.td}>{Math.round(r.armPeakDps)}{r.armSaturated ? " ▲" : ""}</Text>
            <Text style={styles.td}>{r.torsoPeakDps ?? "—"}</Text>
            <Text style={styles.td}>{r.lagMs ?? "—"}</Text>
            <Text style={[styles.td, { color: r.lagMs == null ? theme.faint : r.sequencingOk ? theme.good : theme.faint }]}>
              {r.lagMs == null ? "—" : r.sequencingOk ? "✓" : "✗"}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Kpi({ label, value, unit, sub, accent, flex }: any) {
  return (
    <View style={[styles.card, flex && { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.kpiValue}>
        {value}
        <Text style={styles.kpiUnit}> {unit}</Text>
      </Text>
      <Text style={styles.kpiSub}>{sub}</Text>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ground },
  meta: { color: theme.muted, fontSize: 13 },
  uploadBtn: { backgroundColor: theme.panel, borderWidth: 1, borderColor: theme.arm, borderRadius: theme.radius, padding: 12, alignItems: "center" },
  uploadText: { color: theme.arm, fontWeight: "700", fontSize: 14 },
  card: { backgroundColor: theme.panel, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 14 },
  kpiRow: { flexDirection: "row", gap: 14 },
  kpi: { alignItems: "center", justifyContent: "center" },
  label: { color: theme.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700", marginBottom: 6 },
  kpiValue: { color: theme.text, fontSize: 26, fontWeight: "800" },
  kpiUnit: { color: theme.muted, fontSize: 14, fontWeight: "600" },
  kpiSub: { color: theme.faint, fontSize: 12, marginTop: 2 },
  accentBar: { height: 3, borderRadius: 2, marginTop: 10, opacity: 0.8 },
  legend: { flexDirection: "row", gap: 16, marginTop: 8 },
  seqRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  seqIdx: { color: theme.muted, width: 30, fontSize: 12 },
  seqTrack: { flex: 1, height: 20, backgroundColor: theme.panel2, borderRadius: 6, borderWidth: 1, borderColor: theme.lineSoft },
  seqMid: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: theme.line },
  seqBar: { position: "absolute", top: 4, height: 11, borderRadius: 3, borderWidth: 1 },
  seqVal: { width: 64, textAlign: "right", fontSize: 12.5, fontWeight: "700" },
  tip: { backgroundColor: theme.panel2, borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 8 },
  tipCat: { color: theme.faint, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  tipMsg: { color: theme.text, fontSize: 13.5, marginTop: 2 },
  trow: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.lineSoft },
  thead: { borderBottomColor: theme.line },
  th: { flex: 1, color: theme.muted, fontSize: 11, textTransform: "uppercase", textAlign: "right" },
  td: { flex: 1, color: theme.text, fontSize: 13, textAlign: "right" },
  empty: { color: theme.faint, textAlign: "center", marginTop: 40 },
});
