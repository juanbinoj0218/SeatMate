import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";

import { SEAT_ALERT_TTL_MS, SEAT_ALERTS, seatAlertId } from "@seatmate/shared/seat-alerts";

import { BellIcon } from "@/components/icons";
import { colors } from "@/components/ui";
import { useAccount } from "@/lib/account";
import { useFeatures } from "@/lib/features";
import { db } from "@/lib/firebase";
import { success, tap } from "@/lib/haptics";

// "Email me when a seat opens" on a full place: the same seatAlerts document
// the website creates, so the business's next opened seat emails this
// customer (for the next 12 hours).
export default function SeatAlertButton({
  slug,
  businessId,
  placeName,
}: {
  slug: string;
  businessId: string;
  placeName: string;
}) {
  const { user, goToSignIn } = useAccount();
  const { seatAlerts } = useFeatures();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const alertPath = user ? `${SEAT_ALERTS}/${seatAlertId(user.uid, slug)}` : null;

  useEffect(() => {
    if (!alertPath) return;
    let cancelled = false;

    getDoc(doc(db, alertPath))
      .then((snapshot) => {
        const data = snapshot.data();
        const createdAt = data?.createdAt;
        const fresh = createdAt instanceof Timestamp && Date.now() - createdAt.toMillis() < SEAT_ALERT_TTL_MS;
        if (!cancelled) setActive(Boolean(data?.active) && fresh);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [alertPath]);

  if (!seatAlerts) return null;

  const on = Boolean(user) && active;

  const toggle = async () => {
    tap();
    if (!user || !alertPath) {
      goToSignIn();
      return;
    }

    setBusy(true);
    setError("");

    try {
      const ref = doc(db, alertPath);
      if (active) {
        await deleteDoc(ref);
        setActive(false);
      } else {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email || "",
          slug,
          businessId,
          placeName,
          active: true,
          createdAt: serverTimestamp(),
        });
        setActive(true);
        success();
      }
    } catch (caught) {
      console.error("Could not update seat alert:", caught);
      setError("Couldn't set the alert. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on, busy }}
        disabled={busy}
        onPress={toggle}
        style={({ pressed }) => [
          styles.button,
          on ? styles.buttonOn : styles.buttonOff,
          (busy || pressed) && { opacity: 0.75 },
        ]}
      >
        <BellIcon size={18} color={on ? "#fff" : colors.ink} filled={on} />
        <Text style={[styles.text, { color: on ? "#fff" : colors.ink }]}>
          {on ? "We'll email you when a seat opens" : "Email me when a seat opens"}
        </Text>
      </Pressable>
      {on ? (
        <Text style={styles.note}>
          For the next 12 hours.{" "}
          <Text onPress={toggle} style={{ textDecorationLine: "underline" }}>
            Cancel
          </Text>
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  buttonOff: { backgroundColor: "#fff" },
  buttonOn: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  text: { fontSize: 15, fontWeight: "800" },
  note: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center", marginTop: 8 },
  error: { color: "#fca5a5", fontSize: 12, textAlign: "center", marginTop: 8 },
});
