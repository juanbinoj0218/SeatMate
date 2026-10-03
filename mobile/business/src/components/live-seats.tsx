import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { isGameMarker, type FloorMarker } from "@seatmate/shared/floor-plan";

import FloorCanvas from "@/components/floor-canvas";
import SeatList from "@/components/seat-list";
import { colors, Segmented, StatTile } from "@/components/ui";
import { CANVAS_WIDTH, seatCounts, type Table } from "@/lib/floor";

// Seat counts plus the floor plan (or a list) where tapping a seat flips
// it between open and taken. Used by owners and staff.
export default function LiveSeats({
  tables,
  markers,
  onSeatPress,
  onGamePress,
}: {
  tables: Table[];
  markers: FloorMarker[];
  onSeatPress: (tableId: string, seatId: number) => void;
  onGamePress?: (marker: FloorMarker) => void;
}) {
  const games = markers.filter((marker) => isGameMarker(marker.type));
  const counts = seatCounts(tables);
  const { width } = useWindowDimensions();
  const [view, setView] = useState<"map" | "list">("map");
  const [zoom, setZoom] = useState(1);

  return (
    <View>
      <View style={styles.row}>
        <StatTile label="Total" value={counts.total} />
        <StatTile label="Open" value={counts.open} color={colors.green} />
        <StatTile label="Taken" value={counts.taken} color={colors.red} />
      </View>

      <View style={{ marginTop: 16 }}>
        <Segmented
          options={[
            { value: "map", label: "Floor plan" },
            { value: "list", label: "List" },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      <Text style={styles.hint}>
        Tap a seat to switch it between open and taken.
        {games.length > 0 && onGamePress ? " Tap a pool table, darts board or lane to mark it in use." : ""}
      </Text>

      {view === "map" ? (
        <>
          <ZoomControls zoom={zoom} onZoom={setZoom} />
          <FloorCanvas
            tables={tables}
            markers={markers}
            mode="seats"
            scale={fitScale(width) * zoom}
            onSeatPress={onSeatPress}
            onGamePress={onGamePress}
          />
        </>
      ) : (
        <SeatList tables={tables} games={onGamePress ? games : []} onSeatPress={onSeatPress} onGamePress={onGamePress} />
      )}

      <View style={styles.legend}>
        <Text style={{ color: colors.green, fontWeight: "700" }}>● Open</Text>
        <Text style={{ color: colors.red, fontWeight: "700" }}>● Taken</Text>
      </View>
    </View>
  );
}

// Scale that fits the whole 1000px-wide floor plan in the screen's width
// (minus the screen padding).
export const fitScale = (screenWidth: number) => Math.min(1, (screenWidth - 42) / CANVAS_WIDTH);

export function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  const step = (amount: number) => onZoom(Math.min(3, Math.max(1, Number((zoom + amount).toFixed(2)))));

  return (
    <View style={styles.zoom}>
      <ZoomButton label="−" accessibilityLabel="Zoom out" onPress={() => step(-0.5)} disabled={zoom <= 1} />
      <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
      <ZoomButton label="+" accessibilityLabel="Zoom in" onPress={() => step(0.5)} disabled={zoom >= 3} />
      {zoom > 1 && <ZoomButton label="Fit" accessibilityLabel="Fit to screen" onPress={() => onZoom(1)} />}
    </View>
  );
}

function ZoomButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={[styles.zoomButton, disabled && { opacity: 0.35 }]}
    >
      <Text style={styles.zoomButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  hint: { color: colors.muted, marginTop: 12, marginBottom: 10 },
  zoom: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, alignSelf: "flex-end" },
  zoomText: { fontWeight: "700", color: colors.muted, minWidth: 48, textAlign: "center" },
  zoomButton: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomButtonText: { fontSize: 16, fontWeight: "800", color: colors.ink },
  legend: { flexDirection: "row", gap: 18, justifyContent: "center", marginTop: 14 },
});
