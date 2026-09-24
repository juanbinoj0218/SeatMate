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

import { db } from "@/lib/firebase";

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
  const activeZip =
    /^\d{5}$/.test(zipcode) ? zipcode : detectedZip;

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
    <main className="min-h-screen bg-[#f7f8f5] text-[#101811]">
      {/* NAVBAR */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center">
              S
            </div>

            <span className="text-xl font-bold">
              SeatMate
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* ABOUT US */}
            <button
              type="button"
              onClick={() => router.push("/about")}
              className="text-sm font-semibold text-gray-500 hover:text-black transition"
            >
              About Us
            </button>

            {/* BUSINESS PORTAL */}
            <button
              type="button"
              onClick={() =>
                router.push("/business/login")
              }
              className="bg-[#101811] text-white px-5 py-3 rounded-xl font-semibold hover:bg-black transition"
            >
              Business Portal
            </button>
          </div>
        </div>
      </header>

      {/* HERO - OLD LAYOUT RESTORED */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* LEFT SIDE */}
          <div>
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Live seating availability
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1] mt-7">
              Know before
              <br />
              you go.
            </h1>

            <p className="text-lg md:text-xl text-gray-500 max-w-xl mt-7 leading-8">
              Check live seating availability at cafés and restaurants before
              you arrive.
            </p>

            <form
              onSubmit={findBusiness}
              className="mt-10 max-w-xl"
            >
              <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-lg">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setMessage("");
                    }}
                    placeholder="Café or restaurant"
                    className="flex-1 h-12 px-4 outline-none bg-transparent text-black"
                  />

                  <div className="hidden sm:block w-px bg-gray-200" />

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
                    placeholder={
                      detectedZip || "ZIP code"
                    }
                    maxLength={5}
                    className="sm:w-36 h-12 px-4 outline-none bg-transparent text-black border-t sm:border-t-0 border-gray-100"
                  />

                  <button
                    type="submit"
                    className="h-12 bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-semibold transition whitespace-nowrap"
                  >
                    Find Seats
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <p className="text-xs text-gray-400">
                  Search by business name, ZIP code, or both.
                </p>

                {detectedZip && !zipcode && (
                  <span className="text-xs font-semibold text-green-700">
                    Near you: {detectedZip}
                  </span>
                )}
              </div>

              {message && (
                <p className="text-red-500 text-sm mt-3">
                  {message}
                </p>
              )}
            </form>

            <div className="flex flex-wrap gap-6 mt-7 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="text-green-500">
                  ●
                </span>

                Live availability
              </span>

              <span>
                ✓ No account needed
              </span>

              <span>
                ↻ Updates instantly
              </span>
            </div>
          </div>

          {/* OLD MOCK FLOOR PLAN RESTORED */}
          <div className="bg-white border border-gray-200 rounded-[32px] shadow-xl p-7">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-green-700 text-xs font-bold">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />

                  LIVE
                </div>

                <h2 className="text-2xl font-bold mt-2">
                  Your favorite café
                </h2>

                <p className="text-sm text-gray-400 mt-1">
                  Seating updated moments ago
                </p>
              </div>

              <div className="text-right">
                <p className="text-3xl font-bold text-green-600">
                  8
                </p>

                <p className="text-xs text-gray-400">
                  seats open
                </p>
              </div>
            </div>

            <div className="relative h-[360px] bg-[#f8faf7] border border-gray-100 rounded-3xl mt-7 overflow-hidden">
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />

              <PreviewTable
                name="Table 1"
                left="8%"
                top="14%"
                seats={[
                  "available",
                  "available",
                  "occupied",
                  "available",
                ]}
              />

              <PreviewTable
                name="Table 2"
                left="53%"
                top="18%"
                seats={[
                  "available",
                  "occupied",
                  "available",
                  "available",
                ]}
              />

              <PreviewTable
                name="Table 3"
                left="28%"
                top="61%"
                seats={[
                  "occupied",
                  "available",
                  "available",
                  "available",
                ]}
              />
            </div>

            <div className="flex justify-center gap-6 text-xs font-semibold mt-5">
              <span className="text-green-600">
                ● Available
              </span>

              <span className="text-red-500">
                ● Occupied
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: RESTAURANTS NEAR YOU */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="text-green-600 font-bold text-sm">
              LIVE NEAR YOU
            </p>

            <h2 className="text-4xl md:text-5xl font-bold mt-3">
              Restaurants near you
            </h2>

            <p className="text-gray-500 mt-3 max-w-2xl">
              {activeZip
                ? `Approved SeatMate locations in ZIP ${activeZip}, sorted by current seating availability.`
                : "Approved restaurants and cafés currently using SeatMate."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {locationState !== "ready" && (
              <button
                type="button"
                onClick={detectLocation}
                disabled={locationState === "checking"}
                className="border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                {locationState === "checking"
                  ? "Finding your area..."
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
              className="bg-[#101811] text-white hover:bg-black px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              View all →
            </button>
          </div>
        </div>

        {businessesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[330px] bg-white border border-gray-200 rounded-[26px] animate-pulse"
              />
            ))}
          </div>
        ) : nearbyBusinesses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-[26px] p-10 mt-10 text-center">
            <div className="text-4xl">
              🪑
            </div>

            <h3 className="text-xl font-bold mt-4">
              No SeatMate locations nearby yet
            </h3>

            <p className="text-gray-500 mt-2">
              {activeZip
                ? `There are no approved SeatMate businesses in ZIP ${activeZip} yet.`
                : "Try entering your ZIP code above to find SeatMate locations near you."}
            </p>

            {activeZip && (
              <button
                type="button"
                onClick={() => router.push("/search")}
                className="text-green-700 font-semibold mt-5 hover:text-green-800"
              >
                Browse all locations →
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
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
            <p className="text-sm text-gray-500 mt-5">
              Location access is unavailable. Enter your ZIP code above to see
              SeatMate restaurants near you.
            </p>
          )}
      </section>

      {/* HOW IT WORKS - OLD SECTION RESTORED */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <p className="text-green-600 font-bold text-sm">
            HOW IT WORKS
          </p>

          <h2 className="text-4xl md:text-5xl font-bold mt-3 max-w-2xl">
            Finding a seat shouldn&apos;t be a guessing game.
          </h2>

          <div className="grid md:grid-cols-3 gap-5 mt-12">
            <InfoCard
              number="01"
              title="Find a location"
              description="Search for the café or restaurant you want to visit."
            />

            <InfoCard
              number="02"
              title="Check the floor"
              description="See which seats are available and where they are located."
            />

            <InfoCard
              number="03"
              title="Head over"
              description="Availability updates live as staff manage seating."
            />
          </div>
        </div>
      </section>

      {/* BUSINESS - OLD SECTION RESTORED */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-[#101811] text-white rounded-[36px] p-8 md:p-14">
          <p className="text-green-400 font-bold text-sm">
            SEATMATE FOR BUSINESS
          </p>

          <h2 className="text-4xl md:text-5xl font-bold max-w-2xl mt-4">
            Turn your floor plan into live information.
          </h2>

          <p className="text-white/60 text-lg max-w-xl mt-5 leading-8">
            Staff update occupancy with one tap. Customers see those changes
            instantly.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/business/login")
            }
            className="bg-green-500 hover:bg-green-400 text-[#101811] px-6 py-3 rounded-xl font-bold mt-8 transition"
          >
            Open Business Portal →
          </button>
        </div>
      </section>

      {/* FOOTER - OLD FOOTER RESTORED */}
      <footer className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 text-white font-bold flex items-center justify-center">
              S
            </div>

            <span className="font-bold">
              SeatMate
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Live seating, without the guessing.
          </p>
        </div>
      </footer>
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
    <button
      type="button"
      onClick={onOpen}
      className="group bg-white border border-gray-200 rounded-[26px] overflow-hidden text-left hover:border-green-300 hover:shadow-lg transition"
    >
      {/* REAL RESTAURANT PHOTO IF SAVED IN FIREBASE */}
      {business.imageUrl ? (
        <div className="h-44 bg-gray-100 overflow-hidden">
          <img
            src={business.imageUrl}
            alt={business.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
          />
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-[#e9f5ea] to-[#f7f8f5] flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-xl font-bold text-green-700 mx-auto">
              {business.name
                .trim()
                .charAt(0)
                .toUpperCase() || "S"}
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Restaurant photo coming soon
            </p>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              {business.type}
            </span>

            <h3 className="text-xl font-bold mt-3 truncate group-hover:text-green-700 transition">
              {business.name}
            </h3>
          </div>

          {business.totalSeats > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-3xl font-bold text-green-600 leading-none">
                {business.availableSeats}
              </p>

              <p className="text-[11px] text-gray-400 mt-1">
                seats open
              </p>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mt-2 line-clamp-2">
          {business.address}
        </p>

        <div className="border-t border-gray-100 mt-5 pt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">
              {availabilityLabel}
            </p>

            <p
              className={`text-xs mt-1 ${
                isFresh
                  ? "text-green-700"
                  : "text-gray-400"
              }`}
            >
              {freshnessLabel}
            </p>
          </div>

          <span className="text-green-700 font-bold">
            View →
          </span>
        </div>
      </div>
    </button>
  );
}

function PreviewTable({
  name,
  left,
  top,
  seats,
}: {
  name: string;
  left: string;
  top: string;
  seats: ("available" | "occupied")[];
}) {
  return (
    <div
      className="absolute w-[145px] bg-white border border-gray-200 shadow-sm rounded-2xl p-3"
      style={{
        left,
        top,
      }}
    >
      <div className="bg-[#101811] h-14 rounded-xl flex items-center justify-center">
        <span className="text-white text-xs font-semibold">
          {name}
        </span>
      </div>

      <div className="flex justify-center gap-1.5 mt-2.5">
        {seats.map((status, index) => (
          <div
            key={index}
            className={`w-6 h-6 rounded-full ${
              status === "available"
                ? "bg-green-500"
                : "bg-red-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function InfoCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-gray-200 rounded-[26px] p-7">
      <div className="w-11 h-11 rounded-xl bg-green-50 text-green-700 font-bold flex items-center justify-center text-sm">
        {number}
      </div>

      <h3 className="text-xl font-bold mt-6">
        {title}
      </h3>

      <p className="text-gray-500 leading-7 mt-2">
        {description}
      </p>
    </div>
  );
}
