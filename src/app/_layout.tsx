import { useEffect } from "react";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { AccountProvider } from "../lib/account";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      {/* Makes the signed-in account available on every screen */}
      <AccountProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Sign in slides up from the bottom, like a sheet */}
          <Stack.Screen name="login" options={{ presentation: "modal" }} />
        </Stack>
      </AccountProvider>
    </ThemeProvider>
  );
}
