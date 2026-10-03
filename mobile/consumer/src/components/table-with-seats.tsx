import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  elapsed,
  isSingleSeat,
  stoolNumber,
  tableGeometry,
  type TableRotation,
  type TableSeat,
  type TableShape,
} from "@seatmate/shared/table-geometry";

import { TimerIcon } from "@/components/icons";
import { colors } from "@/components/ui";

// A table drawn from above with its seats around it, laid out exactly like
// the web portal's TableWithSeats. Seats are buttons when onSeatPress is set.
export default function TableWithSeats({
  name,
  shape,
  seats,
  scale = 1,
  rotation = 0,
  onSeatPress,
  selected = false,
  preview = false,
}: {
  name: string;
  shape: TableShape;
  seats: TableSeat[];
  scale?: number;
  rotation?: TableRotation;
  onSeatPress?: (seatId: number) => void;
  selected?: boolean;
  // A small picture in the "Add" panel: no name, no chair timer.
  preview?: boolean;
}) {
  const stool = isSingleSeat(shape);
  const chair = shape === "barberChair";
  const shown = stool ? seats.slice(0, 1) : seats;
  const { width, height, tableWidth, tableHeight, seatSize, spots } = tableGeometry(
    shape,
    shown.length,
    scale,
    rotation
  );
  const open = shown.filter((seat) => seat.status === "available").length;
  const fontSize = Math.max(9, Math.min(14, 12.5 * scale));

  return (
    <View
      style={{ width, height }}
      accessibilityLabel={`${name}: ${open} of ${shown.length} seats open`}
    >
      <View
        style={[
          styles.table,
          {
            left: (width - tableWidth) / 2,
            top: (height - tableHeight) / 2,
            width: tableWidth,
            height: tableHeight,
            borderRadius: chair ? 12 : stool || shape === "round" ? tableWidth / 2 : 16,
            backgroundColor: chair ? "#2b2f36" : stool ? "#3b2a1c" : colors.ink,
            padding: stool ? 0 : 6 * scale,
          },
          chair && {
            borderTopLeftRadius: tableWidth * 0.4,
            borderTopRightRadius: tableWidth * 0.4,
            borderTopWidth: 5,
            borderTopColor: "#8b1e2d",
          },
          selected && styles.selected,
        ]}
      >
        {!stool && !preview && (
          <>
            <Text numberOfLines={2} style={[styles.name, { fontSize }]}>
              {name}
            </Text>
            <Text style={[styles.count, { fontSize }]}>
              {shown.length} {shown.length === 1 ? "seat" : "seats"}
            </Text>
          </>
        )}
      </View>

      {shown.map((seat, index) => {
        const spot = spots[index];
        const status = seat.status === "available" ? "open" : "taken";
        const label = stool ? `${name}: ${status}` : `Seat ${seat.id}: ${status}`;
        const style = [
          styles.seat,
          {
            left: width / 2 + spot.x - seatSize / 2,
            top: height / 2 + spot.y - seatSize / 2,
            width: seatSize,
            height: seatSize,
            borderRadius: seatSize / 2,
            backgroundColor: seat.status === "available" ? "#22c55e" : colors.red,
          },
        ];
        const text = (
          <Text style={[styles.seatText, { fontSize: Math.max(8, 10 * scale) }]}>
            {stool ? stoolNumber(name) : seat.id}
          </Text>
        );

        return onSeatPress ? (
          <Pressable
            key={seat.id}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={4}
            onPress={() => onSeatPress(seat.id)}
            style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.9 }] }]}
          >
            {text}
          </Pressable>
        ) : (
          <View key={seat.id} accessibilityLabel={label} style={style}>
            {text}
          </View>
        );
      })}

      {chair && shown[0] && !preview ? (
        <View pointerEvents="none" style={styles.timerRow}>
          <ChairTimer seat={shown[0]} fontSize={Math.max(9, 10 * scale)} />
        </View>
      ) : null}
    </View>
  );
}

// Pill under a barber chair: "Open" while free, and a running timer of how
// long the current customer has been in the chair once it is taken.
export function ChairTimer({ seat, fontSize }: { seat: TableSeat; fontSize: number }) {
  const occupied = seat.status === "occupied";
  const since = occupied && typeof seat.occupiedSince === "number" ? seat.occupiedSince : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);

  const look = occupied
    ? { backgroundColor: colors.redSoft, color: "#dc2626", borderColor: "#fecaca" }
    : { backgroundColor: colors.greenSoft, color: "#15803d", borderColor: "#bbf7d0" };

  return (
    <View style={[styles.timer, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}>
      {since !== null && <TimerIcon size={fontSize} color={look.color} strokeWidth={2.4} />}
      <Text style={[styles.timerText, { fontSize, color: look.color }]}>
        {!occupied ? "Open" : since === null ? "In chair" : elapsed(since, Math.max(now, since))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  selected: { borderWidth: 3, borderColor: "#93c5fd" },
  name: { color: "#fff", fontWeight: "800", textAlign: "center" },
  count: { color: "rgba(255,255,255,0.55)", fontWeight: "700", marginTop: 1 },
  seat: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  seatText: { color: "#fff", fontWeight: "800" },
  timerRow: { position: "absolute", top: "100%", left: -40, right: -40, alignItems: "center", marginTop: 4 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  timerText: { fontWeight: "800", fontVariant: ["tabular-nums"] },
});
