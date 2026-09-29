import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { signOut } from "firebase/auth";

import type { FloorMarker } from "@seatmate/shared/floor-plan";

import WrongAccount from "@/components/gate";
import LiveSeats from "@/components/live-seats";
import UpdateReminder from "@/components/update-reminder";
import { Banner, Button, Card, colors, Loading, Muted, Screen, Title } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { watchMarkers, watchTables, type Table } from "@/lib/floor";
import { toggleSeat } from "@/lib/seat-updates";
import { useSession } from "@/lib/session";

export default function StaffConsoleScreen() {
  const session = useSession();
  const staff = session.state === "staff" ? session.staff : null;
  const businessId = staff?.active ? staff.businessId : null;

  const [tables, setTables] = useState<Table[] | null>(null);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessId) return;

    const stopTables = watchTables(businessId, setTables, (err) => {
      console.error(err);
      setError("Could not load the floor plan.");
      setTables([]);
    });
    const stopMarkers = watchMarkers(businessId, setMarkers, () => {});

    return () => {
      stopTables();
      stopMarkers();
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

  const onSeatPress = async (tableId: string, seatId: number) => {
    try {
      setError("");
      await toggleSeat(staff.businessId, tableId, seatId, tables);
    } catch (err) {
      console.error(err);
      setError("Could not update this seat.");
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#22c55e" }} />
        <Text style={{ color: colors.greenText, fontWeight: "800", fontSize: 12, letterSpacing: 1 }}>LIVE STAFF MODE</Text>
      </View>
      <Title>{staff.businessName}</Title>
      <Muted style={{ marginTop: 4, marginBottom: 16 }}>Changes update the customer view automatically.</Muted>

      <UpdateReminder businessId={staff.businessId} tables={tables} />

      {error ? <Banner tone="error">{error}</Banner> : null}

      <LiveSeats tables={tables} markers={markers} onSeatPress={onSeatPress} />

      <Button title="Log out" variant="secondary" onPress={() => void signOut(auth)} style={{ marginTop: 28 }} />
    </Screen>
  );
}
