import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, type User } from "firebase/auth";

import GoogleButton, { googleAvailable } from "@/components/google-button";
import { Banner, Button, colors, Field, Muted } from "@/components/ui";
import { useAccount } from "@/lib/account";

const usesPassword = (user: User) => user.providerData.some((provider) => provider.providerId === "password");

const describe = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That password isn't right.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google confirmation was cancelled.";
    case "auth/user-mismatch":
      return "Confirm with the same Google account you're signed in with.";
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
// accounts that confirmed who they are recently, so that comes first;
// nothing is removed if it fails.
export default function DeleteAccountScreen() {
  const { user, deleteCustomerData, showToast } = useAccount();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
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

  const needsPassword = usesPassword(user);
  const confirmed = confirmText.trim().toUpperCase() === "DELETE";

  const finish = async () => {
    try {
      await deleteCustomerData();
      await deleteUser(user);
      showToast("Your account was deleted");
      router.dismissTo("/");
    } catch (caught) {
      console.error("Could not delete account:", caught);
      setError(describe(caught));
      setBusy(false);
    }
  };

  const deleteWithPassword = async () => {
    setError("");
    if (!confirmed) return setError("Type DELETE to confirm.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || "", password));
    } catch (caught) {
      setError(describe(caught));
      setBusy(false);
      return;
    }
    await finish();
  };

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

        {needsPassword ? (
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
        ) : googleAvailable ? (
          <View style={{ marginTop: 22 }}>
            <GoogleButton
              reauth
              label="Confirm with Google and delete"
              disabled={busy || !confirmed}
              onStart={() => {
                setError("");
                setBusy(true);
              }}
              onSignedIn={() => finish()}
              onError={(caught) => {
                setError(describe(caught));
                setBusy(false);
              }}
            />
            {!confirmed && <Text style={styles.note}>Type DELETE above first.</Text>}
          </View>
        ) : (
          <Banner tone="warning">
            This account signs in with Google, which this build of the app can&apos;t confirm. Delete it from the Account
            page on seatmate360.com instead.
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
