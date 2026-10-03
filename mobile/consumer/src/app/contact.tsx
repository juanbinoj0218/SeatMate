import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { Banner, Button, Chip, colors, Field, Muted } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { useFeatures } from "@/lib/features";
import { db } from "@/lib/firebase";
import { success } from "@/lib/haptics";

const TOPICS = ["General question", "I run a business", "Report a problem", "Press", "Other"];

export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL || "admin@seatmate360.com";

// The website's contact form, saved to contactMessages for the admin site.
export default function ContactScreen() {
  const { user, profile } = useAccount();
  const { contactForm } = useFeatures();
  const [name, setName] = useState(profile.displayName || user?.displayName || "");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const replyTo = email.trim() || user?.email || "";
  const mail = () => Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});

  if (done) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <View style={[styles.content, { alignItems: "center" }]}>
          <Text style={{ fontSize: 52 }}>📬</Text>
          <Text style={styles.doneTitle}>Message sent</Text>
          <Muted style={{ textAlign: "center", marginTop: 8 }}>We&apos;ll reply to {replyTo} as soon as we can.</Muted>
          <Button title="Done" onPress={() => router.back()} style={{ marginTop: 24, alignSelf: "stretch" }} />
        </View>
      </View>
    );
  }

  if (!contactForm) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Muted>Email us and we&apos;ll get back to you.</Muted>
          <Button title={CONTACT_EMAIL} onPress={mail} style={{ marginTop: 18 }} />
        </View>
      </View>
    );
  }

  const submit = async () => {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(replyTo)) return setError("Add an email so we can reply.");
    if (message.trim().length < 5) return setError("Write a short message.");

    setBusy(true);
    try {
      await addDoc(collection(db, "contactMessages"), {
        name: name.trim().slice(0, 100),
        email: replyTo.slice(0, 200),
        topic,
        message: message.trim().slice(0, 3000),
        uid: user?.uid ?? null,
        status: "new",
        createdAt: serverTimestamp(),
      });
      success();
      setDone(true);
    } catch (caught) {
      console.error("Could not send message:", caught);
      setError(`We couldn't send that. You can also email ${CONTACT_EMAIL}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Muted>Questions, feedback or a problem with a place? We read everything.</Muted>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Text style={styles.label}>Topic</Text>
        <View style={styles.topics}>
          {TOPICS.map((option) => (
            <Chip key={option} label={option} active={topic === option} onPress={() => setTopic(option)} />
          ))}
        </View>
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder={user?.email || "you@example.com"}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          maxLength={200}
          hint={user?.email && !email ? `We'll reply to ${user.email}.` : undefined}
        />
        <Field
          label="Message"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={3000}
          placeholder="How can we help?"
          style={styles.textarea}
        />
        <Button title="Send message" onPress={submit} busy={busy} style={{ marginTop: 22 }} />
        <Text style={styles.alt}>
          Or email <Text style={styles.altLink} onPress={mail}>{CONTACT_EMAIL}</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingBottom: 40, width: "100%", maxWidth: 560, alignSelf: "center" },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 14, marginBottom: 8 },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  textarea: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
    minHeight: 140,
    textAlignVertical: "top",
  },
  alt: { textAlign: "center", marginTop: 18, color: colors.muted, fontSize: 14 },
  altLink: { color: colors.ink, fontWeight: "800" },
  doneTitle: { fontSize: 26, fontWeight: "900", color: colors.ink, marginTop: 12 },
});
