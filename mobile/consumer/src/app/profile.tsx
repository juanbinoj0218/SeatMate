import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { updateProfile } from "firebase/auth";

import { Banner, Button, colors, Field, Loading, Muted } from "@/components/ui";
import { describeAccountError, useAccount } from "@/lib/account";
import { success } from "@/lib/haptics";

// Name and home ZIP, saved to the same profile the website's account page
// edits.
export default function ProfileScreen() {
  const { user, profile, profileReady } = useAccount();

  if (!user) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Muted>Sign in to edit your details.</Muted>
          <Button title="Sign in" onPress={() => router.replace("/login")} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  if (!profileReady) return <Loading />;

  return <ProfileForm key={user.uid} initialName={profile.displayName} initialZip={profile.homeZip} />;
}

function ProfileForm({ initialName, initialZip }: { initialName: string; initialZip: string }) {
  const { user, saveProfile, showToast } = useAccount();
  const [name, setName] = useState(initialName);
  const [zip, setZip] = useState(initialZip);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const cleanZip = zip.trim();
    if (cleanZip && !/^\d{5}$/.test(cleanZip)) return setError("Enter a 5-digit ZIP code, or leave it empty.");

    setBusy(true);
    try {
      await saveProfile({ displayName: name.trim(), homeZip: cleanZip });
      if (user && name.trim() && name.trim() !== user.displayName) {
        await updateProfile(user, { displayName: name.trim() }).catch(() => {});
      }
      success();
      showToast("Saved your details");
      router.back();
    } catch (caught) {
      setError(describeAccountError(caught, "We couldn't save your details."));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Muted>These show on the app and on seatmate360.com.</Muted>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={80} placeholder="Your name" />
        <Field
          label="Home ZIP"
          value={zip}
          onChangeText={(value) => setZip(value.replace(/\D/g, "").slice(0, 5))}
          keyboardType="number-pad"
          placeholder="95814"
          hint="Optional. Helps us know which neighborhoods to bring SeatMate to next."
        />
        <Field label="Email" value={user?.email ?? ""} editable={false} style={styles.readonly} />
        <Button title="Save" onPress={save} busy={busy} style={{ marginTop: 22 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 24, paddingBottom: 56, width: "100%", maxWidth: 560, alignSelf: "center" },
  readonly: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.muted,
    backgroundColor: "#f3f4f6",
  },
});
