"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=85",
];

export default function HomePage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [message, setMessage] = useState("");

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

    if (query) params.set("q", query);
    if (zip) params.set("zip", zip);

    router.push(`/search?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#101811]">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f7f8f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 font-bold text-white shadow-sm">
              S
            </div>
            <span className="text-xl font-black tracking-tight">SeatMate</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/about")}
              className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-white hover:text-black sm:block"
            >
              About us
            </button>

            <button
              type="button"
              onClick={() => router.push("/business/login")}
              className="rounded-xl bg-[#101811] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black sm:px-5"
            >
              Business Portal
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              Live seating availability
            </div>

            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl md:text-7xl">
              Find the right place before you leave.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-500 md:text-xl">
              See live seating at cafés and restaurants, check the floor plan,
              and know whether there is actually room for you.
            </p>

            <form onSubmit={findBusiness} className="mt-9 max-w-2xl">
              <div className="rounded-[22px] border border-gray-200 bg-white p-2 shadow-[0_18px_50px_rgba(16,24,17,0.10)]">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                    <span className="text-lg text-gray-400">⌕</span>
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setMessage("");
                      }}
                      placeholder="Search café or restaurant"
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
                    className="h-12 border-t border-gray-100 bg-transparent px-4 text-black outline-none placeholder:text-gray-400 sm:w-36 sm:border-t-0"
                  />

                  <button
                    type="submit"
                    className="h-12 rounded-[14px] bg-green-600 px-6 font-bold text-white transition hover:bg-green-700"
                  >
                    Find seats
                  </button>
                </div>
              </div>

              {message && (
                <p className="mt-3 text-sm font-medium text-red-500">{message}</p>
              )}
            </form>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-gray-500">
              <span>● Live availability</span>
              <span>✓ No account needed</span>
              <span>↻ Updates instantly</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px] lg:mx-0">
            <div className="grid grid-cols-[1.05fr_0.95fr] gap-3 sm:gap-4">
              <div className="relative row-span-2 min-h-[460px] overflow-hidden rounded-[30px] shadow-xl sm:min-h-[560px]">
                <img
                  src={HERO_IMAGES[0]}
                  alt="Modern café interior"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <div className="absolute bottom-5 left-5 right-5 rounded-[22px] border border-white/20 bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-green-600">
                        Live now
                      </p>
                      <p className="mt-1 text-lg font-black sm:text-xl">
                        Downtown Coffee
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Quiet · Wi-Fi · Outlets
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-black text-green-600">8</p>
                      <p className="text-xs font-semibold text-gray-400">
                        seats open
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-[220px] overflow-hidden rounded-[28px] shadow-lg sm:min-h-[272px]">
                <img
                  src={HERO_IMAGES[1]}
                  alt="Restaurant dining room"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="relative min-h-[220px] overflow-hidden rounded-[28px] bg-[#101811] shadow-lg sm:min-h-[272px]">
                <img
                  src={HERO_IMAGES[2]}
                  alt="Restaurant seating area"
                  className="h-full w-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
                    SeatMate floor
                  </p>
                  <p className="mt-2 text-xl font-black">Pick a seat before you go.</p>
                </div>
              </div>
            </div>

            <div className="absolute -left-5 top-12 hidden rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xl md:block">
              <p className="text-xs font-semibold text-gray-400">Best for</p>
              <p className="mt-1 font-black">📚 Studying</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-20">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-green-600">
                Discover differently
              </p>
              <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-tight md:text-5xl">
                Choose a place based on what you need right now.
              </h2>
            </div>
            <p className="max-w-md text-gray-500 leading-7">
              SeatMate is built around the thing normal restaurant apps cannot show
              you: whether there is actually somewhere to sit.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UseCaseCard icon="📚" title="Study" text="Find calmer spaces with open tables." />
            <UseCaseCard icon="☕" title="Coffee" text="See where seats are open before the trip." />
            <UseCaseCard icon="🍽️" title="Eat" text="Check current room before choosing a spot." />
            <UseCaseCard icon="💻" title="Work" text="Look for seating, Wi-Fi, and outlets." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-green-600">
              How it works
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              No more walking in and hoping there is a table.
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-500">
              Businesses update their live floor in a few taps. Customers see the
              same information immediately.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard number="01" title="Find a place" description="Search restaurants and cafés that use SeatMate." />
            <InfoCard number="02" title="See the floor" description="Check live seat availability and where open seats are." />
            <InfoCard number="03" title="Head over" description="Make your choice with better information before you leave." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[36px] bg-[#101811] px-7 py-10 text-white sm:px-10 md:px-14 md:py-14">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-green-400">
              SeatMate for Business
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Turn your floor plan into live information.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/60">
              Staff update occupancy with one tap. Customers see those changes
              instantly and know when it is worth coming in.
            </p>
            <button
              type="button"
              onClick={() => router.push("/business/login")}
              className="mt-8 rounded-xl bg-green-500 px-6 py-3 font-black text-[#101811] transition hover:bg-green-400"
            >
              Open Business Portal →
            </button>
          </div>

          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-green-500/10" />
          <div className="absolute -bottom-36 right-32 h-80 w-80 rounded-full border border-white/5" />
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 font-bold text-white">
              S
            </div>
            <span className="font-black">SeatMate</span>
          </div>
          <p className="text-xs text-gray-400">Live seating, without the guessing.</p>
        </div>
      </footer>
    </main>
  );
}

function UseCaseCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[26px] border border-gray-200 bg-[#fafbf9] p-6 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-black">{title}</h3>
      <p className="mt-2 leading-7 text-gray-500">{text}</p>
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
    <div className="rounded-[26px] border border-gray-200 bg-white p-7 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-sm font-black text-green-700">
        {number}
      </div>
      <h3 className="mt-6 text-xl font-black">{title}</h3>
      <p className="mt-2 leading-7 text-gray-500">{description}</p>
    </div>
  );
}
