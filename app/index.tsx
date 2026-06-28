import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { analyzeSession } from "@core";
import { ble, type BleState, type BoardState } from "@/ble/bleManager";
import { saveSession } from "@/db/database";
import { theme, tint } from "@/theme";

export default function CaptureScreen() {
  const router = useRouter();
  const [state, setState] = useState<BleState>(ble.snapshot());
  const [busy, setBusy] = useState(false);
  const [captureStart, setCaptureStart] = useState<number | null>(null);

  useEffect(() => ble.subscribe(setState), []);

  const bothConnected = state.arm.connected && state.torso.connected;
  const anyConnected = state.arm.connected || state.torso.connected;

  async function onConnect() { setBusy(true); await ble.scanAndConnect(); setBusy(false); }
  async function onSync() {
    await ble.sync();
    Alert.alert("Sincronizando", "Junta y golpea suavemente las dos placas una vez para afinar la sincronización de relojes.");
  }
  async function onStart() { setCaptureStart(Date.now()); await ble.startCapture(); }
  async function onStop() {
    const startedAt = captureStart ?? Date.now();
    const { arm, torso } = ble.stopCapture();
    setCaptureStart(null);
    if (!arm) { Alert.alert("Sin datos", "No se recibieron muestras del sensor de brazo."); return; }
    setBusy(true);
    try {
      const result = analyzeSession(arm, torso);
      const id = await saveSession(result, startedAt, Date.now());
      router.push(`/session/${id}`);
    } catch (e: any) {
      Alert.alert("Error al analizar", String(e?.message ?? e));
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 14 }}>
      {/* hero */}
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>LAB DE RENDIMIENTO</Text>
        <Text style={styles.h1}>¿Listo para{"\n"}rematar?</Text>
        <Text style={styles.sub}>Conecta los dos sensores, sincroniza y graba tu serie. Todo desde el móvil.</Text>
      </View>

      {/* boards */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <BoardCard board={state.arm} accent={theme.arm} label="Muñeca" />
        <BoardCard board={state.torso} accent={theme.torso} label="Torso" />
      </View>

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      {/* actions */}
      {!anyConnected ? (
        <Btn onPress={onConnect} disabled={busy || state.scanning} primary>
          {state.scanning ? "Buscando sensores…" : "Conectar sensores"}
        </Btn>
      ) : (
        <>
          {!state.capturing && <Btn onPress={onSync}>Sincronizar relojes</Btn>}
          {!state.capturing ? (
            <RecordButton onPress={onStart} disabled={busy} />
          ) : (
            <>
              <View style={styles.recording}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>Grabando</Text>
                <Text style={styles.recCount}>brazo {state.arm.sampleCount} · torso {state.torso.sampleCount}</Text>
              </View>
              <Btn onPress={onStop} danger>Detener y analizar</Btn>
            </>
          )}
        </>
      )}

      {busy ? <ActivityIndicator color={theme.arm} /> : null}
      {!bothConnected && anyConnected && !state.capturing ? (
        <Text style={styles.hint}>Falta una placa. Puedes capturar solo con el brazo, pero la secuencia tronco→brazo no estará disponible.</Text>
      ) : null}

      <Link href="/sessions" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={styles.linkText}>Ver historial de sesiones  →</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function BoardCard({ board, accent, label }: { board: BoardState; accent: string; label: string }) {
  const on = board.connected;
  return (
    <View style={[styles.board, { borderColor: on ? accent : theme.hair, flex: 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={[styles.dot, { backgroundColor: on ? theme.good : theme.faint }]} />
        <Text style={styles.boardTitle}>{label}</Text>
      </View>
      <Text style={[styles.boardState, { color: on ? theme.good : theme.faint }]}>{on ? "Conectado" : "Sin conexión"}</Text>
      <View style={styles.boardStats}>
        <View>
          <Text style={styles.bk}>Batería</Text>
          <Text style={styles.bv}>{board.batteryPct != null ? `${board.batteryPct}%` : "—"}</Text>
        </View>
        <View>
          <Text style={styles.bk}>Giro</Text>
          <Text style={[styles.bv, on && { color: accent }]}>{on ? `${board.lastGyroDps}` : "—"}</Text>
        </View>
      </View>
    </View>
  );
}

function RecordButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.record, disabled && { opacity: 0.5 }]}>
      <View style={styles.recordInner} />
      <Text style={styles.recordText}>Iniciar captura</Text>
    </Pressable>
  );
}

function Btn({ children, onPress, primary, danger, disabled }: any) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={[styles.btn, primary && styles.btnPrimary, danger && styles.btnDanger, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.btnText, (primary || danger) && { color: "#fff" }]}>{children}</Text>
    </Pressable>
  );
}

const card = { backgroundColor: theme.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.hair, shadowColor: "#1a2238", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  hero: { ...card, borderRadius: 26, padding: 22, overflow: "hidden", backgroundColor: theme.surface },
  heroGlow: { position: "absolute", right: -50, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: tint(theme.arm, "22") },
  eyebrow: { color: theme.arm, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  h1: { color: theme.text, fontSize: 32, fontWeight: "800", marginTop: 6, letterSpacing: -0.8, lineHeight: 36 },
  sub: { color: theme.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },

  board: { ...card, padding: 14 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  boardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  boardState: { fontSize: 12, fontWeight: "700", marginTop: 4 },
  boardStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  bk: { color: theme.faint, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  bv: { color: theme.text, fontSize: 18, fontWeight: "800", marginTop: 2 },

  btn: { ...card, paddingVertical: 15, alignItems: "center" },
  btnPrimary: { backgroundColor: theme.arm, borderColor: theme.arm },
  btnDanger: { backgroundColor: theme.bad, borderColor: theme.bad },
  btnText: { color: theme.text, fontSize: 15, fontWeight: "800" },

  record: { backgroundColor: theme.arm, borderRadius: 18, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 12, shadowColor: theme.arm, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  recordInner: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  recordText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  recording: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 4 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.bad },
  recText: { color: theme.bad, fontWeight: "800", fontSize: 14 },
  recCount: { color: theme.muted, fontSize: 12.5 },

  error: { color: theme.bad, fontSize: 13 },
  hint: { color: theme.faint, fontSize: 12.5, lineHeight: 18 },
  linkRow: { paddingVertical: 14, alignItems: "center" },
  linkText: { color: theme.torso, fontWeight: "800", fontSize: 14 },
});
