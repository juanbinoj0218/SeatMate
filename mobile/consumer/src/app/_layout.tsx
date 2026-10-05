import { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { CircleAlert } from "lucide-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import OfflineBanner from "@/components/offline-banner";
import StatusScreen from "@/components/status-screen";
import { colors } from "@/components/ui";
import { AccountProvider, useAccount } from "@/lib/account";
import { PlacesProvider, usePlaces } from "@/lib/places";

// Keep the splash screen up until sign-in state and the first list of places
// are known, so the app opens on real content instead of a flash of loading.
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
  const { loading } = usePlaces();
  const { authReady } = useAccount();
  const ready = !loading && authReady;

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
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PlacesProvider>
          <AccountProvider>
            <SplashGate />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.page },
                headerTintColor: colors.ink,
                headerTitleStyle: { fontWeight: "800" },
                headerShadowVisible: false,
                headerBackButtonDisplayMode: "minimal",
                contentStyle: { backgroundColor: colors.page },
                // Native push: the iOS slide (with swipe back) on both
                // platforms, run by the OS rather than JavaScript.
                animation: "ios_from_right",
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "SeatMate" }} />
              <Stack.Screen name="place/[slug]" options={{ headerShown: false }} />
              {/* A native sheet on iOS (swipe down to close); slides up on Android. */}
              <Stack.Screen
                name="login"
                options={{
                  presentation: "modal",
                  animation: Platform.OS === "android" ? "slide_from_bottom" : "default",
                  headerShown: false,
                }}
              />
              <Stack.Screen name="profile" options={{ title: "Your details" }} />
              <Stack.Screen name="suggest" options={{ title: "Suggest a place" }} />
              <Stack.Screen name="contact" options={{ title: "Contact us" }} />
              <Stack.Screen name="delete-account" options={{ title: "Delete account" }} />
              <Stack.Screen name="+not-found" options={{ title: "Not found" }} />
            </Stack>
            <OfflineBanner />
          </AccountProvider>
        </PlacesProvider>
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
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <StatusScreen
        icon={<CircleAlert size={40} color={colors.muted} strokeWidth={1.9} />}
        title="Something went wrong"
        text="SeatMate hit a problem showing this screen. Try again, and if it keeps happening, restart the app."
        action="Try again"
        onAction={() => void retry()}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
});
