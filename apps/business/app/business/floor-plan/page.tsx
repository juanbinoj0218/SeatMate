"use client";

import { MarkerIcon } from "@seatmate/shared/components/Icons";

import { ArrowRight } from "lucide-react";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  type DocumentReference,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";

import CoverPhoto from "@/components/cover-photo";
import UpdateReminder from "@/components/update-reminder";
import GameStatus from "@seatmate/shared/components/GameStatus";
import TableWithSeats, {
  isSingleSeat,
  tableSize,
  type TableRotation,
  type TableShape,
} from "@seatmate/shared/components/TableWithSeats";
import { toggleSeat as toggleSeatStatus } from "@/lib/seat-updates";
import {
  newTablePosition,
  readMarker,
  readTable,
} from "@seatmate/shared/floor-docs";
import {
  clamp,
  type FloorMarker,
  isBarbershop,
  isGameMarker,
  markerAllowed,
  MARKERS,
  markerClassName,
  type MarkerType,
} from "@seatmate/shared/floor-plan";

type SeatStatus = "available" | "occupied";
type Mode = "occupancy" | "layout";
type BusinessStatus =
  | "draft"
  | "pending"
  | "approved"
  | "suspended"
  | "rejected";

type Seat = {
  id: number;
  status: SeatStatus;
  occupiedSince?: number;
};

type Table = {
  id: string;
  name: string;
  seats: Seat[];
  xPct: number;
  yPct: number;
  shape: TableShape;
  rotation: TableRotation;
  scale: number;
};

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

  // Bars get pool table and darts markers; bowling alleys also get lanes.
  const [businessType, setBusinessType] = useState("");
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
    // Listeners for the signed-in owner's floor plan. Stopped when the
    // account changes or the page closes, even if that happens while the
    // business is still loading.
    let closed = false;
    let listeners: (() => void)[] = [];
    const stopListeners = () => {
      listeners.forEach((unsubscribe) => unsubscribe());
      listeners = [];
    };

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        stopListeners();

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

          if (closed || auth.currentUser?.uid !== currentUser.uid) {
            return;
          }

          if (!businessSnap.exists()) {
            router.replace("/business/setup");
            return;
          }

          setBusinessType(String(businessSnap.data().type || ""));

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

          listeners.push(
            onSnapshot(
              collection(db, "businesses", currentUser.uid, "tables"),
              (snapshot) => {
                setTables(
                  snapshot.docs.map((tableDoc, index) =>
                    readTable(tableDoc.id, tableDoc.data(), index)
                  )
                );
                setLoading(false);
              },
              (error) => {
                console.error(error);
                setMessage("Could not load floor plan.");
                setLoading(false);
              }
            ),
            onSnapshot(
              collection(db, "businesses", currentUser.uid, "floorMarkers"),
              (snapshot) => {
                setMarkers(
                  snapshot.docs.map((markerDoc, index) =>
                    readMarker(markerDoc.id, markerDoc.data(), index)
                  )
                );
              },
              (error) => {
                console.error(error);
                setMessage(
                  "Could not load floor markers. Check your Firestore rules."
                );
              }
            )
          );
        } catch (error) {
          console.error(error);
          setMessage("Could not load business setup.");
          setLoading(false);
        }
      }
    );

    return () => {
      closed = true;
      unsubscribeAuth();
      stopListeners();
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

    const stool = isSingleSeat(newTableShape);
    const numberOfSeats = stool ? 1 : Number(seatCount);

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

      // Stools and chairs line up to the right of the rightmost one of the
      // same kind; tables fill a 3×3 grid.
      const sameKind = tables.filter((table) => table.shape === newTableShape);
      const lastStool = sameKind
        .filter((table) => table.yPct <= 100)
        .sort((a, b) => a.xPct - b.xPct)
        .at(-1);
      const index = tables.filter((table) => !isSingleSeat(table.shape)).length;
      const position = stool
        ? lastStool
          ? { xPct: clamp(lastStool.xPct + (newTableShape === "barberChair" ? 9 : 6), 4, 96), yPct: lastStool.yPct }
          : { xPct: newTableShape === "barberChair" ? 20 : 50, yPct: newTableShape === "barberChair" ? 50 : 85 }
        : {
            ...newTablePosition(index),
          };

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
            (newTableShape === "stool"
              ? `Stool ${sameKind.length + 1}`
              : newTableShape === "barberChair"
                ? `Chair ${sameKind.length + 1}`
                : `Table ${index + 1}`),
          seats,
          shape: newTableShape,
          rotation: 0,
          scale: 1,
          ...position,
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

    try {
      await toggleSeatStatus(user.uid, tableId, seatId, tables);
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

  // Layout edits from the toolbar or a drag. Problems (offline, rules) show
  // a message instead of failing silently.
  const saveChange = async (
    ref: DocumentReference,
    fields: DocumentData
  ) => {
    try {
      await updateDoc(ref, fields);
    } catch (error) {
      console.error(error);
      setMessage("Couldn't save that change. Check your connection and try again.");
    }
  };

  // Adds or removes a seat on the latest copy of the table, so a seat staff
  // just marked taken isn't undone by an older copy on this screen.
  const editSeats = async (
    table: Table,
    change: (seats: Seat[]) => Seat[] | string
  ) => {
    if (!user) return;

    const tableRef = doc(db, "businesses", user.uid, "tables", table.id);

    try {
      const problem = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(tableRef);
        if (!snapshot.exists()) return "This table was deleted.";

        const seats: Seat[] = Array.isArray(snapshot.data().seats)
          ? snapshot.data().seats
          : [];
        const result = change(seats);
        if (typeof result === "string") return result;

        transaction.update(tableRef, {
          seats: result,
          updatedAt: serverTimestamp(),
        });
        return "";
      });

      if (problem) setMessage(problem);
    } catch (error) {
      console.error(error);
      setMessage("Couldn't save that change. Check your connection and try again.");
    }
  };

  const addSeat = (table: Table) =>
    editSeats(table, (seats) => {
      if (seats.length >= 12) return "A table can have at most 12 seats.";

      const nextId =
        seats.length === 0
          ? 1
          : Math.max(...seats.map((seat) => seat.id)) + 1;

      return [...seats, { id: nextId, status: "available" as SeatStatus }];
    });

  const removeSeat = (table: Table) =>
    editSeats(table, (seats) =>
      seats.length <= 1
        ? "A table must have at least one seat."
        : seats.slice(0, -1)
    );

  const changeShape = async (table: Table) => {
    if (!user) return;

    const newShape: TableShape =
      table.shape === "rectangle" ? "round" : "rectangle";

    await saveChange(
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

  const rotateTable = async (table: Table) => {
    if (!user) return;

    await saveChange(
      doc(
        db,
        "businesses",
        user.uid,
        "tables",
        table.id
      ),
      {
        rotation: table.rotation === 90 ? 0 : 90,
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

    await saveChange(
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

    await saveChange(
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

    await saveChange(
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

  // Pool tables, darts and lanes: tap in occupancy mode to flip open / in use.
  const toggleGame = async (marker: FloorMarker) => {
    if (!user) return;

    try {
      await saveChange(
        doc(db, "businesses", user.uid, "floorMarkers", marker.id),
        {
          status: marker.status === "occupied" ? "available" : "occupied",
          statusUpdatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(error);
      setMessage("Could not update that game. Try again.");
    }
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

    await saveChange(
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

    await saveChange(
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
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center text-[#101811]">
                <SeatMateMark className="h-[85%] w-[85%]" />
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
            Done<ArrowRight aria-hidden className="mx-1 inline h-4 w-4 align-[-3px]" />Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>

            <h1 className="text-4xl md:text-5xl font-bold">
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

        {user && <CoverPhoto businessId={user.uid} />}

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
                Occupancy
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
                  value={isSingleSeat(newTableShape) ? "1" : seatCount}
                  disabled={isSingleSeat(newTableShape)}
                  aria-label="Seats"
                  onChange={(event) => setSeatCount(event.target.value)}
                  className="h-11 w-24 border border-gray-200 rounded-xl px-3 text-black disabled:bg-gray-50 disabled:text-gray-400"
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
                  <option value="stool">Bar stool (1 seat)</option>
                  {isBarbershop(businessType) && (
                    <option value="barberChair">Barber chair (1 seat)</option>
                  )}
                </select>

                <button
                  onClick={() => void createTable()}
                  disabled={creating}
                  className="h-11 bg-[#101811] text-white px-5 rounded-xl font-semibold disabled:opacity-50"
                >
                  {creating
                    ? "Adding..."
                    : newTableShape === "stool"
                      ? "+ Add Stool"
                      : newTableShape === "barberChair"
                        ? "+ Add Chair"
                        : "+ Add Table"}
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
                  {(Object.keys(MARKERS) as MarkerType[])
                    .filter((type) => markerAllowed(type, businessType))
                    .map((type) => (
                      <option key={type} value={type}>
                        {type === "wall"
                          ? "Wall / Divider"
                          : MARKERS[type].label}
                      </option>
                    ))}
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
                {selectedTable.shape === "stool"
                  ? "SELECTED STOOL"
                  : selectedTable.shape === "barberChair"
                    ? "SELECTED CHAIR"
                    : "SELECTED TABLE"}
              </p>
              <p className="font-bold mt-1">{selectedTable.name}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={() => renameTable(selectedTable)}>
                Rename
              </ToolButton>
              {!isSingleSeat(selectedTable.shape) && (
                <>
                  <ToolButton
                    onClick={() => void changeShape(selectedTable)}
                  >
                    {selectedTable.shape === "round"
                      ? "Rectangle"
                      : "Round"}
                  </ToolButton>
                  {selectedTable.shape === "rectangle" && (
                    <ToolButton
                      onClick={() => void rotateTable(selectedTable)}
                    >
                      Rotate 90°
                    </ToolButton>
                  )}
                  <ToolButton onClick={() => void removeSeat(selectedTable)}>
                    − Seat
                  </ToolButton>
                  <ToolButton onClick={() => void addSeat(selectedTable)}>
                    + Seat
                  </ToolButton>
                </>
              )}
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

        {mode === "occupancy" && user && (
          <div className="mt-6 -mb-2">
            <UpdateReminder businessId={user.uid} />
          </div>
        )}

        <p className="text-sm text-gray-500 mt-4">
          {mode === "occupancy"
            ? markers.some((marker) => isGameMarker(marker.type))
              ? "Tap a seat when somebody sits down or leaves. Tap a pool table, darts board or bowling lane to mark it in use."
              : "Tap a seat when somebody sits down or leaves."
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
                    } else if (isGameMarker(marker.type)) {
                      void toggleGame(marker);
                    }
                  }}
                  role={mode === "occupancy" && isGameMarker(marker.type) ? "button" : undefined}
                  aria-label={
                    mode === "occupancy" && isGameMarker(marker.type)
                      ? `${marker.label}: ${marker.status === "occupied" ? "in use" : "open"}`
                      : undefined
                  }
                  className={`absolute flex items-center justify-center border text-center font-bold select-none ${markerClassName(marker.type)} ${
                    mode === "layout"
                      ? "cursor-grab active:cursor-grabbing"
                      : isGameMarker(marker.type)
                        ? "cursor-pointer transition-transform hover:scale-[1.03] active:scale-95"
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
                      <MarkerIcon
                        type={marker.type}
                        className="mx-auto"
                        style={{
                          width: Math.max(12, 17 * displayScale),
                          height: Math.max(12, 17 * displayScale),
                        }}
                      />
                      {marker.scale >= 0.75 && (
                        <div className="mt-0.5">{marker.label}</div>
                      )}
                      {isGameMarker(marker.type) && (
                        <GameStatus
                          status={marker.status ?? "available"}
                          size={Math.max(9, 10 * displayScale)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {tables.map((table) => {
              const displayScale = table.scale * floorZoom;
              const box = tableSize(table.shape, table.seats.length, displayScale, table.rotation);
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
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    transform: "translate(-50%, -50%)",
                    zIndex: draggingTable === table.id ? 70 : 20,
                  }}
                >
                  {mode === "layout" && selected && (
                    <div className={`absolute -inset-2 border-2 border-green-400 bg-green-50/30 pointer-events-none ${table.shape === "round" || table.shape === "stool" ? "rounded-full" : "rounded-3xl"}`} />
                  )}

                  <TableWithSeats
                    name={table.name}
                    shape={table.shape}
                    seats={table.seats}
                    scale={displayScale}
                    rotation={table.rotation}
                    onSeatClick={(seatId) => void toggleSeat(table.id, seatId)}
                    seatsDisabled={mode === "layout"}
                  />
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
                  ? "Resubmit for Approval"
                  : "Submit for Approval"}
              {!submitting && <ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" />}
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
