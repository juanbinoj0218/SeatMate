import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { getOpenStatus, type Hours } from "@seatmate/shared/business-hours";

import { Button, colors } from "@/components/ui";
import { db } from "@/lib/firebase";
import type { Table } from "@/lib/floor";

// Same rule as the web portal: nudge when seats haven't been updated for
// 30 minutes while the place is open, so customers don't see stale seats.
const REMIND_AFTER_MINUTES = 30;

const describeAge = (minutes: number) =>
  minutes >= 120 ? `${Math.floor(minutes / 60)} hours` : `${minutes} min`;

export default function UpdateReminder({ businessId, tables }: { businessId: string; tables: Table[] }) {
  const [hours, setHours] = useState<{ hours?: Hours; timezone?: string }>({});
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);

  // Opening hours from the public listing (readable by owner and staff).
  useEffect(() => {
    getDocs(query(collection(db, "publicBusinesses"), where("businessId", "==", businessId), limit(1)))
      .then((snapshot) => {
        const data = snapshot.docs[0]?.data();
        if (data) setHours({ hours: data.hours, timezone: data.timezone });
      })
      .catch(() => {});
  }, [businessId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Unknown hours count as open.
  const tableIds = tables.map((table) => table.id);
  const latestUpdateMs = tables.reduce<number | null>(
    (latest, table) =>
      table.occupancyUpdatedMs !== null && (latest === null || table.occupancyUpdatedMs > latest)
        ? table.occupancyUpdatedMs
        : latest,
    null
  );
  const open = getOpenStatus(hours.hours, hours.timezone, now)?.open ?? true;
  const age = latestUpdateMs === null ? null : Math.max(0, Math.round((now - latestUpdateMs) / 60000));
  const stale = tableIds.length > 0 && open && (age === null || age >= REMIND_AFTER_MINUTES);

  if (!stale) return null;

  // Staff can say "nothing changed" without tapping every seat.
  const confirmAccurate = async () => {
    setConfirming(true);
    try {
      const batch = writeBatch(db);
      tableIds.forEach((tableId) =>
        batch.update(doc(db, "businesses", businessId, "tables", tableId), {
          occupancyUpdatedAt: serverTimestamp(),
        })
      );
      await batch.commit();
    } catch (error) {
      console.error("Could not confirm seats:", error);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text style={{ fontWeight: "800", color: "#78350f", fontSize: 16 }}>
        {age === null ? "Seats haven't been updated yet" : `No seat updates in ${describeAge(age)}`}
      </Text>
      <Text style={{ color: colors.amberText, marginTop: 4, lineHeight: 20 }}>
        Customers see this as out of date. Tap any seats that changed, or confirm they&apos;re still right.
      </Text>
      <Button title="Seats are still accurate" onPress={confirmAccurate} busy={confirming} style={{ marginTop: 12 }} />
    </View>
  );
}

