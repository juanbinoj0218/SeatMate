import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { CircleAlert } from "lucide-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import OfflineBanner from "@/components/offline-banner";
import StatusScreen from "@/components/status-screen";
import { colors } from "@/components/ui";
import { SessionProvider, useSession } from "@/lib/session";

// Keep the splash screen up until we know who is signed in, so the app opens
// straight on the right screen instead of a loading flash.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Never hold the splash longer than this, even on a slow connection; the
// screens show their own loading states from here.
const SPLASH_TIMEOUT_MS = 4000;

let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  SplashScreen.hideAsync().catch(() => {});
}

function SplashGate() {
  const ready = useSession().state !== "loading";

  useEffect(() => {
    if (ready) hideSplash();
  }, [ready]);

  useEffect(() => {
    const timer = setTimeout(hideSplash, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={layout.root}>
      <SafeAreaProvider>
        <SessionProvider>
          <SplashGate />
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
            <Stack.Screen name="+not-found" options={{ title: "Not found" }} />
          </Stack>
          <OfflineBanner />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Shown in place of the whole app if a screen crashes.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("Unhandled error:", error);
    hideSplash();
  }, [error]);

  return (
    <GestureHandlerRootView style={layout.root}>
      <StatusBar style="dark" />
      <StatusScreen
        icon={<CircleAlert size={36} color={colors.muted} strokeWidth={1.9} />}
        title="Something went wrong"
        text="SeatMate Business hit a problem showing this screen. Try again, and if it keeps happening, restart the app."
        action="Try again"
        onAction={() => void retry()}
      />
    </GestureHandlerRootView>
  );
}

const layout = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
});
