import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  OAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  updateProfile,
  type UserCredential,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

// Sign in with Apple (App Store guideline 4.8, since the app offers Google).
// iPhone and iPad only: the system Apple sheet gives an identity token that
// Firebase accepts as an "apple.com" credential. Needs the Apple provider
// switched on in Firebase Authentication. With `reauth`, it confirms the
// signed-in account again instead (needed before deleting an account).

// True once we know this device can show the Apple sheet (iOS 13+).
export function useAppleAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((result) => active && setAvailable(result))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return available;
}

export const isAppleCancel = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "ERR_REQUEST_CANCELED";

// Apple only shares the name the first time someone signs in to the app.
const fullName = (name: AppleAuthentication.AppleAuthenticationFullName | null) => ({
  firstName: name?.givenName?.trim() ?? "",
  lastName: name?.familyName?.trim() ?? "",
});

export type AppleName = ReturnType<typeof fullName>;

// The Apple sheet, then a Firebase sign-in (or re-confirmation) with its
// token. The nonce ties Apple's token to this request.
export async function signInWithApple(reauth = false): Promise<{ credential: UserCredential; name: AppleName }> {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!apple.identityToken) {
    throw new Error("Apple didn't return a sign-in token. Please try again.");
  }

  const firebaseCredential = new OAuthProvider("apple.com").credential({ idToken: apple.identityToken, rawNonce });
  const credential =
    reauth && auth.currentUser
      ? await reauthenticateWithCredential(auth.currentUser, firebaseCredential)
      : await signInWithCredential(auth, firebaseCredential);

  const name = fullName(apple.fullName);
  const displayName = `${name.firstName} ${name.lastName}`.trim();
  if (displayName && !credential.user.displayName) {
    await updateProfile(credential.user, { displayName }).catch(() => {});
  }

  return { credential, name };
}

type Props = {
  disabled?: boolean;
  reauth?: boolean;
  onStart: () => void;
  onSignedIn: (credential: UserCredential, name: AppleName) => void;
  onError: (error: unknown) => void;
  // Cancelling the Apple sheet isn't an error; this resets busy state.
  onCancel?: () => void;
};

export default function AppleButton({ disabled, reauth, onStart, onSignedIn, onError, onCancel }: Props) {
  const available = useAppleAvailable();
  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        reauth ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
      }
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={14}
      style={{ height: 50, width: "100%", opacity: disabled ? 0.5 : 1 }}
      onPress={async () => {
        if (disabled) return;
        onStart();
        try {
          const { credential, name } = await signInWithApple(reauth);
          onSignedIn(credential, name);
        } catch (error) {
          if (isAppleCancel(error)) onCancel?.();
          else onError(error);
        }
      }}
    />
  );
}
