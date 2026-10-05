import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { CROWD_LEVELS, crowdLevel, usualCrowd, type DoorCount } from "@seatmate/shared/door-crowd";

import WrongAccount from "@/components/gate";
import { AnimatedNumber } from "@/components/animated-number";
import { CrowdIcon, DoorIcon } from "@/components/icons";
import { Loading, PressableScale } from "@/components/ui";
import { resetDoorCount, setBouncerMode, stepDoorCount, watchDoor } from "@/lib/door";
import { success, tap, warning } from "@/lib/haptics";
import { useSession } from "@/lib/session";

// Bouncer mode: big +1 / −1 buttons for whoever is on the door. Owners and
// staff both use it; customers see the crowd update live.
export default function DoorScreen() {
  const session = useSession();
  const access =
    session.state === "owner"
      ? { businessId: session.business.id, name: session.business.name, isOwner: true }
      : session.state === "staff" && session.staff.active
        ? { businessId: session.staff.businessId, name: session.staff.businessName, isOwner: false }
        : null;
  const businessId = access?.businessId;

  const [door, setDoor] = useState<DoorCount | null>(null);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    return watchDoor(businessId, setDoor, (err) => {
      console.error(err);
      setError("Could not load the door count.");
    });
  }, [businessId]);

  if (!access) return <WrongAccount />;
  if (!door) return <Loading label={error || "Loading door counter…"} />;

  // Door writes are plain Firestore updates, so the count on screen moves
  // the moment a button is tapped (Firestore applies the write locally and
  // syncs it in the background). If the server refuses it, Firestore puts
  // the count back and we say so with a warning haptic.
  const run = async (work: () => Promise<void>, failure: string) => {
    try {
      setError("");
      await work();
    } catch (err) {
      console.error(err);
      warning();
      setError(failure);
    }
  };

  const step = (amount: 1 | -1) => {
    tap();
    void run(() => stepDoorCount(access.businessId, door, amount), "That tap didn't go through. Try again.");
  };

  const usual = usualCrowd(door);
  const level = crowdLevel(door.count, usual);

  return (
    <SafeAreaView style={styles.page} edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ title: access.name, headerStyle: { backgroundColor: "#101811" }, headerTintColor: "#fff" }} />

      {!door.enabled ? (
        <View style={styles.center}>
          <DoorIcon size={44} color="#fff" />
          <Text style={styles.offTitle}>Bouncer mode is off</Text>
          <Text style={styles.offText}>
            {access.isOwner
              ? "Turn it on to count people at the door and show customers how busy you are."
              : "Ask the owner to turn on bouncer mode from their dashboard."}
          </Text>
          {access.isOwner && (
            <PressableScale
              haptic
              onPress={() =>
                void run(async () => {
                  await setBouncerMode(access.businessId, true);
                  success();
                }, "Could not turn on bouncer mode.")
              }
              style={styles.turnOn}
            >
              <Text style={{ fontWeight: "800", color: "#101811", fontSize: 16 }}>Turn on bouncer mode</Text>
            </PressableScale>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={styles.eyebrow}>INSIDE RIGHT NOW</Text>
          <View style={styles.countWrap} accessibilityLiveRegion="polite">
            <AnimatedNumber value={door.count} style={styles.count} accessibilityLabel={`${door.count} inside`} />
          </View>
          {level ? (
            <View style={styles.levelRow}>
              <CrowdIcon level={level} size={16} color="rgba(255,255,255,0.6)" />
              <Text style={[styles.level, { flexShrink: 1, paddingHorizontal: 0 }]}>
                {`Customers see: ${CROWD_LEVELS[level].label}${usual !== null ? ` (usually about ${Math.round(usual)})` : ""}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.level}>
              Customers see the count. After a few nights they&apos;ll also see if it&apos;s quieter or busier than usual.
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.pad}>
            <PressableScale
              accessibilityLabel="Someone left: minus one"
              disabled={door.count === 0}
              onPress={() => step(-1)}
              style={[styles.tap, styles.minus, door.count === 0 && { opacity: 0.3 }]}
            >
              <Text style={[styles.tapNumber, { color: "#fff" }]}>−1</Text>
              <Text style={[styles.tapLabel, { color: "rgba(255,255,255,0.6)" }]}>Left</Text>
            </PressableScale>
            <PressableScale
              accessibilityLabel="Someone came in: plus one"
              onPress={() => step(1)}
              style={[styles.tap, styles.plus]}
            >
              <Text style={[styles.tapNumber, { color: "#101811" }]}>+1</Text>
              <Text style={[styles.tapLabel, { color: "rgba(16,24,17,0.7)" }]}>Came in</Text>
            </PressableScale>
          </View>

          <View style={styles.resetRow}>
            {confirmReset ? (
              <>
                <Text style={{ color: "rgba(255,255,255,0.6)" }}>Set the count back to 0?</Text>
                <SmallButton
                  label="Reset"
                  danger
                  onPress={() =>
                    void run(async () => {
                      setConfirmReset(false);
                      await resetDoorCount(access.businessId);
                    }, "Could not reset the count.")
                  }
                />
                <SmallButton label="Cancel" onPress={() => setConfirmReset(false)} />
              </>
            ) : (
              <SmallButton label="Reset to 0" onPress={() => setConfirmReset(true)} />
            )}
          </View>
          <Text style={styles.footnote}>The count starts over on its own if nobody taps for 8 hours.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function SmallButton({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <PressableScale
      haptic
      onPress={onPress}
      style={[styles.small, danger && { backgroundColor: "#f43f5e", borderColor: "#f43f5e" }]}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#101811" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  offTitle: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 16 },
  offText: { color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 10, fontSize: 16, lineHeight: 22 },
  turnOn: { marginTop: 22, backgroundColor: "#22c55e", borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14 },
  eyebrow: { color: "#4ade80", fontWeight: "800", letterSpacing: 2, fontSize: 12, textAlign: "center", marginTop: 8 },
  countWrap: { alignItems: "center" },
  count: { color: "#fff", fontSize: 112, fontWeight: "900", fontVariant: ["tabular-nums"], lineHeight: 120 },
  level: { color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 14, lineHeight: 20, paddingHorizontal: 12 },
  levelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  error: { color: "#fda4af", textAlign: "center", marginTop: 14 },
  pad: { flex: 1, flexDirection: "row", gap: 14, marginTop: 24, minHeight: 240 },
  tap: { flex: 1, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  minus: { backgroundColor: "rgba(255,255,255,0.1)" },
  plus: { backgroundColor: "#22c55e" },
  tapNumber: { fontSize: 64, fontWeight: "900" },
  tapLabel: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  resetRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20 },
  small: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  footnote: { color: "rgba(255,255,255,0.72)", textAlign: "center", fontSize: 12, marginTop: 12 },
});
