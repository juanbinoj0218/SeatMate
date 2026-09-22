"use client";

import { useEffect, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import BackButton from "@/components/BackButton";
<BackButton fallback="/business" />

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
  availableSeats: number;
  totalSeats: number;
  latestUpdateMs: number | null;
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery =
    searchParams.get("q") || "";

  const [search, setSearch] =
    useState(initialQuery);

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [now, setNow] =
    useState(Date.now());

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

              return {
                slug: businessDoc.id,

                businessId:
                  data.businessId,

                name:
                  data.name || "",

                address:
                  data.address || "",

                type:
                  data.type || "",
              };
            })
            .filter((business) => {
              if (!term) {
                return true;
              }

              const searchableText = `
                ${business.name}
                ${business.address}
                ${business.type}
              `.toLowerCase();

              return searchableText.includes(
                term
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
  }, [initialQuery]);

  const submitSearch = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!search.trim()) {
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(
        search.trim()
      )}`
    );
  };

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
          Search restaurants and cafés
          using SeatMate.
        </p>

        {/* SEARCH */}

        <form
          onSubmit={submitSearch}
          className="mt-8 max-w-2xl"
        >

          <div className="bg-white border border-gray-200 rounded-2xl p-2 flex shadow-sm">

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Restaurant, café, or location"
              className="flex-1 h-12 px-4 outline-none bg-transparent text-black"
            />

            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-semibold transition"
            >
              Search
            </button>

          </div>

        </form>

        {/* RESULTS */}

        <div className="mt-10">

          <div className="flex items-center justify-between">

            <h2 className="font-bold text-xl text-[#101811]">
              Results
            </h2>

            {!loading && (
              <span className="text-sm text-gray-400">

                {results.length}{" "}

                {results.length === 1
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

          ) : results.length === 0 ? (

            <div className="bg-white border border-gray-200 rounded-[26px] p-10 mt-5 text-center">

              <div className="text-4xl">
                🪑
              </div>

              <h3 className="text-xl font-bold text-[#101811] mt-4">
                No locations found
              </h3>

              <p className="text-gray-500 mt-2">
                Try another business name
                or location.
              </p>

            </div>

          ) : (

            <div className="grid gap-4 mt-5">

              {results.map(
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