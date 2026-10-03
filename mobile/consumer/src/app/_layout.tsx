import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/components/ui";
import { AccountProvider } from "@/lib/account";
import { PlacesProvider } from "@/lib/places";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlacesProvider>
        <AccountProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.page },
              headerTintColor: colors.ink,
              headerTitleStyle: { fontWeight: "800" },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: "minimal",
              contentStyle: { backgroundColor: colors.page },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "SeatMate" }} />
            <Stack.Screen name="place/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: "Your details" }} />
            <Stack.Screen name="suggest" options={{ title: "Suggest a place" }} />
            <Stack.Screen name="contact" options={{ title: "Contact us" }} />
            <Stack.Screen name="delete-account" options={{ title: "Delete account" }} />
          </Stack>
        </AccountProvider>
      </PlacesProvider>
    </SafeAreaProvider>
  );
}
