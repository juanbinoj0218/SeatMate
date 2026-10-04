import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { isGameMarker, MARKERS, type FloorMarker, type MarkerType } from "@seatmate/shared/floor-plan";
import { tableSize } from "@seatmate/shared/table-geometry";

import { MarkerIcon } from "@/components/icons";
import TableWithSeats from "@/components/table-with-seats";
import { colors } from "@/components/ui";
import { tap } from "@/lib/haptics";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Table } from "@/lib/floor";

// The business's live floor plan, read-only: the same 1000 × 700 canvas the
// owner lays out on the website or business app, scaled to fit the screen,
// with zoom buttons for a closer look.

type MarkerLook = { background: string; border: string; text: string; radius?: number; borderWidth?: number };

// Marker colors, matching markerClassName in the shared floor-plan config.
const MARKER_LOOKS: Partial<Record<MarkerType, MarkerLook>> = {
  wall: { background: "#374151", border: "#1f2937", text: "#fff" },
  window: { background: "#f0f9ff", border: "#7dd3fc", text: "#075985" },
  outlet: { background: "#fffbeb", border: "#fcd34d", text: "#92400e", radius: 12 },
  barCounter: { background: "#92400e", border: "#451a03", text: "#fffbeb", radius: 12 },
  poolTable: { background: "#047857", border: "#78350f", text: "#fff", radius: 8, borderWidth: 6 },
  darts: { background: "#fff1f2", border: "#fda4af", text: "#9f1239", radius: 999 },
  bowlingLane: { background: "#fef3c7", border: "#fcd34d", text: "#78350f", radius: 6 },
};
const DEFAULT_LOOK: MarkerLook = { background: "#fff", border: "#d1d5db", text: colors.ink, radius: 12 };

const ZOOMS = [1, 1.6, 2.4];
// Room left around the outermost table or marker when fitting to the layout.
const MARGIN = 36;
// Never blow tables up past this on big screens.
const MAX_SCALE = 1.1;

type Box = { x: number; y: number; width: number; height: number };

// The part of the 1000 × 700 canvas the business actually uses, so a small
// layout fills the screen instead of sitting in a sea of empty grid.
function layoutBounds(tables: Table[], markers: FloorMarker[]): Box {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const add = (xPct: number, yPct: number, width: number, height: number, rotation: number) => {
    // A rotated marker can reach its longer side in either direction.
    const turned = rotation % 180 !== 0;
    const half = turned ? Math.max(width, height) / 2 : width / 2;
    const halfY = turned ? Math.max(width, height) / 2 : height / 2;
    const x = (xPct / 100) * CANVAS_WIDTH;
    const y = (yPct / 100) * CANVAS_HEIGHT;
    left = Math.min(left, x - half);
    right = Math.max(right, x + half);
    top = Math.min(top, y - halfY);
    bottom = Math.max(bottom, y + halfY);
  };
  tables.forEach((table) => {
    const box = tableSize(table.shape, table.seats.length, table.scale, table.rotation);
    add(table.xPct, table.yPct, box.width, box.height, 0);
  });
  markers.forEach((marker) => {
    const info = MARKERS[marker.type];
    add(marker.xPct, marker.yPct, info.width * marker.scale, info.height * marker.scale, marker.rotation);
  });
  if (left === Infinity) return { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

  const x = Math.max(0, left - MARGIN);
  const y = Math.max(0, top - MARGIN);
  return {
    x,
    y,
    width: Math.min(CANVAS_WIDTH, right + MARGIN) - x,
    height: Math.min(CANVAS_HEIGHT, bottom + MARGIN) - y,
  };
}

export default function FloorView({
  tables,
  markers,
  width,
  maxHeight,
}: {
  tables: Table[];
  markers: FloorMarker[];
  // Space available for the map.
  width: number;
  // Tallest the map may get; it fits the layout to width × maxHeight.
  maxHeight: number;
}) {
  const [zoom, setZoom] = useState(0);
  const bounds = useMemo(() => layoutBounds(tables, markers), [tables, markers]);
  // Fit the used part of the floor to the screen, phone or iPad, portrait or landscape.
  const fit = Math.min(MAX_SCALE, width / bounds.width, maxHeight / bounds.height);
  const scale = fit * ZOOMS[zoom];
  const frameHeight = Math.max(160, bounds.height * fit);
  const contentWidth = bounds.width * scale;
  const contentHeight = bounds.height * scale;

  return (
    <View>
      <View style={[styles.frame, { width, height: frameHeight }]}>
        <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={zoom > 0}>
          <ScrollView nestedScrollEnabled bounces={false} showsVerticalScrollIndicator={zoom > 0}>
            <View
              style={{
                width: contentWidth,
                height: contentHeight,
                marginLeft: Math.max(0, (width - 2 - contentWidth) / 2),
                marginTop: Math.max(0, (frameHeight - 2 - contentHeight) / 2),
                overflow: "hidden",
              }}
            >
              <View
                style={[
                  styles.canvas,
                  {
                    transform: [{ translateX: -bounds.x * scale }, { translateY: -bounds.y * scale }, { scale }],
                    transformOrigin: "top left",
                  },
                ]}
              >
                <Grid />
                <Text style={styles.floorLabel}>TOP-DOWN FLOOR</Text>

                {tables.length === 0 && markers.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No seating layout yet</Text>
                    <Text style={styles.emptyText}>This business hasn&apos;t published its floor plan.</Text>
                  </View>
                )}

                {markers.map((marker) => (
                  <Marker key={marker.id} marker={marker} />
                ))}

                {tables.map((table) => {
                  const box = tableSize(table.shape, table.seats.length, table.scale, table.rotation);
                  return (
                    <View
                      key={table.id}
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: (table.xPct / 100) * CANVAS_WIDTH - box.width / 2,
                        top: (table.yPct / 100) * CANVAS_HEIGHT - box.height / 2,
                        width: box.width,
                        height: box.height,
                        zIndex: 20,
                      }}
                    >
                      <TableWithSeats
                        name={table.name}
                        shape={table.shape}
                        seats={table.seats}
                        scale={table.scale}
                        rotation={table.rotation}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </ScrollView>

      </View>

      <View style={styles.legend}>
        <LegendDot color="#22c55e" label="Open" />
        <LegendDot color={colors.red} label="Taken" />
        <View style={{ flex: 1 }} />
        <View style={styles.zoom}>
          <ZoomButton label="−" disabled={zoom === 0} onPress={() => setZoom((value) => Math.max(0, value - 1))} />
          <View style={styles.zoomDivider} />
          <ZoomButton
            label="+"
            disabled={zoom === ZOOMS.length - 1}
            onPress={() => setZoom((value) => Math.min(ZOOMS.length - 1, value + 1))}
          />
        </View>
      </View>
    </View>
  );
}

function Marker({ marker }: { marker: FloorMarker }) {
  const info = MARKERS[marker.type];
  const look = MARKER_LOOKS[marker.type] ?? DEFAULT_LOOK;
  const width = info.width * marker.scale;
  const height = info.height * marker.scale;
  const game = isGameMarker(marker.type);

  return (
    <View
      pointerEvents="none"
      accessibilityLabel={game ? `${marker.label}: ${marker.status === "occupied" ? "in use" : "open"}` : marker.label}
      style={[
        styles.marker,
        {
          left: (marker.xPct / 100) * CANVAS_WIDTH - width / 2,
          top: (marker.yPct / 100) * CANVAS_HEIGHT - height / 2,
          width,
          height,
          backgroundColor: look.background,
          borderColor: look.border,
          borderWidth: look.borderWidth ?? 1,
          borderRadius: Math.min(look.radius ?? 0, Math.min(width, height) / 2),
          transform: [{ rotate: `${marker.rotation}deg` }],
        },
      ]}
    >
      {marker.type !== "wall" && (
        <View style={{ transform: [{ rotate: `${-marker.rotation}deg` }], alignItems: "center" }}>
          <MarkerIcon type={marker.type} size={Math.max(12, 17 * marker.scale)} color={look.text} />
          {marker.scale >= 0.75 && (
            <Text numberOfLines={1} style={{ fontSize: Math.max(9, 11 * marker.scale), fontWeight: "700", color: look.text }}>
              {marker.label}
            </Text>
          )}
          {game && (
            <Text style={[styles.game, { backgroundColor: marker.status === "occupied" ? colors.red : "#22c55e" }]}>
              {marker.status === "occupied" ? "In use" : "Open"}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function ZoomButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Zoom in" : "Zoom out"}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.zoomButton, disabled && { opacity: 0.3 }, pressed && { backgroundColor: "#f3f4f6" }]}
    >
      <Text style={styles.zoomText}>{label}</Text>
    </Pressable>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Grid() {
  const lines = [];
  for (let x = 32; x < CANVAS_WIDTH; x += 32) {
    lines.push(<View key={`x${x}`} style={[styles.gridLine, { left: x, top: 0, bottom: 0, width: 1 }]} />);
  }
  for (let y = 32; y < CANVAS_HEIGHT; y += 32) {
    lines.push(<View key={`y${y}`} style={[styles.gridLine, { top: y, left: 0, right: 0, height: 1 }]} />);
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#fff",
    borderColor: "#dfe4de",
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: "#fff" },
  gridLine: { position: "absolute", backgroundColor: "#e5e7eb", opacity: 0.5 },
  floorLabel: { position: "absolute", top: 20, left: 24, fontSize: 12, fontWeight: "800", letterSpacing: 2, color: "#d1d5db" },
  empty: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 30, fontWeight: "800", color: colors.ink },
  emptyText: { fontSize: 22, color: colors.faint, marginTop: 8 },
  marker: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 5 },
  game: {
    marginTop: 3,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  zoom: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  zoomButton: { width: 48, height: 44, alignItems: "center", justifyContent: "center" },
  zoomText: { fontSize: 24, fontWeight: "700", color: colors.ink, marginTop: -2 },
  zoomDivider: { width: 1, backgroundColor: colors.border },
  legend: { flexDirection: "row", gap: 16, alignItems: "center", marginTop: 14, paddingLeft: 4 },
  legendText: { fontSize: 15, fontWeight: "700", color: colors.muted },
});
