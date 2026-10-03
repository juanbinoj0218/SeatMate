import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CROWD_LEVELS, crowdLevel, DOOR_STALE_MS, readDoorCount, usualCrowd, type CrowdLevel } from "@seatmate/shared/door-crowd";

import { watchDoor } from "@/lib/door";

// Colors for each crowd level on the dark availability card (the website
// uses Tailwind classes from CROWD_LEVELS).
const LOOKS: Record<CrowdLevel, { background: string; border: string; text: string }> = {
  quiet: { background: "rgba(56,189,248,0.15)", border: "rgba(125,211,252,0.3)", text: "#bae6fd" },
  usual: { background: "rgba(251,191,36,0.15)", border: "rgba(252,211,77,0.3)", text: "#fde68a" },
  busy: { background: "rgba(232,121,249,0.15)", border: "rgba(240,171,252,0.3)", text: "#f5d0fe" },
};

// How busy a bar is right now, from the bouncer's door count. Shown only
// while the bar has bouncer mode on and the count is from tonight.
export default function CrowdMeter({ businessId, now }: { businessId: string; now: number }) {
  const [data, setData] = useState<Record<string, unknown> | undefined>();

  useEffect(() => watchDoor(businessId, setData), [businessId]);

  const door = data ? readDoorCount(data, now) : null;

  if (!door?.enabled || door.updatedAtMs === null || now - door.updatedAtMs > DOOR_STALE_MS) {
    return null;
  }

  const usual = usualCrowd(door, now);
  const level = crowdLevel(door.count, usual);
  const info = level ? CROWD_LEVELS[level] : null;
  const look = level ? LOOKS[level] : { background: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", text: "#fff" };

  return (
    <View style={[styles.box, { backgroundColor: look.background, borderColor: look.border }]}>
      <Text style={styles.icon}>{info?.icon ?? "🚪"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {info?.label ?? "Crowd right now"}
          <Text style={styles.count}> · {door.count} inside</Text>
        </Text>
        <Text style={[styles.detail, { color: look.text }]}>
          {info ? `${info.detail} Usually about ${Math.round(usual ?? 0)} people.` : "Counted live at the door."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 16 },
  icon: { fontSize: 30 },
  title: { color: "#fff", fontWeight: "900", fontSize: 16 },
  count: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  detail: { fontSize: 13, marginTop: 3, lineHeight: 18 },
});
