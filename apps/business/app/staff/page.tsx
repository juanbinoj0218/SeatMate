"use client";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@seatmate/shared/firebase";

import TableWithSeats, {
  parseTableRotation,
  parseTableShape,
  type TableRotation,
  type TableShape,
} from "@seatmate/shared/components/TableWithSeats";

import GameStatus from "@seatmate/shared/components/GameStatus";
import {
  isGameMarker,
  MARKERS,
  markerStatus,
  type MarkerType,
} from "@seatmate/shared/floor-plan";

import { doorRef, readDoorCount } from "@seatmate/shared/door-count";

import UpdateReminder from "@/components/update-reminder";
import { toggleSeat as toggleSeatStatus } from "@/lib/seat-updates";

type Seat = {
  id: number;
  status: "available" | "occupied";
};

type Table = {
  id: string;
  name: string;
  seats: Seat[];
  xPct: number;
  yPct: number;
  shape: TableShape;
  rotation: TableRotation;
};

// A pool table or darts board staff can mark as in use.
type Game = {
  id: string;
  type: MarkerType;
  label: string;
  status: "available" | "occupied";
};

type StaffAccount = {
  businessId: string;
  businessName: string;
  role: string;
  active: boolean;
  email?: string;
};

export default function StaffConsolePage() {
  const router = useRouter();

  const [staffAccount, setStaffAccount] =
    useState<StaffAccount | null>(null);

  const [tables, setTables] =
    useState<Table[]>([]);

  const [games, setGames] =
    useState<Game[]>([]);

  const [loading, setLoading] =
    useState(true);

  // People inside, when the owner has bouncer mode on.
  const [doorCount, setDoorCount] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let stopGames: (() => void) | undefined;
    let stopDoor: (() => void) | undefined;
    let stopTables:
      | (() => void)
      | undefined;

    const stopAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.push("/business/login");
          return;
        }

        try {
          const staffRef = doc(
            db,
            "staffUsers",
            currentUser.uid
          );

          const staffSnap =
            await getDoc(staffRef);

          if (!staffSnap.exists()) {
            router.push("/business");
            return;
          }

          const account =
            staffSnap.data() as StaffAccount;

          if (!account.active) {
            setError(
              "Your staff access has been disabled."
            );

            setLoading(false);
            return;
          }

          setStaffAccount(account);

          const tablesRef = collection(
            db,
            "businesses",
            account.businessId,
            "tables"
          );

          stopDoor = onSnapshot(
            doorRef(account.businessId),
            (snapshot) => {
              const door = readDoorCount(snapshot.data({ serverTimestamps: "estimate" }));
              setDoorCount(door.enabled ? door.count : null);
            },
            (snapshotError) => console.error(snapshotError)
          );

          stopGames = onSnapshot(
            collection(db, "businesses", account.businessId, "floorMarkers"),
            (snapshot) => {
              setGames(
                snapshot.docs
                  .map((markerDoc) => {
                    const data = markerDoc.data();
                    const type = (
                      data.type in MARKERS ? data.type : "outlet"
                    ) as MarkerType;

                    return {
                      id: markerDoc.id,
                      type,
                      label:
                        typeof data.label === "string"
                          ? data.label
                          : MARKERS[type].label,
                      status: markerStatus(data.status),
                    };
                  })
                  .filter((game) => isGameMarker(game.type))
                  .sort((a, b) => a.label.localeCompare(b.label))
              );
            },
            (snapshotError) => console.error(snapshotError)
          );

          stopTables = onSnapshot(
            tablesRef,
            (snapshot) => {
              const loadedTables: Table[] =
                snapshot.docs.map(
                  (tableDoc, index) => {
                    const data =
                      tableDoc.data();

                    return {
                      id: tableDoc.id,

                      name:
                        data.name ||
                        "Table",

                      seats:
                        data.seats || [],

                      xPct:
                        typeof data.xPct ===
                        "number"
                          ? data.xPct
                          : 8 +
                            (index % 3) *
                              30,

                      yPct:
                        typeof data.yPct ===
                        "number"
                          ? data.yPct
                          : 10 +
                            Math.floor(
                              index / 3
                            ) *
                              30,

                      shape: parseTableShape(data.shape),
                      rotation: parseTableRotation(data.rotation),
                    };
                  }
                );

              setTables(
                loadedTables
              );

              setLoading(false);
            },
            (snapshotError) => {
              console.error(
                snapshotError
              );

              setError(
                "Could not load the floor plan."
              );

              setLoading(false);
            }
          );
        } catch (err) {
          console.error(err);

          setError(
            "Could not load your staff account."
          );

          setLoading(false);
        }
      }
    );

    return () => {
      stopAuth();
      stopTables?.();
      stopGames?.();
      stopDoor?.();
    };
  }, [router]);

  const toggleSeat = async (
    tableId: string,
    seatId: number
  ) => {
    if (!staffAccount) return;

    try {
      setError("");

      await toggleSeatStatus(
        staffAccount.businessId,
        tableId,
        seatId,
        tables
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not update this seat."
      );
    }
  };

  const toggleGame = async (game: Game) => {
    if (!staffAccount) return;

    try {
      setError("");

      await updateDoc(
        doc(db, "businesses", staffAccount.businessId, "floorMarkers", game.id),
        {
          status: game.status === "occupied" ? "available" : "occupied",
          statusUpdatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not update this game."
      );
    }
  };

  const handleLogout = async () => {
    await signOut(auth);

    router.push(
      "/business/login"
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <p className="text-gray-500">
          Loading staff console...
        </p>
      </main>
    );
  }

  if (!staffAccount) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">

        <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center max-w-md">

          <h1 className="text-2xl font-bold">
            Staff access unavailable
          </h1>

          <p className="text-gray-500 mt-3">
            {error}
          </p>

          <button
            onClick={handleLogout}
            className="bg-[#101811] text-white px-6 py-3 rounded-xl mt-6"
          >
            Sign Out
          </button>

        </div>

      </main>
    );
  }

  const totalSeats =
    tables.reduce(
      (total, table) =>
        total +
        table.seats.length,
      0
    );

  const availableSeats =
    tables.reduce(
      (total, table) =>
        total +
        table.seats.filter(
          (seat) =>
            seat.status ===
            "available"
        ).length,
      0
    );

  const occupiedSeats =
    totalSeats -
    availableSeats;

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="bg-white border-b border-[#e3e7e2]">

        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 flex items-center justify-center text-[#101811]">
              <SeatMateMark className="h-[85%] w-[85%]" />
            </div>

            <div>
              <p className="font-bold text-[#101811]">
                SeatMate
              </p>

              <p className="text-xs text-gray-400">
                Staff Console
              </p>
            </div>

          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/business/security"
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-[#101811] transition"
            >
              Security
            </Link>

            <button
              onClick={handleLogout}
              className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Log Out
            </button>
          </div>

        </div>

      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <UpdateReminder businessId={staffAccount.businessId} />

        {/* BUSINESS */}

        <div>

          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">

            <span className="relative flex h-2.5 w-2.5">

              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />

              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />

            </span>

            LIVE STAFF MODE

          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#101811] mt-4">

            {staffAccount.businessName}

          </h1>

          <p className="text-gray-500 mt-2">
            Tap a seat when its availability changes.
          </p>

        </div>

        {doorCount !== null && (
          <Link
            href="/business/door"
            className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-[#101811] px-5 py-4 text-white"
          >
            <span>
              <span className="block font-bold">Door counter</span>
              <span className="block text-sm text-white/60">
                {doorCount} inside · tap people in and out
              </span>
            </span>
            <span className="font-semibold">Open →</span>
          </Link>
        )}

        {/* STATS */}

        <div className="grid grid-cols-3 gap-4 mt-8">

          <div className="bg-white border border-[#e3e7e2] rounded-2xl p-5">

            <p className="text-xs font-bold text-gray-400 uppercase">
              Total
            </p>

            <p className="text-2xl font-bold text-[#101811] mt-2">
              {totalSeats}
            </p>

          </div>

          <div className="bg-white border border-[#e3e7e2] rounded-2xl p-5">

            <p className="text-xs font-bold text-gray-400 uppercase">
              Available
            </p>

            <p className="text-2xl font-bold text-green-600 mt-2">
              {availableSeats}
            </p>

          </div>

          <div className="bg-white border border-[#e3e7e2] rounded-2xl p-5">

            <p className="text-xs font-bold text-gray-400 uppercase">
              Occupied
            </p>

            <p className="text-2xl font-bold text-red-500 mt-2">
              {occupiedSeats}
            </p>

          </div>

        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 mt-6">
            {error}
          </div>
        )}

        {/* FLOOR HEADER */}

        <div className="flex items-end justify-between mt-12">

          <div>

            <p className="text-xs font-bold tracking-wider text-gray-400">
              LIVE FLOOR
            </p>

            <h2 className="text-3xl font-bold text-[#101811] mt-2">
              Update availability
            </h2>

            <p className="text-gray-500 mt-2">
              Tap a seat to switch between available and occupied.
            </p>

          </div>

          <div className="hidden sm:flex gap-5 text-xs font-semibold">

            <span className="text-green-600">
              ● Available
            </span>

            <span className="text-red-500">
              ● Occupied
            </span>

          </div>

        </div>

        {/* POOL TABLES / DARTS */}

        {games.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => void toggleGame(game)}
                aria-label={`${game.label}: ${game.status === "occupied" ? "in use" : "open"}`}
                className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition active:scale-95 ${
                  game.status === "occupied" ? "border-red-200" : "border-green-200"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {MARKERS[game.type].icon}
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#101811]">
                    {game.label}
                  </span>
                  <GameStatus status={game.status} size={11} />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* EXACT FLOOR GRID */}

        <div className="overflow-x-auto mt-6 pb-3">

          <div
            className="relative min-w-[900px] h-[620px] bg-white border border-[#dfe4de] rounded-[28px] overflow-hidden"
          >

            {/* GRID BACKGROUND */}

            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",

                backgroundSize:
                  "32px 32px",
              }}
            />

            <div className="absolute top-5 left-6 text-xs font-bold tracking-[0.18em] text-gray-300">
              MAIN FLOOR
            </div>

            {tables.length ===
              0 && (
              <div className="absolute inset-0 flex items-center justify-center">

                <div className="text-center">

                  <p className="font-bold text-xl text-[#101811]">
                    No seating layout yet
                  </p>

                  <p className="text-gray-400 mt-2">
                    The owner has not created any tables yet.
                  </p>

                </div>

              </div>
            )}

            {/* TABLES */}

            {tables.map((table) => {
              return (
                <div
                  key={table.id}
                  className="absolute"
                  style={{
                    left: `${table.xPct}%`,
                    top: `${table.yPct}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <TableWithSeats
                    name={table.name}
                    shape={table.shape}
                    seats={table.seats}
                    // A bit larger than the owner's view so seats are easy to tap.
                    scale={1.15}
                    rotation={table.rotation}
                    onSeatClick={(seatId) => toggleSeat(table.id, seatId)}
                  />
                </div>
              );
            })}

          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-10">
          Changes update the customer view automatically.
        </p>

      </div>

    </main>
  );
}