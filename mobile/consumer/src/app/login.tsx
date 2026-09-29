import { ReactNode, useEffect, useState } from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import { auth } from "../lib/auth";
import { useAccount } from "../lib/account";
import { PRIVACY_URL, TERMS_URL } from "../lib/site";

// Same messages as the website's sign-in page
function errorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account already exists with this email. Try signing in.";
    case "auth/weak-password":
      return "Use at least 6 characters for your password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      console.error("Sign-in failed:", error);
      return "Something went wrong. Please try again.";
  }
}

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, authReady } = useAccount();

  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const signingUp = mode === "signup";

  // Signed in (or already was): close this screen
  useEffect(() => {
    if (authReady && user) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/account");
      }
    }
  }, [authReady, user, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit() {
    setError("");
    setNotice("");

    if (signingUp && !name.trim()) {
      setError("Enter your name.");
      return;
    }

    setBusy(true);

    try {
      if (signingUp) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError("Enter your email above, then tap “Forgot password?”.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice(
        `If there's an account for ${email.trim()}, a reset link is on its way. ` +
          "It can take a minute — check your spam or junk folder too."
      );
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* CLOSE */}

          <View style={styles.topRow}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              hitSlop={10}
              style={({ pressed }) => [styles.closeButton, pressed ? { opacity: 0.6 } : null]}
            >
              <Ionicons name="close" size={20} color="#1F2522" />
            </Pressable>
          </View>

          {/* HEADER */}

          <Text style={styles.title}>{signingUp ? "Create your account" : "Welcome back"}</Text>

          <Text style={styles.subtitle}>
            {signingUp
              ? "Save places and see what's open near you."
              : "Sign in to see your saved places."}
          </Text>

          {/* FORM */}

          <View style={styles.card}>
            {signingUp && (
              <Field label="Name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="#9AA09D"
                  autoComplete="name"
                  textContentType="name"
                  style={styles.input}
                />
              </Field>
            )}

            <Field label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9AA09D"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
              />
            </Field>

            <Field
              label="Password"
              action={
                !signingUp ? (
                  <Pressable onPress={resetPassword} hitSlop={8}>
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </Pressable>
                ) : null
              }
            >
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={signingUp ? "At least 6 characters" : "Your password"}
                  placeholderTextColor="#9AA09D"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  textContentType={signingUp ? "newPassword" : "password"}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                />

                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={8}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#9AA09D"
                  />
                </Pressable>
              </View>
            </Field>

            {error !== "" && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {notice !== "" && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryButton,
                busy ? { opacity: 0.6 } : null,
                pressed && !busy ? { opacity: 0.8, transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {signingUp ? "Create account" : "Sign in"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* SWITCH MODE */}

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {signingUp ? "Already have an account? " : "New to SeatMate? "}
            </Text>

            <Pressable onPress={() => switchMode(signingUp ? "signin" : "signup")} hitSlop={8}>
              <Text style={styles.switchLink}>{signingUp ? "Sign in" : "Create an account"}</Text>
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            {signingUp
              ? "By creating an account, you agree to the SeatMate "
              : "An account is optional. You can always check seats without one. See our "}
            <Text style={styles.footnoteLink} onPress={() => Linking.openURL(TERMS_URL)}>
              Terms of Service
            </Text>
            {" and "}
            <Text style={styles.footnoteLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
              Privacy Policy
            </Text>
            {". It's the same account as the SeatMate website."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {action}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F6F3" },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  topRow: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECECE8",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "800",
    color: "#1F2522",
    letterSpacing: -0.5,
  },

  subtitle: { marginTop: 6, fontSize: 15, color: "#5F6763", lineHeight: 21 },

  card: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECECE8",
    padding: 18,
  },

  field: { marginBottom: 14 },

  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#1F2522" },

  linkText: { fontSize: 14, fontWeight: "600", color: "#23804F" },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E6E6E2",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#1F2522",
    backgroundColor: "#FFFFFF",
  },

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E6E2",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  eyeButton: { paddingHorizontal: 12, height: 46, justifyContent: "center" },

  errorBox: { backgroundColor: "#FBEEEE", borderRadius: 12, padding: 12, marginBottom: 12 },

  errorText: { color: "#B55353", fontSize: 14, lineHeight: 19 },

  noticeBox: { backgroundColor: "#E9F6EE", borderRadius: 12, padding: 12, marginBottom: 12 },

  noticeText: { color: "#23804F", fontSize: 14, lineHeight: 19 },

  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#1F2522",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    flexWrap: "wrap",
  },

  switchText: { color: "#5F6763", fontSize: 14 },

  switchLink: { color: "#1F2522", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },

  footnoteLink: { color: "#5F6763", fontWeight: "600", textDecorationLine: "underline" },

  footnote: {
    marginTop: 18,
    textAlign: "center",
    color: "#9AA09D",
    fontSize: 13,
    lineHeight: 18,
  },
});
