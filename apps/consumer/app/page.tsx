"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { businessUrl } from "@seatmate/shared/site-urls";

import {
  ArrowRightIcon,
  AppBadges,
  SiteFooter,
  SiteHeader,
} from "@/components/site-chrome";
import AccountDeletedNotice from "@/components/account-deleted-notice";
import { HeartIcon } from "@/components/account-menu";
import { useAccount } from "@/components/account-provider";
import { useFeatures } from "@/lib/use-features";
import SaveButton from "@/components/save-button";
import {
  fetchPublicPlaces,
  type PlaceWithSeats,
  withSeatSummaries,
} from "@/lib/places";
import { useNow } from "@/lib/use-now";

type NearbyBusiness = PlaceWithSeats;

// Shortcuts from the hero into the full list, pre-filtered by type.
const BROWSE_TYPES = [
  { label: "Cafés", type: "cafe" },
  { label: "Restaurants", type: "restaurant" },
  { label: "Bars", type: "bar" },
  { label: "Barbershops", type: "barbershop" },
];

export default function HomePage() {
  const features = useFeatures();
  const router = useRouter();
  const { favorites } = useAccount();

  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const now = useNow();

  // Load approved/public SeatMate locations and their live seat counts.
  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        const places = await withSeatSummaries(
          await fetchPublicPlaces()
        );

        setBusinesses(
          places.map((place) => ({
            ...place,
            name: place.name || "SeatMate location",
            type: place.type || "Restaurant",
          }))
        );
      } catch (error) {
        console.error(
          "Could not load SeatMate businesses:",
          error
        );
      } finally {
        setBusinessesLoading(false);
      }
    };

    loadBusinesses();
  }, []);

  // SeatMate only serves the Sacramento area, so every place is "nearby":
  // show the six with the most open seats.
  const nearbyBusinesses = useMemo(
    () =>
      [...businesses]
        .sort((a, b) => {
          const aPercent =
            a.totalSeats > 0
              ? a.availableSeats / a.totalSeats
              : -1;

          const bPercent =
            b.totalSeats > 0
              ? b.availableSeats / b.totalSeats
              : -1;

          return bPercent - aPercent;
        })
        .slice(0, 6),
    [businesses]
  );

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <AccountDeletedNotice />

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28">
        <div>
          <h1 className="font-display text-[3.5rem] leading-[0.95] sm:text-7xl lg:text-[5.75rem]">
            Know before
            <br />
            you go.
          </h1>

          <p className="mt-6 max-w-md text-lg text-gray-600">
            Check live seating at cafés, restaurants, bars and barbershops
            before you arrive.
          </p>

          <button
            type="button"
            onClick={() => router.push("/search")}
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-semibold text-white transition hover:bg-black"
          >
            See open seats
            <ArrowRightIcon className="h-4 w-4" />
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-gray-500">Or jump to</span>
            {BROWSE_TYPES.map(({ label, type }) => (
              <button
                key={type}
                type="button"
                onClick={() => router.push(`/search?type=${type}`)}
                className="rounded-full border border-line bg-white px-3.5 py-1.5 font-medium transition hover:border-gray-300"
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
            {[
              "Live availability",
              "No account needed",
              "Updates instantly",
            ].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-moss" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <LiveFloorPreview />
      </section>

      {/* SAVED PLACES (signed in) */}
      {favorites.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <HeartIcon filled className="h-4 w-4 text-seat-taken" />
              Your saved places
            </h2>

            <button
              type="button"
              onClick={() => router.push("/account#saved")}
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 transition hover:text-ink"
            >
              See all
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {favorites.slice(0, 8).map((place) => (
              <button
                key={place.slug}
                type="button"
                onClick={() => router.push(`/place/${place.slug}`)}
                className="flex shrink-0 items-center gap-3 rounded-full border border-line bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium transition hover:border-gray-300"
              >
                <span className="font-display flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ec] text-base text-moss">
                  {place.name.trim().charAt(0).toUpperCase() || "S"}
                </span>
                {place.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* RESTAURANTS NEAR YOU */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="flex flex-col gap-6 border-t border-line pt-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl">
              Open seats around Sacramento
            </h2>

            <p className="mt-3 max-w-xl text-gray-600">
              The places with the most room right now.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              View all
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {businessesLoading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-line bg-white"
              >
                <div className="aspect-[16/10] animate-pulse bg-gray-100" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : nearbyBusinesses.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-gray-300 bg-white/60 px-6 py-14 text-center">
            <EmptyTableIcon className="h-14 w-14 text-gray-300" />

            <h3 className="mt-5 text-lg font-semibold">
              No SeatMate locations yet
            </h3>

            <p className="mt-2 max-w-md text-gray-600">
              The first places are on their way.
            </p>

          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyBusinesses.map((business) => (
              <RestaurantCard
                key={business.slug}
                business={business}
                now={now}
                onOpen={() =>
                  router.push(`/place/${business.slug}`)
                }
              />
            ))}
          </div>
        )}

      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-28">
          <div>
            <h2 className="font-display text-4xl leading-[1.05] sm:text-5xl">
              Finding a seat shouldn&apos;t be a guessing game.
            </h2>
          </div>

          <ol className="divide-y divide-line">
            {[
              {
                title: "Pick a place",
                description:
                  "Browse cafés, restaurants, bars and barbershops around Sacramento.",
              },
              {
                title: "Check the floor",
                description:
                  "See which seats are available and where they are located.",
              },
              {
                title: "Head over",
                description:
                  "Availability updates live as staff manage seating.",
              },
            ].map((step, index) => (
              <li
                key={step.title}
                className="flex gap-6 py-7 first:pt-0 last:pb-0"
              >
                <span className="font-display w-6 shrink-0 text-4xl leading-none text-gray-300">
                  {index + 1}
                </span>

                <div>
                  <h3 className="text-lg font-semibold">
                    {step.title}
                  </h3>

                  <p className="mt-1.5 text-gray-600">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* APP */}
      {features.appBadges && (
        <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 lg:pt-28">
          <div className="flex flex-col gap-6 rounded-3xl border border-line bg-white p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <h2 className="font-display text-3xl sm:text-4xl">Take SeatMate with you.</h2>
              <p className="mt-3 text-gray-600">
                Check seats on the way, get alerts when a full place opens up, and keep your saved
                places in your pocket.
              </p>
            </div>
            <AppBadges />
          </div>
        </section>
      )}

      {/* BUSINESS */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:pb-28 lg:pt-12">
        <div className="grid overflow-hidden rounded-3xl bg-ink text-white lg:grid-cols-2">
          <div className="p-8 sm:p-12 lg:p-14">
            <h2 className="font-display text-4xl leading-[1.05] sm:text-5xl">
              Turn your floor plan into live information.
            </h2>

            <p className="mt-5 max-w-md text-lg text-white/65">
              Staff update occupancy with one tap. Customers see those
              changes instantly.
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.assign(businessUrl("/business/login"))
              }
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-ink transition hover:bg-green-50"
            >
              Open Business Portal
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center border-t border-white/10 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <StaffUpdateMock />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function RestaurantCard({
  business,
  now,
  onOpen,
}: {
  business: NearbyBusiness;
  now: number;
  onOpen: () => void;
}) {
  const percentage =
    business.totalSeats > 0
      ? Math.round(
          (business.availableSeats /
            business.totalSeats) *
            100
        )
      : 0;

  const availabilityLabel =
    percentage >= 60
      ? "Plenty of seating"
      : percentage >= 25
        ? "Some seats available"
        : percentage > 0
          ? "Limited seating"
          : business.totalSeats > 0
            ? "Currently full"
            : "No seating data";

  // Chip and meter colors follow the same thresholds as the label.
  const tone =
    percentage >= 25
      ? {
          chip: "bg-white text-green-800",
          dot: "bg-seat-open",
          bar: "bg-seat-open",
        }
      : percentage > 0
        ? {
            chip: "bg-white text-amber-800",
            dot: "bg-amber-500",
            bar: "bg-amber-500",
          }
        : business.totalSeats > 0
          ? {
              chip: "bg-white text-red-700",
              dot: "bg-seat-taken",
              bar: "bg-seat-taken",
            }
          : {
              chip: "bg-white text-gray-600",
              dot: "bg-gray-400",
              bar: "bg-gray-300",
            };

  const ageMinutes =
    business.latestUpdateMs === null
      ? null
      : Math.max(
          0,
          Math.floor(
            (now - business.latestUpdateMs) / 60000
          )
        );

  let freshnessLabel = "No recent update";

  if (ageMinutes !== null) {
    if (ageMinutes < 1) {
      freshnessLabel = "Updated just now";
    } else if (ageMinutes === 1) {
      freshnessLabel = "Updated 1 min ago";
    } else if (ageMinutes < 60) {
      freshnessLabel = `Updated ${ageMinutes} min ago`;
    } else {
      const hours =
        Math.floor(ageMinutes / 60);

      freshnessLabel =
        hours === 1
          ? "Updated 1 hour ago"
          : `Updated ${hours} hours ago`;
    }
  }

  const isFresh =
    ageMinutes !== null && ageMinutes < 15;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_20px_40px_-24px_rgba(16,24,17,0.4)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[#eef2ec]">
          {/* REAL RESTAURANT PHOTO IF SAVED IN FIREBASE */}
          {business.imageUrl ? (
            // Owner-supplied photos can be on any host, so these stay plain
            // <img> tags rather than next/image; they load lazily below the fold.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.imageUrl}
              alt={business.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(21,128,61,0.14) 1.5px, transparent 1.5px)",
                backgroundSize: "18px 18px",
              }}
            >
              <span className="font-display text-7xl text-moss/70">
                {business.name
                  .trim()
                  .charAt(0)
                  .toUpperCase() || "S"}
              </span>
            </div>
          )}

          <span
            className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${tone.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {availabilityLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-lg font-semibold transition group-hover:text-moss">
              {business.name}
            </h3>

            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-gray-400">
              {business.type}
            </span>
          </div>

          <p className="mt-1 line-clamp-1 text-sm text-gray-500">
            {business.address}
          </p>

          {business.totalSeats > 0 ? (
            <div className="mb-5 mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${tone.bar}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <p className="mt-2 text-sm">
                <span className="font-semibold">
                  {business.availableSeats}
                </span>{" "}
                <span className="text-gray-500">
                  of {business.totalSeats} seats open
                </span>
              </p>
            </div>
          ) : (
            <p className="mb-5 mt-4 text-sm text-gray-500">
              Seat counts will appear once staff start updating.
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-4 text-sm">
            <span
              className={
                isFresh ? "text-moss" : "text-gray-400"
              }
            >
              {freshnessLabel}
            </span>

            <span className="inline-flex items-center gap-1 font-medium text-ink transition group-hover:text-moss">
              View floor
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </button>

      <SaveButton
        place={{
          slug: business.slug,
          name: business.name,
          address: business.address,
          type: business.type,
          imageUrl: business.imageUrl,
        }}
        className="absolute right-3 top-3"
      />
    </div>
  );
}

// Example floor for the hero. Every seat is listed once so the "seats open"
// count is always derived from what is drawn.
const DEMO_TABLES: {
  shape: "round" | "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  seats: [number, number][];
}[] = [
  { shape: "round", x: 100, y: 102, w: 52, h: 52, seats: [[100, 62], [140, 102], [100, 142], [60, 102]] },
  { shape: "rect", x: 240, y: 102, w: 100, h: 40, seats: [[210, 64], [240, 64], [270, 64], [210, 140], [240, 140], [270, 140]] },
  { shape: "round", x: 362, y: 102, w: 40, h: 40, seats: [[328, 102], [396, 102]] },
  { shape: "rect", x: 104, y: 230, w: 44, h: 40, seats: [[104, 192], [104, 268]] },
  { shape: "round", x: 200, y: 230, w: 36, h: 36, seats: [[200, 196], [200, 264]] },
];

const DEMO_STOOLS: [number, number][] = [
  [296, 212],
  [336, 212],
  [376, 212],
];

const DEMO_SEAT_COUNT =
  DEMO_TABLES.reduce((sum, table) => sum + table.seats.length, 0) +
  DEMO_STOOLS.length;

// Which seats start taken, and the order seats flip in to show updates.
const DEMO_INITIAL_TAKEN = [2, 4, 8, 11, 13, 17];
const DEMO_FLIP_ORDER = [5, 11, 0, 15, 8, 12, 2, 16];

function LiveFloorPreview() {
  const [open, setOpen] = useState<boolean[]>(() =>
    Array.from(
      { length: DEMO_SEAT_COUNT },
      (_, index) => !DEMO_INITIAL_TAKEN.includes(index)
    )
  );

  // Flip one seat every few seconds so the example reads as live.
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let step = 0;

    const interval = window.setInterval(() => {
      const seat = DEMO_FLIP_ORDER[step % DEMO_FLIP_ORDER.length];
      step += 1;

      setOpen((current) =>
        current.map((value, index) =>
          index === seat ? !value : value
        )
      );
    }, 2800);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const openCount = open.filter(Boolean).length;

  let seatIndex = 0;

  const seatFill = () =>
    open[seatIndex++] ? "#22a55b" : "#e5534b";

  return (
    <figure className="rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,17,0.04),0_30px_60px_-30px_rgba(16,24,17,0.28)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
            Example floor
          </p>

          <p className="mt-1.5 text-lg font-semibold">
            Your favorite café
          </p>

          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <LiveDot />
            Updated moments ago
          </p>
        </div>

        <div className="text-right">
          <p className="font-display text-5xl leading-none text-moss">
            {openCount}
          </p>

          <p className="mt-1.5 text-xs text-gray-500">
            of {DEMO_SEAT_COUNT} seats open
          </p>
        </div>
      </div>

      <svg
        viewBox="0 0 420 300"
        role="img"
        aria-label={`Example floor plan with ${openCount} of ${DEMO_SEAT_COUNT} seats open`}
        className="mt-6 w-full"
      >
        {/* Room */}
        <rect x="6" y="6" width="408" height="288" rx="18" fill="#fafbf9" stroke="#e3e7e2" strokeWidth="2" />

        {/* Window along the top wall */}
        <rect x="80" y="3" width="260" height="6" rx="3" fill="#cfe3e8" />
        <text x="210" y="26" textAnchor="middle" fontSize="9" letterSpacing="2" fill="#9aa39c">
          WINDOW
        </text>

        {/* Entrance on the left wall */}
        <line x1="6" y1="196" x2="6" y2="248" stroke="#fafbf9" strokeWidth="4" />
        <path d="M6 196 A 52 52 0 0 1 48 248" fill="none" stroke="#d3d9d2" strokeDasharray="3 4" />
        <text x="20" y="276" fontSize="9" letterSpacing="2" fill="#9aa39c">
          ENTRANCE
        </text>

        {/* Counter */}
        <rect x="272" y="232" width="128" height="46" rx="10" fill="#eef1ec" stroke="#e3e7e2" />
        <text x="336" y="259" textAnchor="middle" fontSize="9" letterSpacing="2" fill="#9aa39c">
          COUNTER
        </text>

        {DEMO_TABLES.map((table, tableIndex) => (
          <g key={tableIndex}>
            {table.shape === "round" ? (
              <circle cx={table.x} cy={table.y} r={table.w / 2} fill="#101811" />
            ) : (
              <rect
                x={table.x - table.w / 2}
                y={table.y - table.h / 2}
                width={table.w}
                height={table.h}
                rx="8"
                fill="#101811"
              />
            )}

            {table.seats.map(([cx, cy], index) => (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r="10"
                fill={seatFill()}
                stroke="#fff"
                strokeWidth="3"
                style={{ transition: "fill 500ms ease" }}
              />
            ))}
          </g>
        ))}

        {DEMO_STOOLS.map(([cx, cy], index) => (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r="9"
            fill={seatFill()}
            stroke="#fff"
            strokeWidth="3"
            style={{ transition: "fill 500ms ease" }}
          />
        ))}
      </svg>

      <figcaption className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-seat-open" />
            Available
          </span>

          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-seat-taken" />
            Occupied
          </span>
        </span>

        <span>Staff update seats with one tap</span>
      </figcaption>
    </figure>
  );
}

function StaffUpdateMock() {
  const rows = [
    { name: "Window table", seats: [true, false] },
    { name: "Table 4", seats: [false, false, true, true] },
    { name: "Bar", seats: [true, true, false] },
  ];

  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-sm rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
    >
      <div className="flex items-center justify-between text-xs text-white/70">
        <span className="font-medium uppercase tracking-[0.14em]">
          Staff view
        </span>
        <span>Tap a seat to update</span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between rounded-xl bg-white/[0.06] px-4 py-3"
          >
            <span className="text-sm font-medium">{row.name}</span>

            <span className="flex gap-1.5">
              {row.seats.map((isOpen, index) => (
                <span
                  key={index}
                  className={`h-5 w-5 rounded-full ring-2 ring-ink ${
                    isOpen ? "bg-seat-open" : "bg-seat-taken"
                  }`}
                />
              ))}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-2 text-xs text-white/70">
        <LiveDot />
        Customers see changes instantly
      </p>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-seat-open opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-seat-open" />
    </span>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function EmptyTableIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="28" cy="28" r="11" />
      <circle cx="28" cy="7" r="4" />
      <circle cx="49" cy="28" r="4" />
      <circle cx="28" cy="49" r="4" />
      <circle cx="7" cy="28" r="4" />
    </svg>
  );
}
