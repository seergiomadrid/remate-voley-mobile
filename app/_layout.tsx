import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "800" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "RemateVoley" }} />
        <Stack.Screen name="sessions" options={{ title: "Historial" }} />
        <Stack.Screen name="session/[id]" options={{ title: "Sesión" }} />
        <Stack.Screen name="cloud" options={{ title: "Nube", presentation: "modal" }} />
      </Stack>
    </>
  );
}
