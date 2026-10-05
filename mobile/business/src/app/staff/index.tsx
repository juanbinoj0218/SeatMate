import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";

import type { FloorMarker } from "@seatmate/shared/floor-plan";

import WrongAccount from "@/components/gate";
import LiveSeats from "@/components/live-seats";
import UpdateReminder from "@/components/update-reminder";
import { AnimatedNumber } from "@/components/animated-number";
import { Banner, Button, Card, colors, Loading, Muted, PressableScale, Screen, Title } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { watchDoor } from "@/lib/door";
import { toggleGame, watchMarkers, watchTables, type Table } from "@/lib/floor";
import { tap, warning } from "@/lib/haptics";
import { useWide } from "@/lib/layout";
import { useOptimisticSeats } from "@/lib/optimistic-seats";
import { useSession } from "@/lib/session";

export default function StaffConsoleScreen() {
  const session = useSession();
  const staff = session.state === "staff" ? session.staff : null;
  const businessId = staff?.active ? staff.businessId : null;

  const [liveTables, setTables] = useState<Table[] | null>(null);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);
  const [error, setError] = useState("");
  // People inside, when the owner has bouncer mode on.
  const [doorCount, setDoorCount] = useState<number | null>(null);
  const wide = useWide();
  // Seat taps show at once; the snapshot catches up behind them.
  const { tables, toggleSeat } = useOptimisticSeats(businessId, liveTables, setError);

  useEffect(() => {
    if (!businessId) return;

    const stopTables = watchTables(businessId, setTables, (err) => {
      console.error(err);
      setError("Could not load the floor plan.");
      setTables([]);
    });
    const stopMarkers = watchMarkers(businessId, setMarkers, () => {});
    const stopDoor = watchDoor(
      businessId,
      (door) => setDoorCount(door.enabled ? door.count : null),
      () => {}
    );

    return () => {
      stopTables();
      stopMarkers();
      stopDoor();
    };
  }, [businessId]);

  if (!staff) {
    return <WrongAccount />;
  }

  if (!staff.active) {
    return (
      <Screen>
        <Card>
          <Title>Staff access unavailable</Title>
          <Muted style={{ marginTop: 8 }}>Your staff access has been disabled.</Muted>
          <Button title="Sign out" onPress={() => void signOut(auth)} style={{ marginTop: 18 }} />
        </Card>
      </Screen>
    );
  }

  if (!tables) {
    return <Loading label="Loading staff console…" />;
  }

  const onSeatPress = (tableId: string, seatId: number) => {
    setError("");
    toggleSeat(tableId, seatId);
  };

  const doorCard =
    doorCount !== null ? (
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: wide ? 0 : 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>On the door?</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }} accessible accessibilityLabel={`${doorCount} inside right now`}>
            <AnimatedNumber value={doorCount} style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }} />
            <Muted> inside right now</Muted>
          </View>
        </View>
        <Button title="Door counter" onPress={() => router.push("/door")} />
      </Card>
    ) : null;

  const title = (
    <View style={{ marginBottom: wide ? 0 : 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#22c55e" }} />
        <Text style={{ color: colors.greenText, fontWeight: "800", fontSize: 12, letterSpacing: 1 }}>LIVE STAFF MODE</Text>
      </View>
      <Title>{staff.businessName}</Title>
      <Muted style={{ marginTop: 4 }}>Changes update the customer view automatically.</Muted>
    </View>
  );

  const live = (
    <LiveSeats
      tables={tables}
      markers={markers}
      onSeatPress={onSeatPress}
      onGamePress={(marker) => {
        // A plain Firestore update, which shows locally at once and is
        // rolled back by Firestore itself if the server refuses it.
        tap();
        void toggleGame(staff.businessId, marker).catch((err) => {
          console.error(err);
          warning();
          setError("Could not update this game.");
        });
      }}
      aside={
        <>
          {wide && title}
          {doorCard}
          <UpdateReminder businessId={staff.businessId} tables={tables} />
          {error ? <Banner tone="error">{error}</Banner> : null}
          {wide && <Button title="Log out" variant="secondary" onPress={() => void signOut(auth)} />}
          {wide && (
            <PressableScale onPress={() => router.push("/delete-account")} style={{ alignSelf: "center", padding: 6 }}>
              <Text style={{ color: colors.redText, fontWeight: "700", fontSize: 14 }}>Delete account</Text>
            </PressableScale>
          )}
        </>
      }
    />
  );

  // Staff only tap seats and games; the layout is the owner's to change.
  return wide ? (
    <Screen scroll={false}>{live}</Screen>
  ) : (
    <Screen>
      {title}
      {live}
      <Button title="Log out" variant="secondary" onPress={() => void signOut(auth)} style={{ marginTop: 28 }} />
      <PressableScale onPress={() => router.push("/delete-account")} style={{ alignSelf: "center", marginTop: 18, padding: 6 }}>
        <Text style={{ color: colors.redText, fontWeight: "700", fontSize: 14 }}>Delete account</Text>
      </PressableScale>
    </Screen>
  );
}
