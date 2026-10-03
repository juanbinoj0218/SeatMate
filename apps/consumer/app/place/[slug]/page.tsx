"use client";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { MarkerIcon } from "@seatmate/shared/components/Icons";
import { Armchair, ArrowLeft, Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

import { bumpPlaceStat } from "@seatmate/shared/analytics";
import {
  type DayName,
  getOpenStatus,
  type Hours,
  toMinutes,
} from "@seatmate/shared/business-hours";
import GameStatus from "@seatmate/shared/components/GameStatus";
import TableWithSeats, {
  parseTableRotation,
  parseTableShape,
  tableSize,
  type TableRotation,
  type TableShape,
} from "@seatmate/shared/components/TableWithSeats";
import { db } from "@seatmate/shared/firebase";
import {
  clamp,
  type FloorMarker,
  MARKERS,
  markerClassName,
  type MarkerType,
  isBar,
  isGameMarker,
  markerStatus,
} from "@seatmate/shared/floor-plan";

import AccountMenu from "@/components/account-menu";
import CrowdMeter from "@/components/crowd-meter";
import { useAccount } from "@/components/account-provider";
import SeatAlertButton from "@/components/seat-alert-button";
import SaveButton from "@/components/save-button";
import ShareButton from "@/components/share-button";
import { SiteFooter } from "@/components/site-chrome";
import { cityFromAddress } from "@/lib/place-data";
import { useNow } from "@/lib/use-now";
import { businessUrl } from "@seatmate/shared/site-urls";

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
  scale: number;
  occupancyUpdatedAt?: Timestamp | null;
};

type PublicBusiness = {
  businessId: string;
  name: string;
  address: string;
  type: string;
  imageUrl?: string;
  coverImageUrl?: string;
  photoUrl?: string;
  hours?: Hours;
  timezone?: string;
};

const PLACE_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=86",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=86",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=86",
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1600&q=86",
];

const getFallbackPlaceImage = (value: string) => {
  const hash = value
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

  return PLACE_FALLBACK_IMAGES[hash % PLACE_FALLBACK_IMAGES.length];
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

export default function PlacePage() {
  const params =
    useParams<{ slug: string }>();

  const slug = params.slug;

  const { profileReady, recordView } = useAccount();

  const router = useRouter();

  // Opened from the business portal's "View Customer Page" link.
  const fromBusiness =
    useSearchParams().get("from") === "business";

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
  
  const now = useNow();

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

  shape: parseTableShape(table.shape),
  rotation: parseTableRotation(table.rotation),

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

                    status: markerStatus(marker.status),
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

  // Add this place to the signed-in customer's "Recently viewed" list.
  useEffect(() => {
    if (!business || !profileReady) {
      return;
    }

    recordView({
      slug,
      name: business.name,
      address: business.address,
      type: business.type || "Restaurant",
      imageUrl:
        business.imageUrl ||
        business.coverImageUrl ||
        business.photoUrl ||
        "",
    });
  }, [business, profileReady, slug, recordView]);

  // Count one view per place per browser session for the business's
  // analytics. Skipped when the owner previews their own page.
  useEffect(() => {
    if (!business || fromBusiness) {
      return;
    }

    try {
      const key = `seatmate:viewed:${slug}`;

      if (sessionStorage.getItem(key)) {
        return;
      }

      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: still count the view.
    }

    bumpPlaceStat(slug, "views");

    if (new URLSearchParams(window.location.search).get("ref") === "qr") {
      bumpPlaceStat(slug, "scans");
    }
  }, [business, fromBusiness, slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <div className="text-center">

          <div className="w-12 h-12 flex items-center justify-center mx-auto text-[#101811]">
            <SeatMateMark className="h-[85%] w-[85%]" />
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
          <Armchair aria-hidden className="mx-auto h-12 w-12 text-[#101811]" strokeWidth={1.6} />

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

  const city = cityFromAddress(business.address);

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

const businessImage =
  business.imageUrl ||
  business.coverImageUrl ||
  business.photoUrl ||
  getFallbackPlaceImage(business.name || slug);

const openDirections = () => {
  const destination = encodeURIComponent(business.address);
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    "_blank",
    "noopener,noreferrer"
  );
};

return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="bg-white border-b border-[#e3e7e2]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">

          {/* SEATMATE LOGO = HOME */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 flex items-center justify-center text-[#101811]">
              <SeatMateMark className="h-[85%] w-[85%]" />
            </div>

            <span className="font-bold text-xl text-[#101811]">
              SeatMate
            </span>
          </button>

          <div className="flex items-center gap-2">

            {/* CUSTOMER BACK BUTTON */}
            {!fromBusiness && (
              <button
                type="button"
                onClick={() => router.push("/search")}
                className="inline-flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Back to Search
              </button>
            )}

            {/* BUSINESS BACK BUTTON */}
            {fromBusiness && (
              <button
                type="button"
                onClick={() =>
                  window.location.assign(businessUrl("/business"))
                }
                className="inline-flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Back to Business
              </button>
            )}

            {/* UNIVERSAL HOME BUTTON */}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="bg-[#101811] text-white hover:bg-black px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Home
            </button>

            <AccountMenu />

          </div>

        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 md:py-10">

        {/* PHOTO + LOCATION + LIVE AVAILABILITY */}

        <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr] lg:items-stretch">
          <div className="relative min-h-[390px] overflow-hidden rounded-[32px] border border-gray-200 bg-gray-200 shadow-sm md:min-h-[470px]">
            {/* Hero photo: loaded first. Owner photos can be on any host, so
                this is a plain <img> rather than next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={businessImage}
              alt={`${business.name} interior`}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = getFallbackPlaceImage(slug);
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/5" />

            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-green-700 shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                LIVE AVAILABILITY
              </span>

              <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#101811] shadow-sm backdrop-blur">
                {business.type || "Restaurant"}
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                {business.name}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                {business.address}
                {city && (
                  <>
                    {" · "}
                    <Link href={`/places/${city.slug}`} className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                      More in {city.name}
                    </Link>
                  </>
                )}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <SaveButton
                  variant="pill"
                  place={{
                    slug,
                    name: business.name,
                    address: business.address,
                    type: business.type || "Restaurant",
                    imageUrl:
                      business.imageUrl ||
                      business.coverImageUrl ||
                      business.photoUrl ||
                      "",
                  }}
                />

                <ShareButton
                  title={`${business.name} on SeatMate`}
                  text={`See open seats at ${business.name} right now.`}
                />

                {openStatus && (
                  <span
                    className={`rounded-full px-3 py-1.5 text-sm font-black backdrop-blur ${
                      openStatus.open
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {openStatus.open ? "● Open now" : "● Closed now"}
                  </span>
                )}

                {todaysHours && (
                  <span className="rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
                    {todaysHours.closed
                      ? "Closed today"
                      : `Today ${formatHour(todaysHours.open)} – ${formatHour(todaysHours.close)}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-[32px] bg-[#101811] p-7 text-white shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                  Available right now
                </p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-6xl font-black leading-none sm:text-7xl">
                    {availableSeats}
                  </span>
                  <span className="pb-2 text-sm font-semibold text-white/45">
                    of {totalSeats} seats
                  </span>
                </div>
              </div>

              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[7px] border-green-500/20 sm:h-28 sm:w-28">
                <div className="text-center">
                  <p className="text-2xl font-black">{percentage}%</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">
                    open
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-xl font-black">{availabilityLabel}</p>

            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                isStale
                  ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                  : "border-green-400/20 bg-green-400/10 text-green-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isStale ? "bg-amber-400" : "bg-green-400"
                  }`}
                />
                {freshnessLabel}
              </div>
              {isStale && (
                <p className="mt-1 text-xs text-amber-100/70">
                  Current availability may have changed since the last update.
                </p>
              )}
            </div>

            {isBar(business.type) && openStatus?.open !== false && (
              <CrowdMeter businessId={business.businessId} now={now} />
            )}

            <div className="mt-auto grid grid-cols-2 gap-3 pt-7">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">
                  Available
                </p>
                <p className="mt-2 text-2xl font-black text-green-400">
                  {availableSeats}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">
                  Occupied
                </p>
                <p className="mt-2 text-2xl font-black">{occupiedSeats}</p>
              </div>
            </div>

            {totalSeats > 0 && availableSeats === 0 && (
              <SeatAlertButton
                slug={slug}
                businessId={business.businessId}
                placeName={business.name}
              />
            )}

            <button
              type="button"
              onClick={openDirections}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-500 px-5 py-3.5 font-black text-[#101811] transition hover:bg-green-400"
            >
              <Navigation aria-hidden className="h-[18px] w-[18px]" />
              Get directions
            </button>
          </div>
        </section>

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
                  className={`absolute flex items-center justify-center border text-center font-bold select-none pointer-events-none ${markerClassName(marker.type)}`}
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
                      <MarkerIcon
                        type={marker.type}
                        className="mx-auto"
                        style={{
                          width: Math.max(12, 17 * displayScale),
                          height: Math.max(12, 17 * displayScale),
                        }}
                      />

                      {marker.scale >=
                        0.75 && (
                        <div className="mt-0.5">
                          {marker.label}
                        </div>
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

            {/* TABLES */}

            {tables.map((table) => {
              const displayScale =
                table.scale;

              const box = tableSize(table.shape, table.seats.length, displayScale, table.rotation);

              return (
                <div
                  key={table.id}
                  className="absolute select-none pointer-events-none"
                  style={{
                    left: `${table.xPct}%`,
                    top: `${table.yPct}%`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    transform:
                      "translate(-50%, -50%)",
                    zIndex: 20,
                  }}
                >

                  <TableWithSeats
                    name={table.name}
                    shape={table.shape}
                    seats={table.seats}
                    scale={displayScale}
                    rotation={table.rotation}
                  />

                </div>
              );
            })}

          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-10">
          Seat availability and floor-plan changes update live as the business makes changes.
        </p>

      </div>
      <SiteFooter />
    </main>
  );
}