import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import LiveSeats from "@/components/live-seats";
import SuggestLink from "@/components/suggest-link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { fallbackImageFor } from "@/lib/place-data";
import { listCitiesServer } from "@/lib/places-server";

async function findCity(slug: string) {
  return (await listCitiesServer()).find((city) => city.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/places/[city]">): Promise<Metadata> {
  const city = await findCity((await params).city);

  if (!city) {
    return { title: "City not found – SeatMate" };
  }

  return {
    title: `Live seating in ${city.name}, ${city.state} – SeatMate`,
    description: `See open seats right now at ${city.places.length} ${
      city.places.length === 1 ? "place" : "places"
    } in ${city.name}, ${city.state}, before you go.`,
  };
}

export default async function CityPage({ params }: PageProps<"/places/[city]">) {
  const city = await findCity((await params).city);

  if (!city) {
    notFound();
  }

  const types = [...new Set(city.places.map((place) => place.type).filter(Boolean))];

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 md:pt-16">
        <Link href="/places" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          All cities
        </Link>

        <h1 className="font-display mt-4 text-5xl sm:text-6xl">
          {city.name}, {city.state}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-gray-600">
          Live seating at {city.places.length} {city.places.length === 1 ? "place" : "places"}
          {types.length > 0 ? ` — ${types.slice(0, 3).join(", ").toLowerCase()}` : ""}. Check
          who has room before you head out.
        </p>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {city.places.map((place) => (
            <li key={place.slug}>
              <Link
                href={`/place/${place.slug}`}
                className="group block overflow-hidden rounded-2xl border border-line bg-white transition hover:border-gray-300 hover:shadow-[0_16px_32px_-20px_rgba(16,24,17,0.35)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={place.imageUrl || fallbackImageFor(place.name || place.slug)}
                  alt=""
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="p-5">
                  <p className="text-sm text-gray-500">{place.type || "Restaurant"}</p>
                  <h2 className="mt-1 text-lg font-semibold group-hover:text-moss">{place.name}</h2>
                  <p className="mt-1 truncate text-sm text-gray-500">{place.address}</p>
                  <div className="mt-4">
                    <LiveSeats businessId={place.businessId} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-gray-600">
          <SuggestLink
            href={`/suggest?location=${encodeURIComponent(`${city.name}, ${city.state}`)}`}
            before={<>Missing a favorite spot in {city.name}? </>}
          >
            Ask for it on SeatMate
          </SuggestLink>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
