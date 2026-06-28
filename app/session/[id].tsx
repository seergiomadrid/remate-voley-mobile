import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator, Pressable, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getSessionPayload } from "@/db/database";
import { getCloudConfig, uploadSession } from "@/cloud/supabase";
import type { SessionPayload } from "@/analysis/persist";
import { SignalChart } from "@/components/SignalChart";
import { Ring } from "@/components/Ring";
import { RangeBar } from "@/components/RangeBar";
import { theme, verdict, tint, type Verdict } from "@/theme";
import { repNote, buildFocus, avgTimeToPeak, QUALITY_VERDICT, RANGES } from "@/analysis/insights";

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
      Alert.alert("Subido ☁", `La sesión "${name}" ya está en la nube.`);
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

  if (loading) return <View style={styles.screen}><ActivityIndicator color={theme.arm} style={{ marginTop: 50 }} /></View>;
  if (!p) return <View style={styles.screen}><Text style={styles.empty}>Sesión no encontrada.</Text></View>;

  const a = p.aggregates;
  const qv = verdict("quality", a.qualityIndex);
  const seqv = verdict("seq", a.sequencingOkPct);
  const cvv = verdict("cv", a.armConsistencyCvPct);
  const ttp = avgTimeToPeak(p);
  const ttpv = verdict("ttp", ttp);
  const peakv = verdict("peak", a.armPeakBestDps);
  const sat = p.reps.filter((r) => r.armSaturated).length;
  const focus = buildFocus(a);
  const paired = p.reps.filter((r) => r.lagMs != null);
  const chartW = width - 32 - 32;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}>
      {/* HERO */}
      <View style={styles.hero}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Ring value={a.qualityIndex} size={92} color={qv.color} big={Math.round(a.qualityIndex)} small="Calidad" />
          <View style={{ flex: 1 }}>
            <View style={[styles.tag, { backgroundColor: tint(qv.color) }]}>
              <Text style={[styles.tagText, { color: qv.color }]}>{qv.label}</Text>
            </View>
            <Text style={styles.heroTitle}>Análisis de sesión</Text>
            <Text style={styles.heroSub}>{QUALITY_VERDICT(a.qualityIndex)}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <MetaChip text={`${a.repCount} remates`} bold />
          <MetaChip text={new Date(p.startedAtMs).toLocaleDateString()} />
          <MetaChip text={`pico ${Math.round(a.armPeakBestDps)}°/s`} />
          {sat ? <MetaChip text={`▲ ${sat} saturó${sat > 1 ? "n" : ""}`} color={theme.warn} /> : null}
        </View>
      </View>

      {/* upload */}
      <Pressable style={styles.uploadBtn} onPress={onUploadPress} disabled={uploading}>
        {uploading ? <ActivityIndicator color={theme.arm} /> : <Text style={styles.uploadText}>☁  Subir a la nube</Text>}
      </Pressable>

      {/* FOCUS */}
      <View style={styles.focus}>
        <Text style={styles.focusTag}>{focus.tag.toUpperCase()}</Text>
        <Text style={styles.focusTitle}>{focus.title}</Text>
        <Text style={styles.focusBody}>{focus.body}</Text>
      </View>

      {/* MÉTRICAS */}
      <SectionHeader title="Tus métricas" hint="qué significa cada una" />
      <View style={styles.grid}>
        <MetricCard
          label="Potencia de brazo" value={Math.round(a.armPeakBestDps)} unit="°/s"
          sub={`media ${Math.round(a.armPeakMeanDps)}°/s`} v={peakv}
          range={RANGES.peak} rangeVal={a.armPeakBestDps} color={theme.good}
          explain={"Velocidad de giro de la muñeca en el golpe. A más alto, más potencia." + (sat ? " Algunos remates saturaron (≥2000°/s): tu pico real es aún mayor." : "")}
        />
        <MetricCard
          label="Secuencia tronco→brazo" value={Math.round(a.sequencingOkPct)} unit="%"
          sub={`lag medio ${a.sequencingMeanLagMs != null ? Math.round(a.sequencingMeanLagMs) : "—"} ms`} v={seqv}
          range={RANGES.seq} rangeVal={a.sequencingOkPct} color={theme.good}
          explain="% de remates con el orden correcto: el tronco gira y el brazo lo sigue como un látigo. Es la clave de la potencia eficiente."
        />
        <MetricCard
          label="Consistencia" value={Math.round(a.armConsistencyCvPct)} unit="%"
          sub="variación entre remates" v={cvv}
          range={RANGES.cv} rangeVal={a.armConsistencyCvPct} color={theme.good}
          explain="Cuánto varían tus remates entre sí (CV). Más bajo = más regular. La regularidad es la base para mejorar."
        />
        <MetricCard
          label="Explosividad" value={Math.round(ttp)} unit="ms"
          sub="tiempo hasta el pico" v={ttpv}
          range={RANGES.ttp} rangeVal={ttp} color={theme.good}
          explain="Cuánto tardas en alcanzar la máxima velocidad. Menos ms = gesto más explosivo, tipo látigo."
        />
      </View>

      {/* GRÁFICA */}
      <SectionHeader title="Velocidad angular del gesto" />
      <View style={styles.card}>
        <Text style={styles.cardDesc}>Cada pico es un remate. Naranja = muñeca; turquesa = tronco. La línea roja marca el límite del sensor (2000°/s).</Text>
        <SignalChart arm={p.traces.arm} torso={p.traces.torso} width={chartW} />
        <View style={styles.legend}>
          <LegendItem color={theme.arm} label="Brazo (muñeca)" />
          {p.traces.torso ? <LegendItem color={theme.torso} label="Tronco" /> : null}
        </View>
      </View>

      {/* CADENA CINÉTICA */}
      {paired.length > 0 && (
        <>
          <SectionHeader title="Cadena cinética" hint="tronco → brazo" />
          <View style={styles.card}>
            <Text style={styles.cardDesc}>El tronco debe girar antes que el brazo. Verde = orden correcto (lidera 10–150 ms). A la izquierda del centro, el brazo se adelantó.</Text>
            {paired.map((r) => <KineticRow key={r.index} rep={r} maxLag={Math.max(220, ...paired.map((x) => Math.abs(x.lagMs!)))} />)}
          </View>
        </>
      )}

      {/* REMATE A REMATE */}
      <SectionHeader title="Remate a remate" hint="análisis individual" />
      {p.reps.map((r) => <RepCard key={r.index} rep={r} />)}

      {/* CONSEJOS */}
      <SectionHeader title="Consejos" />
      <View style={styles.card}>
        {p.tips.map((t, i) => {
          const col = t.severity === "good" ? theme.good : t.severity === "warn" ? theme.warn : theme.violet;
          const ic = t.severity === "good" ? "✅" : t.severity === "warn" ? "⚠️" : "🎯";
          return (
            <View key={i} style={[styles.tip, i > 0 && { borderTopWidth: 1, borderTopColor: theme.hair }]}>
              <View style={[styles.tipIc, { backgroundColor: tint(col) }]}><Text style={{ fontSize: 16 }}>{ic}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipCat}>{t.category}</Text>
                <Text style={styles.tipMsg}>{t.message}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ---------- subcomponentes ---------- */
function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      {hint ? <Text style={styles.secHint}>{hint}</Text> : null}
    </View>
  );
}

function MetaChip({ text, bold, color }: { text: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={[styles.metaChipText, bold && { color: theme.text, fontWeight: "700" }, color ? { color } : null]}>{text}</Text>
    </View>
  );
}

function MetricCard({ label, value, unit, sub, v, range, rangeVal, color, explain }: {
  label: string; value: number; unit: string; sub: string; v: Verdict;
  range: { min: number; max: number; a: number; b: number; invert?: boolean }; rangeVal: number; color: string; explain: string;
}) {
  return (
    <View style={styles.mcard}>
      <View style={styles.mcardTop}>
        <Text style={styles.mLabel}>{label}</Text>
        <View style={[styles.chip, { backgroundColor: tint(v.color) }]}><Text style={[styles.chipText, { color: v.color }]}>{v.label}</Text></View>
      </View>
      <Text style={styles.mVal}>{value}<Text style={styles.mUnit}> {unit}</Text></Text>
      <Text style={styles.mSub}>{sub}</Text>
      <RangeBar min={range.min} max={range.max} a={range.a} b={range.b} value={rangeVal} color={color} invert={range.invert} />
      <Text style={styles.mExplain}>{explain}</Text>
    </View>
  );
}

function KineticRow({ rep, maxLag }: { rep: SessionPayload["reps"][number]; maxLag: number }) {
  const lag = rep.lagMs!;
  const ok = rep.sequencingOk;
  const col = ok ? theme.good : theme.bad;
  const w = Math.max(8, (Math.abs(lag) / maxLag) * 46);
  const left = lag >= 0 ? 50 : 50 - w;
  const idealW = (150 / maxLag) * 46;
  return (
    <View style={styles.kcRow}>
      <View style={styles.kcIdx}><Text style={styles.kcIdxText}>{rep.index + 1}</Text></View>
      <View style={styles.kcTrack}>
        <View style={[styles.kcIdeal, { left: "50%", width: `${idealW}%` }]} />
        <View style={styles.kcMid} />
        <View style={[styles.kcBar, { left: `${left}%`, width: `${w}%`, backgroundColor: tint(col), borderColor: col }]}>
          <Text style={[styles.kcBarText, { color: col }]}>{lag > 0 ? "+" : ""}{lag}</Text>
        </View>
      </View>
      <Text style={[styles.kcVal, { color: col }]}>{ok ? "✓" : "✗"}</Text>
    </View>
  );
}

function RepCard({ rep }: { rep: SessionPayload["reps"][number] }) {
  const col = rep.armPeakDps >= 2000 ? theme.good : rep.armPeakDps >= 1200 ? theme.warn : theme.faint;
  return (
    <View style={styles.rep}>
      <View style={styles.repHead}>
        <View style={styles.repNo}><Text style={styles.repNoText}>{rep.index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.repTitle}>Remate {rep.index + 1}</Text>
          <Text style={styles.repSub}>{cap(rep.armShape || "gesto")} · {rep.armSaturated ? "pico saturado" : "pico medido"}</Text>
        </View>
      </View>
      <View style={styles.repStats}>
        <RStat k="Brazo" v={`${Math.round(rep.armPeakDps)}${rep.armSaturated ? "▲" : ""}`} color={col} />
        <RStat k="Tronco" v={rep.torsoPeakDps != null ? String(rep.torsoPeakDps) : "—"} />
        <RStat k="Lag" v={rep.lagMs != null ? `${rep.lagMs > 0 ? "+" : ""}${rep.lagMs}` : "—"} />
        {rep.jumpHeightCm != null ? <RStat k="Salto" v={`${rep.jumpHeightCm}cm`} /> : null}
      </View>
      <Text style={styles.repNote}>{repNote(rep)}</Text>
    </View>
  );
}

function RStat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <View style={styles.rstat}>
      <Text style={styles.rstatK}>{k}</Text>
      <Text style={[styles.rstatV, color ? { color } : null]}>{v}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const card = { backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.hair, shadowColor: "#1a2238", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  empty: { color: theme.faint, textAlign: "center", marginTop: 50 },

  hero: { ...card, borderRadius: 26, padding: 20, backgroundColor: theme.surface },
  tag: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  heroTitle: { color: theme.text, fontSize: 20, fontWeight: "800", marginTop: 8, letterSpacing: -0.3 },
  heroSub: { color: theme.muted, fontSize: 13.5, marginTop: 2, lineHeight: 19 },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 14 },
  metaChip: { backgroundColor: "rgba(17,27,46,0.04)", borderWidth: 1, borderColor: theme.hair, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  metaChipText: { fontSize: 12, color: theme.muted },

  uploadBtn: { ...card, padding: 14, alignItems: "center", borderColor: theme.arm },
  uploadText: { color: theme.arm, fontWeight: "800", fontSize: 14.5 },

  focus: { ...card, padding: 18, backgroundColor: "#F3F1FE", borderColor: "rgba(106,91,224,0.18)" },
  focusTag: { fontSize: 11, letterSpacing: 1, color: theme.violet, fontWeight: "800" },
  focusTitle: { fontSize: 17, fontWeight: "800", color: theme.text, marginTop: 6 },
  focusBody: { fontSize: 13.5, color: theme.muted, lineHeight: 20, marginTop: 4 },

  sec: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8, marginLeft: 2 },
  secTitle: { fontSize: 15, fontWeight: "800", color: theme.text, letterSpacing: -0.2 },
  secHint: { fontSize: 12, color: theme.faint },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  mcard: { ...card, padding: 16, width: "47.5%", flexGrow: 1 },
  mcardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  mLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: theme.muted, fontWeight: "700", flex: 1 },
  chip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  chipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  mVal: { fontSize: 28, fontWeight: "800", color: theme.text, marginTop: 8, letterSpacing: -1 },
  mUnit: { fontSize: 13, color: theme.muted, fontWeight: "600" },
  mSub: { fontSize: 12, color: theme.faint, marginTop: 3 },
  mExplain: { fontSize: 12.5, color: theme.muted, lineHeight: 18, marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: theme.hair },

  card: { ...card, padding: 16 },
  cardDesc: { fontSize: 12.5, color: theme.muted, lineHeight: 18, marginBottom: 12 },
  legend: { flexDirection: "row", gap: 16, marginTop: 10, flexWrap: "wrap" },

  kcRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.hair },
  kcIdx: { width: 30, height: 30, borderRadius: 10, backgroundColor: theme.bg2, alignItems: "center", justifyContent: "center" },
  kcIdxText: { fontSize: 13, fontWeight: "800", color: theme.muted },
  kcTrack: { flex: 1, height: 30, backgroundColor: theme.bg2, borderRadius: 9, position: "relative", overflow: "hidden" },
  kcIdeal: { position: "absolute", top: 0, bottom: 0, backgroundColor: "rgba(21,166,91,0.13)" },
  kcMid: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: theme.hair2 },
  kcBar: { position: "absolute", top: 6, height: 18, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  kcBarText: { fontSize: 11, fontWeight: "700" },
  kcVal: { width: 24, textAlign: "center", fontSize: 15, fontWeight: "800" },

  rep: { ...card, padding: 14 },
  repHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  repNo: { width: 34, height: 34, borderRadius: 11, backgroundColor: tint(theme.arm, "26"), alignItems: "center", justifyContent: "center" },
  repNoText: { fontWeight: "800", fontSize: 15, color: theme.arm },
  repTitle: { fontWeight: "800", fontSize: 14, color: theme.text },
  repSub: { fontSize: 12, color: theme.faint, marginTop: 1 },
  repStats: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  rstat: { backgroundColor: theme.bg2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, minWidth: 72 },
  rstatK: { fontSize: 10, color: theme.faint, textTransform: "uppercase", letterSpacing: 0.4 },
  rstatV: { fontSize: 15, fontWeight: "800", color: theme.text, marginTop: 2 },
  repNote: { fontSize: 13, color: theme.muted, lineHeight: 19, backgroundColor: theme.bg2, borderRadius: 11, padding: 11, borderLeftWidth: 3, borderLeftColor: theme.arm },

  tip: { flexDirection: "row", gap: 11, paddingVertical: 12 },
  tipIc: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tipCat: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: theme.faint, fontWeight: "700" },
  tipMsg: { fontSize: 13.5, color: theme.text, lineHeight: 19, marginTop: 2 },
});
