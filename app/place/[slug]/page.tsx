"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

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
  scale: number;
  occupancyUpdatedAt?: Timestamp | null;
};

type MarkerType =
  | "outlet"
  | "window"
  | "register"
  | "counter"
  | "door"
  | "entrance"
  | "restroom"
  | "wall";

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

const clamp = (
  value: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, value));

type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

type Hours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

type DayName = keyof Hours;

type PublicBusiness = {
  businessId: string;
  name: string;
  address: string;
  type: string;
  hours?: Hours;
  timezone?: string;
};

const dayLabels: {
  key: DayName;
  label: string;
}[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const dayOrder: DayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const toMinutes = (time: string) => {
  const [hour, minute] =
    time.split(":").map(Number);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return hour * 60 + minute;
};

const formatHour = (time: string) => {
  const minutes = toMinutes(time);

  if (minutes === null) {
    return time;
  }

  const hour =
    Math.floor(minutes / 60);

  const minute =
    minutes % 60;

  const suffix =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${minute
    .toString()
    .padStart(2, "0")} ${suffix}`;
};

const getOpenStatus = (
  hours: Hours | undefined,
  timezone: string | undefined,
  nowMs: number
) => {
  if (!hours || !timezone) {
    return null;
  }

  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: timezone,
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }
      ).formatToParts(
        new Date(nowMs)
      );

    const weekdayValue =
      parts
        .find(
          (part) =>
            part.type === "weekday"
        )
        ?.value.toLowerCase();

    const hourValue =
      parts.find(
        (part) =>
          part.type === "hour"
      )?.value;

    const minuteValue =
      parts.find(
        (part) =>
          part.type === "minute"
      )?.value;

    if (
      !weekdayValue ||
      hourValue === undefined ||
      minuteValue === undefined
    ) {
      return null;
    }

    const day =
      weekdayValue as DayName;

    const currentMinutes =
      Number(hourValue) * 60 +
      Number(minuteValue);

    const today =
      hours[day];

    let openNow = false;

    if (today && !today.closed) {
      const opening =
        toMinutes(today.open);

      const closing =
        toMinutes(today.close);

      if (
        opening !== null &&
        closing !== null
      ) {
        if (closing > opening) {
          openNow =
            currentMinutes >= opening &&
            currentMinutes < closing;
        } else {
          openNow =
            currentMinutes >= opening;
        }
      }
    }

    if (!openNow) {
      const currentIndex =
        dayOrder.indexOf(day);

      const previousDay =
        dayOrder[
          (currentIndex + 6) %
            dayOrder.length
        ];

      const previous =
        hours[previousDay];

      if (
        previous &&
        !previous.closed
      ) {
        const previousOpening =
          toMinutes(previous.open);

        const previousClosing =
          toMinutes(previous.close);

        if (
          previousOpening !== null &&
          previousClosing !== null &&
          previousClosing <=
            previousOpening &&
          currentMinutes <
            previousClosing
        ) {
          openNow = true;
        }
      }
    }

    return {
      open: openNow,
      day,
    };
  } catch (error) {
    console.error(
      "Could not calculate business open status:",
      error
    );

    return null;
  }
};

export default function PlacePage() {
  const params =
    useParams<{ slug: string }>();

  const slug = params.slug;

  const router = useRouter();

  const [fromBusiness, setFromBusiness] =
    useState(false);

const [business, setBusiness] =
    useState<PublicBusiness | null>(null);

  const [tables, setTables] =
    useState<Table[]>([]);

  const [markers, setMarkers] =
    useState<FloorMarker[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [notFound, setNotFound] =
    useState(false);
  
  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    setFromBusiness(
      searchParams.get("from") ===
        "business"
    );
  }, []);

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

    let unsubscribeMarkers:
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

  scale:
    typeof table.scale === "number"
      ? clamp(table.scale, 0.65, 1.8)
      : 1,

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


        const markersRef = collection(
          db,
          "businesses",
          businessData.businessId,
          "floorMarkers"
        );

        unsubscribeMarkers = onSnapshot(
          markersRef,
          (snapshot) => {
            const data: FloorMarker[] =
              snapshot.docs.map(
                (markerDoc, index) => {
                  const marker =
                    markerDoc.data();

                  const type: MarkerType =
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
                        ? clamp(marker.xPct, 0, 100)
                        : 15 + (index % 4) * 20,

                    yPct:
                      typeof marker.yPct === "number"
                        ? clamp(marker.yPct, 0, 100)
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
            console.error(
              "Could not load floor markers:",
              error
            );
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
      unsubscribeMarkers?.();
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

const openStatus =
  getOpenStatus(
    business.hours,
    business.timezone,
    now
  );

const todaysHours =
  openStatus
    ? business.hours?.[
        openStatus.day
      ]
    : undefined;

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

            {openStatus && (
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
                    openStatus.open
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      openStatus.open
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />

                  {openStatus.open
                    ? "Open now"
                    : "Closed now"}
                </span>

                {todaysHours && (
                  <span className="text-sm text-gray-500">
                    {todaysHours.closed
                      ? "Closed today"
                      : `Today ${formatHour(
                          todaysHours.open
                        )} – ${formatHour(
                          todaysHours.close
                        )}`}
                  </span>
                )}
              </div>
            )}
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

        {/* BUSINESS HOURS */}

        {business.hours && (
          <div className="bg-white border border-[#e3e7e2] rounded-[26px] p-6 mt-8">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

              <div>
                <p className="text-xs font-bold tracking-wider text-gray-400">
                  HOURS
                </p>

                <h2 className="text-2xl font-bold text-[#101811] mt-2">
                  Business hours
                </h2>
              </div>

              {openStatus && (
                <span
                  className={`text-sm font-bold ${
                    openStatus.open
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {openStatus.open
                    ? "● Open now"
                    : "● Closed now"}
                </span>
              )}

            </div>

            <div className="mt-5 divide-y divide-gray-100">

              {dayLabels.map(
                ({ key, label }) => {
                  const dayHours =
                    business.hours?.[key];

                  const isToday =
                    openStatus?.day === key;

                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between gap-4 py-3 ${
                        isToday
                          ? "text-[#101811] font-semibold"
                          : "text-gray-500"
                      }`}
                    >

                      <div className="flex items-center gap-2">
                        <span>
                          {label}
                        </span>

                        {isToday && (
                          <span className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-full font-bold">
                            TODAY
                          </span>
                        )}
                      </div>

                      <span className="text-right">
                        {!dayHours ||
                        dayHours.closed
                          ? "Closed"
                          : `${formatHour(
                              dayHours.open
                            )} – ${formatHour(
                              dayHours.close
                            )}`}
                      </span>

                    </div>
                  );
                }
              )}

            </div>

          </div>
        )}

        {/* FLOOR PLAN */}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-12">

          <div>
            <p className="text-xs font-bold tracking-wider text-gray-400">
              LIVE FLOOR
            </p>

            <h2 className="text-3xl font-bold text-[#101811] mt-2">
              Find your seat
            </h2>

            <p className="text-gray-500 mt-2">
              This is the same live floor plan created by the business.
            </p>
          </div>

          <div className="flex gap-5 text-xs font-semibold">

            <span className="text-green-600">
              ● Available
            </span>

            <span className="text-red-500">
              ● Occupied
            </span>

          </div>

        </div>

        <div className="overflow-auto mt-6 pb-3 border border-gray-200 rounded-[30px] bg-gray-100/50 p-3">

          <div
            className="relative bg-white border border-gray-300 rounded-[24px] overflow-hidden shadow-inner"
            style={{
              width: "1000px",
              minWidth: "1000px",
              height: "700px",
            }}
          >

            <div
              className="absolute inset-0 pointer-events-none opacity-55"
              style={{
                backgroundImage:
                  "linear-gradient(#dfe4df 1px, transparent 1px), linear-gradient(90deg, #dfe4df 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            <div className="absolute top-5 left-6 text-xs font-bold tracking-widest text-gray-300 pointer-events-none">
              TOP-DOWN FLOOR
            </div>

            {tables.length === 0 &&
              markers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-center">

                  <div>
                    <p className="font-bold text-xl text-[#101811]">
                      No seating layout yet
                    </p>

                    <p className="text-gray-400 mt-2">
                      This business hasn&apos;t published its floor plan.
                    </p>
                  </div>

                </div>
              )}

            {/* ROOM MARKERS */}

            {markers.map((marker) => {
              const info =
                MARKERS[marker.type];

              const displayScale =
                marker.scale;

              return (
                <div
                  key={marker.id}
                  className={`absolute flex items-center justify-center border text-center font-bold select-none pointer-events-none ${
                    marker.type === "wall"
                      ? "bg-gray-700 border-gray-800 text-white"
                      : marker.type === "window"
                        ? "bg-sky-50 border-sky-300 text-sky-800"
                        : marker.type === "outlet"
                          ? "bg-amber-50 border-amber-300 text-amber-800 rounded-xl"
                          : "bg-white border-gray-300 text-[#101811] rounded-xl shadow-sm"
                  }`}
                  style={{
                    left: `${marker.xPct}%`,
                    top: `${marker.yPct}%`,
                    width: `${
                      info.width *
                      displayScale
                    }px`,
                    height: `${
                      info.height *
                      displayScale
                    }px`,
                    transform: `translate(-50%, -50%) rotate(${marker.rotation}deg)`,
                    zIndex: 5,
                    fontSize: `${Math.max(
                      9,
                      11 * displayScale
                    )}px`,
                  }}
                >
                  {marker.type ===
                  "wall" ? null : (
                    <div
                      className="leading-tight"
                      style={{
                        transform: `rotate(${-marker.rotation}deg)`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: `${Math.max(
                            12,
                            17 *
                              displayScale
                          )}px`,
                        }}
                      >
                        {info.icon}
                      </div>

                      {marker.scale >=
                        0.75 && (
                        <div className="mt-0.5">
                          {marker.label}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}

            {/* TABLES */}

            {tables.map((table) => {
              const displayScale =
                table.scale;

              const baseWidth =
                table.shape === "round"
                  ? 175
                  : 210;

              const baseHeight =
                table.shape === "round"
                  ? 175
                  : 165;

              return (
                <div
                  key={table.id}
                  className="absolute select-none pointer-events-none"
                  style={{
                    left: `${table.xPct}%`,
                    top: `${table.yPct}%`,
                    width: `${
                      baseWidth *
                      displayScale
                    }px`,
                    height: `${
                      baseHeight *
                      displayScale
                    }px`,
                    transform:
                      "translate(-50%, -50%)",
                    zIndex: 20,
                  }}
                >

                  <div
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#101811] text-white flex items-center justify-center text-center shadow-md ${
                      table.shape ===
                      "round"
                        ? "rounded-full"
                        : "rounded-2xl"
                    }`}
                    style={{
                      width:
                        table.shape ===
                        "round"
                          ? `${
                              88 *
                              displayScale
                            }px`
                          : `${
                              125 *
                              displayScale
                            }px`,

                      height:
                        table.shape ===
                        "round"
                          ? `${
                              88 *
                              displayScale
                            }px`
                          : `${
                              76 *
                              displayScale
                            }px`,

                      fontSize: `${Math.max(
                        9,
                        13 *
                          displayScale
                      )}px`,

                      padding: `${
                        6 *
                        displayScale
                      }px`,
                    }}
                  >

                    <div>
                      <div className="font-bold">
                        {table.name}
                      </div>

                      <div className="text-white/50 font-semibold mt-1">
                        {table.seats.length} seats
                      </div>
                    </div>

                  </div>

                  {table.seats.map(
                    (seat, index) => {
                      const angle =
                        -Math.PI / 2 +
                        (index /
                          Math.max(
                            table.seats
                              .length,
                            1
                          )) *
                          Math.PI *
                          2;

                      const radiusX =
                        table.shape ===
                        "round"
                          ? 43
                          : 45;

                      const radiusY =
                        table.shape ===
                        "round"
                          ? 43
                          : 42;

                      const left =
                        50 +
                        Math.cos(
                          angle
                        ) *
                          radiusX;

                      const top =
                        50 +
                        Math.sin(
                          angle
                        ) *
                          radiusY;

                      const seatSize =
                        clamp(
                          30 *
                            displayScale,
                          22,
                          45
                        );

                      return (
                        <div
                          key={seat.id}
                          title={
                            seat.status ===
                            "available"
                              ? "Available"
                              : "Occupied"
                          }
                          className={`absolute rounded-full text-white font-bold border-2 border-white shadow-sm flex items-center justify-center ${
                            seat.status ===
                            "available"
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${seatSize}px`,
                            height: `${seatSize}px`,
                            transform:
                              "translate(-50%, -50%)",
                            fontSize: `${Math.max(
                              8,
                              10 *
                                displayScale
                            )}px`,
                          }}
                        >
                          {seat.id}
                        </div>
                      );
                    }
                  )}

                </div>
              );
            })}

          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-10">
          Seat availability and floor-plan changes update live as the business makes changes.
        </p>

      </div>
    </main>
  );
}