"use client";

import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#101811]">
      {/* HEADER */}
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

            <span className="font-bold text-xl">
              SeatMate
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-xl font-semibold transition"
          >
            Home
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-4xl">
          <p className="text-green-600 font-bold text-sm tracking-wider">
            ABOUT SEATMATE
          </p>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mt-5 leading-[1.05]">
            Know before you go.
          </h1>

          <p className="text-xl md:text-2xl text-gray-500 mt-7 max-w-3xl leading-relaxed">
            SeatMate helps people see live seating availability
            at restaurants and cafés before they arrive.
          </p>
        </div>
      </section>

      {/* MISSION */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-14">
            <div>
              <p className="text-green-600 font-bold text-sm">
                OUR MISSION
              </p>

              <h2 className="text-4xl md:text-5xl font-bold mt-4">
                Make finding a place to sit simple.
              </h2>
            </div>

            <div className="text-gray-500 text-lg leading-8 space-y-5">
              <p>
                Finding a restaurant or café is easy. Knowing
                whether there is actually somewhere to sit when
                you arrive is not.
              </p>

              <p>
                SeatMate connects businesses and customers through
                live floor-plan data, giving customers a clearer
                picture of seating availability while helping
                businesses manage occupancy with a simple interface.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <p className="text-green-600 font-bold text-sm">
          HOW IT WORKS
        </p>

        <h2 className="text-4xl md:text-5xl font-bold mt-4 max-w-2xl">
          One floor plan. Two sides of the experience.
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mt-12">
          <div className="bg-white border border-gray-200 rounded-[28px] p-8">
            <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center font-bold">
              01
            </div>

            <h3 className="text-2xl font-bold mt-6">
              For businesses
            </h3>

            <p className="text-gray-500 mt-3 leading-7">
              Businesses create a digital floor plan and update
              seat occupancy as customers arrive and leave.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-[28px] p-8">
            <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center font-bold">
              02
            </div>

            <h3 className="text-2xl font-bold mt-6">
              For customers
            </h3>

            <p className="text-gray-500 mt-3 leading-7">
              Customers see the same floor plan and live seating
              information before deciding where to go.
            </p>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="bg-[#101811] text-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-3xl">
            <p className="text-green-400 font-bold text-sm">
              WHY SEATMATE
            </p>

            <h2 className="text-4xl md:text-5xl font-bold mt-4">
              Less guessing. Better decisions.
            </h2>

            <p className="text-white/60 text-lg leading-8 mt-6">
              SeatMate is built around a simple idea: live
              information should make everyday decisions easier.
              Whether you are looking for a place to study, grab
              coffee, eat with friends, or simply find an open
              seat, SeatMate gives you more information before
              you leave.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mt-12">
            <ValueCard
              title="Live"
              description="Availability updates as businesses manage their floor."
            />

            <ValueCard
              title="Simple"
              description="Businesses can update occupancy with only a few taps."
            />

            <ValueCard
              title="Local"
              description="SeatMate is designed to launch community by community."
            />
          </div>
        </div>
      </section>

      {/* FOUNDERS */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-green-600 font-bold text-sm">
            OUR STORY
          </p>

          <h2 className="text-4xl md:text-5xl font-bold mt-4">
            Built from a problem we kept noticing.
          </h2>

          <p className="text-gray-500 text-lg leading-8 mt-6">
            SeatMate started with a simple question: why can we
            see almost everything about a restaurant online except
            whether there is actually somewhere to sit?
          </p>

          <p className="text-gray-500 text-lg leading-8 mt-4">
            We started building SeatMate to close that gap by
            connecting real-time information from businesses
            directly to the people deciding where to go.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="bg-green-600 rounded-[36px] p-8 md:p-14 text-white">
          <h2 className="text-4xl md:text-5xl font-bold">
            See what&apos;s open.
          </h2>

          <p className="text-white/80 text-lg mt-4 max-w-xl">
            Search SeatMate and find live seating availability
            before you arrive.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="bg-white text-[#101811] px-6 py-3 rounded-xl font-bold"
            >
              Find a Seat →
            </button>

            <button
              type="button"
              onClick={() => router.push("/business/login")}
              className="border border-white/30 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-bold"
            >
              SeatMate for Business
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="font-bold">
            SeatMate
          </p>

          <p className="text-sm text-gray-400">
            Live seating. Less guessing.
          </p>
        </div>
      </footer>
    </main>
  );
}

function ValueCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-white/10 bg-white/5 rounded-2xl p-6">
      <h3 className="font-bold text-xl">
        {title}
      </h3>

      <p className="text-white/50 text-sm leading-6 mt-2">
        {description}
      </p>
    </div>
  );
}