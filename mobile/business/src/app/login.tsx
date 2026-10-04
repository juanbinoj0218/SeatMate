import { useCallback, useRef, useState, type ComponentType } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type MultiFactorResolver,
} from "firebase/auth";

import GoogleButton, { googleAvailable } from "@/components/google-button";
import { ClockIcon, FloorPlanIcon, SeatIcon, SeatMateMark, StaffIcon } from "@/components/icons";
import { Banner, Button, colors, Field, Muted, Segmented } from "@/components/ui";
import { friendlyAuthError } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { businessUrl, consumerUrl } from "@/lib/site-urls";
import { finishTwoFactorSignIn, twoFactorResolver } from "@/lib/two-factor";

type Mode = "signin" | "signup";

// Same four features, colors and icons as the business portal's sign-in page.
const FEATURES: { title: string; description: string; Icon: ComponentType<{ size?: number; color?: string }>; tile: [string, string] }[] = [
  { title: "Floor plan", description: "Lay out your tables and seats.", Icon: FloorPlanIcon, tile: ["#d1fae5", "#047857"] },
  { title: "Live seats", description: "Mark seats open or taken as guests come and go.", Icon: SeatIcon, tile: ["#e0f2fe", "#0369a1"] },
  { title: "Staff", description: "Invite your team to update seats.", Icon: StaffIcon, tile: ["#ede9fe", "#6d28d9"] },
  { title: "Hours", description: "Show customers when you're open.", Icon: ClockIcon, tile: ["#fef3c7", "#b45309"] },
];

// A sample row of seats showing what customers see: green open, red taken.
const SAMPLE_SEATS = [true, false, true, true, false, false, true, true, false, true, true, true];

// Only follow in-app paths (e.g. a staff invite) after signing in.
const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;

// The opening screen: the business portal's sign-in page, laid out for a
// phone (stacked) or a tablet (side by side). Accounts made on the website
// sign in here with the same email/password, Google or two-factor code.
export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const scroll = useRef<ScrollView>(null);
  const [cardY, setCardY] = useState(0);

  const [mode, setMode] = useState<Mode>("signin");
  const [twoFactor, setTwoFactor] = useState<MultiFactorResolver | null>(null);
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const done = useCallback(() => {
    // "/" works out where this account belongs (dashboard, staff, setup).
    router.replace((safeNext(next) ?? "/") as "/");
  }, [next]);

  const clear = () => {
    setError("");
    setMessage("");
  };

  const fail = useCallback((err: unknown) => {
    const resolver = twoFactorResolver(err);
    if (resolver) {
      setTwoFactor(resolver);
      setCode("");
    } else {
      setError(friendlyAuthError(err));
    }
    setBusy(false);
  }, []);

  const signIn = async () => {
    clear();
    if (!email.trim()) return setError("Enter your email.");
    if (!password) return setError("Enter your password.");

    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      done();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    clear();
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

  const verifyCode = async () => {
    if (!twoFactor) return;
    clear();
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your authenticator app.");

    try {
      setBusy(true);
      await finishTwoFactorSignIn(twoFactor, code);
      done();
    } catch (err) {
      setError(
        typeof err === "object" && err !== null && "code" in err && String(err.code) === "auth/invalid-verification-code"
          ? "That code didn't match. Check your authenticator app and try again."
          : friendlyAuthError(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    clear();
    if (!email.trim()) return setError("Enter your email first, then tap Forgot password.");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Firebase doesn't reveal whether an account exists, so neither can we.
      setMessage(
        `If there's an account for ${email.trim()}, a reset link is on its way. ` +
          "It can take a minute, so check your spam or junk folder too."
      );
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  const hero = (
    <View style={wide ? { flex: 1, paddingRight: 48 } : undefined}>
      <Text style={[styles.hero, wide && { fontSize: 56, lineHeight: 58 }]}>Manage your space in real time.</Text>
      <Text style={styles.lead}>
        Create your business, build your floor plan, manage staff and keep customers updated on live seating
        availability.
      </Text>

      <View style={{ marginTop: 26, gap: 16 }}>
        {FEATURES.map(({ title, description, Icon, tile }) => (
          <View key={title} style={styles.feature}>
            <View style={[styles.featureTile, { backgroundColor: tile[0] }]}>
              <Icon size={20} color={tile[1]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureText}>{description}</Text>
            </View>
          </View>
        ))}
      </View>

      <SeatPreview />
    </View>
  );

  const card = (
    <View style={[styles.card, wide && { flex: 1 }]} onLayout={(event) => setCardY(event.nativeEvent.layout.y)}>
      {twoFactor ? (
        <>
          <Text style={styles.cardTitle}>Two-factor sign-in.</Text>
          <Muted style={{ marginTop: 6 }}>
            Open your authenticator app and enter the 6-digit code for SeatMate.
          </Muted>
          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            onSubmitEditing={verifyCode}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button title="Verify and sign in" onPress={verifyCode} busy={busy} style={{ marginTop: 18 }} />
          <Button
            title="Back"
            variant="secondary"
            onPress={() => {
              setTwoFactor(null);
              clear();
            }}
            style={{ marginTop: 10 }}
          />
        </>
      ) : (
        <>
          <Segmented
            options={[
              { value: "signin", label: "Sign In" },
              { value: "signup", label: "Create Account" },
            ]}
            value={mode}
            onChange={(value: Mode) => {
              setMode(value);
              clear();
            }}
          />

          <View style={{ marginTop: 22 }}>
            <Text style={styles.cardTitle}>{mode === "signin" ? "Welcome back." : "Create your account."}</Text>
            <Muted style={{ marginTop: 6 }}>
              {mode === "signin"
                ? "Sign in to manage your SeatMate business."
                : "Create an account to register and manage your business."}
            </Muted>
          </View>

          {googleAvailable && (
            <>
              <View style={{ marginTop: 20 }}>
                <GoogleButton
                  disabled={busy}
                  onStart={() => {
                    clear();
                    setBusy(true);
                  }}
                  onSignedIn={done}
                  onError={fail}
                />
              </View>
              <View style={styles.divider}>
                <View style={styles.rule} />
                <Text style={styles.or}>OR</Text>
                <View style={styles.rule} />
              </View>
            </>
          )}

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
            title={mode === "signin" ? "Sign In" : "Create Account"}
            onPress={mode === "signin" ? signIn : createAccount}
            busy={busy}
            style={{ marginTop: 18 }}
          />

          {mode === "signin" ? (
            <Muted style={styles.small}>
              Use the same account as seatmate360.net. Your business, floor plan, staff and hours are already here.
              {!googleAvailable ? " Signed up with Google? Tap Forgot password to add a password to that account." : ""}
            </Muted>
          ) : (
            <Muted style={styles.small}>
              After creating your account, you&apos;ll add your business details and build your live floor plan. By
              signing up you agree to our{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL(businessUrl("/terms"))}>
                Terms
              </Text>{" "}
              and{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL(businessUrl("/privacy"))}>
                Privacy Policy
              </Text>
              . Invited as staff? Create an account, then open your invite link.
            </Muted>
          )}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <SeatMateMark size={34} />
          <View>
            <Text style={{ fontWeight: "800", fontSize: 16, color: colors.ink }}>SeatMate</Text>
            <Text style={{ fontSize: 12, color: colors.faint }}>Business Portal</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 16 }}>
          {!wide && (
            <Pressable accessibilityRole="button" onPress={() => scroll.current?.scrollTo({ y: cardY - 12 })}>
              <Text style={styles.nav}>Sign in</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(businessUrl("/about"))}>
            <Text style={styles.nav}>How it works</Text>
          </Pressable>
          {wide && (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(consumerUrl("/"))}>
              <Text style={styles.nav}>Customer site</Text>
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={[wide && { flexDirection: "row", alignItems: "center" }, { maxWidth: 1100, width: "100%", alignSelf: "center" }]}>
            {hero}
            <View style={{ height: wide ? 0 : 28 }} />
            {card}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SeatPreview() {
  const open = SAMPLE_SEATS.filter(Boolean).length;

  return (
    <View style={styles.preview}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontWeight: "700", fontSize: 14, color: colors.ink }}>What customers see</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          <Text style={{ fontWeight: "800", color: "#059669" }}>{open}</Text> of {SAMPLE_SEATS.length} seats open
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 14 }}>
        {SAMPLE_SEATS.map((isOpen, index) => (
          <View
            key={index}
            style={{ flex: 1, aspectRatio: 1, borderRadius: 6, backgroundColor: isOpen ? "#10b981" : "#fb7185" }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    height: 64,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nav: { fontWeight: "700", color: colors.muted, fontSize: 14 },
  content: { padding: 22, paddingTop: 30, paddingBottom: 48 },
  hero: { fontSize: 42, lineHeight: 45, fontWeight: "800", color: colors.ink, letterSpacing: -1.2 },
  lead: { fontSize: 17, lineHeight: 27, color: colors.muted, marginTop: 16 },
  feature: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureTile: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontWeight: "700", fontSize: 16, color: colors.ink },
  featureText: { color: colors.muted, fontSize: 14, marginTop: 2 },
  preview: { marginTop: 28, backgroundColor: "#fff", borderColor: "#e5e7eb", borderWidth: 1, borderRadius: 18, padding: 18 },
  card: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 30,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 },
  rule: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  or: { fontSize: 12, fontWeight: "700", color: colors.faint, letterSpacing: 1 },
  small: { marginTop: 16, textAlign: "center", fontSize: 13, lineHeight: 19 },
  link: { textDecorationLine: "underline", color: colors.muted },
});
