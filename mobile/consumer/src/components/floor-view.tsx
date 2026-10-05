import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { isGameMarker, MARKERS, type FloorMarker, type MarkerType } from "@seatmate/shared/floor-plan";
import { tableSize } from "@seatmate/shared/table-geometry";

import { CloseIcon, FitIcon, FloorPlanIcon, ListIcon, MarkerIcon, MinusIcon, PlusIcon } from "@/components/icons";
import TableWithSeats, { SEAT_OPEN, SEAT_TAKEN } from "@/components/table-with-seats";
import { colors } from "@/components/ui";
import { tap } from "@/lib/haptics";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Table } from "@/lib/floor";

// The business's live floor plan, read-only: the same 1000 × 700 canvas the
// owner lays out on the website or business app, trimmed to the part in use
// and fitted to the screen. Pinch or double-tap to zoom, drag to look around,
// and tap a table to see its seats. A list view shows the same tables as rows.

type MarkerLook = { background: string; border: string; text: string; radius?: number; borderWidth?: number };

// Marker colors, matching markerClassName in the shared floor-plan config.
// Walls are drawn as solid lines rather than boxes.
const MARKER_LOOKS: Partial<Record<MarkerType, MarkerLook>> = {
  wall: { background: "#2b332d", border: "#2b332d", text: "#fff", radius: 3, borderWidth: 0 },
  window: { background: "#eef8ff", border: "#9cd3f5", text: "#075985", radius: 4 },
  outlet: { background: "#fffbeb", border: "#fcd34d", text: "#92400e", radius: 12 },
  barCounter: { background: "#8a4a1c", border: "#5c2e0e", text: "#fffbeb", radius: 12 },
  poolTable: { background: "#047857", border: "#6b3a14", text: "#fff", radius: 8, borderWidth: 6 },
  darts: { background: "#fff1f2", border: "#fda4af", text: "#9f1239", radius: 999 },
  bowlingLane: { background: "#fdf3d8", border: "#ecc879", text: "#78350f", radius: 6 },
};
const DEFAULT_LOOK: MarkerLook = { background: "#fff", border: "#d6dad4", text: colors.ink, radius: 12 };

const FLOOR = "#f6f5f1";
const DOT = "#d9dbd4";
// Room left around the outermost table or marker when fitting to the layout.
const MARGIN = 36;
// Never blow tables up past this when fitting on big screens.
const MAX_FIT = 1.1;
// Zoom range, relative to the fitted view.
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.4;
// The map is laid out at its most zoomed-in size and shrunk to fit, so text,
// seats and edges stay sharp at every zoom instead of being stretched up.
const SHARP = MAX_ZOOM;
const SPRING = { damping: 22, stiffness: 220, mass: 0.8 };

type Box = { x: number; y: number; width: number; height: number };

// The part of the 1000 × 700 canvas the business actually uses, so a small
// layout fills the screen instead of sitting in a sea of empty floor.
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

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

function openSeats(table: Table) {
  return table.seats.filter((seat) => seat.status === "available").length;
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
  const [mode, setMode] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const bounds = useMemo(() => layoutBounds(tables, markers), [tables, markers]);
  // Fit the used part of the floor to the screen, phone or iPad, portrait or landscape.
  const fit = Math.min(MAX_FIT, width / bounds.width, maxHeight / bounds.height);
  // Points per canvas pixel in the sharp, fully zoomed-in drawing.
  const unit = fit * SHARP;
  const contentWidth = bounds.width * fit;
  const contentHeight = bounds.height * fit;
  const frameHeight = Math.max(200, contentHeight);
  const selected = tables.find((table) => table.id === selectedId) ?? null;
  const empty = tables.length === 0 && markers.length === 0;

  // Zoom and pan, relative to the fitted view and centered on the frame.
  const zoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);

  // Rotating the phone or changing the layout re-fits the map.
  const [fittedTo, setFittedTo] = useState(fit);
  if (fittedTo !== fit) {
    setFittedTo(fit);
    setZoomed(false);
  }
  useEffect(() => {
    zoom.set(withTiming(1));
    panX.set(withTiming(0));
    panY.set(withTiming(0));
  }, [fit, zoom, panX, panY]);

  const frameWidth = width;
  // How far the map may move at a zoom level before its edge leaves the frame.
  const limitX = (scale: number) => {
    "worklet";
    return Math.max(0, (contentWidth * scale - frameWidth) / 2);
  };
  const limitY = (scale: number) => {
    "worklet";
    return Math.max(0, (contentHeight * scale - frameHeight) / 2);
  };

  const zoomTo = useCallback(
    (next: number, focusX = 0, focusY = 0) => {
      "worklet";
      const scale = clamp(next, 1, MAX_ZOOM);
      // Keep the point under the finger (or the center) in place.
      const pointX = (focusX - panX.get()) / zoom.get();
      const pointY = (focusY - panY.get()) / zoom.get();
      zoom.set(withSpring(scale, SPRING));
      panX.set(withSpring(clamp(focusX - pointX * scale, -limitX(scale), limitX(scale)), SPRING));
      panY.set(withSpring(clamp(focusY - pointY * scale, -limitY(scale), limitY(scale)), SPRING));
      runOnJS(setZoomed)(scale > 1.02);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentWidth, contentHeight, frameWidth, frameHeight]
  );

  // Pick the table under a tap, in map coordinates.
  const pickTable = useCallback(
    (x: number, y: number) => {
      const localX = (x - frameWidth / 2 - panX.get()) / zoom.get();
      const localY = (y - frameHeight / 2 - panY.get()) / zoom.get();
      const canvasX = bounds.x + (localX + contentWidth / 2) / fit;
      const canvasY = bounds.y + (localY + contentHeight / 2) / fit;
      // A little slack makes small tables easy to hit with a finger.
      const slack = 14 / (fit * zoom.get());
      let best: { id: string; distance: number } | null = null;
      tables.forEach((table) => {
        const box = tableSize(table.shape, table.seats.length, table.scale, table.rotation);
        const centerX = (table.xPct / 100) * CANVAS_WIDTH;
        const centerY = (table.yPct / 100) * CANVAS_HEIGHT;
        const dx = Math.abs(canvasX - centerX);
        const dy = Math.abs(canvasY - centerY);
        if (dx > box.width / 2 + slack || dy > box.height / 2 + slack) return;
        const distance = dx * dx + dy * dy;
        if (!best || distance < best.distance) best = { id: table.id, distance };
      });
      const hit = best as { id: string } | null;
      if (hit) tap();
      setSelectedId((current) => (hit && hit.id !== current ? hit.id : null));
    },
    [bounds, contentWidth, contentHeight, fit, frameWidth, frameHeight, panX, panY, tables, zoom]
  );

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startZoom.set(zoom.get());
      startX.set(panX.get());
      startY.set(panY.get());
      anchorX.set((event.focalX - frameWidth / 2 - panX.get()) / zoom.get());
      anchorY.set((event.focalY - frameHeight / 2 - panY.get()) / zoom.get());
    })
    .onUpdate((event) => {
      // A little give past the limits, then it springs back on release.
      const scale = clamp(startZoom.get() * event.scale, 0.85, MAX_ZOOM * 1.15);
      zoom.set(scale);
      panX.set(event.focalX - frameWidth / 2 - anchorX.get() * scale);
      panY.set(event.focalY - frameHeight / 2 - anchorY.get() * scale);
    })
    .onEnd(() => {
      const scale = clamp(zoom.get(), 1, MAX_ZOOM);
      zoom.set(withSpring(scale, SPRING));
      panX.set(withSpring(clamp(panX.get(), -limitX(scale), limitX(scale)), SPRING));
      panY.set(withSpring(clamp(panY.get(), -limitY(scale), limitY(scale)), SPRING));
      runOnJS(setZoomed)(scale > 1.02);
    });

  // Dragging only takes over once zoomed in, so the page still scrolls normally.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .minDistance(4)
    .averageTouches(true)
    .onStart(() => {
      startX.set(panX.get());
      startY.set(panY.get());
    })
    .onUpdate((event) => {
      const scale = zoom.get();
      const rubber = (value: number, limit: number) => {
        "worklet";
        if (value > limit) return limit + (value - limit) * 0.3;
        if (value < -limit) return -limit + (value + limit) * 0.3;
        return value;
      };
      panX.set(rubber(startX.get() + event.translationX, limitX(scale)));
      panY.set(rubber(startY.get() + event.translationY, limitY(scale)));
    })
    .onEnd((event) => {
      const scale = zoom.get();
      // Carry a little momentum, then settle inside the map.
      const glideX = startX.get() + event.translationX + event.velocityX * 0.08;
      const glideY = startY.get() + event.translationY + event.velocityY * 0.08;
      panX.set(withSpring(clamp(glideX, -limitX(scale), limitX(scale)), SPRING));
      panY.set(withSpring(clamp(glideY, -limitY(scale), limitY(scale)), SPRING));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((event) => {
      if (zoom.get() > 1.02) {
        zoom.set(withSpring(1, SPRING));
        panX.set(withSpring(0, SPRING));
        panY.set(withSpring(0, SPRING));
        runOnJS(setZoomed)(false);
      } else {
        zoomTo(DOUBLE_TAP_ZOOM, event.x - frameWidth / 2, event.y - frameHeight / 2);
      }
    });

  const singleTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => pickTable(event.x, event.y));

  const gestures = Gesture.Simultaneous(Gesture.Simultaneous(pinch, pan), Gesture.Exclusive(doubleTap, singleTap));

  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.get() }, { translateY: panY.get() }, { scale: zoom.get() / SHARP }],
  }));

  const zoomBy = (factor: number) => {
    tap();
    zoomTo(zoom.get() * factor);
  };
  const fitMap = () => {
    tap();
    zoomTo(1);
  };

  return (
    <View>
      {mode === "map" ? (
        <View style={[styles.frame, { width, height: frameHeight }]}>
          <GestureDetector gesture={gestures}>
            <View style={styles.stage} collapsable={false}>
              <Animated.View style={[{ width: contentWidth * SHARP, height: contentHeight * SHARP }, mapStyle]}>
                <View style={{ width: contentWidth * SHARP, height: contentHeight * SHARP, overflow: "hidden" }}>
                  <View
                    style={{
                      position: "absolute",
                      left: -bounds.x * unit,
                      top: -bounds.y * unit,
                      width: CANVAS_WIDTH * unit,
                      height: CANVAS_HEIGHT * unit,
                      backgroundColor: FLOOR,
                    }}
                  >
                    <DotGrid unit={unit} />

                    {markers.map((marker) => (
                      <Marker key={marker.id} marker={marker} unit={unit} />
                    ))}

                    {tables.map((table) => {
                      const box = tableSize(table.shape, table.seats.length, table.scale, table.rotation);
                      return (
                        <View
                          key={table.id}
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            left: ((table.xPct / 100) * CANVAS_WIDTH - box.width / 2) * unit,
                            top: ((table.yPct / 100) * CANVAS_HEIGHT - box.height / 2) * unit,
                            width: box.width * unit,
                            height: box.height * unit,
                            zIndex: 20,
                          }}
                        >
                          <TableWithSeats
                            name={table.name}
                            shape={table.shape}
                            seats={table.seats}
                            scale={table.scale}
                            rotation={table.rotation}
                            selected={table.id === selectedId}
                            magnify={unit}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            </View>
          </GestureDetector>

          {empty && (
            <View style={styles.empty} pointerEvents="none">
              <FloorPlanIcon size={28} color={colors.faint} />
              <Text style={styles.emptyTitle}>No seating layout yet</Text>
              <Text style={styles.emptyText}>This business hasn&apos;t published its floor plan.</Text>
            </View>
          )}

          {selected && (
            <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(150)} style={styles.card}>
              <SwipeAway onDismiss={() => setSelectedId(null)}>
                <TableCard table={selected} onClose={() => setSelectedId(null)} />
              </SwipeAway>
            </Animated.View>
          )}
        </View>
      ) : (
        <TableList tables={tables} width={width} />
      )}

      {!empty && (
        <View style={styles.toolbar}>
          {tables.length > 0 ? (
            <View style={styles.modes} accessibilityRole="tablist">
              <ModeButton label="Map" active={mode === "map"} onPress={() => setMode("map")} icon={<FloorPlanIcon size={16} color={colors.ink} />} />
              <ModeButton label="List" active={mode === "list"} onPress={() => setMode("list")} icon={<ListIcon size={16} color={colors.ink} />} />
            </View>
          ) : (
            <View />
          )}
          {mode === "map" && (
            <View style={styles.controls}>
              {zoomed && <MapButton label="Show the whole room" onPress={fitMap} icon={<FitIcon size={16} color={colors.ink} />} />}
              <MapButton label="Zoom out" onPress={() => zoomBy(1 / 1.6)} icon={<MinusIcon size={18} color={colors.ink} />} />
              <MapButton label="Zoom in" onPress={() => zoomBy(1.6)} icon={<PlusIcon size={18} color={colors.ink} />} />
            </View>
          )}
        </View>
      )}

      <View style={styles.legend}>
        <LegendDot color={SEAT_OPEN} label="Open" />
        <LegendDot color={SEAT_TAKEN} label="Taken" />
        {mode === "map" && !empty && <Text style={styles.hint}>Pinch to zoom, tap a table</Text>}
      </View>
    </View>
  );
}

// Lets the table card be flicked down to close; it follows the finger and
// springs back if the swipe is too short.
function SwipeAway({ onDismiss, children }: { onDismiss: () => void; children: ReactNode }) {
  const drag = useSharedValue(0);
  const swipe = Gesture.Pan()
    .activeOffsetY(6)
    .failOffsetX([-12, 12])
    .onUpdate((event) => {
      drag.set(event.translationY > 0 ? event.translationY : event.translationY * 0.2);
    })
    .onEnd((event) => {
      if (event.translationY > 50 || event.velocityY > 600) {
        drag.set(withTiming(220, { duration: 160 }));
        runOnJS(onDismiss)();
      } else {
        drag.set(withSpring(0, SPRING));
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

function TableCard({ table, onClose }: { table: Table; onClose: () => void }) {
  const open = openSeats(table);
  const total = table.seats.length;
  return (
    <View style={styles.cardInner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {table.name}
        </Text>
        <Text style={[styles.cardText, { color: open > 0 ? colors.greenText : colors.redText }]}>
          {open === 0 ? "All seats taken" : `${open} of ${total} ${total === 1 ? "seat" : "seats"} open`}
        </Text>
        <SeatDots table={table} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={10}
        onPress={onClose}
        style={({ pressed }) => [styles.cardClose, pressed && { transform: [{ scale: 0.92 }] }]}
      >
        <CloseIcon size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function SeatDots({ table }: { table: Table }) {
  return (
    <View style={styles.seatDots}>
      {table.seats.map((seat) => (
        <View
          key={seat.id}
          style={[styles.seatDot, { backgroundColor: seat.status === "available" ? SEAT_OPEN : SEAT_TAKEN }]}
        />
      ))}
    </View>
  );
}

// The same tables as rows: easier with a screen reader or in a very big room.
function TableList({ tables, width }: { tables: Table[]; width: number }) {
  const sorted = useMemo(
    () =>
      [...tables].sort(
        (a, b) => openSeats(b) - openSeats(a) || a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
    [tables]
  );
  return (
    <View style={[styles.list, { width }]}>
      {sorted.map((table, index) => {
        const open = openSeats(table);
        return (
          <View
            key={table.id}
            style={[styles.row, index > 0 && styles.rowBorder]}
            accessibilityLabel={`${table.name}: ${open} of ${table.seats.length} seats open`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {table.name}
              </Text>
              <SeatDots table={table} />
            </View>
            <Text style={[styles.rowCount, { color: open > 0 ? colors.greenText : colors.faint }]}>
              {open > 0 ? `${open} open` : "Full"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Marker({ marker, unit }: { marker: FloorMarker; unit: number }) {
  const info = MARKERS[marker.type];
  const look = MARKER_LOOKS[marker.type] ?? DEFAULT_LOOK;
  const width = info.width * marker.scale * unit;
  const height = info.height * marker.scale * unit;
  const game = isGameMarker(marker.type);

  return (
    <View
      pointerEvents="none"
      accessibilityLabel={game ? `${marker.label}: ${marker.status === "occupied" ? "in use" : "open"}` : marker.label}
      style={[
        styles.marker,
        {
          left: (marker.xPct / 100) * CANVAS_WIDTH * unit - width / 2,
          top: (marker.yPct / 100) * CANVAS_HEIGHT * unit - height / 2,
          width,
          height,
          backgroundColor: look.background,
          borderColor: look.border,
          borderWidth: (look.borderWidth ?? 1) * unit,
          borderRadius: Math.min((look.radius ?? 0) * unit, Math.min(width, height) / 2),
          transform: [{ rotate: `${marker.rotation}deg` }],
        },
      ]}
    >
      {marker.type !== "wall" && (
        <View style={{ transform: [{ rotate: `${-marker.rotation}deg` }], alignItems: "center" }}>
          <MarkerIcon type={marker.type} size={Math.max(12, 17 * marker.scale) * unit} color={look.text} />
          {marker.scale >= 0.75 && (
            <Text numberOfLines={1} style={{ fontSize: Math.max(9, 11 * marker.scale) * unit, fontWeight: "700", color: look.text }}>
              {marker.label}
            </Text>
          )}
          {game && (
            <Text
              style={[
                styles.game,
                {
                  backgroundColor: marker.status === "occupied" ? SEAT_TAKEN : SEAT_OPEN,
                  marginTop: 3 * unit,
                  paddingHorizontal: 7 * unit,
                  paddingVertical: unit,
                  fontSize: 10 * unit,
                },
              ]}
            >
              {marker.status === "occupied" ? "In use" : "Open"}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function MapButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.mapButton, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      {icon}
    </Pressable>
  );
}

function ModeButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.mode, active && styles.modeActive, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      {icon}
      <Text style={styles.modeText}>{label}</Text>
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

// A faint dotted floor, drawn once as a pattern instead of hundreds of views.
// It is drawn at half the sharp size to keep its memory small; the dots are
// faint enough that it doesn't show.
function DotGrid({ unit }: { unit: number }) {
  const id = `dots${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const half = unit / 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CANVAS_WIDTH * half,
        height: CANVAS_HEIGHT * half,
        transform: [{ scale: 2 }],
        transformOrigin: "top left",
      }}
    >
      <Svg width={CANVAS_WIDTH * half} height={CANVAS_HEIGHT * half} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
        <Defs>
          <Pattern id={id} width={25} height={25} patternUnits="userSpaceOnUse">
            <Circle cx={12.5} cy={12.5} r={1.6} fill={DOT} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: FLOOR,
    borderColor: "#e4e3dc",
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: 4 },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: "center" },
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
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  controls: { flexDirection: "row", gap: 8 },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  card: { position: "absolute", left: 12, right: 12, bottom: 12 },
  cardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: "#101811",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  cardText: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  cardClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  seatDots: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  seatDot: { width: 12, height: 12, borderRadius: 6 },
  list: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  rowCount: { fontSize: 15, fontWeight: "800" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center", marginTop: 12, paddingLeft: 4 },
  legendText: { fontSize: 15, fontWeight: "700", color: colors.muted },
  modes: { flexDirection: "row", backgroundColor: colors.chip, borderRadius: 12, padding: 3 },
  mode: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 9 },
  modeActive: {
    backgroundColor: "#fff",
    shadowColor: "#101811",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  modeText: { fontSize: 14, fontWeight: "800", color: colors.ink },
  hint: { flex: 1, textAlign: "right", fontSize: 13, color: colors.faint },
});
