import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { Banner, Button, Chip, colors, Field, Muted } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { useFeatures } from "@/lib/features";
import { db } from "@/lib/firebase";
import { success } from "@/lib/haptics";

const TYPES = ["Café", "Restaurant", "Bar", "Barbershop", "Bakery", "Other"];

// "Suggest a place": the website's form, saved to placeRequests for the
// SeatMate team to follow up on.
export default function SuggestScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const { user } = useAccount();
  const { suggestPlace } = useFeatures();
  const [placeName, setPlaceName] = useState(params.name ?? "");
  const [location, setLocation] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!suggestPlace) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Banner tone="warning">Suggestions are paused right now. Please check back soon.</Banner>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <View style={[styles.content, { alignItems: "center" }]}>
          <Text style={{ fontSize: 52 }}>🙌</Text>
          <Text style={styles.doneTitle}>Thanks for the tip!</Text>
          <Muted style={{ textAlign: "center", marginTop: 8 }}>
            We&apos;ll reach out to {placeName.trim() || "them"} about showing live seats on SeatMate.
          </Muted>
          <Button title="Done" onPress={() => router.back()} style={{ marginTop: 24, alignSelf: "stretch" }} />
        </View>
      </View>
    );
  }

  const submit = async () => {
    setError("");
    if (!placeName.trim()) return setError("Add the place's name.");
    if (!location.trim()) return setError("Add where it is (a street, neighborhood or city).");
    const replyTo = email.trim();
    if (replyTo && !/^\S+@\S+\.\S+$/.test(replyTo)) return setError("Check your email address.");

    setBusy(true);
    try {
      await addDoc(collection(db, "placeRequests"), {
        placeName: placeName.trim().slice(0, 120),
        location: location.trim().slice(0, 160),
        type,
        note: note.trim().slice(0, 500),
        email: (replyTo || user?.email || "").slice(0, 200),
        uid: user?.uid ?? null,
        status: "new",
        createdAt: serverTimestamp(),
      });
      success();
      setDone(true);
    } catch (caught) {
      console.error("Could not send suggestion:", caught);
      setError("We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Muted>Know a spot that should show live seats? Tell us and we&apos;ll ask them to join.</Muted>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Field label="Place name" value={placeName} onChangeText={setPlaceName} placeholder="e.g. Temple Coffee" maxLength={120} />
        <Field label="Where is it?" value={location} onChangeText={setLocation} placeholder="Street, neighborhood or city" maxLength={160} />
        <Text style={styles.label}>Type</Text>
        <View style={styles.types}>
          {TYPES.map((option) => (
            <Chip key={option} label={option} active={type === option} onPress={() => setType(option)} />
          ))}
        </View>
        <Field
          label="Anything else? (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Why you'd love live seats there"
          multiline
          maxLength={500}
          style={[styles.textarea]}
        />
        {!user && (
          <Field
            label="Your email (optional)"
            hint="Only to tell you when it joins."
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            maxLength={200}
          />
        )}
        <Button title="Send suggestion" onPress={submit} busy={busy} style={{ marginTop: 22 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingBottom: 40, width: "100%", maxWidth: 560, alignSelf: "center" },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 14, marginBottom: 8 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  textarea: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
    minHeight: 96,
    textAlignVertical: "top",
  },
  doneTitle: { fontSize: 26, fontWeight: "900", color: colors.ink, marginTop: 12 },
});
