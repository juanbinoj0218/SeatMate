"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type SearchResult = {
  slug: string;
  businessId: string;
  name: string;
  address: string;
  type: string;
  zipcode: string;
  availableSeats: number;
  totalSeats: number;
  latestUpdateMs: number | null;
};

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery =
    searchParams.get("q") || "";

  const initialZip =
    searchParams.get("zip") || "";

  const [search, setSearch] =
    useState(initialQuery);

  const [zipcode, setZipcode] =
    useState(initialZip);

  const [message, setMessage] =
    useState("");

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [now, setNow] =
    useState(Date.now());

  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("availability");

  // Refresh freshness labels every 30 seconds
  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setNow(Date.now());
      }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // Load search results
  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);

        const term =
          initialQuery
            .trim()
            .toLowerCase();

        const zipTerm =
          initialZip.trim();

        const businessesSnapshot =
          await getDocs(
            collection(
              db,
              "publicBusinesses"
            )
          );

        const matches =
          businessesSnapshot.docs
            .map((businessDoc) => {
              const data =
                businessDoc.data();

              const address =
                String(data.address || "");

              const zipFromAddress =
                address.match(
                  /\b\d{5}(?:-\d{4})?\b/
                )?.[0]?.slice(0, 5) || "";

              return {
                slug: businessDoc.id,

                businessId:
                  data.businessId,

                name:
                  data.name || "",

                address,

                type:
                  data.type || "",

                zipcode:
                  String(
                    data.zipcode ||
                      data.zip ||
                      zipFromAddress
                  ).trim(),
              };
            })
            .filter((business) => {
              const searchableText = `
                ${business.name}
                ${business.address}
                ${business.type}
              `.toLowerCase();

              const matchesQuery =
                !term ||
                searchableText.includes(term);

              const matchesZip =
                !zipTerm ||
                business.zipcode === zipTerm;

              return (
                matchesQuery &&
                matchesZip
              );
            });

        const resultsWithAvailability =
          await Promise.all(
            matches.map(
              async (business) => {
                const tablesSnapshot =
                  await getDocs(
                    collection(
                      db,
                      "businesses",
                      business.businessId,
                      "tables"
                    )
                  );

                let totalSeats = 0;

                let availableSeats = 0;

                let latestUpdateMs:
                  | number
                  | null = null;

                tablesSnapshot.docs.forEach(
                  (tableDoc) => {
                    const table =
                      tableDoc.data();

                    const seats =
                      table.seats || [];

                    totalSeats +=
                      seats.length;

                    availableSeats +=
                      seats.filter(
                        (seat: {
                          status: string;
                        }) =>
                          seat.status ===
                          "available"
                      ).length;

                    // Find newest occupancy update
                    const occupancyUpdatedAt =
                      table.occupancyUpdatedAt;

                    if (
                      occupancyUpdatedAt
                        instanceof Timestamp
                    ) {
                      const updateMs =
                        occupancyUpdatedAt.toMillis();

                      if (
                        latestUpdateMs ===
                          null ||
                        updateMs >
                          latestUpdateMs
                      ) {
                        latestUpdateMs =
                          updateMs;
                      }
                    }
                  }
                );

                return {
                  ...business,

                  totalSeats,

                  availableSeats,

                  latestUpdateMs,
                };
              }
            )
          );

        setResults(
          resultsWithAvailability
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [initialQuery, initialZip]);

  const submitSearch = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const query = search.trim();
    const zip = zipcode.trim();

    setMessage("");

    if (!query && !zip) {
      setMessage(
        "Enter a business name or ZIP code."
      );
      return;
    }

    if (zip && !/^\d{5}$/.test(zip)) {
      setMessage(
        "Enter a valid 5-digit ZIP code."
      );
      return;
    }

    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }

    if (zip) {
      params.set("zip", zip);
    }

    router.push(
      `/search?${params.toString()}`
    );
  };

  const displayedResults = useMemo(() => {
    let filtered = [...results];

    if (filter === "available") {
      filtered = filtered.filter(
        (business) => business.availableSeats > 0
      );
    }

    if (filter === "plenty") {
      filtered = filtered.filter((business) => {
        if (business.totalSeats === 0) return false;

        const percentage =
          (business.availableSeats / business.totalSeats) * 100;

        return percentage >= 60;
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
        business.type
          .toLowerCase()
          .includes("restaurant")
      );
    }

    if (sort === "availability") {
      filtered.sort((a, b) => {
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
    }

    if (sort === "recent") {
      filtered.sort(
        (a, b) =>
          (b.latestUpdateMs ?? 0) -
          (a.latestUpdateMs ?? 0)
      );
    }

    if (sort === "name") {
      filtered.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    return filtered;
  }, [results, filter, sort]);

  return (
    <main className="min-h-screen bg-[#f7f8f5]">

      {/* HEADER */}

      <header className="bg-white border-b border-[#e3e7e2]">

        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">

          <button
            onClick={() =>
              router.push("/")
            }
            className="flex items-center gap-3"
          >

            <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold">
              S
            </div>

            <span className="font-bold text-xl text-[#101811]">
              SeatMate
            </span>

          </button>

          <button
            onClick={() =>
              router.push(
                "/business/login"
              )
            }
            className="text-sm font-semibold text-gray-500 hover:text-black"
          >
            Business Portal
          </button>

        </div>

      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">

        <button
          onClick={() =>
            router.push("/")
          }
          className="text-sm text-gray-500 hover:text-black"
        >
          ← Back
        </button>

        <h1 className="text-4xl md:text-5xl font-bold text-[#101811] mt-6">
          Find a seat
        </h1>

        <p className="text-gray-500 mt-3">
          {initialZip
            ? `Showing SeatMate locations in ZIP ${initialZip}.`
            : "Search restaurants and cafés using SeatMate."}
        </p>

        {/* SEARCH */}

        <form
          onSubmit={submitSearch}
          className="mt-8 max-w-2xl"
        >

          <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">

            <div className="flex flex-col sm:flex-row gap-2">

              <input
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value
                  );
                  setMessage("");
                }}
                placeholder="Restaurant, café, or name"
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
                placeholder="ZIP code"
                maxLength={5}
                className="sm:w-36 h-12 px-4 outline-none bg-transparent text-black border-t sm:border-t-0 border-gray-100"
              />

              <button
                type="submit"
                className="h-12 bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-semibold transition"
              >
                Search
              </button>

            </div>

          </div>

          {message && (
            <p className="text-red-500 text-sm mt-3">
              {message}
            </p>
          )}

        </form>

        {/* FILTERS */}

        <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div className="flex flex-wrap gap-2">

            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                filter === "all"
                  ? "bg-[#101811] text-white border-[#101811]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              All
            </button>

            <button
              onClick={() => setFilter("available")}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                filter === "available"
                  ? "bg-[#101811] text-white border-[#101811]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Available now
            </button>

            <button
              onClick={() => setFilter("plenty")}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                filter === "plenty"
                  ? "bg-[#101811] text-white border-[#101811]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Plenty of seats
            </button>

            <button
              onClick={() => setFilter("cafe")}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                filter === "cafe"
                  ? "bg-[#101811] text-white border-[#101811]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Café
            </button>

            <button
              onClick={() => setFilter("restaurant")}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                filter === "restaurant"
                  ? "bg-[#101811] text-white border-[#101811]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              Restaurant
            </button>

          </div>

          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value)
            }
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 outline-none cursor-pointer"
          >
            <option value="availability">
              Best availability
            </option>

            <option value="recent">
              Recently updated
            </option>

            <option value="name">
              Name A-Z
            </option>
          </select>

        </div>

        {/* RESULTS */}

        <div className="mt-10">

          <div className="flex items-center justify-between">

            <h2 className="font-bold text-xl text-[#101811]">
              Results
            </h2>

            {!loading && (
              <span className="text-sm text-gray-400">

                {displayedResults.length}{" "}

                {displayedResults.length === 1
                  ? "location"
                  : "locations"}

              </span>
            )}

          </div>

          {loading ? (

            <div className="bg-white border border-gray-200 rounded-2xl p-8 mt-5">

              <p className="text-gray-500">
                Searching SeatMate...
              </p>

            </div>

          ) : displayedResults.length === 0 ? (

            <div className="bg-white border border-gray-200 rounded-[26px] p-10 mt-5 text-center">

              <div className="text-4xl">
                🪑
              </div>

              <h3 className="text-xl font-bold text-[#101811] mt-4">
                No locations found
              </h3>

              <p className="text-gray-500 mt-2">
                {initialZip
                  ? `No approved SeatMate locations were found in ZIP ${initialZip}.`
                  : "Try another business name or ZIP code."}
              </p>

            </div>

          ) : (

            <div className="grid gap-4 mt-5">

              {displayedResults.map(
                (business) => {

                  const percentage =
                    business.totalSeats ===
                    0
                      ? 0
                      : Math.round(
                          (business.availableSeats /
                            business.totalSeats) *
                            100
                        );

                  const availability =
                    percentage >= 60
                      ? "Plenty of seating"
                      : percentage >= 25
                        ? "Some seats available"
                        : percentage > 0
                          ? "Limited seating"
                          : business.totalSeats >
                              0
                            ? "Currently full"
                            : "No seating data";

                  // ---------------------------
                  // FRESHNESS
                  // ---------------------------

                  const ageMinutes =
                    business.latestUpdateMs ===
                    null
                      ? null
                      : Math.max(
                          0,
                          Math.floor(
                            (now -
                              business.latestUpdateMs) /
                              60000
                          )
                        );

                  let freshnessLabel =
                    "No recent update";

                  if (
                    ageMinutes !== null
                  ) {
                    if (
                      ageMinutes < 1
                    ) {
                      freshnessLabel =
                        "Updated just now";
                    } else if (
                      ageMinutes === 1
                    ) {
                      freshnessLabel =
                        "Updated 1 min ago";
                    } else if (
                      ageMinutes < 60
                    ) {
                      freshnessLabel =
                        `Updated ${ageMinutes} min ago`;
                    } else {
                      const hours =
                        Math.floor(
                          ageMinutes /
                            60
                        );

                      freshnessLabel =
                        hours === 1
                          ? "Updated 1 hour ago"
                          : `Updated ${hours} hours ago`;
                    }
                  }

                  const isStale =
                    ageMinutes === null ||
                    ageMinutes >= 15;

                  return (

                    <button
                      key={
                        business.slug
                      }
                      onClick={() =>
                        router.push(
                          `/place/${business.slug}`
                        )
                      }
                      className="w-full text-left bg-white border border-[#e3e7e2] rounded-[24px] p-6 hover:border-green-300 hover:shadow-md transition group"
                    >

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

                        <div>

                          <div className="flex flex-wrap items-center gap-2">

                            {/* BUSINESS TYPE */}

                            <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                              {
                                business.type
                              }
                            </span>

                            {/* FRESHNESS */}

                            {business.totalSeats >
                              0 && (

                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  isStale
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-green-50 text-green-700"
                                }`}
                              >

                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isStale
                                      ? "bg-amber-500"
                                      : "bg-green-500"
                                  }`}
                                />

                                {
                                  freshnessLabel
                                }

                              </span>

                            )}

                          </div>

                          <h3 className="text-2xl font-bold text-[#101811] mt-3 group-hover:text-green-700 transition">

                            {
                              business.name
                            }

                          </h3>

                          <p className="text-gray-500 mt-1">

                            {
                              business.address
                            }

                          </p>

                          {/* STALE WARNING */}

                          {business.totalSeats >
                            0 &&
                            isStale && (

                            <p className="text-xs text-amber-700 mt-3 font-medium">
                              Availability may be outdated
                            </p>

                          )}

                        </div>

                        <div className="md:text-right">

                          {business.totalSeats >
                          0 ? (

                            <>

                              <div className="flex md:justify-end items-end gap-2">

                                <span className="text-3xl font-bold text-green-600">

                                  {
                                    business.availableSeats
                                  }

                                </span>

                                <span className="text-gray-400 text-sm mb-1">

                                  of{" "}

                                  {
                                    business.totalSeats
                                  }{" "}

                                  open

                                </span>

                              </div>

                              <p className="text-sm font-medium text-[#101811] mt-1">

                                {
                                  availability
                                }

                              </p>

                            </>

                          ) : (

                            <p className="text-gray-400 text-sm">
                              No seating data yet
                            </p>

                          )}

                        </div>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </div>

      </div>

    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center font-bold mx-auto">
              S
            </div>

            <p className="text-gray-500 mt-4">
              Loading SeatMate...
            </p>
          </div>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}