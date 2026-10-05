import { StyleSheet, Text, View } from "react-native";

import type { FloorMarker } from "@seatmate/shared/floor-plan";
import { isSingleSeat } from "@seatmate/shared/table-geometry";

import { AnimatedNumber } from "@/components/animated-number";
import { MarkerIcon } from "@/components/icons";
import { ChairTimer } from "@/components/table-with-seats";
import { colors, PressableScale } from "@/components/ui";
import type { Table } from "@/lib/floor";

// Every table as a row of big seat buttons: quicker than the floor plan on
// a phone when the room is busy.
export default function SeatList({
  tables,
  games = [],
  onSeatPress,
  onGamePress,
}: {
  tables: Table[];
  games?: FloorMarker[];
  onSeatPress: (tableId: string, seatId: number) => void;
  onGamePress?: (marker: FloorMarker) => void;
}) {
  const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const sortedGames = [...games].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  if (sorted.length === 0 && sortedGames.length === 0) {
    return <Text style={styles.empty}>No tables yet.</Text>;
  }

  return (
    <View style={{ gap: 10 }}>
      {sortedGames.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.name}>Games</Text>
          <View style={styles.seats}>
            {sortedGames.map((marker) => {
              const open = marker.status !== "occupied";
              return (
                <PressableScale
                  key={marker.id}
                  accessibilityLabel={`${marker.label}: ${open ? "open" : "in use"}`}
                  onPress={() => onGamePress?.(marker)}
                  style={[styles.game, { backgroundColor: open ? "#22c55e" : colors.red }]}
                >
                  <View style={styles.gameLabel}>
                    <MarkerIcon type={marker.type} size={16} color="#fff" />
                    <Text style={styles.gameText}>{marker.label}</Text>
                  </View>
                  <Text style={[styles.gameText, { fontSize: 12, opacity: 0.85 }]}>{open ? "Open" : "In use"}</Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
      )}
      {sorted.map((table) => {
        const open = table.seats.filter((seat) => seat.status === "available").length;

        return (
          <View key={table.id} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.name}>{table.name}</Text>
              {table.shape === "barberChair" && table.seats[0] ? (
                <ChairTimer seat={table.seats[0]} fontSize={13} />
              ) : (
                <View style={{ flexDirection: "row" }} accessible accessibilityLabel={`${open} of ${table.seats.length} open`}>
                  <AnimatedNumber value={open} style={styles.count} />
                  <Text style={styles.count}>/{table.seats.length} open</Text>
                </View>
              )}
            </View>
            <View style={styles.seats}>
              {table.seats.map((seat) => {
                const available = seat.status === "available";
                return (
                  <PressableScale
                    key={seat.id}
                    accessibilityLabel={`${table.name}, seat ${seat.id}: ${available ? "open" : "taken"}`}
                    scaleTo={0.9}
                    onPress={() => onSeatPress(table.id, seat.id)}
                    style={[styles.seat, { backgroundColor: available ? "#22c55e" : colors.red }]}
                  >
                    {isSingleSeat(table.shape) ? (
                      <View style={styles.seatDot} />
                    ) : (
                      <Text style={styles.seatText}>{seat.id}</Text>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  name: { fontSize: 16, fontWeight: "800", color: colors.ink },
  count: { fontSize: 13, lineHeight: 18, color: colors.muted, fontWeight: "600" },
  seats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  seat: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  seatText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  seatDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  game: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 110 },
  gameLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  gameText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
});
