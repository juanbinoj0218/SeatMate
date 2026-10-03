import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { clamp, isGameMarker, MARKERS, type FloorMarker, type MarkerType } from "@seatmate/shared/floor-plan";
import { tableSize } from "@seatmate/shared/table-geometry";

import TableWithSeats from "@/components/table-with-seats";
import { colors } from "@/components/ui";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Table } from "@/lib/floor";

export type Selection = { kind: "table" | "marker"; id: string } | null;

// Marker colors, matching markerClassName in the shared floor-plan config.
type MarkerLook = { background: string; border: string; text: string; radius?: number; borderWidth?: number };

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

// The floor plan: a 1000 × 700 canvas drawn at `scale` inside a scroll view.
// In "seats" mode seats are tappable; in "layout" mode tables and markers
// can be tapped to select them and dragged to move them.
export default function FloorCanvas({
  tables,
  markers,
  scale,
  mode,
  onSeatPress,
  onGamePress,
  selection = null,
  onSelect,
  onMoveTable,
  onMoveMarker,
}: {
  tables: Table[];
  markers: FloorMarker[];
  scale: number;
  mode: "seats" | "layout";
  onSeatPress?: (tableId: string, seatId: number) => void;
  onGamePress?: (marker: FloorMarker) => void;
  selection?: Selection;
  onSelect?: (selection: Selection) => void;
  onMoveTable?: (tableId: string, xPct: number, yPct: number) => void;
  onMoveMarker?: (markerId: string, xPct: number, yPct: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const layout = mode === "layout";

  return (
    <ScrollView horizontal scrollEnabled={!dragging} style={styles.frame} contentContainerStyle={{ flexGrow: 1 }}>
      <ScrollView scrollEnabled={!dragging} nestedScrollEnabled>
        <Pressable
          disabled={!layout}
          onPress={() => onSelect?.(null)}
          style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale, overflow: "hidden" }}
        >
          <View
            style={[
              styles.canvas,
              { transform: [{ scale }], transformOrigin: "top left" },
            ]}
          >
            <Grid />
            <Text style={styles.floorLabel}>MAIN FLOOR</Text>

            {tables.length === 0 && markers.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No seating layout yet</Text>
                <Text style={styles.emptyText}>
                  {layout ? "Add a table to get started." : "The owner hasn't added any tables yet."}
                </Text>
              </View>
            )}

            {markers.map((marker) => {
              const info = MARKERS[marker.type];
              const look = MARKER_LOOKS[marker.type] ?? DEFAULT_LOOK;
              const width = info.width * marker.scale;
              const height = info.height * marker.scale;
              const selected = selection?.kind === "marker" && selection.id === marker.id;
              const game = isGameMarker(marker.type);

              return (
                <Draggable
                  key={marker.id}
                  xPct={marker.xPct}
                  yPct={marker.yPct}
                  width={width}
                  height={height}
                  scale={scale}
                  enabled={layout}
                  bounds={{ x: [2, 98], y: [3, 97] }}
                  onDragState={setDragging}
                  onTap={() => onSelect?.({ kind: "marker", id: marker.id })}
                  onDrop={(x, y) => onMoveMarker?.(marker.id, x, y)}
                  zIndex={5}
                >
                  <Pressable
                    disabled={layout || !game || !onGamePress}
                    accessibilityRole={!layout && game ? "button" : undefined}
                    accessibilityLabel={
                      !layout && game ? `${marker.label}: ${marker.status === "occupied" ? "in use" : "open"}` : undefined
                    }
                    onPress={() => onGamePress?.(marker)}
                    style={({ pressed }) => [
                      styles.marker,
                      {
                        width,
                        height,
                        backgroundColor: look.background,
                        borderColor: look.border,
                        borderWidth: look.borderWidth ?? 1,
                        borderRadius: Math.min(look.radius ?? 0, Math.min(width, height) / 2),
                        transform: [{ rotate: `${marker.rotation}deg` }, { scale: pressed ? 0.95 : 1 }],
                      },
                      selected && styles.selected,
                    ]}
                  >
                    {marker.type !== "wall" && (
                      <View style={{ transform: [{ rotate: `${-marker.rotation}deg` }], alignItems: "center" }}>
                        {info.icon ? (
                          <Text style={{ fontSize: Math.max(12, 17 * marker.scale), color: look.text }}>{info.icon}</Text>
                        ) : null}
                        {marker.scale >= 0.75 && (
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: Math.max(9, 11 * marker.scale), fontWeight: "700", color: look.text }}
                          >
                            {marker.label}
                          </Text>
                        )}
                        {game && <GameStatus status={marker.status ?? "available"} />}
                      </View>
                    )}
                  </Pressable>
                </Draggable>
              );
            })}

            {tables.map((table) => {
              const box = tableSize(table.shape, table.seats.length, table.scale, table.rotation);
              const selected = selection?.kind === "table" && selection.id === table.id;

              return (
                <Draggable
                  key={table.id}
                  xPct={table.xPct}
                  yPct={table.yPct}
                  width={box.width}
                  height={box.height}
                  scale={scale}
                  enabled={layout}
                  bounds={{ x: [5, 95], y: [7, 93] }}
                  onDragState={setDragging}
                  onTap={() => onSelect?.({ kind: "table", id: table.id })}
                  onDrop={(x, y) => onMoveTable?.(table.id, x, y)}
                  zIndex={10}
                >
                  <TableWithSeats
                    name={table.name}
                    shape={table.shape}
                    seats={table.seats}
                    scale={table.scale}
                    rotation={table.rotation}
                    selected={selected}
                    onSeatPress={layout ? undefined : (seatId) => onSeatPress?.(table.id, seatId)}
                  />
                </Draggable>
              );
            })}
          </View>
        </Pressable>
      </ScrollView>
    </ScrollView>
  );
}

// Places a child centred on (xPct, yPct). When enabled, a tap selects it and
// a drag moves it; the new position is reported once the finger lifts.
function Draggable({
  xPct,
  yPct,
  width,
  height,
  scale,
  enabled,
  bounds,
  onDragState,
  onTap,
  onDrop,
  zIndex,
  children,
}: {
  xPct: number;
  yPct: number;
  width: number;
  height: number;
  scale: number;
  enabled: boolean;
  bounds: { x: [number, number]; y: [number, number] };
  onDragState: (dragging: boolean) => void;
  onTap: () => void;
  onDrop: (xPct: number, yPct: number) => void;
  zIndex: number;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  // PanResponder is created once, so it reads the latest props from a ref.
  const latest = useRef({ xPct, yPct, scale, enabled, bounds, onDragState, onTap, onDrop });
  useLayoutEffect(() => {
    latest.current = { xPct, yPct, scale, enabled, bounds, onDragState, onTap, onDrop };
  });

  // `latest` is only read inside the gesture handlers, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const target = (dx: number, dy: number) => {
      const { xPct: x, yPct: y, scale: s, bounds: b } = latest.current;
      return {
        x: clamp(x + (dx / s / CANVAS_WIDTH) * 100, b.x[0], b.x[1]),
        y: clamp(y + (dy / s / CANVAS_HEIGHT) * 100, b.y[0], b.y[1]),
      };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.enabled,
      onMoveShouldSetPanResponder: () => latest.current.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        latest.current.onDragState(true);
        latest.current.onTap();
      },
      onPanResponderMove: (_, gesture) => {
        setOffset(target(gesture.dx, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        latest.current.onDragState(false);
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3) {
          const next = target(gesture.dx, gesture.dy);
          latest.current.onDrop(next.x, next.y);
          // Keep showing the dropped spot until the saved position arrives.
          setOffset(next);
        } else {
          setOffset(null);
        }
      },
      onPanResponderTerminate: () => {
        latest.current.onDragState(false);
        setOffset(null);
      },
    });
  });

  // Once Firestore reports the new position, stop overriding it.
  const [lastSaved, setLastSaved] = useState({ xPct, yPct });
  if (lastSaved.xPct !== xPct || lastSaved.yPct !== yPct) {
    setLastSaved({ xPct, yPct });
    setOffset(null);
  }

  const x = offset?.x ?? xPct;
  const y = offset?.y ?? yPct;

  return (
    <View
      {...(enabled ? responder.panHandlers : {})}
      style={{
        position: "absolute",
        left: (x / 100) * CANVAS_WIDTH - width / 2,
        top: (y / 100) * CANVAS_HEIGHT - height / 2,
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        zIndex: offset ? 60 : zIndex,
      }}
    >
      {children}
    </View>
  );
}

// "Open" / "In use" pill on pool tables, darts and bowling lanes.
function GameStatus({ status }: { status: "available" | "occupied" }) {
  const open = status === "available";
  return (
    <Text style={[styles.game, { backgroundColor: open ? "#22c55e" : colors.red }]}>{open ? "Open" : "In use"}</Text>
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
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{lines}</View>;
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#fff",
    borderColor: "#dfe4de",
    borderWidth: 1,
    borderRadius: 20,
  },
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: "#fff" },
  gridLine: { position: "absolute", backgroundColor: "#e5e7eb", opacity: 0.5 },
  floorLabel: {
    position: "absolute",
    top: 20,
    left: 24,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#d1d5db",
  },
  empty: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 26, fontWeight: "800", color: colors.ink },
  emptyText: { fontSize: 18, color: colors.faint, marginTop: 8 },
  marker: { alignItems: "center", justifyContent: "center" },
  selected: { borderWidth: 3, borderColor: "#93c5fd" },
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
});
