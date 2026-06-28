import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.ground },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: theme.ground },
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
