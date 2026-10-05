import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { router } from "expo-router";

import type { DoorCount } from "@seatmate/shared/door-crowd";

import { AnimatedNumber } from "@/components/animated-number";
import { Button, Card, colors, Muted } from "@/components/ui";
import { setBouncerMode, watchDoor } from "@/lib/door";
import { success, warning } from "@/lib/haptics";

// Dashboard card for bars: turn bouncer mode on or off and open the door
// counter. Same switch as the web dashboard.
export default function BouncerCard({ businessId }: { businessId: string }) {
  const [door, setDoor] = useState<DoorCount | null>(null);
  // What the owner just switched to, shown until the save finishes. Turning
  // it on first reads the door document, so without this the switch would
  // sit still for a round trip.
  const [wanted, setWanted] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => watchDoor(businessId, setDoor, (err) => console.error(err)), [businessId]);

  const enabled = wanted ?? door?.enabled === true;

  const toggle = async () => {
    if (wanted !== null) return;
    const next = !enabled;
    try {
      setWanted(next);
      setError("");
      await setBouncerMode(businessId, next);
      success();
    } catch (err) {
      console.error(err);
      warning();
      setError("Could not change bouncer mode.");
    } finally {
      // The live snapshot already has the new value: Firestore applies the
      // write locally before the save resolves.
      setWanted(null);
    }
  };

  return (
    <Card style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 16, color: colors.ink }}>Bouncer mode</Text>
          <Muted style={{ marginTop: 4 }}>
            Count people at the door. Customers see how busy you are compared with a normal night.
          </Muted>
        </View>
        <Switch
          accessibilityLabel="Bouncer mode"
          value={enabled}
          disabled={!door}
          onValueChange={() => void toggle()}
          trackColor={{ true: "#10b981", false: "#d1d5db" }}
        />
      </View>

      {enabled && door && (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }} accessible accessibilityLabel={`${door.count} inside`}>
            <AnimatedNumber value={door.count} style={{ fontSize: 30, lineHeight: 36, fontWeight: "800", color: colors.ink }} />
            <Text style={{ color: colors.faint, fontSize: 20, lineHeight: 30, fontWeight: "700" }}> inside</Text>
          </View>
          <Button title="Open door counter" onPress={() => router.push("/door")} style={{ marginTop: 12 }} />
        </View>
      )}

      {error ? <Text style={{ color: "#e11d48", marginTop: 10 }}>{error}</Text> : null}
    </Card>
  );
}
