import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { analyzeSession } from "@core";
import { ble, type BleState, type BoardState } from "@/ble/bleManager";
import { saveSession } from "@/db/database";
import { theme } from "@/theme";

export default function CaptureScreen() {
  const router = useRouter();
  const [state, setState] = useState<BleState>(ble.snapshot());
  const [busy, setBusy] = useState(false);
  const [captureStart, setCaptureStart] = useState<number | null>(null);

  useEffect(() => ble.subscribe(setState), []);

  const bothConnected = state.arm.connected && state.torso.connected;
  const anyConnected = state.arm.connected || state.torso.connected;

  async function onConnect() {
    setBusy(true);
    await ble.scanAndConnect();
    setBusy(false);
  }

  async function onSync() {
    await ble.sync();
    Alert.alert("Sincronizando", "Junta y golpea suavemente las dos placas una vez para afinar la sincronización de relojes.");
  }

  async function onStart() {
    setCaptureStart(Date.now());
    await ble.startCapture();
  }

  async function onStop() {
    const startedAt = captureStart ?? Date.now();
    const { arm, torso } = ble.stopCapture();
    setCaptureStart(null);
    if (!arm) {
      Alert.alert("Sin datos", "No se recibieron muestras del sensor de brazo.");
      return;
    }
    setBusy(true);
    try {
      const result = analyzeSession(arm, torso);
      const id = await saveSession(result, startedAt, Date.now());
      router.push(`/session/${id}`);
    } catch (e: any) {
      Alert.alert("Error al analizar", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={styles.eyebrow}>LAB DE RENDIMIENTO</Text>
      <Text style={styles.h1}>Captura de remate</Text>
      <Text style={styles.sub}>Conecta los dos sensores, sincroniza y graba tu serie. Sin ordenador.</Text>

      <BoardCard board={state.arm} accent={theme.arm} label="Muñeca" />
      <BoardCard board={state.torso} accent={theme.torso} label="Torso" />

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      {!anyConnected ? (
        <Btn onPress={onConnect} disabled={busy || state.scanning} primary>
          {state.scanning ? "Buscando sensores…" : "Conectar sensores"}
        </Btn>
      ) : (
        <>
          <Btn onPress={onSync} disabled={state.capturing}>Sincronizar relojes</Btn>
          {!state.capturing ? (
            <Btn onPress={onStart} disabled={!anyConnected || busy} primary>
              Iniciar captura
            </Btn>
          ) : (
            <Btn onPress={onStop} danger>
              Detener y analizar
            </Btn>
          )}
          {state.capturing ? (
            <Text style={styles.capturing}>
              ● Grabando · brazo {state.arm.sampleCount} · torso {state.torso.sampleCount} muestras
            </Text>
          ) : null}
        </>
      )}

      {busy ? <ActivityIndicator color={theme.arm} /> : null}
      {!bothConnected && anyConnected ? (
        <Text style={styles.hint}>Falta una placa. Puedes capturar solo con el brazo, pero la secuenciación torso→brazo no estará disponible.</Text>
      ) : null}

      <Link href="/sessions" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={styles.linkText}>Ver historial de sesiones →</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function BoardCard({ board, accent, label }: { board: BoardState; accent: string; label: string }) {
  return (
    <View style={[styles.card, { borderColor: board.connected ? accent : theme.line }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={[styles.dot, { backgroundColor: board.connected ? theme.good : theme.faint }]} />
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardId}>{board.sensor}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        <Stat label="Estado" value={board.connected ? "Conectado" : "—"} />
        <Stat label="Batería" value={board.batteryPct != null ? `${board.batteryPct}%` : "—"} />
        <Stat label="Giro" value={board.connected ? `${board.lastGyroDps}°/s` : "—"} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Btn({ children, onPress, primary, danger, disabled }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        primary && { backgroundColor: theme.arm },
        danger && { backgroundColor: theme.bad },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.btnText, (primary || danger) && { color: "#0b1120" }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ground },
  eyebrow: { color: theme.arm, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  h1: { color: theme.text, fontSize: 28, fontWeight: "800", marginTop: 2 },
  sub: { color: theme.muted, fontSize: 14, marginBottom: 4 },
  card: { backgroundColor: theme.panel, borderRadius: theme.radius, borderWidth: 1, padding: 14 },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  cardId: { color: theme.faint, fontSize: 11, marginLeft: "auto" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statLabel: { color: theme.faint, fontSize: 11, textTransform: "uppercase" },
  statValue: { color: theme.text, fontSize: 17, fontWeight: "700" },
  btn: { backgroundColor: theme.panel, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: theme.line },
  btnText: { color: theme.text, fontSize: 15, fontWeight: "700" },
  capturing: { color: theme.bad, textAlign: "center", fontWeight: "700" },
  error: { color: theme.bad, fontSize: 13 },
  hint: { color: theme.faint, fontSize: 12.5 },
  linkRow: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: theme.torso, fontWeight: "700" },
});
