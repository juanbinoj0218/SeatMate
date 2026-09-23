"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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

    if (query) {
      params.set("q", query);
    }

    if (zip) {
      params.set("zip", zip);
    }

    router.push(`/search?${params.toString()}`);
  };

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

      {/* HERO */}
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
                    placeholder="ZIP code"
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

              <p className="text-xs text-gray-400 mt-3">
                Search by business name, ZIP code, or both.
              </p>

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

          {/* MOCK FLOOR PLAN */}
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

      {/* HOW IT WORKS */}
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

      {/* BUSINESS */}
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

      {/* FOOTER */}
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