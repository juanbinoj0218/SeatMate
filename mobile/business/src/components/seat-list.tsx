import { Pressable, StyleSheet, Text, View } from "react-native";

import { MARKERS, type FloorMarker } from "@seatmate/shared/floor-plan";
import { isSingleSeat } from "@seatmate/shared/table-geometry";

import { ChairTimer } from "@/components/table-with-seats";
import { colors } from "@/components/ui";
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
                <Pressable
                  key={marker.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${marker.label}: ${open ? "open" : "in use"}`}
                  onPress={() => onGamePress?.(marker)}
                  style={({ pressed }) => [
                    styles.game,
                    { backgroundColor: open ? "#22c55e" : colors.red },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.gameText}>
                    {MARKERS[marker.type].icon} {marker.label}
                  </Text>
                  <Text style={[styles.gameText, { fontSize: 12, opacity: 0.85 }]}>{open ? "Open" : "In use"}</Text>
                </Pressable>
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
                <Text style={styles.count}>
                  {open}/{table.seats.length} open
                </Text>
              )}
            </View>
            <View style={styles.seats}>
              {table.seats.map((seat) => {
                const available = seat.status === "available";
                return (
                  <Pressable
                    key={seat.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${table.name}, seat ${seat.id}: ${available ? "open" : "taken"}`}
                    onPress={() => onSeatPress(table.id, seat.id)}
                    style={({ pressed }) => [
                      styles.seat,
                      { backgroundColor: available ? "#22c55e" : colors.red },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.seatText}>{isSingleSeat(table.shape) ? "●" : seat.id}</Text>
                  </Pressable>
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
  count: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  seats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  seat: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  seatText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  game: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 110 },
  gameText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
});
