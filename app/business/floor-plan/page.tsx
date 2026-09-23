"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import BackButton from "@/components/BackButton";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type SeatStatus = "available" | "occupied";
type TableShape = "rectangle" | "round";
type Mode = "occupancy" | "layout";
type BusinessStatus =
  | "draft"
  | "pending"
  | "approved"
  | "suspended"
  | "rejected";

type MarkerType =
  | "outlet"
  | "window"
  | "register"
  | "counter"
  | "door"
  | "entrance"
  | "restroom"
  | "wall";

type Seat = {
  id: number;
  status: SeatStatus;
};

type Table = {
  id: string;
  name: string;
  seats: Seat[];
  xPct: number;
  yPct: number;
  shape: TableShape;
  scale: number;
};

type FloorMarker = {
  id: string;
  type: MarkerType;
  label: string;
  xPct: number;
  yPct: number;
  scale: number;
  rotation: number;
};

const MARKERS: Record<
  MarkerType,
  {
    label: string;
    icon: string;
    width: number;
    height: number;
  }
> = {
  outlet: {
    label: "Outlet",
    icon: "⚡",
    width: 54,
    height: 54,
  },
  window: {
    label: "Window",
    icon: "▭",
    width: 120,
    height: 36,
  },
  register: {
    label: "Cash Register",
    icon: "▣",
    width: 92,
    height: 66,
  },
  counter: {
    label: "Counter",
    icon: "▰",
    width: 135,
    height: 54,
  },
  door: {
    label: "Door",
    icon: "↪",
    width: 82,
    height: 42,
  },
  entrance: {
    label: "Entrance",
    icon: "⇥",
    width: 110,
    height: 44,
  },
  restroom: {
    label: "Restroom",
    icon: "WC",
    width: 90,
    height: 62,
  },
  wall: {
    label: "Wall",
    icon: "",
    width: 150,
    height: 26,
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function FloorPlanPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [markers, setMarkers] = useState<FloorMarker[]>([]);

  const [mode, setMode] = useState<Mode>("occupancy");

  const [tableName, setTableName] = useState("");
  const [seatCount, setSeatCount] = useState("4");
  const [newTableShape, setNewTableShape] =
    useState<TableShape>("rectangle");

  const [markerType, setMarkerType] =
    useState<MarkerType>("outlet");

  const [floorZoom, setFloorZoom] = useState(1);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingMarker, setCreatingMarker] = useState(false);
  const [message, setMessage] = useState("");

  const [businessStatus, setBusinessStatus] =
    useState<BusinessStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [renameTarget, setRenameTarget] =
    useState<Table | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<Table | null>(null);
  const [deletingTable, setDeletingTable] = useState(false);

  const [selectedTableId, setSelectedTableId] =
    useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] =
    useState<string | null>(null);

  const [draggingTable, setDraggingTable] =
    useState<string | null>(null);
  const [tableDragOffset, setTableDragOffset] = useState({
    x: 0,
    y: 0,
  });

  const [draggingMarker, setDraggingMarker] =
    useState<string | null>(null);
  const [markerDragOffset, setMarkerDragOffset] = useState({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    let unsubscribeTables: (() => void) | undefined;
    let unsubscribeMarkers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.push("/business/login");
          return;
        }

        setUser(currentUser);

        try {
          const businessRef = doc(
            db,
            "businesses",
            currentUser.uid
          );

          const businessSnap = await getDoc(businessRef);

          if (!businessSnap.exists()) {
            router.replace("/business/setup");
            return;
          }

          const rawStatus = businessSnap.data().status;

          if (
            rawStatus === "draft" ||
            rawStatus === "pending" ||
            rawStatus === "approved" ||
            rawStatus === "suspended" ||
            rawStatus === "rejected"
          ) {
            setBusinessStatus(rawStatus);
          } else {
            setBusinessStatus("approved");
          }

          const tablesRef = collection(
            db,
            "businesses",
            currentUser.uid,
            "tables"
          );

          unsubscribeTables = onSnapshot(
            tablesRef,
            (snapshot) => {
              const data: Table[] = snapshot.docs.map(
                (tableDoc, index) => {
                  const table = tableDoc.data();

                  return {
                    id: tableDoc.id,
                    name: table.name || `Table ${index + 1}`,
                    seats: table.seats || [],
                    xPct:
                      typeof table.xPct === "number"
                        ? table.xPct
                        : 12 + (index % 3) * 32,
                    yPct:
                      typeof table.yPct === "number"
                        ? table.yPct
                        : 18 + Math.floor(index / 3) * 30,
                    shape:
                      table.shape === "round"
                        ? "round"
                        : "rectangle",
                    scale:
                      typeof table.scale === "number"
                        ? clamp(table.scale, 0.65, 1.8)
                        : 1,
                  };
                }
              );

              setTables(data);
              setLoading(false);
            },
            (error) => {
              console.error(error);
              setMessage("Could not load floor plan.");
              setLoading(false);
            }
          );

          const markersRef = collection(
            db,
            "businesses",
            currentUser.uid,
            "floorMarkers"
          );

          unsubscribeMarkers = onSnapshot(
            markersRef,
            (snapshot) => {
              const data: FloorMarker[] = snapshot.docs.map(
                (markerDoc, index) => {
                  const marker = markerDoc.data();
                  const type =
                    marker.type in MARKERS
                      ? (marker.type as MarkerType)
                      : "outlet";

                  return {
                    id: markerDoc.id,
                    type,
                    label:
                      typeof marker.label === "string"
                        ? marker.label
                        : MARKERS[type].label,
                    xPct:
                      typeof marker.xPct === "number"
                        ? marker.xPct
                        : 15 + (index % 4) * 20,
                    yPct:
                      typeof marker.yPct === "number"
                        ? marker.yPct
                        : 82,
                    scale:
                      typeof marker.scale === "number"
                        ? clamp(marker.scale, 0.5, 2.5)
                        : 1,
                    rotation:
                      typeof marker.rotation === "number"
                        ? marker.rotation
                        : 0,
                  };
                }
              );

              setMarkers(data);
            },
            (error) => {
              console.error(error);
              setMessage(
                "Could not load floor markers. Check your Firestore rules."
              );
            }
          );
        } catch (error) {
          console.error(error);
          setMessage("Could not load business setup.");
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeTables?.();
      unsubscribeMarkers?.();
    };
  }, [router]);

  const selectedTable = useMemo(
    () =>
      tables.find((table) => table.id === selectedTableId) ||
      null,
    [tables, selectedTableId]
  );

  const selectedMarker = useMemo(
    () =>
      markers.find((marker) => marker.id === selectedMarkerId) ||
      null,
    [markers, selectedMarkerId]
  );

  const createTable = async () => {
    if (!user) return;

    const numberOfSeats = Number(seatCount);

    if (
      !Number.isInteger(numberOfSeats) ||
      numberOfSeats < 1 ||
      numberOfSeats > 12
    ) {
      setMessage("Choose between 1 and 12 seats.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");

      const seats: Seat[] = Array.from(
        { length: numberOfSeats },
        (_, index) => ({
          id: index + 1,
          status: "available",
        })
      );

      const index = tables.length;

      const newTable = await addDoc(
        collection(
          db,
          "businesses",
          user.uid,
          "tables"
        ),
        {
          name:
            tableName.trim() ||
            `Table ${tables.length + 1}`,
          seats,
          shape: newTableShape,
          scale: 1,
          xPct: 18 + (index % 3) * 31,
          yPct: 22 + Math.floor(index / 3) * 28,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setSelectedTableId(newTable.id);
      setSelectedMarkerId(null);
      setMode("layout");
      setTableName("");
      setSeatCount("4");
      setNewTableShape("rectangle");
    } catch (error) {
      console.error(error);
      setMessage("Could not create table.");
    } finally {
      setCreating(false);
    }
  };

  const createMarker = async () => {
    if (!user) return;

    try {
      setCreatingMarker(true);
      setMessage("");

      const index = markers.length;
      const markerInfo = MARKERS[markerType];

      const newMarker = await addDoc(
        collection(
          db,
          "businesses",
          user.uid,
          "floorMarkers"
        ),
        {
          type: markerType,
          label: markerInfo.label,
          xPct: 14 + (index % 5) * 17,
          yPct: 84 - Math.floor(index / 5) * 10,
          scale: 1,
          rotation: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setSelectedMarkerId(newMarker.id);
      setSelectedTableId(null);
      setMode("layout");
    } catch (error) {
      console.error(error);
      setMessage(
        "Could not add marker. Make sure your Firestore rules allow floorMarkers."
      );
    } finally {
      setCreatingMarker(false);
    }
  };

  const toggleSeat = async (
    tableId: string,
    seatId: number
  ) => {
    if (!user || mode !== "occupancy") return;

    const tableRef = doc(
      db,
      "businesses",
      user.uid,
      "tables",
      tableId
    );

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(tableRef);

        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const seats: Seat[] = data.seats || [];

        const updatedSeats = seats.map((seat) =>
          seat.id === seatId
            ? {
                ...seat,
                status:
                  seat.status === "available"
                    ? "occupied"
                    : "available",
              }
            : seat
        );

        transaction.update(tableRef, {
          seats: updatedSeats,
          occupancyUpdatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error(error);
      setMessage("Could not update seat.");
    }
  };

  const renameTable = (table: Table) => {
    setMessage("");
    setRenameTarget(table);
    setRenameValue(table.name);
  };

  const saveTableName = async () => {
    if (!user || !renameTarget) return;

    const newName = renameValue.trim();

    if (!newName) {
      setMessage("Table name cannot be empty.");
      return;
    }

    try {
      setSavingRename(true);
      setMessage("");

      await updateDoc(
        doc(
          db,
          "businesses",
          user.uid,
          "tables",
          renameTarget.id
        ),
        {
          name: newName,
          updatedAt: serverTimestamp(),
        }
      );

      setRenameTarget(null);
      setRenameValue("");
    } catch (error) {
      console.error(error);
      setMessage("Could not rename table.");
    } finally {
      setSavingRename(false);
    }
  };

  const addSeat = async (table: Table) => {
    if (!user) return;

    if (table.seats.length >= 12) {
      setMessage("A table can have at most 12 seats.");
      return;
    }

    const nextId =
      table.seats.length === 0
        ? 1
        : Math.max(...table.seats.map((seat) => seat.id)) + 1;

    const updatedSeats = [
      ...table.seats,
      {
        id: nextId,
        status: "available" as SeatStatus,
      },
    ];

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "tables",
        table.id
      ),
      {
        seats: updatedSeats,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const removeSeat = async (table: Table) => {
    if (!user) return;

    if (table.seats.length <= 1) {
      setMessage("A table must have at least one seat.");
      return;
    }

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "tables",
        table.id
      ),
      {
        seats: table.seats.slice(0, -1),
        updatedAt: serverTimestamp(),
      }
    );
  };

  const changeShape = async (table: Table) => {
    if (!user) return;

    const newShape: TableShape =
      table.shape === "rectangle" ? "round" : "rectangle";

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "tables",
        table.id
      ),
      {
        shape: newShape,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const resizeTable = async (
    table: Table,
    amount: number
  ) => {
    if (!user) return;

    const scale = clamp(
      Number((table.scale + amount).toFixed(2)),
      0.65,
      1.8
    );

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "tables",
        table.id
      ),
      {
        scale,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const resizeMarker = async (
    marker: FloorMarker,
    amount: number
  ) => {
    if (!user) return;

    const scale = clamp(
      Number((marker.scale + amount).toFixed(2)),
      0.5,
      2.5
    );

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "floorMarkers",
        marker.id
      ),
      {
        scale,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const rotateMarker = async (marker: FloorMarker) => {
    if (!user) return;

    const rotation = (marker.rotation + 90) % 360;

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "floorMarkers",
        marker.id
      ),
      {
        rotation,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const deleteMarker = async (marker: FloorMarker) => {
    if (!user) return;

    try {
      await deleteDoc(
        doc(
          db,
          "businesses",
          user.uid,
          "floorMarkers",
          marker.id
        )
      );

      setSelectedMarkerId(null);
    } catch (error) {
      console.error(error);
      setMessage("Could not delete marker.");
    }
  };

  const removeTable = (table: Table) => {
    setMessage("");
    setDeleteTarget(table);
  };

  const confirmDeleteTable = async () => {
    if (!user || !deleteTarget) return;

    try {
      setDeletingTable(true);
      setMessage("");

      await deleteDoc(
        doc(
          db,
          "businesses",
          user.uid,
          "tables",
          deleteTarget.id
        )
      );

      if (selectedTableId === deleteTarget.id) {
        setSelectedTableId(null);
      }

      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setMessage("Could not delete table.");
    } finally {
      setDeletingTable(false);
    }
  };

  const startTableDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    table: Table
  ) => {
    if (mode !== "layout") return;

    event.stopPropagation();
    setSelectedTableId(table.id);
    setSelectedMarkerId(null);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = rect.left + (table.xPct / 100) * rect.width;
    const currentY = rect.top + (table.yPct / 100) * rect.height;

    setTableDragOffset({
      x: event.clientX - currentX,
      y: event.clientY - currentY,
    });

    setDraggingTable(table.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragTable = (
    event: React.PointerEvent<HTMLDivElement>,
    tableId: string
  ) => {
    if (mode !== "layout" || draggingTable !== tableId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    let x =
      ((event.clientX - rect.left - tableDragOffset.x) /
        rect.width) *
      100;
    let y =
      ((event.clientY - rect.top - tableDragOffset.y) /
        rect.height) *
      100;

    x = clamp(x, 5, 95);
    y = clamp(y, 7, 93);

    setTables((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId
          ? { ...table, xPct: x, yPct: y }
          : table
      )
    );
  };

  const finishTableDrag = async (
    event: React.PointerEvent<HTMLDivElement>,
    tableId: string
  ) => {
    if (
      mode !== "layout" ||
      draggingTable !== tableId ||
      !user
    ) {
      return;
    }

    setDraggingTable(null);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}

    const table = tables.find((item) => item.id === tableId);
    if (!table) return;

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "tables",
        tableId
      ),
      {
        xPct: table.xPct,
        yPct: table.yPct,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const startMarkerDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    marker: FloorMarker
  ) => {
    if (mode !== "layout") return;

    event.stopPropagation();
    setSelectedMarkerId(marker.id);
    setSelectedTableId(null);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = rect.left + (marker.xPct / 100) * rect.width;
    const currentY = rect.top + (marker.yPct / 100) * rect.height;

    setMarkerDragOffset({
      x: event.clientX - currentX,
      y: event.clientY - currentY,
    });

    setDraggingMarker(marker.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragMarker = (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => {
    if (mode !== "layout" || draggingMarker !== markerId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    let x =
      ((event.clientX - rect.left - markerDragOffset.x) /
        rect.width) *
      100;
    let y =
      ((event.clientY - rect.top - markerDragOffset.y) /
        rect.height) *
      100;

    x = clamp(x, 2, 98);
    y = clamp(y, 3, 97);

    setMarkers((currentMarkers) =>
      currentMarkers.map((marker) =>
        marker.id === markerId
          ? { ...marker, xPct: x, yPct: y }
          : marker
      )
    );
  };

  const finishMarkerDrag = async (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => {
    if (
      mode !== "layout" ||
      draggingMarker !== markerId ||
      !user
    ) {
      return;
    }

    setDraggingMarker(null);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}

    const marker = markers.find((item) => item.id === markerId);
    if (!marker) return;

    await updateDoc(
      doc(
        db,
        "businesses",
        user.uid,
        "floorMarkers",
        markerId
      ),
      {
        xPct: marker.xPct,
        yPct: marker.yPct,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const submitForApproval = async () => {
    if (!user) return;

    if (tables.length === 0) {
      setMessage(
        "Add at least one table before submitting your business."
      );
      return;
    }

    if (
      businessStatus !== "draft" &&
      businessStatus !== "rejected"
    ) {
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      await updateDoc(doc(db, "businesses", user.uid), {
        status: "pending",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setBusinessStatus("pending");
      router.push("/business");
    } catch (error) {
      console.error(error);
      setMessage(
        "Could not submit your business for approval."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalSeats = tables.reduce(
    (total, table) => total + table.seats.length,
    0
  );

  const availableSeats = tables.reduce(
    (total, table) =>
      total +
      table.seats.filter((seat) => seat.status === "available")
        .length,
    0
  );

  const occupiedSeats = totalSeats - availableSeats;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        Loading floor plan...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <header className="bg-white border-b border-[#e3e7e2]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <BackButton fallback="/business" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold">
                S
              </div>

              <div>
                <p className="font-bold">SeatMate</p>
                <p className="text-xs text-gray-400">
                  Floor Manager
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push("/business")}
            className="border border-gray-200 px-4 py-2.5 rounded-xl font-semibold text-sm bg-white hover:bg-gray-50"
          >
            Done → Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="text-green-700 font-semibold text-sm">
              ● LIVE FLOOR
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mt-3">
              Floor Plan
            </h1>

            <p className="text-gray-500 mt-2">
              Build a top-down map of the restaurant and manage live
              seating.
            </p>
          </div>

          <div className="flex bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <Stat label="Total" value={totalSeats} />
            <Stat label="Available" value={availableSeats} green />
            <Stat label="Occupied" value={occupiedSeats} />
          </div>
        </div>

        {/* MODE + ZOOM */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-8 flex flex-col xl:flex-row gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
              <button
                onClick={() => {
                  setMode("occupancy");
                  setSelectedTableId(null);
                  setSelectedMarkerId(null);
                }}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${
                  mode === "occupancy"
                    ? "bg-white shadow-sm"
                    : "text-gray-500"
                }`}
              >
                ● Occupancy
              </button>

              <button
                onClick={() => setMode("layout")}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${
                  mode === "layout"
                    ? "bg-white shadow-sm"
                    : "text-gray-500"
                }`}
              >
                Edit Layout
              </button>
            </div>

            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() =>
                  setFloorZoom((zoom) =>
                    clamp(Number((zoom - 0.1).toFixed(1)), 0.7, 1.5)
                  )
                }
                className="w-10 h-10 font-bold hover:bg-gray-50"
              >
                −
              </button>

              <div className="px-3 text-xs font-bold text-gray-500 min-w-[66px] text-center">
                {Math.round(floorZoom * 100)}%
              </div>

              <button
                type="button"
                onClick={() =>
                  setFloorZoom((zoom) =>
                    clamp(Number((zoom + 0.1).toFixed(1)), 0.7, 1.5)
                  )
                }
                className="w-10 h-10 font-bold hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {mode === "layout" && (
            <p className="text-sm text-gray-500 self-center">
              Drag tables and markers. Select one to resize or edit it.
            </p>
          )}
        </div>

        {/* ADD TOOLS */}
        {mode === "layout" && (
          <div className="grid xl:grid-cols-2 gap-4 mt-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold tracking-wider text-gray-400 mb-3">
                ADD TABLE
              </p>

              <div className="flex flex-wrap gap-2">
                <input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  placeholder={`Table ${tables.length + 1}`}
                  className="h-11 flex-1 min-w-[150px] border border-gray-200 rounded-xl px-4 text-black"
                />

                <input
                  type="number"
                  min="1"
                  max="12"
                  value={seatCount}
                  onChange={(event) => setSeatCount(event.target.value)}
                  className="h-11 w-24 border border-gray-200 rounded-xl px-3 text-black"
                />

                <select
                  value={newTableShape}
                  onChange={(event) =>
                    setNewTableShape(
                      event.target.value as TableShape
                    )
                  }
                  className="h-11 border border-gray-200 rounded-xl px-3 bg-white text-black"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="round">Round</option>
                </select>

                <button
                  onClick={() => void createTable()}
                  disabled={creating}
                  className="h-11 bg-[#101811] text-white px-5 rounded-xl font-semibold disabled:opacity-50"
                >
                  {creating ? "Adding..." : "+ Add Table"}
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold tracking-wider text-gray-400 mb-3">
                ADD FLOOR MARKER
              </p>

              <div className="flex gap-2">
                <select
                  value={markerType}
                  onChange={(event) =>
                    setMarkerType(event.target.value as MarkerType)
                  }
                  className="h-11 flex-1 border border-gray-200 rounded-xl px-3 bg-white text-black"
                >
                  <option value="outlet">⚡ Outlet</option>
                  <option value="window">▭ Window</option>
                  <option value="register">▣ Cash Register</option>
                  <option value="counter">▰ Counter</option>
                  <option value="door">↪ Door</option>
                  <option value="entrance">⇥ Entrance</option>
                  <option value="restroom">WC Restroom</option>
                  <option value="wall">Wall / Divider</option>
                </select>

                <button
                  type="button"
                  onClick={() => void createMarker()}
                  disabled={creatingMarker}
                  className="h-11 bg-green-600 hover:bg-green-700 text-white px-5 rounded-xl font-semibold disabled:opacity-50"
                >
                  {creatingMarker ? "Adding..." : "+ Add Marker"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SELECTED ITEM CONTROLS */}
        {mode === "layout" && selectedTable && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-wider text-green-700">
                SELECTED TABLE
              </p>
              <p className="font-bold mt-1">{selectedTable.name}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={() => renameTable(selectedTable)}>
                Rename
              </ToolButton>
              <ToolButton
                onClick={() => void changeShape(selectedTable)}
              >
                {selectedTable.shape === "round"
                  ? "Rectangle"
                  : "Round"}
              </ToolButton>
              <ToolButton onClick={() => void removeSeat(selectedTable)}>
                − Seat
              </ToolButton>
              <ToolButton onClick={() => void addSeat(selectedTable)}>
                + Seat
              </ToolButton>
              <ToolButton
                onClick={() => void resizeTable(selectedTable, -0.1)}
              >
                Smaller
              </ToolButton>
              <ToolButton
                onClick={() => void resizeTable(selectedTable, 0.1)}
              >
                Bigger
              </ToolButton>
              <button
                type="button"
                onClick={() => removeTable(selectedTable)}
                className="px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {mode === "layout" && selectedMarker && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-wider text-blue-700">
                SELECTED MARKER
              </p>
              <p className="font-bold mt-1">{selectedMarker.label}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ToolButton
                onClick={() => void resizeMarker(selectedMarker, -0.1)}
              >
                Smaller
              </ToolButton>
              <ToolButton
                onClick={() => void resizeMarker(selectedMarker, 0.1)}
              >
                Bigger
              </ToolButton>
              <ToolButton
                onClick={() => void rotateMarker(selectedMarker)}
              >
                Rotate 90°
              </ToolButton>
              <button
                type="button"
                onClick={() => void deleteMarker(selectedMarker)}
                className="px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-4">
          {mode === "occupancy"
            ? "Tap a seat when somebody sits down or leaves."
            : "This is your top-down restaurant map. Drag objects to match the real room."}
        </p>

        {message && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mt-4 text-sm">
            {message}
          </div>
        )}

        {/* FLOOR */}
        <div className="overflow-auto mt-6 pb-3 border border-gray-200 rounded-[30px] bg-gray-100/50 p-3">
          <div
            ref={canvasRef}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedTableId(null);
                setSelectedMarkerId(null);
              }
            }}
            className="relative bg-white border border-gray-300 rounded-[24px] overflow-hidden shadow-inner"
            style={{
              width: `${1000 * floorZoom}px`,
              minWidth: `${1000 * floorZoom}px`,
              height: `${700 * floorZoom}px`,
              touchAction: "none",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-55"
              style={{
                backgroundImage:
                  "linear-gradient(#dfe4df 1px, transparent 1px), linear-gradient(90deg, #dfe4df 1px, transparent 1px)",
                backgroundSize: `${32 * floorZoom}px ${32 * floorZoom}px`,
              }}
            />

            <div className="absolute top-5 left-6 text-xs font-bold tracking-widest text-gray-300 pointer-events-none">
              TOP-DOWN FLOOR
            </div>

            {tables.length === 0 && markers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
                <div>
                  <h2 className="text-xl font-bold">
                    Your floor is empty
                  </h2>
                  <p className="text-gray-400 mt-2">
                    Switch to Edit Layout and add tables or room markers.
                  </p>
                </div>
              </div>
            )}

            {markers.map((marker) => {
              const info = MARKERS[marker.type];
              const displayScale = marker.scale * floorZoom;
              const selected = selectedMarkerId === marker.id;

              return (
                <div
                  key={marker.id}
                  onPointerDown={(event) =>
                    startMarkerDrag(event, marker)
                  }
                  onPointerMove={(event) =>
                    dragMarker(event, marker.id)
                  }
                  onPointerUp={(event) =>
                    finishMarkerDrag(event, marker.id)
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (mode === "layout") {
                      setSelectedMarkerId(marker.id);
                      setSelectedTableId(null);
                    }
                  }}
                  className={`absolute flex items-center justify-center border text-center font-bold select-none ${
                    marker.type === "wall"
                      ? "bg-gray-700 border-gray-800 text-white"
                      : marker.type === "window"
                        ? "bg-sky-50 border-sky-300 text-sky-800"
                        : marker.type === "outlet"
                          ? "bg-amber-50 border-amber-300 text-amber-800 rounded-xl"
                          : "bg-white border-gray-300 text-[#101811] rounded-xl shadow-sm"
                  } ${
                    mode === "layout"
                      ? "cursor-grab active:cursor-grabbing"
                      : "pointer-events-none"
                  } ${
                    selected
                      ? "ring-4 ring-blue-300 ring-offset-2"
                      : ""
                  }`}
                  style={{
                    left: `${marker.xPct}%`,
                    top: `${marker.yPct}%`,
                    width: `${info.width * displayScale}px`,
                    height: `${info.height * displayScale}px`,
                    transform: `translate(-50%, -50%) rotate(${marker.rotation}deg)`,
                    zIndex: draggingMarker === marker.id ? 60 : 5,
                    fontSize: `${Math.max(9, 11 * displayScale)}px`,
                  }}
                >
                  {marker.type === "wall" ? null : (
                    <div
                      className="leading-tight"
                      style={{
                        transform: `rotate(${-marker.rotation}deg)`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: `${Math.max(12, 17 * displayScale)}px`,
                        }}
                      >
                        {info.icon}
                      </div>
                      {marker.scale >= 0.75 && (
                        <div className="mt-0.5">{marker.label}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {tables.map((table) => {
              const displayScale = table.scale * floorZoom;
              const baseWidth = table.shape === "round" ? 175 : 210;
              const baseHeight = table.shape === "round" ? 175 : 165;
              const selected = selectedTableId === table.id;

              return (
                <div
                  key={table.id}
                  onPointerDown={(event) =>
                    startTableDrag(event, table)
                  }
                  onPointerMove={(event) =>
                    dragTable(event, table.id)
                  }
                  onPointerUp={(event) =>
                    finishTableDrag(event, table.id)
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (mode === "layout") {
                      setSelectedTableId(table.id);
                      setSelectedMarkerId(null);
                    }
                  }}
                  className={`absolute select-none ${
                    mode === "layout"
                      ? "cursor-grab active:cursor-grabbing"
                      : ""
                  }`}
                  style={{
                    left: `${table.xPct}%`,
                    top: `${table.yPct}%`,
                    width: `${baseWidth * displayScale}px`,
                    height: `${baseHeight * displayScale}px`,
                    transform: "translate(-50%, -50%)",
                    zIndex: draggingTable === table.id ? 70 : 20,
                  }}
                >
                  {mode === "layout" && selected && (
                    <div className="absolute -inset-2 rounded-3xl border-2 border-green-400 bg-green-50/30 pointer-events-none" />
                  )}

                  <div
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#101811] text-white flex items-center justify-center text-center shadow-md ${
                      table.shape === "round"
                        ? "rounded-full"
                        : "rounded-2xl"
                    }`}
                    style={{
                      width:
                        table.shape === "round"
                          ? `${88 * displayScale}px`
                          : `${125 * displayScale}px`,
                      height:
                        table.shape === "round"
                          ? `${88 * displayScale}px`
                          : `${76 * displayScale}px`,
                      fontSize: `${Math.max(9, 13 * displayScale)}px`,
                      padding: `${6 * displayScale}px`,
                    }}
                  >
                    <div>
                      <div className="font-bold">{table.name}</div>
                      <div className="text-white/50 font-semibold mt-1">
                        {table.seats.length} seats
                      </div>
                    </div>
                  </div>

                  {table.seats.map((seat, index) => {
                    const angle =
                      -Math.PI / 2 +
                      (index / Math.max(table.seats.length, 1)) *
                        Math.PI *
                        2;

                    const radiusX = table.shape === "round" ? 43 : 45;
                    const radiusY = table.shape === "round" ? 43 : 42;
                    const left = 50 + Math.cos(angle) * radiusX;
                    const top = 50 + Math.sin(angle) * radiusY;
                    const seatSize = clamp(30 * displayScale, 22, 45);

                    return (
                      <button
                        key={seat.id}
                        disabled={mode === "layout"}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleSeat(table.id, seat.id);
                        }}
                        title={
                          seat.status === "available"
                            ? "Available"
                            : "Occupied"
                        }
                        className={`absolute rounded-full text-white font-bold border-2 border-white shadow-sm ${
                          seat.status === "available"
                            ? "bg-green-500"
                            : "bg-red-500"
                        } ${
                          mode === "occupancy"
                            ? "hover:scale-110 transition-transform"
                            : "opacity-90"
                        }`}
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${seatSize}px`,
                          height: `${seatSize}px`,
                          transform: "translate(-50%, -50%)",
                          fontSize: `${Math.max(8, 10 * displayScale)}px`,
                        }}
                      >
                        {seat.id}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* APPROVAL STATUS */}
        {(businessStatus === "draft" ||
          businessStatus === "rejected") && (
          <div className="bg-[#101811] text-white rounded-3xl p-7 mt-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <p className="text-green-400 text-sm font-bold">
                READY TO GO LIVE?
              </p>

              <h2 className="text-2xl font-bold mt-2">
                {businessStatus === "rejected"
                  ? "Update and resubmit your business"
                  : "Submit your business for approval"}
              </h2>

              <p className="text-white/60 mt-2 max-w-xl">
                Make sure your floor plan matches the real location.
                SeatMate will review your business before customers can
                find it.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void submitForApproval()}
              disabled={submitting}
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl whitespace-nowrap disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : businessStatus === "rejected"
                  ? "Resubmit for Approval →"
                  : "Submit for Approval →"}
            </button>
          </div>
        )}

        {businessStatus === "pending" && (
          <StatusBox tone="amber" title="Pending SeatMate approval">
            Your business has been submitted and is waiting for review.
          </StatusBox>
        )}

        {businessStatus === "approved" && (
          <StatusBox tone="green" title="Business approved">
            Your location is live on SeatMate.
          </StatusBox>
        )}

        {businessStatus === "suspended" && (
          <StatusBox tone="red" title="Business suspended">
            Your location is currently hidden from SeatMate customers.
          </StatusBox>
        )}
      </div>

      {/* RENAME MODAL */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setRenameTarget(null);
              setRenameValue("");
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <p className="text-sm font-bold text-green-600">
              EDIT TABLE
            </p>

            <h2 className="text-2xl font-bold mt-2">
              Rename table
            </h2>

            <p className="text-gray-500 mt-2">
              Choose a name your staff can easily recognize.
            </p>

            <input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveTableName();
                }

                if (event.key === "Escape") {
                  setRenameTarget(null);
                  setRenameValue("");
                }
              }}
              placeholder="Table name"
              className="w-full mt-6 border border-gray-200 rounded-xl px-4 py-3 text-black outline-none focus:ring-2 focus:ring-green-500"
            />

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setRenameTarget(null);
                  setRenameValue("");
                }}
                className="flex-1 border border-gray-200 hover:bg-gray-50 font-semibold py-3 rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void saveTableName()}
                disabled={savingRename || !renameValue.trim()}
                className="flex-1 bg-[#101811] hover:bg-black text-white font-bold py-3 rounded-xl transition disabled:opacity-40"
              >
                {savingRename ? "Saving..." : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <p className="text-sm font-bold text-red-600">
              DELETE TABLE
            </p>

            <h2 className="text-2xl font-bold mt-2">
              Delete {deleteTarget.name}?
            </h2>

            <p className="text-gray-500 mt-2">
              This removes the table and all of its seats from the floor
              plan.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-200 hover:bg-gray-50 font-semibold py-3 rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void confirmDeleteTable()}
                disabled={deletingTable}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40"
              >
                {deletingTable ? "Deleting..." : "Delete Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ToolButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  green = false,
}: {
  label: string;
  value: number;
  green?: boolean;
}) {
  return (
    <div className="px-5 py-4 border-r border-gray-100 last:border-r-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
        {label}
      </p>

      <p
        className={`text-xl font-bold mt-1 ${
          green ? "text-green-600" : "text-[#101811]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBox({
  tone,
  title,
  children,
}: {
  tone: "amber" | "green" | "red";
  title: string;
  children: React.ReactNode;
}) {
  const classes = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-700",
  }[tone];

  return (
    <div className={`${classes} border rounded-2xl p-5 mt-8`}>
      <p className="font-bold">{title}</p>
      <p className="text-sm mt-1">{children}</p>
    </div>
  );
}
