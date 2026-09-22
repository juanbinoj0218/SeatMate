"use client";

import { useEffect, useRef, useState } from "react";
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
};

export default function FloorPlanPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [tables, setTables] = useState<Table[]>([]);

  const [mode, setMode] = useState<Mode>("occupancy");

  const [tableName, setTableName] = useState("");
  const [seatCount, setSeatCount] = useState("4");
  const [newTableShape, setNewTableShape] =
    useState<TableShape>("rectangle");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  const [dragging, setDragging] = useState<string | null>(
    null
  );

  const [dragOffset, setDragOffset] = useState({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    let unsubscribeTables: (() => void) | undefined;

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
            // Older SeatMate businesses created before approvals existed.
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
                        : 8 + (index % 3) * 30,
                    yPct:
                      typeof table.yPct === "number"
                        ? table.yPct
                        : 10 + Math.floor(index / 3) * 30,
                    shape:
                      table.shape === "round"
                        ? "round"
                        : "rectangle",
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
    };
  }, [router]);

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

      await addDoc(
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

          xPct: 8 + (index % 3) * 30,
          yPct:
            10 + Math.floor(index / 3) * 30,

          createdAt: serverTimestamp(),
        }
      );

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
      await runTransaction(
        db,
        async (transaction) => {
          const snapshot =
            await transaction.get(tableRef);

          if (!snapshot.exists()) return;

          const data = snapshot.data();

          const seats: Seat[] =
            data.seats || [];

          const updatedSeats = seats.map(
            (seat) =>
              seat.id === seatId
                ? {
                    ...seat,
                    status:
                      seat.status ===
                      "available"
                        ? "occupied"
                        : "available",
                  }
                : seat
          );

          transaction.update(tableRef, {
            seats: updatedSeats,
            occupancyUpdatedAt: serverTimestamp(),
          });
        }
      );
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
      setMessage(
        "A table can have at most 12 seats."
      );
      return;
    }

    const nextId =
      table.seats.length === 0
        ? 1
        : Math.max(
            ...table.seats.map(
              (seat) => seat.id
            )
          ) + 1;

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

  const removeSeat = async (
    table: Table
  ) => {
    if (!user) return;

    if (table.seats.length <= 1) {
      setMessage(
        "A table must have at least one seat."
      );
      return;
    }

    const updatedSeats =
      table.seats.slice(0, -1);

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

  const changeShape = async (
    table: Table
  ) => {
    if (!user) return;

    const newShape: TableShape =
      table.shape === "rectangle"
        ? "round"
        : "rectangle";

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

      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setMessage("Could not delete table.");
    } finally {
      setDeletingTable(false);
    }
  };

  const startDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    table: Table
  ) => {
    if (mode !== "layout") return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect =
      canvas.getBoundingClientRect();

    const currentX =
      rect.left +
      (table.xPct / 100) * rect.width;

    const currentY =
      rect.top +
      (table.yPct / 100) * rect.height;

    setDragOffset({
      x: event.clientX - currentX,
      y: event.clientY - currentY,
    });

    setDragging(table.id);

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  };

  const dragTable = (
    event: React.PointerEvent<HTMLDivElement>,
    tableId: string
  ) => {
    if (
      mode !== "layout" ||
      dragging !== tableId
    ) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect =
      canvas.getBoundingClientRect();

    let x =
      ((event.clientX -
        rect.left -
        dragOffset.x) /
        rect.width) *
      100;

    let y =
      ((event.clientY -
        rect.top -
        dragOffset.y) /
        rect.height) *
      100;

    x = Math.max(0, Math.min(79, x));
    y = Math.max(0, Math.min(72, y));

    setTables((currentTables) =>
      currentTables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              xPct: x,
              yPct: y,
            }
          : table
      )
    );
  };

  const finishDrag = async (
    event: React.PointerEvent<HTMLDivElement>,
    tableId: string
  ) => {
    if (
      mode !== "layout" ||
      dragging !== tableId ||
      !user
    ) {
      return;
    }

    setDragging(null);

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {}

    const table = tables.find(
      (item) => item.id === tableId
    );

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

      await updateDoc(
        doc(db, "businesses", user.uid),
        {
          status: "pending",
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        Loading floor plan...
      </main>
    );
  }

  const totalSeats = tables.reduce(
    (total, table) =>
      total + table.seats.length,
    0
  );

  const availableSeats = tables.reduce(
    (total, table) =>
      total +
      table.seats.filter(
        (seat) =>
          seat.status === "available"
      ).length,
    0
  );

  const occupiedSeats =
    totalSeats - availableSeats;

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
              <p className="font-bold">
                SeatMate
              </p>

                <p className="text-xs text-gray-400">
                  Floor Manager
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              router.push("/business")
            }
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
              Manage tables, seats and live occupancy.
            </p>
          </div>

          <div className="flex bg-white border border-gray-200 rounded-2xl overflow-hidden">

            <Stat
              label="Total"
              value={totalSeats}
            />

            <Stat
              label="Available"
              value={availableSeats}
              green
            />

            <Stat
              label="Occupied"
              value={occupiedSeats}
            />

          </div>
        </div>

        {/* TOOLBAR */}

        <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-8 flex flex-col xl:flex-row gap-4 justify-between">

          <div className="flex bg-gray-100 rounded-xl p-1 w-fit">

            <button
              onClick={() =>
                setMode("occupancy")
              }
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${
                mode === "occupancy"
                  ? "bg-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              ● Occupancy
            </button>

            <button
              onClick={() =>
                setMode("layout")
              }
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${
                mode === "layout"
                  ? "bg-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Edit Layout
            </button>

          </div>

          <div className="flex flex-wrap gap-2">

            <input
              value={tableName}
              onChange={(e) =>
                setTableName(
                  e.target.value
                )
              }
              placeholder={`Table ${
                tables.length + 1
              }`}
              className="h-11 border border-gray-200 rounded-xl px-4 text-black"
            />

            <input
              type="number"
              min="1"
              max="12"
              value={seatCount}
              onChange={(e) =>
                setSeatCount(
                  e.target.value
                )
              }
              className="h-11 w-24 border border-gray-200 rounded-xl px-3 text-black"
            />

            <select
              value={newTableShape}
              onChange={(e) =>
                setNewTableShape(
                  e.target.value as TableShape
                )
              }
              className="h-11 border border-gray-200 rounded-xl px-3 bg-white text-black"
            >
              <option value="rectangle">
                Rectangle
              </option>

              <option value="round">
                Round
              </option>
            </select>

            <button
              onClick={createTable}
              disabled={creating}
              className="h-11 bg-[#101811] text-white px-5 rounded-xl font-semibold"
            >
              {creating
                ? "Adding..."
                : "+ Add Table"}
            </button>

          </div>

        </div>

        <p className="text-sm text-gray-500 mt-4">
          {mode === "occupancy"
            ? "Tap a seat when somebody sits down or leaves."
            : "Drag tables and use the editing controls below each table."}
        </p>

        {message && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mt-4 text-sm">
            {message}
          </div>
        )}

        {/* FLOOR */}

        <div className="overflow-x-auto mt-6 pb-3">

          <div
            ref={canvasRef}
            className="relative min-w-[900px] h-[660px] bg-white border border-gray-200 rounded-[28px] overflow-hidden"
            style={{
              touchAction: "none",
            }}
          >

            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            <div className="absolute top-5 left-6 text-xs font-bold tracking-widest text-gray-300">
              MAIN FLOOR
            </div>

            {tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-center">

                <div>
                  <h2 className="text-xl font-bold">
                    Your floor is empty
                  </h2>

                  <p className="text-gray-400 mt-2">
                    Add your first table above.
                  </p>
                </div>

              </div>
            )}

            {tables.map((table) => (
              <div
                key={table.id}
                onPointerDown={(event) =>
                  startDrag(event, table)
                }
                onPointerMove={(event) =>
                  dragTable(
                    event,
                    table.id
                  )
                }
                onPointerUp={(event) =>
                  finishDrag(
                    event,
                    table.id
                  )
                }
                style={{
                  position: "absolute",
                  left: `${table.xPct}%`,
                  top: `${table.yPct}%`,
                  width: "205px",
                  userSelect: "none",
                  cursor:
                    mode === "layout"
                      ? dragging ===
                        table.id
                        ? "grabbing"
                        : "grab"
                      : "default",
                  zIndex:
                    dragging === table.id
                      ? 50
                      : 10,
                }}
                className={`border p-3 shadow-md ${
                  table.shape === "round"
                    ? "rounded-[40px]"
                    : "rounded-[22px]"
                } ${
                  mode === "layout"
                    ? "bg-green-50 border-green-200"
                    : "bg-white border-gray-200"
                }`}
              >

                {mode === "layout" && (
                  <p className="text-[10px] text-green-700 font-bold tracking-widest text-center mb-2">
                    DRAG TO MOVE
                  </p>
                )}

                <div
                  className={`bg-[#101811] flex items-center justify-center px-3 ${
                    table.shape === "round"
                      ? "w-24 h-24 rounded-full mx-auto"
                      : "h-20 rounded-2xl"
                  }`}
                >
                  <span className="text-white text-sm font-semibold text-center">
                    {table.name}
                  </span>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mt-3">

                  {table.seats.map(
                    (seat) => (
                      <button
                        key={seat.id}
                        disabled={
                          mode === "layout"
                        }
                        onPointerDown={(
                          event
                        ) =>
                          event.stopPropagation()
                        }
                        onClick={(event) => {
                          event.stopPropagation();

                          toggleSeat(
                            table.id,
                            seat.id
                          );
                        }}
                        className={`w-9 h-9 rounded-full text-xs font-bold text-white ${
                          seat.status ===
                          "available"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      >
                        {seat.id}
                      </button>
                    )
                  )}

                </div>

                {mode === "layout" && (
                  <div
                    onPointerDown={(event) =>
                      event.stopPropagation()
                    }
                    className="mt-4 pt-3 border-t border-green-200"
                  >

                    <div className="grid grid-cols-2 gap-2">

                      <button
                        onClick={() =>
                          renameTable(
                            table
                          )
                        }
                        className="bg-white border border-gray-200 rounded-lg py-2 text-xs font-semibold"
                      >
                        Rename
                      </button>

                      <button
                        onClick={() =>
                          changeShape(
                            table
                          )
                        }
                        className="bg-white border border-gray-200 rounded-lg py-2 text-xs font-semibold"
                      >
                        {table.shape ===
                        "round"
                          ? "Rectangle"
                          : "Round"}
                      </button>

                      <button
                        onClick={() =>
                          addSeat(table)
                        }
                        className="bg-white border border-gray-200 rounded-lg py-2 text-xs font-semibold"
                      >
                        + Seat
                      </button>

                      <button
                        onClick={() =>
                          removeSeat(
                            table
                          )
                        }
                        className="bg-white border border-gray-200 rounded-lg py-2 text-xs font-semibold"
                      >
                        − Seat
                      </button>

                    </div>

                    <button
                      onClick={() =>
                        removeTable(
                          table
                        )
                      }
                      className="w-full text-red-500 hover:bg-red-50 rounded-lg py-2 text-xs font-semibold mt-2"
                    >
                      Delete Table
                    </button>

                  </div>
                )}

              </div>
            ))}

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
                Make sure your floor plan is ready. SeatMate will
                review your business before customers can find it.
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
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 mt-8">
            <p className="font-bold">Pending SeatMate approval</p>
            <p className="text-sm mt-1">
              Your business has been submitted and is waiting for review.
            </p>
          </div>
        )}

        {businessStatus === "approved" && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-5 mt-8">
            <p className="font-bold">Business approved</p>
            <p className="text-sm mt-1">
              Your location is live on SeatMate.
            </p>
          </div>
        )}

        {businessStatus === "suspended" && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 mt-8">
            <p className="font-bold">Business suspended</p>
            <p className="text-sm mt-1">
              Your location is currently hidden from SeatMate customers.
            </p>
          </div>
        )}

      </div>

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
              onChange={(event) =>
                setRenameValue(event.target.value)
              }
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
                disabled={
                  savingRename ||
                  !renameValue.trim()
                }
                className="flex-1 bg-[#101811] hover:bg-black text-white font-bold py-3 rounded-xl transition disabled:opacity-40"
              >
                {savingRename
                  ? "Saving..."
                  : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              This removes the table and all of its seats from
              the floor plan.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(null)
                }
                className="flex-1 border border-gray-200 hover:bg-gray-50 font-semibold py-3 rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void confirmDeleteTable()
                }
                disabled={deletingTable}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40"
              >
                {deletingTable
                  ? "Deleting..."
                  : "Delete Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
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
          green
            ? "text-green-600"
            : "text-[#101811]"
        }`}
      >
        {value}
      </p>

    </div>
  );
}