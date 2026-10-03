import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";

import { toMinutes, type DayHours, type DayName, type Hours } from "@seatmate/shared/business-hours";

import WrongAccount from "@/components/gate";
import { Banner, Button, Card, colors, Loading, Muted, Screen, Title } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useOwner } from "@/lib/session";

const DAYS: DayName[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const weekday = { closed: false, open: "07:00", close: "18:00" };
const DEFAULT_HOURS: Hours = {
  monday: weekday,
  tuesday: weekday,
  wednesday: weekday,
  thursday: weekday,
  friday: weekday,
  saturday: { closed: false, open: "08:00", close: "18:00" },
  sunday: { closed: false, open: "08:00", close: "17:00" },
};

const STEP_MINUTES = 30;

const toTime = (minutes: number) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

const label = (time: string) => {
  const minutes = toMinutes(time) ?? 0;
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
};

// Opening hours customers see. Saved on the business and, once it's live,
// on the public listing too.
export default function HoursScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;

  const [hours, setHours] = useState<Hours | null>(null);
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!businessId) return;

    getDoc(doc(db, "businesses", businessId))
      .then((snapshot) => {
        const data = snapshot.data() ?? {};
        setHours((data.hours as Hours) ?? DEFAULT_HOURS);
        setTimezone(
          data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"
        );
      })
      .catch((error) => {
        console.error(error);
        setMessage({ tone: "error", text: "Could not load business hours." });
        setHours(DEFAULT_HOURS);
      });
  }, [businessId]);

  if (!owner) {
    return <WrongAccount />;
  }

  if (!hours) {
    return <Loading label="Loading business hours…" />;
  }

  const updateDay = (day: DayName, changes: Partial<DayHours>) =>
    setHours((current) => current && { ...current, [day]: { ...current[day], ...changes } });

  const copyMonday = () =>
    setHours(
      (current) =>
        current && {
          ...current,
          tuesday: current.monday,
          wednesday: current.monday,
          thursday: current.monday,
          friday: current.monday,
        }
    );

  const save = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const businessRef = doc(db, "businesses", owner.business.id);
      const snapshot = await getDoc(businessRef);
      const data = snapshot.data();

      if (!data) {
        setMessage({ tone: "error", text: "Business not found." });
        return;
      }

      const batch = writeBatch(db);
      batch.update(businessRef, {
        hours,
        timezone,
        hoursUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Draft and pending businesses don't have a public listing yet.
      if (data.status === "approved" && data.slug) {
        const publicRef = doc(db, "publicBusinesses", data.slug);
        const publicSnap = await getDoc(publicRef);

        if (publicSnap.exists()) {
          batch.update(publicRef, {
            hours,
            timezone,
            hoursUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      setMessage({
        tone: "success",
        text:
          data.status === "approved"
            ? "Business hours saved and synced to your customer page."
            : "Business hours saved. They will appear publicly after approval.",
      });
    } catch (error) {
      console.error(error);
      setMessage({ tone: "error", text: "Could not save business hours." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Title>Business hours</Title>
      <Muted style={{ marginTop: 4 }}>Times are in {timezone}. Closing after midnight is fine.</Muted>

      <Button title="Copy Monday to Tue–Fri" variant="secondary" onPress={copyMonday} style={{ marginTop: 14 }} />

      <View style={{ gap: 10, marginTop: 14 }}>
        {DAYS.map((day) => {
          const today = hours[day];
          return (
            <Card key={day}>
              <View style={styles.dayRow}>
                <Text style={styles.day}>{day[0].toUpperCase() + day.slice(1)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.muted }}>{today.closed ? "Closed" : "Open"}</Text>
                  <Switch
                    value={!today.closed}
                    onValueChange={(open) => updateDay(day, { closed: !open })}
                    trackColor={{ true: "#86efac" }}
                    thumbColor={today.closed ? undefined : colors.green}
                  />
                </View>
              </View>
              {!today.closed && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <TimeStepper title="Opens" value={today.open} onChange={(open) => updateDay(day, { open })} />
                  <TimeStepper title="Closes" value={today.close} onChange={(close) => updateDay(day, { close })} />
                </View>
              )}
            </Card>
          );
        })}
      </View>

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      <Button title="Save hours" onPress={save} busy={saving} style={{ marginTop: 18 }} />
    </Screen>
  );
}

function TimeStepper({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  const shift = (amount: number) => {
    const minutes = toMinutes(value) ?? 0;
    // Snap to the half hour, then step.
    const snapped = Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
    onChange(toTime(snapped === minutes ? minutes + amount : snapped));
  };

  return (
    <View style={styles.timeRow}>
      <Text style={{ color: colors.muted, fontWeight: "600", width: 60 }}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title} earlier`} onPress={() => shift(-STEP_MINUTES)} style={styles.timeButton}>
        <Text style={styles.timeButtonText}>−</Text>
      </Pressable>
      <Text style={styles.time}>{label(value)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title} later`} onPress={() => shift(STEP_MINUTES)} style={styles.timeButton}>
        <Text style={styles.timeButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  day: { fontSize: 16, fontWeight: "800", color: colors.ink },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  time: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.ink },
  timeButton: {
    width: 40,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  timeButtonText: { fontSize: 18, fontWeight: "800", color: colors.ink },
});
