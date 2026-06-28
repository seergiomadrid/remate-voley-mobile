import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getCloudConfig, setCloudConfig } from "@/cloud/supabase";
import { theme } from "@/theme";

export default function CloudConfigScreen() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [anon, setAnon] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await getCloudConfig();
      if (cfg) {
        setUrl(cfg.url);
        setAnon(cfg.anonKey);
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    await setCloudConfig(url, anon);
    setSaved(true);
    setTimeout(() => router.back(), 700);
  }

  if (loading) return <ActivityIndicator color={theme.arm} style={{ marginTop: 40 }} />;

  const valid = url.includes("supabase.co") && anon.length > 20;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={styles.intro}>
        Conecta tu proyecto de Supabase para subir sesiones a la nube. Encuentra
        estos datos en Supabase → Project Settings → API.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>URL del proyecto</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://xxxx.supabase.co"
          placeholderTextColor={theme.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Clave pública (anon key)</Text>
        <TextInput
          style={[styles.input, { height: 90 }]}
          value={anon}
          onChangeText={setAnon}
          placeholder="eyJ..."
          placeholderTextColor={theme.faint}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
      </View>

      <Pressable style={[styles.btn, !valid && styles.btnDisabled]} onPress={save} disabled={!valid}>
        <Text style={styles.btnText}>{saved ? "Guardado ✓" : "Guardar"}</Text>
      </Pressable>

      <Text style={styles.note}>
        Tus credenciales se guardan solo en este dispositivo. La anon key es una
        clave pública pensada para apps cliente.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.ground },
  intro: { color: theme.muted, fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: theme.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" },
  input: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius,
    padding: 12,
    color: theme.text,
    fontSize: 14,
  },
  btn: { backgroundColor: theme.arm, borderRadius: theme.radius, padding: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#0b1120", fontWeight: "800", fontSize: 15 },
  note: { color: theme.faint, fontSize: 12, lineHeight: 17 },
});
