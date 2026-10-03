import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type UserCredential } from "firebase/auth";
import Svg, { Path } from "react-native-svg";

import { colors } from "@/components/ui";
import { auth } from "@/lib/firebase";

WebBrowser.maybeCompleteAuthSession();

// Google sign-in for accounts made with "Continue with Google" on the
// website. In a browser it uses Firebase's popup like the website; on a
// phone it needs the Google OAuth client IDs from Google Cloud (see README).
const clientIds = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export const googleAvailable =
  Platform.OS === "web" ||
  Boolean(Platform.OS === "ios" ? clientIds.iosClientId : Platform.OS === "android" ? clientIds.androidClientId : null);

type Props = {
  disabled?: boolean;
  onStart: () => void;
  onSignedIn: (credential: UserCredential) => void;
  onError: (error: unknown) => void;
};

export default function GoogleButton(props: Props) {
  if (!googleAvailable) return null;
  return Platform.OS === "web" ? <WebGoogleButton {...props} /> : <NativeGoogleButton {...props} />;
}

function WebGoogleButton({ disabled, onStart, onSignedIn, onError }: Props) {
  return (
    <Look
      disabled={disabled}
      onPress={async () => {
        onStart();
        try {
          onSignedIn(await signInWithPopup(auth, new GoogleAuthProvider()));
        } catch (error) {
          onError(error);
        }
      }}
    />
  );
}

function NativeGoogleButton({ disabled, onStart, onSignedIn, onError }: Props) {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(clientIds);

  return (
    <Look
      disabled={disabled || !request}
      onPress={async () => {
        onStart();
        try {
          const result = await promptAsync();
          const idToken = result.type === "success" ? (result.params.id_token ?? result.authentication?.idToken) : null;
          if (!idToken) {
            onError(new Error("Google sign-in was cancelled."));
            return;
          }
          onSignedIn(await signInWithCredential(auth, GoogleAuthProvider.credential(idToken)));
        } catch (error) {
          onError(error);
        }
      }}
    />
  );
}

function Look({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && { opacity: 0.5 }, pressed && { backgroundColor: "#f9fafb" }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <GoogleLogo />
        <Text style={styles.text}>Continue with Google</Text>
      </View>
    </Pressable>
  );
}

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  text: { fontSize: 16, fontWeight: "700", color: colors.ink },
});
