"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=82",
];

type SearchResult = {
  slug: string;
  businessId: string;
  name: string;
  address: string;
  type: string;
  zipcode: string;
  imageUrl: string;
  availableSeats: number;
  totalSeats: number;
  latestUpdateMs: number | null;
};

function hashString(value: string) {
  return value.split("").reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0);
}

function fallbackImageFor(value: string) {
  return FALLBACK_IMAGES[hashString(value) % FALLBACK_IMAGES.length];
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const initialZip = searchParams.get("zip") || "";

  const [search, setSearch] = useState(initialQuery);
  const [zipcode, setZipcode] = useState(initialZip);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("availability");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);

        const term = initialQuery.trim().toLowerCase();
        const zipTerm = initialZip.trim();

        const businessesSnapshot = await getDocs(
          collection(db, "publicBusinesses")
        );

        const matches = businessesSnapshot.docs
          .map((businessDoc) => {
            const data = businessDoc.data();
            const address = String(data.address || "");
            const zipFromAddress =
              address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) || "";

            const name = String(data.name || "");
            const imageUrl = String(
              data.imageUrl ||
                data.coverImageUrl ||
                data.photoUrl ||
                fallbackImageFor(name || businessDoc.id)
            );

            return {
              slug: businessDoc.id,
              businessId: String(data.businessId || ""),
              name,
              address,
              type: String(data.type || ""),
              zipcode: String(
                data.zipcode || data.zip || zipFromAddress
              ).trim(),
              imageUrl,
            };
          })
          .filter((business) => {
            const searchableText = `${business.name} ${business.address} ${business.type}`.toLowerCase();
            const matchesQuery = !term || searchableText.includes(term);
            const matchesZip = !zipTerm || business.zipcode === zipTerm;
            return matchesQuery && matchesZip;
          });

        const resultsWithAvailability = await Promise.all(
          matches.map(async (business) => {
            if (!business.businessId) {
              return {
                ...business,
                totalSeats: 0,
                availableSeats: 0,
                latestUpdateMs: null,
              };
            }

            const tablesSnapshot = await getDocs(
              collection(db, "businesses", business.businessId, "tables")
            );

            let totalSeats = 0;
            let availableSeats = 0;
            let latestUpdateMs: number | null = null;

            tablesSnapshot.docs.forEach((tableDoc) => {
              const table = tableDoc.data();
              const seats = Array.isArray(table.seats) ? table.seats : [];

              totalSeats += seats.length;
              availableSeats += seats.filter(
                (seat: { status?: string }) => seat.status === "available"
              ).length;

              const occupancyUpdatedAt = table.occupancyUpdatedAt;

              if (occupancyUpdatedAt instanceof Timestamp) {
                const updateMs = occupancyUpdatedAt.toMillis();
                if (latestUpdateMs === null || updateMs > latestUpdateMs) {
                  latestUpdateMs = updateMs;
                }
              }
            });

            return {
              ...business,
              totalSeats,
              availableSeats,
              latestUpdateMs,
            };
          })
        );

        setResults(resultsWithAvailability);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [initialQuery, initialZip]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();

    const query = search.trim();
    const zip = zipcode.trim();

    setMessage("");

    if (!query && !zip) {
      setMessage("Enter a business name or ZIP code.");
      return;
    }

    if (zip && !/^\d{5}$/.test(zip)) {
      setMessage("Enter a valid 5-digit ZIP code.");
      return;
    }

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (zip) params.set("zip", zip);

    router.push(`/search?${params.toString()}`);
  };

  const displayedResults = useMemo(() => {
    let filtered = [...results];

    if (filter === "available") {
      filtered = filtered.filter((business) => business.availableSeats > 0);
    }

    if (filter === "plenty") {
      filtered = filtered.filter((business) => {
        if (business.totalSeats === 0) return false;
        return business.availableSeats / business.totalSeats >= 0.6;
      });
    }

    if (filter === "cafe") {
      filtered = filtered.filter((business) => {
        const type = business.type.toLowerCase();
        return (
          type.includes("cafe") ||
          type.includes("café") ||
          type.includes("coffee")
        );
      });
    }

    if (filter === "restaurant") {
      filtered = filtered.filter((business) =>
        business.type.toLowerCase().includes("restaurant")
      );
    }

    if (sort === "availability") {
      filtered.sort((a, b) => {
        const aPercent =
          a.totalSeats > 0 ? a.availableSeats / a.totalSeats : -1;
        const bPercent =
          b.totalSeats > 0 ? b.availableSeats / b.totalSeats : -1;
        return bPercent - aPercent;
      });
    }

    if (sort === "recent") {
      filtered.sort(
        (a, b) => (b.latestUpdateMs ?? 0) - (a.latestUpdateMs ?? 0)
      );
    }

    if (sort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [results, filter, sort]);

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#101811]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 font-bold text-white">
              S
            </div>
            <span className="text-xl font-black tracking-tight">SeatMate</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold transition hover:bg-gray-50"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => router.push("/business/login")}
              className="hidden rounded-xl bg-[#101811] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black sm:block"
            >
              Business Portal
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:py-14">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-semibold text-gray-500 transition hover:text-black"
          >
            ← Back
          </button>

          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-green-600">
                Live SeatMate locations
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                Find your next spot.
              </h1>
              <p className="mt-3 max-w-xl text-gray-500">
                {initialZip
                  ? `Showing SeatMate locations in ZIP ${initialZip}.`
                  : "Search restaurants and cafés and see live seating before you go."}
              </p>
            </div>

            {!loading && (
              <div className="rounded-full bg-[#f2f4f0] px-4 py-2 text-sm font-bold text-gray-600">
                {displayedResults.length}{" "}
                {displayedResults.length === 1 ? "location" : "locations"}
              </div>
            )}
          </div>

          <form onSubmit={submitSearch} className="mt-8 max-w-4xl">
            <div className="rounded-[22px] border border-gray-200 bg-[#fafbf9] p-2 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                  <span className="text-lg text-gray-400">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setMessage("");
                    }}
                    placeholder="Restaurant, café, or name"
                    className="h-12 min-w-0 flex-1 bg-transparent text-black outline-none placeholder:text-gray-400"
                  />
                </div>

                <div className="hidden w-px bg-gray-200 sm:block" />

                <input
                  value={zipcode}
                  onChange={(event) => {
                    setZipcode(
                      event.target.value.replace(/\D/g, "").slice(0, 5)
                    );
                    setMessage("");
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="ZIP code"
                  maxLength={5}
                  className="h-12 border-t border-gray-100 bg-transparent px-4 text-black outline-none sm:w-36 sm:border-t-0"
                />

                <button
                  type="submit"
                  className="h-12 rounded-[14px] bg-green-600 px-6 font-bold text-white transition hover:bg-green-700"
                >
                  Search
                </button>
              </div>
            </div>

            {message && (
              <p className="mt-3 text-sm font-medium text-red-500">{message}</p>
            )}
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:py-10">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-7 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
            <FilterButton active={filter === "available"} onClick={() => setFilter("available")}>Available now</FilterButton>
            <FilterButton active={filter === "plenty"} onClick={() => setFilter("plenty")}>Plenty of seats</FilterButton>
            <FilterButton active={filter === "cafe"} onClick={() => setFilter("cafe")}>Café</FilterButton>
            <FilterButton active={filter === "restaurant"} onClick={() => setFilter("restaurant")}>Restaurant</FilterButton>
          </div>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 outline-none"
          >
            <option value="availability">Best availability</option>
            <option value="recent">Recently updated</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        <div className="mt-8">
          {loading ? (
            <LoadingGrid />
          ) : displayedResults.length === 0 ? (
            <div className="rounded-[28px] border border-gray-200 bg-white p-12 text-center">
              <div className="text-4xl">🪑</div>
              <h2 className="mt-4 text-2xl font-black">No locations found</h2>
              <p className="mt-2 text-gray-500">
                {initialZip
                  ? `No approved SeatMate locations were found in ZIP ${initialZip}.`
                  : "Try another business name or ZIP code."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {displayedResults.map((business) => {
                const percentage =
                  business.totalSeats === 0
                    ? 0
                    : Math.round(
                        (business.availableSeats / business.totalSeats) * 100
                      );

                const availability =
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
                        Math.floor((now - business.latestUpdateMs) / 60000)
                      );

                let freshnessLabel = "No recent update";
                if (ageMinutes !== null) {
                  if (ageMinutes < 1) freshnessLabel = "Updated just now";
                  else if (ageMinutes === 1) freshnessLabel = "Updated 1 min ago";
                  else if (ageMinutes < 60)
                    freshnessLabel = `Updated ${ageMinutes} min ago`;
                  else {
                    const hours = Math.floor(ageMinutes / 60);
                    freshnessLabel =
                      hours === 1
                        ? "Updated 1 hour ago"
                        : `Updated ${hours} hours ago`;
                  }
                }

                const isStale = ageMinutes === null || ageMinutes >= 15;

                return (
                  <button
                    key={business.slug}
                    type="button"
                    onClick={() => router.push(`/place/${business.slug}`)}
                    className="group overflow-hidden rounded-[28px] border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-xl"
                  >
                    <div className="relative h-52 overflow-hidden">
                      <img
                        src={business.imageUrl}
                        alt={`${business.name} interior`}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        onError={(event) => {
                          event.currentTarget.src = fallbackImageFor(business.slug);
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#101811] shadow-sm backdrop-blur">
                          {business.type || "Restaurant"}
                        </span>
                        {business.totalSeats > 0 && (
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-black shadow-sm backdrop-blur ${
                              isStale
                                ? "bg-amber-50/95 text-amber-700"
                                : "bg-green-50/95 text-green-700"
                            }`}
                          >
                            {freshnessLabel}
                          </span>
                        )}
                      </div>

                      {business.totalSeats > 0 && (
                        <div className="absolute bottom-4 right-4 rounded-2xl bg-white/95 px-4 py-3 text-right shadow-lg backdrop-blur">
                          <p className="text-2xl font-black leading-none text-green-600">
                            {business.availableSeats}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-gray-500">
                            seats open
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="truncate text-2xl font-black transition group-hover:text-green-700">
                            {business.name}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">
                            {business.address}
                          </p>
                        </div>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f5f1] font-black text-gray-700 transition group-hover:bg-green-600 group-hover:text-white">
                          →
                        </span>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-4 border-t border-gray-100 pt-4">
                        <div>
                          <p className="text-sm font-black text-[#101811]">
                            {availability}
                          </p>
                          {isStale && business.totalSeats > 0 && (
                            <p className="mt-1 text-xs font-semibold text-amber-700">
                              Availability may be outdated
                            </p>
                          )}
                        </div>

                        {business.totalSeats > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-700">
                              {percentage}% open
                            </p>
                            <p className="text-xs text-gray-400">
                              {business.availableSeats} of {business.totalSeats}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
        active
          ? "border-[#101811] bg-[#101811] text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-[28px] border border-gray-200 bg-white"
        >
          <div className="h-52 animate-pulse bg-gray-200" />
          <div className="space-y-3 p-6">
            <div className="h-6 w-1/2 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-12 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 font-bold text-white">
              S
            </div>
            <p className="mt-4 text-gray-500">Loading SeatMate...</p>
          </div>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
