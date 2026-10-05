import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  type LucideIcon,
} from "lucide-react-native";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  clamp,
  isBar,
  isBarbershop,
  isBowlingAlley,
  isGameMarker,
  markerAllowed,
  MARKERS,
  type FloorMarker,
  type MarkerType,
} from "@seatmate/shared/floor-plan";
import { isSingleSeat, type TableShape } from "@seatmate/shared/table-geometry";

import FloorCanvas, { type Selection } from "@/components/floor-canvas";
import WrongAccount from "@/components/gate";
import { MarkerIcon } from "@/components/icons";
import LiveSeats, { ZoomControls } from "@/components/live-seats";
import TableWithSeats from "@/components/table-with-seats";
import UpdateReminder from "@/components/update-reminder";
import { Banner, Button, Card, colors, Loading, Muted, PressableScale, Screen, Segmented } from "@/components/ui";
import { db } from "@/lib/firebase";
import { CANVAS_HEIGHT, CANVAS_WIDTH, toggleGame, watchMarkers, watchTables, type Table } from "@/lib/floor";
import { fitScale, useBox, useWide } from "@/lib/layout";
import { tap, warning } from "@/lib/haptics";
import { useOptimisticSeats } from "@/lib/optimistic-seats";
import { useOwner, type Business } from "@/lib/session";

type Mode = "seats" | "layout";

// Same limits as the web editor, so a layout made here looks the same there.
const TABLE_SCALE = [0.65, 1.8] as const;
const MARKER_SCALE = [0.5, 2.5] as const;
const MAX_SEATS = 12;

// One grid square of the 1000 × 700 floor (32 px), in percent.
const GRID_X = (32 / CANVAS_WIDTH) * 100;
const GRID_Y = (32 / CANVAS_HEIGHT) * 100;
const snapTo = (value: number, step: number) => Math.round(value / step) * step;

const SHAPE_NAMES: Record<TableShape, string> = {
  rectangle: "Table",
  round: "Round table",
  stool: "Bar stool",
  barberChair: "Barber chair",
};

type Preset = { key: string; label: string; shape: TableShape; seats: number };

// What the "Add" panel offers, tuned to the kind of business.
const presetsFor = (type: string): Preset[] => [
  ...(isBarbershop(type) ? [{ key: "chair", label: "Barber chair", shape: "barberChair" as const, seats: 1 }] : []),
  { key: "r2", label: "Table for 2", shape: "rectangle", seats: 2 },
  { key: "r4", label: "Table for 4", shape: "rectangle", seats: 4 },
  { key: "r6", label: "Table for 6", shape: "rectangle", seats: 6 },
  { key: "o4", label: "Round for 4", shape: "round", seats: 4 },
  { key: "o6", label: "Round for 6", shape: "round", seats: 6 },
  { key: "o8", label: "Round for 8", shape: "round", seats: 8 },
  { key: "stool", label: "Bar stool", shape: "stool", seats: 1 },
];

// The owner's floor plan. "Live seats" is for tapping seats open/taken;
// "Edit layout" is the full editor: add, drag, resize, rotate, rename,
// duplicate and delete tables, stools, chairs and markers. Staff never see
// this screen (they get the staff console, which only toggles seats).
// Everything saves straight to the same Firestore documents the website's
// floor-plan editor uses.
export default function FloorPlanScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;
  const wide = useWide();

  const [liveTables, setTables] = useState<Table[] | null>(null);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);
  const [mode, setMode] = useState<Mode>("seats");
  const [selection, setSelection] = useState<Selection>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [box, onLayout] = useBox();
  // Seat taps in "Live seats" show at once; the snapshot catches up behind.
  const { tables, toggleSeat } = useOptimisticSeats(businessId, liveTables, setMessage);

  useEffect(() => {
    if (!businessId) return;

    const stopTables = watchTables(
      businessId,
      (loaded) => {
        setTables(loaded);
        // A brand-new floor plan starts in the editor.
        setMode((current) => (loaded.length === 0 ? "layout" : current));
      },
      (error) => {
        console.error(error);
        setMessage("Could not load floor plan.");
        setTables([]);
      }
    );
    const stopMarkers = watchMarkers(businessId, setMarkers, (error) => console.error(error));

    return () => {
      stopTables();
      stopMarkers();
    };
  }, [businessId]);

  if (!owner) return <WrongAccount />;
  if (!tables) return <Loading label="Loading floor plan…" />;

  const { business } = owner;
  const tableRef = (id: string) => doc(db, "businesses", business.id, "tables", id);
  const markerRef = (id: string) => doc(db, "businesses", business.id, "floorMarkers", id);

  // Edits are small and saved straight away; errors show a message.
  const save = async (work: () => Promise<unknown>, failure: string) => {
    try {
      setMessage("");
      await work();
    } catch (error) {
      console.error(error);
      warning();
      setMessage(failure);
    }
  };

  const selectedTable = selection?.kind === "table" ? tables.find((table) => table.id === selection.id) : undefined;
  const selectedMarker =
    selection?.kind === "marker" ? markers.find((marker) => marker.id === selection.id) : undefined;

  const place = (x: number, y: number, bounds: [number, number, number, number]) => ({
    xPct: clamp(snap ? snapTo(x, GRID_X) : x, bounds[0], bounds[1]),
    yPct: clamp(snap ? snapTo(y, GRID_Y) : y, bounds[2], bounds[3]),
  });

  // The arrow buttons move one grid square with snapping on, else a little.
  const stepX = snap ? GRID_X : 1;
  const stepY = snap ? GRID_Y : 1;

  const updateTable = (id: string, fields: Record<string, unknown>, failure: string) =>
    void save(() => updateDoc(tableRef(id), { ...fields, updatedAt: serverTimestamp() }), failure);
  const updateMarker = (id: string, fields: Record<string, unknown>, failure: string) =>
    void save(() => updateDoc(markerRef(id), { ...fields, updatedAt: serverTimestamp() }), failure);

  const addTable = (preset: Preset) =>
    void save(async () => {
      const single = isSingleSeat(preset.shape);
      const sameKind = tables.filter((table) => table.shape === preset.shape);
      const index = tables.filter((table) => !isSingleSeat(table.shape)).length;
      const chair = preset.shape === "barberChair";

      // Same placement as the web editor: stools and chairs line up to the
      // right of the rightmost one of their kind; tables fill a 3 × 3 grid.
      const last = sameKind.filter((table) => table.yPct <= 100).sort((a, b) => a.xPct - b.xPct).at(-1);
      const position = single
        ? last
          ? { xPct: clamp(last.xPct + (chair ? 9 : 6), 4, 96), yPct: last.yPct }
          : { xPct: chair ? 20 : 50, yPct: chair ? 50 : 85 }
        : { xPct: 18 + (index % 3) * 31, yPct: 22 + (Math.floor(index / 3) % 3) * 28 };

      const created = await addDoc(collection(db, "businesses", business.id, "tables"), {
        name:
          preset.shape === "stool" ? `Stool ${sameKind.length + 1}` : chair ? `Chair ${sameKind.length + 1}` : `Table ${index + 1}`,
        seats: Array.from({ length: preset.seats }, (_, i) => ({ id: i + 1, status: "available" })),
        shape: preset.shape,
        ...position,
        rotation: 0,
        scale: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelection({ kind: "table", id: created.id });
    }, "Could not add that.");

  const addMarker = (type: MarkerType) =>
    void save(async () => {
      const count = markers.length;
      const created = await addDoc(collection(db, "businesses", business.id, "floorMarkers"), {
        type,
        label: MARKERS[type].label,
        xPct: 14 + (count % 5) * 17,
        yPct: 84 - (Math.floor(count / 5) % 6) * 10,
        scale: 1,
        rotation: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelection({ kind: "marker", id: created.id });
    }, "Could not add that marker.");

  const duplicateTable = (table: Table) =>
    void save(async () => {
      const created = await addDoc(collection(db, "businesses", business.id, "tables"), {
        name: `${table.name} copy`,
        seats: table.seats.map((seat) => ({ id: seat.id, status: "available" })),
        shape: table.shape,
        rotation: table.rotation,
        scale: table.scale,
        ...place(table.xPct + 6, table.yPct + 6, [5, 95, 7, 93]),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelection({ kind: "table", id: created.id });
    }, "Could not duplicate that.");

  const duplicateMarker = (marker: FloorMarker) =>
    void save(async () => {
      const created = await addDoc(collection(db, "businesses", business.id, "floorMarkers"), {
        type: marker.type,
        label: marker.label,
        rotation: marker.rotation,
        scale: marker.scale,
        ...place(marker.xPct + 6, marker.yPct + 6, [2, 98, 3, 97]),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelection({ kind: "marker", id: created.id });
    }, "Could not duplicate that marker.");

  const submitForApproval = async () => {
    if (tables.length === 0) {
      setMessage("Add at least one table before submitting your business.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      await updateDoc(doc(db, "businesses", business.id), {
        status: "pending",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      setMessage("Could not submit your business for approval.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = business.status === "draft" || business.status === "rejected";

  const modeSwitch = (
    <Segmented
      options={[
        { value: "seats", label: "Live seats" },
        { value: "layout", label: "Edit layout" },
      ]}
      value={mode}
      onChange={(value: Mode) => {
        setMode(value);
        setSelection(null);
      }}
    />
  );

  const notices = (
    <>
      {message ? <Banner tone="error">{message}</Banner> : null}
      {canSubmit && (
        <Card style={{ marginTop: wide ? 0 : 16 }}>
          <Text style={styles.cardTitle}>
            {business.status === "rejected" ? "Update and resubmit your business" : "Ready to go live?"}
          </Text>
          <Muted style={{ marginTop: 4 }}>
            Add your tables, then submit your business. SeatMate reviews it before customers can see it.
          </Muted>
          <Button
            title={business.status === "rejected" ? "Resubmit for approval" : "Submit for approval"}
            variant="green"
            onPress={submitForApproval}
            busy={submitting}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}
      {business.status === "pending" && (
        <Banner tone="warning">Your business has been submitted and is waiting for review.</Banner>
      )}
    </>
  );

  // ---------------- Live seats ----------------
  if (mode === "seats") {
    const live = (
      <LiveSeats
        tables={tables}
        markers={markers}
        onSeatPress={(tableId, seatId) => {
          setMessage("");
          toggleSeat(tableId, seatId, "Could not update seat.");
        }}
        onGamePress={(marker) => {
          tap();
          void save(() => toggleGame(business.id, marker), "Could not update that game.");
        }}
        header={wide ? <View style={{ width: 280 }}>{modeSwitch}</View> : undefined}
        aside={
          <>
            {notices}
            <UpdateReminder businessId={business.id} tables={tables} />
          </>
        }
      />
    );

    return wide ? (
      <Screen scroll={false}>{live}</Screen>
    ) : (
      <Screen>
        {modeSwitch}
        <View style={{ marginTop: 16 }}>{live}</View>
      </Screen>
    );
  }

  // ---------------- Edit layout ----------------
  const canvas = (
    <FloorCanvas
      tables={tables}
      markers={markers}
      mode="layout"
      scale={fitScale(wide ? box : box ? { width: box.width } : null) * zoom}
      selection={selection}
      onSelect={setSelection}
      fill={wide}
      onMoveTable={(id, x, y) => updateTable(id, place(x, y, [5, 95, 7, 93]), "Could not move that.")}
      onMoveMarker={(id, x, y) => updateMarker(id, place(x, y, [2, 98, 3, 97]), "Could not move that marker.")}
    />
  );

  const snapSwitch = (
    <View style={styles.snap}>
      <Text style={{ fontWeight: "700", color: colors.ink }}>Snap to grid</Text>
      <Switch value={snap} onValueChange={setSnap} trackColor={{ true: "#10b981", false: "#d1d5db" }} />
    </View>
  );

  const panel = selectedTable ? (
    <TableInspector
      key={selectedTable.id}
      table={selectedTable}
      onUpdate={(fields, failure) => updateTable(selectedTable.id, fields, failure)}
      onNudge={(dx, dy) =>
        updateTable(
          selectedTable.id,
          place(selectedTable.xPct + dx * stepX, selectedTable.yPct + dy * stepY, [5, 95, 7, 93]),
          "Could not move that."
        )
      }
      onDuplicate={() => duplicateTable(selectedTable)}
      onDelete={() =>
        void save(async () => {
          await deleteDoc(tableRef(selectedTable.id));
          setSelection(null);
        }, "Could not delete that.")
      }
      onDone={() => setSelection(null)}
      onMessage={setMessage}
    />
  ) : selectedMarker ? (
    <MarkerInspector
      key={selectedMarker.id}
      marker={selectedMarker}
      onUpdate={(fields) => updateMarker(selectedMarker.id, fields, "Could not update that marker.")}
      onNudge={(dx, dy) =>
        updateMarker(
          selectedMarker.id,
          place(selectedMarker.xPct + dx * stepX, selectedMarker.yPct + dy * stepY, [2, 98, 3, 97]),
          "Could not move that marker."
        )
      }
      onDuplicate={() => duplicateMarker(selectedMarker)}
      onDelete={() =>
        void save(async () => {
          await deleteDoc(markerRef(selectedMarker.id));
          setSelection(null);
        }, "Could not delete that marker.")
      }
      onDone={() => setSelection(null)}
    />
  ) : (
    <AddPanel business={business} onAddTable={addTable} onAddMarker={addMarker} />
  );

  if (wide) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, flexDirection: "row", gap: 18 }}>
          <View style={{ flex: 1 }}>
            <View style={styles.toolbar}>
              <View style={{ width: 280 }}>{modeSwitch}</View>
              <Muted style={{ flex: 1, fontSize: 14 }}>Drag anything to move it. Tap it to change it.</Muted>
              {snapSwitch}
              <ZoomControls zoom={zoom} onZoom={setZoom} />
            </View>
            <View style={{ flex: 1, justifyContent: "center" }} onLayout={onLayout}>
              {canvas}
            </View>
          </View>
          <ScrollView
            style={{ width: 340, flexGrow: 0 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {notices}
            {panel}
          </ScrollView>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {modeSwitch}
      {notices}
      <View style={{ marginTop: 16 }} onLayout={onLayout}>
        <Muted style={{ marginBottom: 8 }}>Drag anything to move it. Tap it to change it.</Muted>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {snapSwitch}
          <ZoomControls zoom={zoom} onZoom={setZoom} />
        </View>
        {canvas}
        <View style={{ marginTop: 16 }}>{panel}</View>
      </View>
    </Screen>
  );
}

// ---------------- Add panel ----------------

function AddPanel({
  business,
  onAddTable,
  onAddMarker,
}: {
  business: Business;
  onAddTable: (preset: Preset) => void;
  onAddMarker: (type: MarkerType) => void;
}) {
  const presets = presetsFor(business.type);
  const markerTypes = (Object.keys(MARKERS) as MarkerType[]).filter((type) => markerAllowed(type, business.type));
  // Games first for the places that have them.
  const games = markerTypes.filter(isGameMarker);
  const others = markerTypes.filter((type) => !isGameMarker(type));

  return (
    <>
      <Card>
        <Text style={styles.cardTitle}>{isBarbershop(business.type) ? "Add chairs and seating" : "Add seating"}</Text>
        <Muted style={{ marginTop: 4, fontSize: 14 }}>Tap to add. You can rename and resize it next.</Muted>
        <View style={styles.tiles}>
          {presets.map((preset) => (
            <PressableScale
              key={preset.key}
              accessibilityLabel={`Add ${preset.label}`}
              haptic
              onPress={() => onAddTable(preset)}
              style={styles.tile}
            >
              <View style={styles.tilePreview} pointerEvents="none">
                <TableWithSeats
                  name=""
                  shape={preset.shape}
                  seats={Array.from({ length: preset.seats }, (_, i) => ({ id: i + 1, status: "available" as const }))}
                  scale={preset.shape === "barberChair" || preset.shape === "stool" ? 0.9 : 0.42}
                  preview
                />
              </View>
              <Text style={styles.tileLabel}>{preset.label}</Text>
            </PressableScale>
          ))}
        </View>
      </Card>

      {games.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>
            {isBowlingAlley(business.type) ? "Lanes and games" : isBar(business.type) ? "Games" : "Games"}
          </Text>
          <Muted style={{ marginTop: 4, fontSize: 14 }}>Staff can mark these in use, like a seat.</Muted>
          <MarkerChips types={games} onAdd={onAddMarker} />
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>Room details</Text>
        <Muted style={{ marginTop: 4, fontSize: 14 }}>Help customers find outlets, windows, the counter and more.</Muted>
        <MarkerChips types={others} onAdd={onAddMarker} />
      </Card>
    </>
  );
}

function MarkerChips({ types, onAdd }: { types: MarkerType[]; onAdd: (type: MarkerType) => void }) {
  return (
    <View style={styles.chips}>
      {types.map((type) => (
        <PressableScale
          key={type}
          accessibilityLabel={`Add ${MARKERS[type].label}`}
          haptic
          onPress={() => onAdd(type)}
          style={styles.chip}
        >
          <MarkerIcon type={type} size={16} color={colors.ink} />
          <Text style={{ fontWeight: "700", color: colors.ink, fontSize: 15 }}>
            {type === "wall" ? "Wall / divider" : MARKERS[type].label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

// ---------------- Inspectors ----------------

function TableInspector({
  table,
  onUpdate,
  onNudge,
  onDuplicate,
  onDelete,
  onDone,
  onMessage,
}: {
  table: Table;
  onUpdate: (fields: Record<string, unknown>, failure: string) => void;
  onNudge: (dx: number, dy: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDone: () => void;
  onMessage: (message: string) => void;
}) {
  const single = isSingleSeat(table.shape);
  const open = table.seats.filter((seat) => seat.status === "available").length;

  const setSeats = (count: number) => {
    if (count > MAX_SEATS) return onMessage(`A table can have at most ${MAX_SEATS} seats.`);
    if (count < 1) return onMessage("A table must have at least one seat.");

    if (count > table.seats.length) {
      const nextId = table.seats.length === 0 ? 1 : Math.max(...table.seats.map((seat) => seat.id)) + 1;
      onUpdate({ seats: [...table.seats, { id: nextId, status: "available" }] }, "Could not add a seat.");
    } else {
      onUpdate({ seats: table.seats.slice(0, -1) }, "Could not remove a seat.");
    }
  };

  return (
    <Inspector
      kind={SHAPE_NAMES[table.shape]}
      subtitle={single ? (open ? "Open" : "Taken") : `${table.seats.length} seats · ${open} open`}
      name={table.name}
      onRename={(name) => onUpdate({ name }, "Could not rename that.")}
      onNudge={onNudge}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onDone={onDone}
    >
      {!single && (
        <Row label="Seats">
          <Stepper value={table.seats.length} onChange={setSeats} min={1} max={MAX_SEATS} />
        </Row>
      )}

      <Row label="Size">
        <Stepper
          value={Math.round(table.scale * 100)}
          format={(value) => `${value}%`}
          onChange={(value) =>
            onUpdate(
              { scale: clamp(Number((value > table.scale * 100 ? table.scale + 0.1 : table.scale - 0.1).toFixed(2)), ...TABLE_SCALE) },
              "Could not resize that."
            )
          }
          min={Math.round(TABLE_SCALE[0] * 100)}
          max={Math.round(TABLE_SCALE[1] * 100)}
        />
      </Row>

      {!single && (
        <>
          <Row label="Shape">
            <View style={{ width: 190 }}>
              <Segmented
                options={[
                  { value: "rectangle", label: "Square" },
                  { value: "round", label: "Round" },
                ]}
                value={table.shape}
                onChange={(shape) => shape !== table.shape && onUpdate({ shape }, "Could not change the shape.")}
              />
            </View>
          </Row>
          <Row label="Turn">
            <View style={{ width: 190 }}>
              <Segmented
                options={[
                  { value: 0, label: "Wide" },
                  { value: 90, label: "Tall" },
                ]}
                value={table.rotation}
                onChange={(rotation) =>
                  rotation !== table.rotation && onUpdate({ rotation }, "Could not turn that.")
                }
              />
            </View>
          </Row>
        </>
      )}
    </Inspector>
  );
}

function MarkerInspector({
  marker,
  onUpdate,
  onNudge,
  onDuplicate,
  onDelete,
  onDone,
}: {
  marker: FloorMarker;
  onUpdate: (fields: Record<string, unknown>) => void;
  onNudge: (dx: number, dy: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const rotate = (by: number) => onUpdate({ rotation: (((marker.rotation + by) % 360) + 360) % 360 });

  return (
    <Inspector
      kind={MARKERS[marker.type].label}
      subtitle={isGameMarker(marker.type) ? (marker.status === "occupied" ? "In use" : "Open") : "Room detail"}
      name={marker.label}
      onRename={(label) => onUpdate({ label })}
      onNudge={onNudge}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onDone={onDone}
    >
      <Row label="Size">
        <Stepper
          value={Math.round(marker.scale * 100)}
          format={(value) => `${value}%`}
          onChange={(value) =>
            onUpdate({
              scale: clamp(
                Number((value > marker.scale * 100 ? marker.scale + 0.1 : marker.scale - 0.1).toFixed(2)),
                ...MARKER_SCALE
              ),
            })
          }
          min={Math.round(MARKER_SCALE[0] * 100)}
          max={Math.round(MARKER_SCALE[1] * 100)}
        />
      </Row>
      <Row label="Rotate">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <StepButton icon={RotateCcw} accessibilityLabel="Rotate left" onPress={() => rotate(-45)} />
          <Text style={styles.stepValue}>{marker.rotation}°</Text>
          <StepButton icon={RotateCw} accessibilityLabel="Rotate right" onPress={() => rotate(45)} />
        </View>
      </Row>
    </Inspector>
  );
}

// The shared frame of both inspectors: name, extra rows, arrow pad, actions.
// onNudge gets a direction (-1, 0 or 1 on each axis).
function Inspector({
  kind,
  subtitle,
  name,
  onRename,
  onNudge,
  onDuplicate,
  onDelete,
  onDone,
  children,
}: {
  kind: string;
  subtitle: string;
  name: string;
  onRename: (name: string) => void;
  onNudge: (dx: number, dy: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rename = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{kind.toUpperCase()}</Text>
          <Muted style={{ fontSize: 14, marginTop: 2 }}>{subtitle}</Muted>
        </View>
        <PressableScale onPress={onDone} style={styles.done}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>Done</Text>
        </PressableScale>
      </View>

      <Text style={[styles.rowLabel, { marginTop: 14, marginBottom: 6 }]}>Name</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={rename}
        onSubmitEditing={rename}
        returnKeyType="done"
        placeholder="Name"
        placeholderTextColor={colors.faint}
        style={styles.input}
      />

      {children}

      <Row label="Move">
        <View style={styles.pad}>
          <StepButton icon={ArrowLeft} accessibilityLabel="Move left" onPress={() => onNudge(-1, 0)} />
          <View style={{ gap: 6 }}>
            <StepButton icon={ArrowUp} accessibilityLabel="Move up" onPress={() => onNudge(0, -1)} />
            <StepButton icon={ArrowDown} accessibilityLabel="Move down" onPress={() => onNudge(0, 1)} />
          </View>
          <StepButton icon={ArrowRight} accessibilityLabel="Move right" onPress={() => onNudge(1, 0)} />
        </View>
      </Row>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <Button title="Duplicate" variant="secondary" onPress={onDuplicate} style={{ flex: 1 }} />
        <Button
          title={confirmDelete ? "Tap to delete" : "Delete"}
          variant="danger"
          onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          style={[{ flex: 1 }, confirmDelete && { backgroundColor: colors.redSoft }]}
        />
      </View>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  format = String,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  format?: (value: number) => string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <StepButton icon={Minus} accessibilityLabel="Decrease" onPress={() => onChange(value - 1)} disabled={value <= min} />
      <Text style={styles.stepValue}>{format(value)}</Text>
      <StepButton icon={Plus} accessibilityLabel="Increase" onPress={() => onChange(value + 1)} disabled={value >= max} />
    </View>
  );
}

function StepButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  icon: LucideIcon;
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
      style={[styles.stepButton, disabled && { opacity: 0.35 }]}
    >
      <Icon size={20} color={colors.ink} strokeWidth={2.2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: colors.greenText },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, minHeight: 44 },
  snap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  tile: {
    width: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tilePreview: { height: 64, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 12, fontWeight: "700", color: colors.ink, marginTop: 6, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  done: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 12 },
  rowLabel: { fontWeight: "700", color: colors.ink, fontSize: 15 },
  stepValue: { minWidth: 52, textAlign: "center", fontWeight: "800", fontSize: 16, color: colors.ink },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  pad: { flexDirection: "row", alignItems: "center", gap: 6 },
});
