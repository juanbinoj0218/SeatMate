"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

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
  shape: "rectangle" | "round";
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

  const [user, setUser] =
    useState<User | null>(null);

  const [staffAccount, setStaffAccount] =
    useState<StaffAccount | null>(null);

  const [tables, setTables] =
    useState<Table[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
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

        setUser(currentUser);

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

                      shape:
                        data.shape ===
                        "round"
                          ? "round"
                          : "rectangle",
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
    };
  }, [router]);

  const toggleSeat = async (
    tableId: string,
    seatId: number
  ) => {
    if (!staffAccount) return;

    try {
      setError("");

      const tableRef = doc(
        db,
        "businesses",
        staffAccount.businessId,
        "tables",
        tableId
      );

      await runTransaction(
        db,
        async (transaction) => {
          const tableSnap =
            await transaction.get(
              tableRef
            );

          if (!tableSnap.exists()) {
            throw new Error(
              "Table not found."
            );
          }

          const data =
            tableSnap.data();

          const currentSeats: Seat[] =
            data.seats || [];

          const updatedSeats =
            currentSeats.map(
              (seat) => {
                if (
                  seat.id !== seatId
                ) {
                  return seat;
                }

                return {
                  ...seat,

                  status:
                    seat.status ===
                    "available"
                      ? "occupied"
                      : "available",
                } as Seat;
              }
            );

          transaction.update(
  tableRef,
  {
    seats: updatedSeats,
    occupancyUpdatedAt:
      serverTimestamp(),
  }
);
        }
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not update this seat."
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

            <div className="w-10 h-10 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center">
              S
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

          <button
            onClick={handleLogout}
            className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Log Out
          </button>

        </div>

      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">

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

            {tables.map(
              (table) => (

                <div
                  key={table.id}
                  style={{
                    position:
                      "absolute",

                    left: `${table.xPct}%`,

                    top: `${table.yPct}%`,

                    width:
                      "190px",
                  }}
                  className="bg-white rounded-[22px] border border-gray-200 p-3 shadow-md"
                >

                  {/* TABLE TOP */}

                  <div
                    className={`bg-[#101811] flex items-center justify-center px-3 ${
                      table.shape ===
                      "round"
                        ? "w-24 h-24 rounded-full mx-auto"
                        : "h-20 rounded-2xl"
                    }`}
                  >

                    <span className="text-white text-sm font-semibold text-center truncate">

                      {table.name}

                    </span>

                  </div>

                  {/* SEATS */}

                  <div className="flex flex-wrap justify-center gap-2 mt-3">

                    {table.seats.map(
                      (seat) => (

                        <button
                          key={
                            seat.id
                          }
                          onClick={() =>
                            toggleSeat(
                              table.id,
                              seat.id
                            )
                          }
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white transition hover:scale-110 active:scale-95 ${
                            seat.status ===
                            "available"
                              ? "bg-green-500 hover:bg-green-600"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                        >

                          {seat.id}

                        </button>

                      )
                    )}

                  </div>

                </div>

              )
            )}

          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-10">
          Changes update the customer view automatically.
        </p>

      </div>

    </main>
  );
}