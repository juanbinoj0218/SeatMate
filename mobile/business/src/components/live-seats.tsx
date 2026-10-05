import { useState } from "react";
import { Minus, Plus, type LucideIcon } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { isGameMarker, type FloorMarker } from "@seatmate/shared/floor-plan";

import FloorCanvas from "@/components/floor-canvas";
import SeatList from "@/components/seat-list";
import { colors, PressableScale, Segmented, StatTile } from "@/components/ui";
import { seatCounts, type Table } from "@/lib/floor";
import { fitScale, useBox, useWide } from "@/lib/layout";

// Seat counts plus the floor plan (or a list) where tapping a seat flips
// it between open and taken. Used by owners and staff; nobody can move or
// change tables here. On an iPad the floor plan fills the screen and the
// counts sit in a panel beside it.
export default function LiveSeats({
  tables,
  markers,
  onSeatPress,
  onGamePress,
  header,
  aside,
}: {
  tables: Table[];
  markers: FloorMarker[];
  onSeatPress: (tableId: string, seatId: number) => void;
  onGamePress?: (marker: FloorMarker) => void;
  // Extra controls above the floor plan (iPad) or above everything (phone).
  header?: React.ReactNode;
  // Extra cards for the side panel (iPad) or under the counts (phone).
  aside?: React.ReactNode;
}) {
  const wide = useWide();
  const counts = seatCounts(tables);
  const [view, setView] = useState<"map" | "list">("map");
  const [zoom, setZoom] = useState(1);
  const [box, onLayout] = useBox();
  const games = markers.filter((marker) => isGameMarker(marker.type));

  const hint = (
    <Text style={styles.hint}>
      Tap a seat to switch it between open and taken.
      {games.length > 0 && onGamePress ? " Tap a pool table, darts board or lane to mark it in use." : ""}
    </Text>
  );

  const viewSwitch = (
    <Segmented
      options={[
        { value: "map", label: "Floor plan" },
        { value: "list", label: "List" },
      ]}
      value={view}
      onChange={setView}
    />
  );

  const stats = (
    <View style={[styles.row, wide && { flexDirection: "column" }]}>
      <StatTile label="Total" value={counts.total} />
      <StatTile label="Open" value={counts.open} color={colors.green} />
      <StatTile label="Taken" value={counts.taken} color={colors.red} />
    </View>
  );

  const list = (
    <SeatList tables={tables} games={onGamePress ? games : []} onSeatPress={onSeatPress} onGamePress={onGamePress} />
  );

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: "row", gap: 18 }}>
        <View style={{ flex: 1 }}>
          <View style={styles.toolbar}>
            {header}
            <View style={{ width: 240 }}>{viewSwitch}</View>
            <View style={{ flex: 1 }} />
            {view === "map" && <ZoomControls zoom={zoom} onZoom={setZoom} />}
          </View>
          {view === "map" ? (
            <View style={{ flex: 1, justifyContent: "center" }} onLayout={onLayout}>
              <FloorCanvas
                tables={tables}
                markers={markers}
                mode="seats"
                scale={fitScale(box) * zoom}
                onSeatPress={onSeatPress}
                onGamePress={onGamePress}
                fill
              />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>{list}</ScrollView>
          )}
        </View>

        <ScrollView style={{ width: 300, flexGrow: 0 }} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
          {stats}
          {aside}
          {hint}
          <Legend />
        </ScrollView>
      </View>
    );
  }

  return (
    <View onLayout={onLayout}>
      {header}
      {stats}
      {aside}
      <View style={{ marginTop: 16 }}>{viewSwitch}</View>
      {hint}
      {view === "map" ? (
        <>
          <ZoomControls zoom={zoom} onZoom={setZoom} />
          <FloorCanvas
            tables={tables}
            markers={markers}
            mode="seats"
            scale={fitScale(box ? { width: box.width } : null) * zoom}
            onSeatPress={onSeatPress}
            onGamePress={onGamePress}
          />
        </>
      ) : (
        list
      )}
      <Legend />
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
        <Text style={{ color: colors.green, fontWeight: "700" }}>Open</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
        <Text style={{ color: colors.red, fontWeight: "700" }}>Taken</Text>
      </View>
    </View>
  );
}

export function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  const step = (amount: number) => onZoom(Math.min(3, Math.max(1, Number((zoom + amount).toFixed(2)))));

  return (
    <View style={styles.zoom}>
      <ZoomButton icon={Minus} accessibilityLabel="Zoom out" onPress={() => step(-0.5)} disabled={zoom <= 1} />
      <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
      <ZoomButton icon={Plus} accessibilityLabel="Zoom in" onPress={() => step(0.5)} disabled={zoom >= 3} />
      {zoom > 1 && <ZoomButton label="Fit" accessibilityLabel="Fit to screen" onPress={() => onZoom(1)} />}
    </View>
  );
}

function ZoomButton({
  label,
  icon: Icon,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label?: string;
  icon?: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.92}
      style={[styles.zoomButton, disabled && { opacity: 0.35 }]}
    >
      {Icon ? <Icon size={18} color={colors.ink} strokeWidth={2.2} /> : <Text style={styles.zoomButtonText}>{label}</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, minHeight: 44 },
  hint: { color: colors.muted, marginTop: 12, marginBottom: 10, lineHeight: 20 },
  zoom: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, alignSelf: "flex-end" },
  zoomText: { fontWeight: "700", color: colors.muted, minWidth: 48, textAlign: "center" },
  zoomButton: {
    minWidth: 44,
    height: 40,
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
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
