import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/components/ui";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#fff" },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.page },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ title: "Add your business", headerBackVisible: false }} />
          <Stack.Screen name="join" options={{ title: "Join as staff" }} />
          <Stack.Screen name="dashboard" options={{ title: "SeatMate Business", headerBackVisible: false }} />
          <Stack.Screen name="floor-plan" options={{ title: "Floor plan" }} />
          <Stack.Screen name="team" options={{ title: "Staff" }} />
          <Stack.Screen name="hours" options={{ title: "Business hours" }} />
          <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
          <Stack.Screen name="qr" options={{ title: "QR code" }} />
          <Stack.Screen name="door" options={{ title: "Door counter" }} />
          <Stack.Screen name="staff/index" options={{ title: "Staff console", headerBackVisible: false }} />
          <Stack.Screen name="staff/join/[inviteId]" options={{ title: "Staff invitation" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
