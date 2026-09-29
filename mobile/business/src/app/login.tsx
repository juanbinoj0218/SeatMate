import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import { Banner, Button, Card, colors, Eyebrow, Field, Muted, Screen, Segmented, Title } from "@/components/ui";
import { friendlyAuthError } from "@/lib/errors";
import { auth } from "@/lib/firebase";

type Mode = "signin" | "signup";

// Only follow in-app paths (e.g. a staff invite) after signing in.
const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [mode, setMode] = useState<Mode>("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const done = () => {
    // "/" works out where this account belongs (dashboard, staff, setup).
    router.replace((safeNext(next) ?? "/") as "/");
  };

  const switchMode = (value: Mode) => {
    setMode(value);
    setError("");
    setMessage("");
  };

  const signIn = async () => {
    setError("");
    setMessage("");

    if (!email.trim()) return setError("Enter your email.");
    if (!password) return setError("Enter your password.");

    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      done();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setError("");
    setMessage("");

    if (!firstName.trim()) return setError("Enter your first name.");
    if (!lastName.trim()) return setError("Enter your last name.");
    if (!email.trim()) return setError("Enter your email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    try {
      setBusy(true);
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: `${firstName.trim()} ${lastName.trim()}` });
      done();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError("");
    setMessage("");

    if (!email.trim()) return setError("Enter your email first, then tap Forgot password.");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Firebase doesn't reveal whether an account exists, so neither can we.
      setMessage(
        `If there's an account for ${email.trim()}, a reset link is on its way. ` +
          "It can take a minute — check your spam or junk folder too."
      );
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["top", "bottom", "left", "right"]}>
        <View style={{ paddingTop: 12, paddingBottom: 20 }}>
          <Eyebrow>SeatMate for Business</Eyebrow>
          <Text style={styles.hero}>Manage your space in real time.</Text>
          <Muted style={{ marginTop: 8 }}>
            Build your floor plan, manage staff and keep customers updated on live seating.
          </Muted>
        </View>

        <Card>
          <Segmented
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
            value={mode}
            onChange={switchMode}
          />

          <View style={{ marginTop: 18 }}>
            <Title>{mode === "signin" ? "Welcome back." : "Create your account."}</Title>
            <Muted style={{ marginTop: 4 }}>
              {mode === "signin"
                ? "Sign in to manage your SeatMate business."
                : "Create an account to register and manage your business."}
            </Muted>
          </View>

          {mode === "signup" && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" />
              </View>
            </View>
          )}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            textContentType={mode === "signin" ? "password" : "newPassword"}
            onSubmitEditing={mode === "signin" ? signIn : undefined}
          />
          {mode === "signup" && (
            <Field
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={createAccount}
            />
          )}

          {mode === "signin" && (
            <Pressable onPress={forgotPassword} accessibilityRole="button" style={{ alignSelf: "flex-end", marginTop: 10 }}>
              <Text style={{ color: colors.greenText, fontWeight: "700" }}>Forgot password?</Text>
            </Pressable>
          )}

          {error ? <Banner tone="error">{error}</Banner> : null}
          {message ? <Banner tone="success">{message}</Banner> : null}

          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={mode === "signin" ? signIn : createAccount}
            busy={busy}
            style={{ marginTop: 18 }}
          />

          {mode === "signup" && (
            <Muted style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
              Next you&apos;ll add your business details and build your floor plan. Invited as staff? Create
              an account, then enter your invite link.
            </Muted>
          )}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 34, fontWeight: "800", color: colors.ink, letterSpacing: -0.8, marginTop: 8, lineHeight: 38 },
});
