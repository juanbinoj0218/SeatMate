import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";

import AppleButton, { useAppleAvailable } from "@/components/apple-button";
import GoogleButton, { googleAvailable } from "@/components/google-button";
import { Banner, Button, colors, Field, Muted } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { finishTwoFactorSignIn, twoFactorResolver } from "@/lib/two-factor";

const linked = (user: User, providerId: string) => user.providerData.some((provider) => provider.providerId === providerId);

const describe = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That password isn't right.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Confirmation was cancelled.";
    case "auth/user-mismatch":
      return "Confirm with the same account you're signed in with.";
    case "auth/invalid-verification-code":
      return "That code didn't work. Check your authenticator app and try the newest code.";
    case "auth/requires-recent-login":
      return "For your security, confirm it's you again, then delete your account.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error && !code ? error.message : "We couldn't delete your account. Please try again, or contact us.";
  }
};

// Permanently deletes the account, its saved places, history and seat
// alerts, like the website's "Delete account". Firebase only deletes
// accounts that confirmed who they are recently (password, Google or Apple,
// plus the authenticator-app code when two-step sign-in is on), so that
// comes first and nothing is removed if it fails. Then the data, then the
// sign-in account itself.
export default function DeleteAccountScreen() {
  const { user, deleteCustomerData, showToast } = useAccount();
  const appleAvailable = useAppleAvailable();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Muted>You&apos;re signed out.</Muted>
        </View>
      </View>
    );
  }

  const usesPassword = linked(user, "password");
  const usesGoogle = linked(user, "google.com");
  const usesApple = linked(user, "apple.com");
  const canGoogle = usesGoogle && googleAvailable;
  const canApple = usesApple && appleAvailable;
  const confirmed = confirmText.trim().toUpperCase() === "DELETE";

  const finish = async () => {
    try {
      await deleteCustomerData();
    } catch (caught) {
      console.error("Could not delete account data:", caught);
      setError(describe(caught));
      setBusy(false);
      return;
    }

    try {
      await deleteUser(user);
    } catch (caught) {
      console.error("Deleted data but not the account:", caught);
      setError(
        "Your saved places, history and seat alerts were deleted, but we couldn't remove your sign-in. Please try again, or contact us and we'll finish it for you."
      );
      setBusy(false);
      return;
    }

    showToast("Your account was deleted");
    router.dismissTo("/");
  };

  // Reauth failed: two-step sign-in accounts get the code step, anything
  // else is shown as an error.
  const reauthFailed = (caught: unknown) => {
    const resolver = twoFactorResolver(caught);
    if (resolver) {
      setTwoFactor(resolver);
      setCode("");
    } else {
      setError(describe(caught));
    }
    setBusy(false);
  };

  const start = () => {
    setError("");
    setBusy(true);
  };

  const deleteWithPassword = async () => {
    setError("");
    if (!confirmed) return setError("Type DELETE to confirm.");
    if (!password) return setError("Enter your password.");

    start();
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || "", password));
    } catch (caught) {
      reauthFailed(caught);
      return;
    }
    await finish();
  };

  const verifyCode = async () => {
    if (!twoFactor) return;
    setError("");
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your authenticator app.");

    start();
    try {
      await finishTwoFactorSignIn(twoFactor, code);
    } catch (caught) {
      setError(describe(caught));
      setBusy(false);
      return;
    }
    setTwoFactor(null);
    await finish();
  };

  if (twoFactor) {
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Enter your code</Text>
          <Muted style={{ marginTop: 8 }}>
            Your account uses two-step sign-in. Open your authenticator app and enter the 6-digit code for SeatMate to
            delete your account.
          </Muted>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Field
            label="6-digit code"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            onSubmitEditing={verifyCode}
          />
          <Button title="Verify and delete" variant="danger" busy={busy} onPress={verifyCode} style={{ marginTop: 22 }} />
          <Button
            title="Keep my account"
            variant="secondary"
            onPress={() => {
              setTwoFactor(null);
              setError("");
            }}
            style={{ marginTop: 10 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Delete your account?</Text>
        <Muted style={{ marginTop: 8 }}>
          This permanently deletes <Text style={{ fontWeight: "800", color: colors.ink }}>{user.email}</Text>, your saved
          places, recently viewed places, home ZIP and any seat alerts, in the app and on seatmate360.com. It can&apos;t be
          undone.
        </Muted>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <Field
          label="Type DELETE to confirm"
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
        />

        {usesPassword && (
          <>
            <Field
              label="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
            <Button title="Delete my account" variant="danger" busy={busy} onPress={deleteWithPassword} style={{ marginTop: 22 }} />
          </>
        )}

        {!usesPassword && (canGoogle || canApple) && (
          <View style={{ marginTop: 22, gap: 10 }}>
            {canApple && (
              <AppleButton
                reauth
                disabled={busy || !confirmed}
                onStart={start}
                onSignedIn={() => finish()}
                onCancel={() => setBusy(false)}
                onError={reauthFailed}
              />
            )}
            {canGoogle && (
              <GoogleButton
                reauth
                label="Confirm with Google and delete"
                disabled={busy || !confirmed}
                onStart={start}
                onSignedIn={() => finish()}
                onError={reauthFailed}
              />
            )}
            {!confirmed && <Text style={styles.note}>Type DELETE above first.</Text>}
          </View>
        )}

        {!usesPassword && !canGoogle && !canApple && (
          <Banner tone="warning">
            {usesGoogle
              ? "This account signs in with Google, which this build of the app can't confirm. Delete it from the Account page on seatmate360.com instead."
              : usesApple
                ? "This account signs in with Apple, which can only be confirmed on an iPhone or iPad. Delete it there, or from the Account page on seatmate360.com."
                : "This account's sign-in can't be confirmed in the app. Delete it from the Account page on seatmate360.com instead."}
          </Banner>
        )}

        <Button title="Keep my account" variant="secondary" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 24, paddingBottom: 56, width: "100%", maxWidth: 560, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "900", color: colors.ink, letterSpacing: -0.6 },
  note: { textAlign: "center", color: colors.faint, fontSize: 14, marginTop: 10 },
});
