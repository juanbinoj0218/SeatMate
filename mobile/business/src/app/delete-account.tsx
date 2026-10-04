import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";

import AppleButton, { useAppleAvailable } from "@/components/apple-button";
import { googleAvailable } from "@/components/google-button";
import GoogleReauthButton from "@/components/google-reauth-button";
import { Banner, Button, Card, colors, Field, Muted, Screen, Title } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { useSession } from "@/lib/session";
import { businessUrl } from "@/lib/site-urls";
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
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error && !code ? error.message : "We couldn't delete your account. Please try again, or contact us.";
  }
};

// Permanently deletes the business account (App Store rule: accounts made
// in the app can be deleted in the app). Firebase needs a recent sign-in,
// so the owner confirms with their password, Google or Apple (plus their
// authenticator code when two-step sign-in is on). Then the business site
// deletes the business, its listing, floor plan, staff and analytics, and
// the sign-in account; nothing is removed if confirming fails.
export default function DeleteAccountScreen() {
  const session = useSession();
  const appleAvailable = useAppleAvailable();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  const header = <Stack.Screen options={{ title: "Delete account" }} />;
  const user = session.state === "loading" || session.state === "signedOut" ? null : session.user;

  if (!user || deleted) {
    return (
      <Screen>
        {header}
        <Muted>{deleted ? "Your account was deleted." : "You're signed out."}</Muted>
        <Button title="Go to sign in" variant="secondary" onPress={() => router.replace("/login")} style={{ marginTop: 18 }} />
      </Screen>
    );
  }

  const usesPassword = linked(user, "password");
  const usesGoogle = linked(user, "google.com");
  const usesApple = linked(user, "apple.com");
  const canGoogle = usesGoogle && googleAvailable;
  const canApple = usesApple && appleAvailable;
  const confirmed = confirmText.trim().toUpperCase() === "DELETE";
  const businessName = session.state === "owner" ? session.business.name : null;

  // Runs once the account is confirmed. A fresh ID token carries the new
  // sign-in time the server checks.
  const finish = async () => {
    setBusy(true);
    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch(businessUrl("/api/delete-account"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error || "We couldn't delete your account. Please try again, or contact us.");
        setBusy(false);
        return;
      }
    } catch (caught) {
      console.error("Could not delete account:", caught);
      setError(describe(caught));
      setBusy(false);
      return;
    }

    setDeleted(true);
    await signOut(auth).catch(() => {});
    router.replace("/login");
  };

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        {header}
        <Card>
          {twoFactor ? (
            <>
              <Title>Enter your code</Title>
              <Muted style={{ marginTop: 8 }}>
                Your account uses two-factor sign-in. Open your authenticator app and enter the 6-digit code for
                SeatMate to delete your account.
              </Muted>
              <Field
                label="Code"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                onSubmitEditing={verifyCode}
              />
              {error ? <Banner tone="error">{error}</Banner> : null}
              <Button title="Verify and delete" variant="danger" busy={busy} onPress={verifyCode} style={{ marginTop: 18 }} />
              <Button
                title="Keep my account"
                variant="secondary"
                onPress={() => {
                  setTwoFactor(null);
                  setError("");
                }}
                style={{ marginTop: 10 }}
              />
            </>
          ) : (
            <>
              <Title>Delete your account?</Title>
              <Muted style={{ marginTop: 8 }}>
                This permanently deletes <Text style={styles.strong}>{user.email}</Text>
                {session.state === "owner" ? (
                  <>
                    {" "}
                    and <Text style={styles.strong}>{businessName}</Text>: its SeatMate listing, floor plan and live
                    seats, staff accounts and invites, hours, cover photo and analytics. Customers won&apos;t find it on
                    SeatMate anymore.
                  </>
                ) : session.state === "staff" ? (
                  <> and your staff access to {session.staff.businessName}.</>
                ) : (
                  "."
                )}{" "}
                The same sign-in is removed from the SeatMate customer app and websites too. It can&apos;t be undone.
              </Muted>

              <Field
                label="Type DELETE to confirm"
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="DELETE"
              />

              {error ? <Banner tone="error">{error}</Banner> : null}

              {usesPassword && (
                <>
                  <Field
                    label="Your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    onSubmitEditing={deleteWithPassword}
                  />
                  <Button
                    title="Delete my account"
                    variant="danger"
                    busy={busy}
                    onPress={deleteWithPassword}
                    style={{ marginTop: 18 }}
                  />
                </>
              )}

              {!usesPassword && (canGoogle || canApple) && (
                <View style={{ marginTop: 18, gap: 10 }}>
                  {canApple && (
                    <AppleButton
                      reauth
                      disabled={busy || !confirmed}
                      onStart={start}
                      onSignedIn={() => void finish()}
                      onCancel={() => setBusy(false)}
                      onError={reauthFailed}
                    />
                  )}
                  {canGoogle && (
                    <GoogleReauthButton
                      reauth
                      label="Confirm with Google and delete"
                      disabled={busy || !confirmed}
                      onStart={start}
                      onSignedIn={() => void finish()}
                      onError={reauthFailed}
                    />
                  )}
                  {!confirmed && <Muted style={styles.note}>Type DELETE above first.</Muted>}
                </View>
              )}

              {!usesPassword && !canGoogle && !canApple && (
                <Banner tone="warning">
                  {usesGoogle
                    ? "This account signs in with Google, which this build of the app can't confirm. Delete it from the Security page on seatmate360.net instead."
                    : usesApple
                      ? "This account signs in with Apple, which can only be confirmed on an iPhone or iPad. Delete it there, or from the Security page on seatmate360.net."
                      : "This account's sign-in can't be confirmed in the app. Delete it from the Security page on seatmate360.net instead."}
                </Banner>
              )}

              <Button
                title="Keep my account"
                variant="secondary"
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                style={{ marginTop: 10 }}
              />
            </>
          )}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  strong: { fontWeight: "800", color: colors.ink },
  note: { textAlign: "center", marginTop: 4 },
});
