import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
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
  BAR_ONLY_MARKERS,
  clamp,
  isBar,
  MARKERS,
  type FloorMarker,
  type MarkerType,
} from "@seatmate/shared/floor-plan";
import type { TableShape } from "@seatmate/shared/table-geometry";

import FloorCanvas, { type Selection } from "@/components/floor-canvas";
import WrongAccount from "@/components/gate";
import LiveSeats, { fitScale, ZoomControls } from "@/components/live-seats";
import UpdateReminder from "@/components/update-reminder";
import { Banner, Button, Card, colors, Loading, Muted, Screen, Segmented } from "@/components/ui";
import { db } from "@/lib/firebase";
import { watchMarkers, watchTables, type Table } from "@/lib/floor";
import { toggleSeat } from "@/lib/seat-updates";
import { useOwner } from "@/lib/session";

type Mode = "seats" | "layout";

const SHAPES: { value: TableShape; label: string }[] = [
  { value: "rectangle", label: "Rectangle" },
  { value: "round", label: "Round" },
  { value: "stool", label: "Bar stool" },
];

export default function FloorPlanScreen() {
  const owner = useOwner();
  const businessId = owner?.business.id;
  const { width } = useWindowDimensions();

  const [tables, setTables] = useState<Table[] | null>(null);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);
  const [mode, setMode] = useState<Mode>("seats");
  const [selection, setSelection] = useState<Selection>(null);
  const [zoom, setZoom] = useState(1);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  if (!owner) {
    return <WrongAccount />;
  }

  if (!tables) {
    return <Loading label="Loading floor plan…" />;
  }

  const { business } = owner;
  const tableRef = (id: string) => doc(db, "businesses", business.id, "tables", id);
  const markerRef = (id: string) => doc(db, "businesses", business.id, "floorMarkers", id);

  // Layout edits are small and saved straight away; errors show a message.
  const save = async (work: () => Promise<unknown>, failure: string) => {
    try {
      setMessage("");
      await work();
    } catch (error) {
      console.error(error);
      setMessage(failure);
    }
  };

  const selectedTable = selection?.kind === "table" ? tables.find((table) => table.id === selection.id) : undefined;
  const selectedMarker =
    selection?.kind === "marker" ? markers.find((marker) => marker.id === selection.id) : undefined;

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

  return (
    <Screen>
      <Segmented
        options={[
          { value: "seats", label: "Live seats" },
          { value: "layout", label: "Edit layout" },
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setSelection(null);
        }}
      />

      {message ? <Banner tone="error">{message}</Banner> : null}

      {canSubmit && (
        <Card style={{ marginTop: 16 }}>
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

      <View style={{ marginTop: 16 }}>
        {mode === "seats" ? (
          <>
            <UpdateReminder businessId={business.id} tables={tables} />
            <LiveSeats
              tables={tables}
              markers={markers}
              onSeatPress={(tableId, seatId) =>
                void save(() => toggleSeat(business.id, tableId, seatId, tables), "Could not update seat.")
              }
            />
          </>
        ) : (
          <>
            <AddTable
              tables={tables}
              onAdd={async (fields) => {
                await save(async () => {
                  const created = await addDoc(collection(db, "businesses", business.id, "tables"), {
                    ...fields,
                    rotation: 0,
                    scale: 1,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  setSelection({ kind: "table", id: created.id });
                }, "Could not create table.");
              }}
            />

            <AddMarker
              markerCount={markers.length}
              bar={isBar(business.type)}
              onAdd={async (fields) => {
                await save(async () => {
                  const created = await addDoc(collection(db, "businesses", business.id, "floorMarkers"), {
                    ...fields,
                    scale: 1,
                    rotation: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  setSelection({ kind: "marker", id: created.id });
                }, "Could not add marker.");
              }}
            />

            <Muted style={{ marginTop: 16, marginBottom: 8 }}>
              Tap a table or marker to edit it. Drag it to move it.
            </Muted>
            <ZoomControls zoom={zoom} onZoom={setZoom} />
            <FloorCanvas
              tables={tables}
              markers={markers}
              mode="layout"
              scale={fitScale(width) * zoom}
              selection={selection}
              onSelect={setSelection}
              onMoveTable={(id, xPct, yPct) =>
                void save(
                  () => updateDoc(tableRef(id), { xPct, yPct, updatedAt: serverTimestamp() }),
                  "Could not move table."
                )
              }
              onMoveMarker={(id, xPct, yPct) =>
                void save(
                  () => updateDoc(markerRef(id), { xPct, yPct, updatedAt: serverTimestamp() }),
                  "Could not move marker."
                )
              }
            />

            {selectedTable && (
              <TableTools
                key={selectedTable.id}
                table={selectedTable}
                onUpdate={(fields, failure) =>
                  void save(() => updateDoc(tableRef(selectedTable.id), { ...fields, updatedAt: serverTimestamp() }), failure)
                }
                onMessage={setMessage}
                onDelete={() =>
                  Alert.alert(`Delete ${selectedTable.name}?`, "Its seats will disappear from your customer page.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        void save(async () => {
                          await deleteDoc(tableRef(selectedTable.id));
                          setSelection(null);
                        }, "Could not delete table."),
                    },
                  ])
                }
              />
            )}

            {selectedMarker && (
              <MarkerTools
                marker={selectedMarker}
                onUpdate={(fields) =>
                  void save(
                    () => updateDoc(markerRef(selectedMarker.id), { ...fields, updatedAt: serverTimestamp() }),
                    "Could not update marker."
                  )
                }
                onDelete={() =>
                  void save(async () => {
                    await deleteDoc(markerRef(selectedMarker.id));
                    setSelection(null);
                  }, "Could not delete marker.")
                }
              />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

function AddTable({
  tables,
  onAdd,
}: {
  tables: Table[];
  onAdd: (fields: Pick<Table, "name" | "seats" | "shape" | "xPct" | "yPct">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<TableShape>("rectangle");
  const [seatCount, setSeatCount] = useState(4);
  const [adding, setAdding] = useState(false);
  const stool = shape === "stool";

  const add = async () => {
    const count = stool ? 1 : seatCount;
    const stools = tables.filter((table) => table.shape === "stool");
    const others = tables.filter((table) => table.shape !== "stool");

    // Same placement as the web editor: stools line up to the right of the
    // rightmost one; tables fill a 3×3 grid.
    const lastStool = stools.filter((table) => table.yPct <= 100).sort((a, b) => a.xPct - b.xPct).at(-1);
    const index = others.length;
    const position = stool
      ? lastStool
        ? { xPct: clamp(lastStool.xPct + 6, 4, 96), yPct: lastStool.yPct }
        : { xPct: 50, yPct: 85 }
      : { xPct: 18 + (index % 3) * 31, yPct: 22 + (Math.floor(index / 3) % 3) * 28 };

    setAdding(true);
    await onAdd({
      name: name.trim() || (stool ? `Stool ${stools.length + 1}` : `Table ${others.length + 1}`),
      seats: Array.from({ length: count }, (_, i) => ({ id: i + 1, status: "available" as const })),
      shape,
      ...position,
    });
    setAdding(false);
    setName("");
  };

  return (
    <Card>
      <Text style={styles.cardTitle}>Add a table</Text>
      <View style={{ marginTop: 12 }}>
        <Segmented options={SHAPES} value={shape} onChange={setShape} />
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={stool ? "Name (optional), e.g. Stool 1" : "Name (optional), e.g. Window table"}
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
      {!stool && (
        <View style={styles.stepperRow}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>Seats</Text>
          <Stepper
            value={seatCount}
            onChange={(value) => setSeatCount(clamp(value, 1, 12))}
            min={1}
            max={12}
          />
        </View>
      )}
      <Button title={stool ? "Add stool" : "Add table"} onPress={add} busy={adding} style={{ marginTop: 12 }} />
    </Card>
  );
}

function AddMarker({
  markerCount,
  bar,
  onAdd,
}: {
  markerCount: number;
  bar: boolean;
  onAdd: (fields: Pick<FloorMarker, "type" | "label" | "xPct" | "yPct">) => Promise<void>;
}) {
  const types = (Object.keys(MARKERS) as MarkerType[]).filter((type) => bar || !BAR_ONLY_MARKERS.includes(type));
  const [adding, setAdding] = useState<MarkerType | null>(null);

  const add = async (type: MarkerType) => {
    setAdding(type);
    await onAdd({
      type,
      label: MARKERS[type].label,
      xPct: 14 + (markerCount % 5) * 17,
      yPct: 84 - Math.floor(markerCount / 5) * 10,
    });
    setAdding(null);
  };

  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={styles.cardTitle}>Add a marker</Text>
      <Muted style={{ marginTop: 4 }}>Help customers find outlets, windows and more.</Muted>
      <View style={styles.chips}>
        {types.map((type) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            disabled={adding !== null}
            onPress={() => void add(type)}
            style={({ pressed }) => [styles.chip, (pressed || adding === type) && { backgroundColor: "#f3f4f6" }]}
          >
            <Text style={{ fontWeight: "700", color: colors.ink }}>
              {MARKERS[type].icon ? `${MARKERS[type].icon} ` : ""}
              {MARKERS[type].label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function TableTools({
  table,
  onUpdate,
  onMessage,
  onDelete,
}: {
  table: Table;
  onUpdate: (fields: Record<string, unknown>, failure: string) => void;
  onMessage: (message: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(table.name);
  const stool = table.shape === "stool";

  const setSeats = (count: number) => {
    if (count > 12) return onMessage("A table can have at most 12 seats.");
    if (count < 1) return onMessage("A table must have at least one seat.");

    if (count > table.seats.length) {
      const nextId = table.seats.length === 0 ? 1 : Math.max(...table.seats.map((seat) => seat.id)) + 1;
      onUpdate({ seats: [...table.seats, { id: nextId, status: "available" }] }, "Could not add a seat.");
    } else {
      onUpdate({ seats: table.seats.slice(0, -1) }, "Could not remove a seat.");
    }
  };

  const resize = (amount: number) =>
    onUpdate({ scale: clamp(Number((table.scale + amount).toFixed(2)), 0.65, 1.8) }, "Could not resize table.");

  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={styles.cardTitle}>{stool ? "Bar stool" : "Table"}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.faint}
          style={[styles.input, { flex: 1, marginTop: 0 }]}
        />
        <Button
          title="Rename"
          variant="secondary"
          disabled={!name.trim() || name.trim() === table.name}
          onPress={() => onUpdate({ name: name.trim() }, "Could not rename table.")}
        />
      </View>

      {!stool && (
        <View style={styles.stepperRow}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>Seats</Text>
          <Stepper value={table.seats.length} onChange={setSeats} min={1} max={12} />
        </View>
      )}

      <View style={styles.stepperRow}>
        <Text style={{ fontWeight: "700", color: colors.ink }}>Size</Text>
        <Stepper
          value={Math.round(table.scale * 100)}
          format={(value) => `${value}%`}
          onChange={(value) => resize(value > table.scale * 100 ? 0.1 : -0.1)}
          min={65}
          max={180}
        />
      </View>

      <View style={[styles.chips, { marginTop: 14 }]}>
        {!stool && (
          <Button
            title={table.shape === "rectangle" ? "Make round" : "Make rectangle"}
            variant="secondary"
            onPress={() =>
              onUpdate({ shape: table.shape === "rectangle" ? "round" : "rectangle" }, "Could not change shape.")
            }
          />
        )}
        {!stool && (
          <Button
            title="Rotate"
            variant="secondary"
            onPress={() => onUpdate({ rotation: table.rotation === 90 ? 0 : 90 }, "Could not rotate table.")}
          />
        )}
        <Button title="Delete" variant="danger" onPress={onDelete} />
      </View>
    </Card>
  );
}

function MarkerTools({
  marker,
  onUpdate,
  onDelete,
}: {
  marker: FloorMarker;
  onUpdate: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={styles.cardTitle}>{MARKERS[marker.type].label}</Text>
      <View style={styles.stepperRow}>
        <Text style={{ fontWeight: "700", color: colors.ink }}>Size</Text>
        <Stepper
          value={Math.round(marker.scale * 100)}
          format={(value) => `${value}%`}
          onChange={(value) =>
            onUpdate({
              scale: clamp(Number((marker.scale + (value > marker.scale * 100 ? 0.1 : -0.1)).toFixed(2)), 0.5, 2.5),
            })
          }
          min={50}
          max={250}
        />
      </View>
      <View style={[styles.chips, { marginTop: 14 }]}>
        <Button title="Rotate" variant="secondary" onPress={() => onUpdate({ rotation: (marker.rotation + 90) % 360 })} />
        <Button title="Delete" variant="danger" onPress={onDelete} />
      </View>
    </Card>
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
      <StepButton label="−" onPress={() => onChange(value - 1)} disabled={value <= min} />
      <Text style={{ minWidth: 48, textAlign: "center", fontWeight: "800", fontSize: 16, color: colors.ink }}>
        {format(value)}
      </Text>
      <StepButton label="+" onPress={() => onChange(value + 1)} disabled={value >= max} />
    </View>
  );
}

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Increase" : "Decrease"}
      onPress={onPress}
      disabled={disabled}
      style={[styles.stepButton, disabled && { opacity: 0.35 }]}
    >
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
});
