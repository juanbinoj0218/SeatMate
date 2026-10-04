import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { BUSINESS_TYPES, businessTypeLabel } from "@seatmate/shared/floor-plan";
import { businessSlug, slugify } from "@seatmate/shared/slug";

import WrongAccount from "@/components/gate";
import { Banner, Button, Card, colors, Eyebrow, Field, Muted, Screen, Title } from "@/components/ui";
import { auth, db } from "@/lib/firebase";
import { useSession } from "@/lib/session";

// Same list as the web portal's setup page.
const TYPES = BUSINESS_TYPES.map((value) => ({ value, label: businessTypeLabel(value) }));

// Step 1 of 2 for a new owner (step 2 is the floor plan). The business
// starts as a private draft until it's submitted and approved.
export default function SetupScreen() {
  const session = useSession();
  const [name, setName] = useState("");
  const [type, setType] = useState("Cafe");
  const [address, setAddress] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (session.state !== "new") {
    return <WrongAccount />;
  }

  const create = async () => {
    setError("");

    if (!name.trim()) return setError("Enter your business name.");
    if (!address.trim()) return setError("Enter your business address.");
    if (!/^\d{5}$/.test(zipcode.trim())) return setError("Enter a valid 5-digit ZIP code.");

    if (!slugify(name)) return setError("Please enter a valid business name.");

    try {
      setSaving(true);
      const uid = session.user.uid;

      // Another place already listed under this name gets its own address,
      // so the two listings never overwrite each other.
      const listed = await getDoc(doc(db, "publicBusinesses", slugify(name))).catch(() => null);
      const slug = businessSlug(name, uid, Boolean(listed?.exists() && listed.data().businessId !== uid));

      await setDoc(doc(db, "businesses", uid), {
        ownerId: uid,
        name: name.trim(),
        type,
        address: address.trim(),
        zipcode: zipcode.trim(),
        slug,
        status: "draft",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.replace("/floor-plan");
    } catch (err) {
      console.error("Error creating business:", err);
      setError("Something went wrong creating your business.");
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Eyebrow>Step 1 of 2</Eyebrow>
      <Title>Add your business.</Title>
      <Muted style={{ marginTop: 6, marginBottom: 16 }}>
        Tell us about your restaurant, café or bar. Next you&apos;ll build your live seating floor plan, then
        submit it for SeatMate approval.
      </Muted>

      <Card>
        <Field label="Business name" value={name} onChangeText={setName} placeholder="Temple Coffee" />

        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 14, marginBottom: 6 }}>
          Business type
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((option) => {
            const selected = option.value === type;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setType(option.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? colors.ink : "#e5e7eb",
                  backgroundColor: selected ? colors.ink : "#fff",
                }}
              >
                <Text style={{ fontWeight: "700", color: selected ? "#fff" : colors.ink }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="Business address"
          value={address}
          onChangeText={setAddress}
          placeholder="123 Main Street, Folsom, CA"
          textContentType="fullStreetAddress"
        />
        <Field
          label="ZIP code"
          value={zipcode}
          onChangeText={(value) => setZipcode(value.replace(/\D/g, "").slice(0, 5))}
          placeholder="95630"
          keyboardType="number-pad"
          textContentType="postalCode"
        />

        {error ? <Banner tone="error">{error}</Banner> : null}

        <Button title="Continue to floor plan" onPress={create} busy={saving} style={{ marginTop: 18 }} />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>Invited as staff?</Text>
        <Muted style={{ marginTop: 4 }}>Enter the invite link your manager sent you instead.</Muted>
        <Button title="Enter invite link" variant="secondary" onPress={() => router.push("/join")} style={{ marginTop: 12 }} />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={() => void signOut(auth)} style={{ marginTop: 16 }} />
    </Screen>
  );
}
