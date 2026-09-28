import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listCitiesServer } from "@/lib/places-server";

export const metadata: Metadata = {
  title: "Cities – SeatMate",
  description:
    "Find cafés, restaurants and bars with live seating on SeatMate, city by city.",
};

export default async function CitiesPage() {
  const cities = await listCitiesServer();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 md:pt-16">
        <p className="text-sm font-medium text-moss">Cities</p>
        <h1 className="font-display mt-3 text-5xl sm:text-6xl">Where SeatMate is live</h1>
        <p className="mt-4 max-w-xl text-lg text-gray-600">
          Every city with at least one place showing live seats. Don&apos;t see yours?{" "}
          <Link href="/suggest" className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            Suggest a place
          </Link>
          .
        </p>

        {cities.length === 0 ? (
          <p className="mt-12 rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center text-gray-500">
            No cities yet. The first places are on their way.
          </p>
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/places/${city.slug}`}
                  className="group flex items-center justify-between rounded-2xl border border-line bg-white p-6 transition hover:border-gray-300 hover:shadow-[0_16px_32px_-20px_rgba(16,24,17,0.35)]"
                >
                  <span>
                    <span className="font-display block text-2xl">{city.name}</span>
                    <span className="mt-1 block text-sm text-gray-500">
                      {city.state} · {city.places.length} {city.places.length === 1 ? "place" : "places"}
                    </span>
                  </span>
                  <ArrowRightIcon className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
