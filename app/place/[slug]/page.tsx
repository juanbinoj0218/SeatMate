"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import BackButton from "@/components/BackButton";
<BackButton fallback="/business" />


import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

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
  occupancyUpdatedAt?: Timestamp | null;
};


type PublicBusiness = {
  businessId: string;
  name: string;
  address: string;
  type: string;
};

export default function PlacePage() {
  const params =
    useParams<{ slug: string }>();

  const slug = params.slug;
  
  const router = useRouter();
const searchParams = useSearchParams();

const fromBusiness =
  searchParams.get("from") === "business";

  const [business, setBusiness] =
    useState<PublicBusiness | null>(null);

  const [tables, setTables] =
    useState<Table[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [notFound, setNotFound] =
    useState(false);
  
  const [now, setNow] =
    useState(Date.now());


  useEffect(() => {
  const interval = window.setInterval(() => {
    setNow(Date.now());
  }, 30000);

  return () => {
    window.clearInterval(interval);
  };
}, []);

  useEffect(() => {
    let unsubscribeTables:
      | (() => void)
      | undefined;

    const loadBusiness = async () => {
      try {
        const businessRef = doc(
          db,
          "publicBusinesses",
          slug
        );

        const businessSnap =
          await getDoc(businessRef);

        if (!businessSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const businessData =
          businessSnap.data() as PublicBusiness;

        setBusiness(businessData);

        const tablesRef = collection(
          db,
          "businesses",
          businessData.businessId,
          "tables"
        );

        unsubscribeTables = onSnapshot(
          tablesRef,
          (snapshot) => {
            const data: Table[] =
              snapshot.docs.map(
                (tableDoc, index) => {
                  const table =
                    tableDoc.data();

                  return {
  id: tableDoc.id,
  name: table.name,
  seats: table.seats || [],

  xPct:
    typeof table.xPct === "number"
      ? table.xPct
      : 8 + (index % 3) * 30,

  yPct:
    typeof table.yPct === "number"
      ? table.yPct
      : 10 +
        Math.floor(index / 3) * 30,

  shape:
    table.shape === "round"
      ? "round"
      : "rectangle",

  occupancyUpdatedAt:
    table.occupancyUpdatedAt instanceof Timestamp
      ? table.occupancyUpdatedAt
      : null,
};
                }
              );

            setTables(data);
            setLoading(false);
          },
          (error) => {
            console.error(error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    loadBusiness();

    

    return () => {
      unsubscribeTables?.();
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <div className="text-center">

          <div className="w-12 h-12 rounded-2xl bg-green-600 text-white font-bold flex items-center justify-center mx-auto">
            S
          </div>

          <p className="text-gray-500 mt-4">
            Finding open seats...
          </p>

        </div>
      </main>
    );
  }

  if (notFound || !business) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">

        <div className="text-center">
          <div className="text-5xl">
            🪑
          </div>

          <h1 className="text-3xl font-bold text-[#101811] mt-5">
            Location not found
          </h1>

          <p className="text-gray-500 mt-2">
            This SeatMate location doesn&apos;t exist.
          </p>
        </div>

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

  const percentage =
    totalSeats === 0
      ? 0
      : Math.round(
          (availableSeats /
            totalSeats) *
            100
        );

  const availabilityLabel =
    percentage >= 60
      ? "Plenty of seating"
      : percentage >= 25
        ? "Some seats available"
        : percentage > 0
          ? "Limited seating"
          : "Currently full";

  const STALE_AFTER_MINUTES = 15;

const latestUpdateMs =
  tables.reduce<number | null>(
    (latest, table) => {
      const timestamp =
        table.occupancyUpdatedAt;

      if (!timestamp) {
        return latest;
      }

      const milliseconds =
        timestamp.toMillis();

      if (
        latest === null ||
        milliseconds > latest
      ) {
        return milliseconds;
      }

      return latest;
    },
    null
  );

const ageMinutes =
  latestUpdateMs === null
    ? null
    : Math.max(
        0,
        Math.floor(
          (now - latestUpdateMs) /
            60000
        )
      );

let freshnessLabel =
  "No occupancy update yet";

if (ageMinutes !== null) {
  if (ageMinutes < 1) {
    freshnessLabel =
      "Updated just now";
  } else if (ageMinutes === 1) {
    freshnessLabel =
      "Updated 1 minute ago";
  } else if (ageMinutes < 60) {
    freshnessLabel =
      `Updated ${ageMinutes} minutes ago`;
  } else {
    const hours =
      Math.floor(
        ageMinutes / 60
      );

    freshnessLabel =
      hours === 1
        ? "Updated 1 hour ago"
        : `Updated ${hours} hours ago`;
  }
}

const isStale =
  ageMinutes === null ||
  ageMinutes >=
    STALE_AFTER_MINUTES;

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="bg-white border-b border-[#e3e7e2]">
  <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">

    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center">
        S
      </div>

      <span className="font-bold text-xl text-[#101811]">
        SeatMate
      </span>
    </div>

    {fromBusiness && (
      <button
        onClick={() => router.push("/business")}
        className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
      >
        ← Back to Business
      </button>
    )}

  </div>
</header>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* LOCATION */}

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">

          <div>
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>

              LIVE AVAILABILITY
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#101811] mt-4">
              {business.name}
            </h1>

            <p className="text-gray-500 mt-2">
              {business.type} ·{" "}
              {business.address}
            </p>
          </div>

          <div
  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
    isStale
      ? "bg-amber-50 text-amber-700 border border-amber-200"
      : "bg-green-50 text-green-700 border border-green-200"
  }`}
>
  <span
    className={`w-2 h-2 rounded-full ${
      isStale
        ? "bg-amber-500"
        : "bg-green-500"
    }`}
  />

  {freshnessLabel}
</div>
        </div>

        {/* AVAILABILITY HERO */}

        <div className="bg-[#101811] rounded-[30px] p-8 md:p-10 mt-10 text-white relative overflow-hidden">

          <div className="relative z-10 grid md:grid-cols-[1fr_auto] gap-8 md:items-center">

            <div>

              <p className="text-xs font-bold tracking-[0.18em] text-green-400">
                AVAILABLE RIGHT NOW
              </p>

              {isStale && (
  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mt-4">

    <p className="font-semibold text-amber-800">
      Availability may be outdated
    </p>

    <p className="text-sm text-amber-700 mt-1">
      This location has not updated its seating recently.
      Current availability may have changed.
    </p>

  </div>
)}

              <div className="flex items-end gap-3 mt-4">

                <span className="text-6xl md:text-7xl font-bold leading-none">
                  {availableSeats}
                </span>

                <span className="text-white/50 pb-2">
                  of {totalSeats} seats
                </span>

              </div>

              <p className="text-xl font-semibold mt-6">
                {availabilityLabel}
              </p>

              <p className="text-white/50 text-sm mt-2">
                Based on live updates from the location.
              </p>

            </div>

            <div className="md:text-right">

              <div className="inline-flex items-center justify-center w-28 h-28 rounded-full border-[8px] border-green-500/20 relative">

                <div className="absolute inset-[-8px] rounded-full border-[8px] border-green-500 border-l-transparent" />

                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {percentage}%
                  </div>

                  <div className="text-[10px] text-white/50 uppercase">
                    Open
                  </div>
                </div>

              </div>

            </div>

          </div>

          <div className="absolute -right-20 -bottom-28 w-80 h-80 bg-green-500/10 rounded-full" />

        </div>

        {/* SMALL STATS */}

        <div className="grid grid-cols-2 gap-4 mt-5">

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

            <p className="text-2xl font-bold text-[#101811] mt-2">
              {occupiedSeats}
            </p>

          </div>

        </div>

        {/* FLOOR PLAN */}

        <div className="flex items-end justify-between mt-12">

          <div>
            <p className="text-xs font-bold tracking-wider text-gray-400">
              LIVE FLOOR
            </p>

            <h2 className="text-3xl font-bold text-[#101811] mt-2">
              Find your seat
            </h2>

            <p className="text-gray-500 mt-2">
              Green seats are currently available.
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

        <div className="overflow-x-auto mt-6 pb-3">

          <div
            className="relative min-w-[900px] h-[620px] bg-white border border-[#dfe4de] rounded-[28px] overflow-hidden"
          >

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

            {tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">

                <div className="text-center">
                  <p className="font-bold text-xl text-[#101811]">
                    No seating layout yet
                  </p>

                  <p className="text-gray-400 mt-2">
                    This business hasn&apos;t published its floor plan.
                  </p>
                </div>

              </div>
            )}

            {tables.map((table) => (

              <div
                key={table.id}
                style={{
                  position: "absolute",
                  left: `${table.xPct}%`,
                  top: `${table.yPct}%`,
                  width: "190px",
                }}
                className="bg-white rounded-[22px] border border-gray-200 p-3 shadow-md"
              >

                <div
  className={`bg-[#101811] flex items-center justify-center px-3 ${
    table.shape === "round"
      ? "w-24 h-24 rounded-full mx-auto"
      : "h-20 rounded-2xl"
  }`}
>
  <span className="text-white text-sm font-semibold text-center truncate">
    {table.name}
  </span>
</div>

                <div className="flex flex-wrap justify-center gap-2 mt-3">

                  {table.seats.map(
                    (seat) => (

                      <div
                        key={seat.id}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          seat.status ===
                          "available"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      >
                        {seat.id}
                      </div>

                    )
                  )}

                </div>

              </div>

            ))}

          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-10">
          Seat availability may change as customers arrive and leave.
        </p>

      </div>
    </main>
  );
}