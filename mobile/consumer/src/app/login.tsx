import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type MultiFactorResolver,
} from "firebase/auth";

import AppleButton, { useAppleAvailable } from "@/components/apple-button";
import GoogleButton, { googleAvailable } from "@/components/google-button";
import { BellIcon, CloseIcon, HeartIcon, SeatMateMark } from "@/components/icons";
import { Banner, Button, colors, Field, PressableScale } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { friendlyAuthError } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { success } from "@/lib/haptics";
import { consumerUrl } from "@/lib/site-urls";
import { finishTwoFactorSignIn, twoFactorResolver } from "@/lib/two-factor";

type Mode = "signin" | "signup" | "reset";

// Sign in or create a customer account: the same accounts as seatmate360.com
// (email and password, Google, Apple on iPhone, and the authenticator-app code for accounts
// that turned on two-step sign-in).
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { user, authReady } = useAccount();
  const appleAvailable = useAppleAvailable();
  const [mode, setMode] = useState<Mode>("signin");
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/")), []);

  // Signed in (here, or already): back to where they were.
  useEffect(() => {
    if (authReady && user && !twoFactor) {
      success();
      close();
    }
  }, [authReady, user, twoFactor, close]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const fail = (caught: unknown) => {
    const resolver = twoFactorResolver(caught);
    if (resolver) {
      setTwoFactor(resolver);
      setCode("");
    } else {
      setError(friendlyAuthError(caught));
    }
    setBusy(false);
  };

  const submit = async () => {
    setError("");
    setNotice("");

    if (mode === "signup" && !name.trim()) return setError("Enter your name.");
    if (!email.trim()) return setError("Enter your email.");

    if (mode === "reset") {
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, email.trim(), { url: consumerUrl("/login"), handleCodeInApp: false }).catch(
          (caught) => {
            const failure = String((caught as { code?: unknown })?.code ?? "");
            if (failure === "auth/unauthorized-continue-uri" || failure === "auth/invalid-continue-uri") {
              return sendPasswordResetEmail(auth, email.trim());
            }
            throw caught;
          }
        );
        setNotice(
          `If there's an account for ${email.trim()}, a reset link is on its way. It can take a minute, so check your spam folder too.`
        );
      } catch (caught) {
        setError(friendlyAuthError(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password) return setError("Enter your password.");
    if (mode === "signup" && password.length < 6) return setError("Use at least 6 characters for your password.");

    setBusy(true);
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (caught) {
      fail(caught);
    }
  };

  const verify = async () => {
    if (!twoFactor) return;
    setError("");
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your authenticator app.");

    setBusy(true);
    try {
      await finishTwoFactorSignIn(twoFactor, code);
      setTwoFactor(null);
    } catch (caught) {
      const failure = String((caught as { code?: unknown })?.code ?? "");
      setError(
        failure === "auth/invalid-verification-code"
          ? "That code didn't work. Check your authenticator app and try the newest code."
          : friendlyAuthError(caught)
      );
      setBusy(false);
    }
  };

  const signingUp = mode === "signup";

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <SeatMateMark size={36} />
          <PressableScale accessibilityLabel="Close" hitSlop={10} scaleTo={0.9} onPress={close} style={styles.close}>
            <CloseIcon size={16} />
          </PressableScale>
        </View>

        {twoFactor ? (
          <>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.subtitle}>
              Your account uses two-step sign-in. Open your authenticator app and enter the 6-digit code for SeatMate.
            </Text>
            {error ? <Banner tone="error">{error}</Banner> : null}
            <Field
              label="6-digit code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus
              onSubmitEditing={verify}
            />
            <Button title="Verify and sign in" onPress={verify} busy={busy} style={{ marginTop: 20 }} />
            <Button
              title="Use a different account"
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
            <Text style={styles.title}>
              {mode === "reset" ? "Reset your password" : signingUp ? "Create your account" : "Welcome back"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "reset"
                ? "We'll email you a link to choose a new password."
                : "One account for the SeatMate app and seatmate360.com."}
            </Text>

            {mode !== "reset" && (
              <View style={styles.perks}>
                <Perk icon={<HeartIcon size={15} color={colors.red} filled />} text="Save your favorite spots" />
                <Perk icon={<BellIcon size={15} color={colors.green} />} text="Get emailed when a seat opens" />
              </View>
            )}

            {error ? <Banner tone="error">{error}</Banner> : null}
            {notice ? <Banner tone="success">{notice}</Banner> : null}

            {signingUp && (
              <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Your name" />
            )}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
            {mode !== "reset" && (
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={signingUp ? "new-password" : "current-password"}
                textContentType={signingUp ? "newPassword" : "password"}
                placeholder={signingUp ? "At least 6 characters" : "Your password"}
                onSubmitEditing={submit}
              />
            )}

            {mode === "signin" && (
              <Text accessibilityRole="button" style={styles.forgot} onPress={() => switchMode("reset")}>
                Forgot password?
              </Text>
            )}

            <Button
              title={mode === "reset" ? "Send reset link" : signingUp ? "Create account" : "Sign in"}
              onPress={submit}
              busy={busy}
              style={{ marginTop: 20 }}
            />

            {mode !== "reset" && (googleAvailable || appleAvailable) && (
              <>
                <View style={styles.or}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                <View style={{ gap: 10 }}>
                  <AppleButton
                    disabled={busy}
                    onStart={() => {
                      setError("");
                      setBusy(true);
                    }}
                    onSignedIn={() => setBusy(false)}
                    onCancel={() => setBusy(false)}
                    onError={fail}
                  />
                  <GoogleButton
                    disabled={busy}
                    onStart={() => {
                      setError("");
                      setBusy(true);
                    }}
                    onSignedIn={() => setBusy(false)}
                    onError={fail}
                  />
                </View>
              </>
            )}

            <Text style={styles.switch}>
              {mode === "reset" ? "Remembered it? " : signingUp ? "Already have an account? " : "New to SeatMate? "}
              <Text style={styles.switchLink} onPress={() => switchMode(signingUp || mode === "reset" ? "signin" : "signup")}>
                {mode === "reset" || signingUp ? "Sign in" : "Create an account"}
              </Text>
            </Text>

            <Text style={styles.legal}>
              By continuing you agree to SeatMate&apos;s Terms and Privacy Policy.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Perk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.perk}>
      {icon}
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: 22, width: "100%", maxWidth: 480, alignSelf: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eceee9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 32, fontWeight: "900", color: colors.ink, letterSpacing: -1, marginTop: 26 },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: 6 },
  perks: { gap: 8, marginTop: 18, marginBottom: 6 },
  perk: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  forgot: { alignSelf: "flex-end", marginTop: 12, fontSize: 14, fontWeight: "800", color: colors.green },
  or: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.faint, fontWeight: "700" },
  switch: { textAlign: "center", marginTop: 24, fontSize: 15, color: colors.muted },
  switchLink: { color: colors.ink, fontWeight: "900" },
  legal: { textAlign: "center", marginTop: 24, fontSize: 13, color: colors.faint, lineHeight: 19 },
});
