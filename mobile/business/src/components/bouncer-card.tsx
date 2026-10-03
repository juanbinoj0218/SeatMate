import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { router } from "expo-router";

import type { DoorCount } from "@seatmate/shared/door-crowd";

import { Button, Card, colors, Muted } from "@/components/ui";
import { setBouncerMode, watchDoor } from "@/lib/door";

// Dashboard card for bars: turn bouncer mode on or off and open the door
// counter. Same switch as the web dashboard.
export default function BouncerCard({ businessId }: { businessId: string }) {
  const [door, setDoor] = useState<DoorCount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => watchDoor(businessId, setDoor, (err) => console.error(err)), [businessId]);

  const enabled = door?.enabled === true;

  const toggle = async () => {
    try {
      setSaving(true);
      setError("");
      await setBouncerMode(businessId, !enabled);
    } catch (err) {
      console.error(err);
      setError("Could not change bouncer mode.");
    } finally {
      setSaving(false);
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
          disabled={!door || saving}
          onValueChange={() => void toggle()}
          trackColor={{ true: "#10b981", false: "#d1d5db" }}
        />
      </View>

      {enabled && door && (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: colors.ink }}>
            {door.count}
            <Text style={{ color: colors.faint, fontSize: 20, fontWeight: "700" }}> inside</Text>
          </Text>
          <Button title="Open door counter" onPress={() => router.push("/door")} style={{ marginTop: 12 }} />
        </View>
      )}

      {error ? <Text style={{ color: "#e11d48", marginTop: 10 }}>{error}</Text> : null}
    </Card>
  );
}
