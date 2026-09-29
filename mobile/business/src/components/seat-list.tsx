import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/ui";
import type { Table } from "@/lib/floor";

// Every table as a row of big seat buttons: quicker than the floor plan on
// a phone when the room is busy.
export default function SeatList({
  tables,
  onSeatPress,
}: {
  tables: Table[];
  onSeatPress: (tableId: string, seatId: number) => void;
}) {
  const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (sorted.length === 0) {
    return <Text style={styles.empty}>No tables yet.</Text>;
  }

  return (
    <View style={{ gap: 10 }}>
      {sorted.map((table) => {
        const open = table.seats.filter((seat) => seat.status === "available").length;

        return (
          <View key={table.id} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.name}>{table.name}</Text>
              <Text style={styles.count}>
                {open}/{table.seats.length} open
              </Text>
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
                    <Text style={styles.seatText}>{table.shape === "stool" ? "●" : seat.id}</Text>
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
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
});
