import { Redirect } from "expo-router";
import { signOut } from "firebase/auth";
import { View } from "react-native";

import { Banner, Button, Screen, SkeletonScreen } from "@/components/ui";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { useSession } from "@/lib/session";

// Sends everyone to the right place for their account, like the web portal.
export default function Index() {
  const session = useSession();

  if (!firebaseConfigured) {
    return (
      <Screen edges={["top", "bottom", "left", "right"]}>
        <Banner tone="error">
          Firebase isn&apos;t set up. Copy .env.example to .env, fill in the EXPO_PUBLIC_FIREBASE_* values
          and restart Expo.
        </Banner>
      </Screen>
    );
  }

  switch (session.state) {
    case "loading":
      return <SkeletonScreen edges={["top", "bottom", "left", "right"]} />;
    case "signedOut":
      return <Redirect href="/login" />;
    case "owner":
      return <Redirect href="/dashboard" />;
    case "staff":
      return <Redirect href="/staff" />;
    case "new":
      return <Redirect href="/setup" />;
    case "error":
      return (
        <Screen edges={["top", "bottom", "left", "right"]}>
          <Banner tone="error">{session.message}</Banner>
          <View style={{ marginTop: 16 }}>
            <Button title="Sign out" variant="secondary" onPress={() => void signOut(auth)} />
          </View>
        </Screen>
      );
  }
}
