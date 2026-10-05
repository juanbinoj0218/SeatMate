import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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

// Seat colors on the floor plan, shared with the legend.
export const SEAT_OPEN = "#22c55e";
export const SEAT_TAKEN = "#d56b63";
const TABLE_COLOR = "#1d2620";

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
  magnify = 1,
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
  // Draw everything this many times larger. The floor plan draws at its
  // most zoomed-in size and shrinks to fit, so zooming in stays sharp.
  magnify?: number;
}) {
  const stool = isSingleSeat(shape);
  const chair = shape === "barberChair";
  const shown = stool ? seats.slice(0, 1) : seats;
  const geometry = tableGeometry(shape, shown.length, scale, rotation);
  const m = magnify;
  const width = geometry.width * m;
  const height = geometry.height * m;
  const tableWidth = geometry.tableWidth * m;
  const tableHeight = geometry.tableHeight * m;
  const seatSize = geometry.seatSize * m;
  const spots = geometry.spots.map((spot) => ({ x: spot.x * m, y: spot.y * m }));
  const open = shown.filter((seat) => seat.status === "available").length;
  const fontSize = Math.max(9, Math.min(14, 12.5 * scale)) * m;

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
            borderRadius: chair ? 12 * m : stool || shape === "round" ? tableWidth / 2 : 16 * m,
            backgroundColor: chair ? "#2b2f36" : stool ? "#3b2a1c" : TABLE_COLOR,
            padding: stool ? 0 : 6 * scale * m,
            shadowRadius: 8 * m,
            shadowOffset: { width: 0, height: 4 * m },
          },
          chair && {
            borderTopLeftRadius: tableWidth * 0.4,
            borderTopRightRadius: tableWidth * 0.4,
            borderTopWidth: 5 * m,
            borderTopColor: "#8b1e2d",
          },
          selected && { borderWidth: 3 * m, borderColor: SEAT_OPEN },
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
        return (
          <Seat
            key={seat.id}
            open={seat.status === "available"}
            size={seatSize}
            left={width / 2 + spot.x - seatSize / 2}
            top={height / 2 + spot.y - seatSize / 2}
            ring={2 * m}
            label={stool ? `${name}: ${status}` : `Seat ${seat.id}: ${status}`}
            onPress={onSeatPress ? () => onSeatPress(seat.id) : undefined}
          >
            <Text style={[styles.seatText, { fontSize: Math.max(8, 10 * scale) * m }]}>
              {stool ? stoolNumber(name) : seat.id}
            </Text>
          </Seat>
        );
      })}

      {chair && shown[0] && !preview ? (
        <View pointerEvents="none" style={[styles.timerRow, { left: -40 * m, right: -40 * m, marginTop: 4 * m }]}>
          <ChairTimer seat={shown[0]} fontSize={Math.max(9, 10 * scale) * m} magnify={m} />
        </View>
      ) : null}
    </View>
  );
}

// One seat. When staff change it, the color slides from green to red (or
// back) and the seat gives a small pulse, so live changes are easy to spot.
function Seat({
  open,
  size,
  left,
  top,
  ring = 2,
  label,
  onPress,
  children,
}: {
  open: boolean;
  size: number;
  left: number;
  top: number;
  ring?: number;
  label: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const progress = useSharedValue(open ? 1 : 0);
  const pulse = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: 420 }));
    if (first.current) {
      first.current = false;
      return;
    }
    // A small pop that stays inside the gap around the seat, so it never
    // runs into the table or the next seat.
    pulse.set(withSequence(withTiming(1.06, { duration: 120 }), withTiming(1, { duration: 180 })));
  }, [open, progress, pulse]);

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [SEAT_TAKEN, SEAT_OPEN]),
    transform: [{ scale: pulse.get() }],
  }));

  const box = { left, top, width: size, height: size, borderRadius: size / 2, shadowRadius: ring, shadowOffset: { width: 0, height: ring / 2 } };
  if (!onPress) {
    return (
      <View accessibilityLabel={label} style={[styles.seatSlot, box]} pointerEvents="none">
        <Animated.View style={[styles.seatFill, { borderRadius: size / 2, borderWidth: ring }, animated]}>{children}</Animated.View>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.seatSlot, box, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Animated.View style={[styles.seatFill, { borderRadius: size / 2, borderWidth: ring }, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// Pill under a barber chair: "Open" while free, and a running timer of how
// long the current customer has been in the chair once it is taken.
export function ChairTimer({ seat, fontSize, magnify = 1 }: { seat: TableSeat; fontSize: number; magnify?: number }) {
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
    <View
      style={[
        styles.timer,
        {
          backgroundColor: look.backgroundColor,
          borderColor: look.borderColor,
          gap: 3 * magnify,
          borderWidth: magnify,
          paddingHorizontal: 8 * magnify,
          paddingVertical: 2 * magnify,
        },
      ]}
    >
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
    shadowColor: "#101811",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  name: { color: "#fff", fontWeight: "800", textAlign: "center" },
  count: { color: "rgba(255,255,255,0.72)", fontWeight: "700", marginTop: 1 },
  seatSlot: {
    position: "absolute",
    shadowColor: "#101811",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    // Always above the table top, on Android too (where elevation decides).
    zIndex: 2,
    elevation: 6,
  },
  seatFill: {
    flex: 1,
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
