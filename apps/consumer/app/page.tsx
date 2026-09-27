"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { db } from "@seatmate/shared/firebase";
import { businessUrl } from "@seatmate/shared/site-urls";

import {
  ArrowRightIcon,
  SiteFooter,
  SiteHeader,
} from "@/components/site-chrome";
import { HeartIcon } from "@/components/account-menu";
import { useAccount } from "@/components/account-provider";
import SaveButton from "@/components/save-button";

type NearbyBusiness = {
  slug: string;
  businessId: string;
  name: string;
  address: string;
  type: string;
  zipcode: string;
  availableSeats: number;
  totalSeats: number;
  latestUpdateMs: number | null;
  imageUrl: string;
};

type LocationState =
  | "checking"
  | "ready"
  | "denied"
  | "unavailable";

const getZipFromAddress = (address: string) =>
  address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) || "";

export default function HomePage() {
  const router = useRouter();
  const { profile, favorites } = useAccount();

  const [search, setSearch] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [message, setMessage] = useState("");

  // Nearby restaurant data
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [detectedZip, setDetectedZip] = useState("");
  const [locationState, setLocationState] =
    useState<LocationState>("checking");
  const [now, setNow] = useState(Date.now());

  const findBusiness = (event: FormEvent) => {
    event.preventDefault();

    const query = search.trim();
    const zip = zipcode.trim();

    if (!query && !zip) {
      setMessage("Enter a café, restaurant, or ZIP code.");
      return;
    }

    if (zip && !/^\d{5}$/.test(zip)) {
      setMessage("Enter a valid 5-digit ZIP code.");
      return;
    }

    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }

    if (zip) {
      params.set("zip", zip);
    }

    router.push(`/search?${params.toString()}`);
  };

  // Tries to detect the user's ZIP code from browser location.
  // This does not use a Google Maps API key.
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }

    setLocationState("checking");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );

          if (!response.ok) {
            throw new Error("Could not detect ZIP code.");
          }

          const data = await response.json();

          const postalCode = String(
            data.postcode ||
              data.postalCode ||
              ""
          ).match(/\b\d{5}\b/)?.[0];

          if (!postalCode) {
            setLocationState("unavailable");
            return;
          }

          setDetectedZip(postalCode);
          setLocationState("ready");
        } catch (error) {
          console.error(
            "Could not determine visitor ZIP:",
            error
          );
          setLocationState("unavailable");
        }
      },
      (error) => {
        console.log(
          "Location permission unavailable:",
          error
        );
        setLocationState("denied");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  // Keep "updated X minutes ago" labels fresh.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // Load approved/public SeatMate locations and their live seat counts.
  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        setBusinessesLoading(true);

        const businessesSnapshot = await getDocs(
          collection(db, "publicBusinesses")
        );

        const approvedBusinesses =
          businessesSnapshot.docs.map((businessDoc) => {
            const data = businessDoc.data();

            const address = String(data.address || "");

            return {
              slug: businessDoc.id,
              businessId: String(data.businessId || ""),
              name: String(data.name || "SeatMate location"),
              address,
              type: String(data.type || "Restaurant"),
              zipcode: String(
                data.zipcode ||
                  data.zip ||
                  getZipFromAddress(address)
              ).trim(),
              imageUrl: String(
                data.imageUrl ||
                  data.coverImageUrl ||
                  data.photoUrl ||
                  ""
              ),
            };
          });

        const withAvailability = await Promise.all(
          approvedBusinesses.map(async (business) => {
            if (!business.businessId) {
              return {
                ...business,
                availableSeats: 0,
                totalSeats: 0,
                latestUpdateMs: null,
              };
            }

            try {
              const tablesSnapshot = await getDocs(
                collection(
                  db,
                  "businesses",
                  business.businessId,
                  "tables"
                )
              );

              let totalSeats = 0;
              let availableSeats = 0;
              let latestUpdateMs: number | null = null;

              tablesSnapshot.docs.forEach((tableDoc) => {
                const table = tableDoc.data();

                const seats = Array.isArray(table.seats)
                  ? table.seats
                  : [];

                totalSeats += seats.length;

                availableSeats += seats.filter(
                  (seat: { status?: string }) =>
                    seat.status === "available"
                ).length;

                if (
                  table.occupancyUpdatedAt instanceof Timestamp
                ) {
                  const updateMs =
                    table.occupancyUpdatedAt.toMillis();

                  if (
                    latestUpdateMs === null ||
                    updateMs > latestUpdateMs
                  ) {
                    latestUpdateMs = updateMs;
                  }
                }
              });

              return {
                ...business,
                availableSeats,
                totalSeats,
                latestUpdateMs,
              };
            } catch (error) {
              console.error(
                `Could not load seating for ${business.name}:`,
                error
              );

              return {
                ...business,
                availableSeats: 0,
                totalSeats: 0,
                latestUpdateMs: null,
              };
            }
          })
        );

        setBusinesses(withAvailability);
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

  // If the user types a ZIP, that takes priority over location detection.
  // Then the signed-in customer's home ZIP, then the detected one.
  const activeZip =
    /^\d{5}$/.test(zipcode)
      ? zipcode
      : profile.homeZip || detectedZip;

  const nearbyBusinesses = useMemo(() => {
    const sorted = [...businesses].sort((a, b) => {
      const aPercent =
        a.totalSeats > 0
          ? a.availableSeats / a.totalSeats
          : -1;

      const bPercent =
        b.totalSeats > 0
          ? b.availableSeats / b.totalSeats
          : -1;

      return bPercent - aPercent;
    });

    if (activeZip) {
      return sorted
        .filter(
          (business) => business.zipcode === activeZip
        )
        .slice(0, 6);
    }

    return sorted.slice(0, 6);
  }, [businesses, activeZip]);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-moss">
            <LiveDot />
            Live seating availability
          </p>

          <h1 className="font-display mt-5 text-[3.5rem] leading-[0.95] sm:text-7xl lg:text-[5.75rem]">
            Know before
            <br />
            you <em className="italic text-moss">go.</em>
          </h1>

          <p className="mt-6 max-w-md text-lg text-gray-600">
            Check live seating availability at cafés and restaurants before
            you arrive.
          </p>

          <form onSubmit={findBusiness} className="mt-9 max-w-xl">
            <div className="flex flex-col rounded-2xl border border-line bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,17,0.04),0_16px_36px_-16px_rgba(16,24,17,0.22)] transition focus-within:border-moss/40 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-center gap-3 px-4">
                <SearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="sr-only">Café or restaurant</span>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setMessage("");
                  }}
                  placeholder="Café or restaurant"
                  className="bare-input h-12 w-full min-w-0 text-[15px] text-ink outline-none"
                />
              </label>

              <div className="mx-4 h-px bg-line sm:mx-0 sm:h-7 sm:w-px" />

              <label className="flex items-center gap-3 px-4 sm:w-40">
                <PinIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="sr-only">ZIP code</span>
                <input
                  value={zipcode}
                  onChange={(event) => {
                    setZipcode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 5)
                    );

                    setMessage("");
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder={detectedZip || "ZIP code"}
                  maxLength={5}
                  className="bare-input h-12 w-full min-w-0 text-[15px] text-ink outline-none"
                />
              </label>

              <button
                type="submit"
                className="mt-1.5 h-12 whitespace-nowrap rounded-xl bg-ink px-6 text-[15px] font-semibold text-white transition hover:bg-black sm:mt-0"
              >
                Find seats
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-gray-500">
              <span>Search by business name, ZIP code, or both.</span>

              {detectedZip && !zipcode && (
                <span className="inline-flex items-center gap-1.5 font-medium text-moss">
                  <PinIcon className="h-3.5 w-3.5" />
                  Near you: {detectedZip}
                </span>
              )}
            </div>

            {message && (
              <p
                role="alert"
                className="mt-3 px-1 text-sm font-medium text-red-600"
              >
                {message}
              </p>
            )}
          </form>

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
              Open seats near you
            </h2>

            <p className="mt-3 max-w-xl text-gray-600">
              {activeZip
                ? `SeatMate locations in ZIP ${activeZip}, with the most open seats first.`
                : "Restaurants and cafés currently using SeatMate."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {locationState !== "ready" && (
              <button
                type="button"
                onClick={detectLocation}
                disabled={locationState === "checking"}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium transition hover:border-gray-300 disabled:opacity-60"
              >
                <PinIcon className="h-3.5 w-3.5" />
                {locationState === "checking"
                  ? "Finding your area…"
                  : "Use my location"}
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                router.push(
                  activeZip
                    ? `/search?zip=${activeZip}`
                    : "/search"
                )
              }
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
              No SeatMate locations nearby yet
            </h3>

            <p className="mt-2 max-w-md text-gray-600">
              {activeZip
                ? `There are no approved SeatMate businesses in ZIP ${activeZip} yet.`
                : "Try entering your ZIP code above to find SeatMate locations near you."}
            </p>

            {activeZip && (
              <button
                type="button"
                onClick={() => router.push("/search")}
                className="mt-5 inline-flex items-center gap-1.5 font-medium text-moss hover:text-green-800"
              >
                Browse all locations
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            )}
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

        {(locationState === "denied" ||
          locationState === "unavailable") &&
          !zipcode && (
            <p className="mt-5 text-sm text-gray-500">
              Location access is unavailable. Enter your ZIP code above to see
              SeatMate restaurants near you.
            </p>
          )}
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-28">
          <div>
            <p className="text-sm font-medium text-moss">How it works</p>

            <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Finding a seat shouldn&apos;t be a guessing game.
            </h2>
          </div>

          <ol className="divide-y divide-line">
            {[
              {
                title: "Find a location",
                description:
                  "Search for the café or restaurant you want to visit.",
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

      {/* BUSINESS */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid overflow-hidden rounded-3xl bg-ink text-white lg:grid-cols-2">
          <div className="p-8 sm:p-12 lg:p-14">
            <p className="text-sm font-medium text-green-400">
              SeatMate for business
            </p>

            <h2 className="font-display mt-4 text-4xl leading-[1.05] sm:text-5xl">
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
          chip: "bg-white/90 text-green-800",
          dot: "bg-seat-open",
          bar: "bg-seat-open",
        }
      : percentage > 0
        ? {
            chip: "bg-white/90 text-amber-800",
            dot: "bg-amber-500",
            bar: "bg-amber-500",
          }
        : business.totalSeats > 0
          ? {
              chip: "bg-white/90 text-red-700",
              dot: "bg-seat-taken",
              bar: "bg-seat-taken",
            }
          : {
              chip: "bg-white/90 text-gray-600",
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
            <img
              src={business.imageUrl}
              alt={business.name}
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
            className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur ${tone.chip}`}
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
      <div className="flex items-center justify-between text-xs text-white/50">
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

      <p className="mt-4 flex items-center gap-2 text-xs text-white/50">
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6" />
      <path d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="10" cy="8" r="2.2" />
    </svg>
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
