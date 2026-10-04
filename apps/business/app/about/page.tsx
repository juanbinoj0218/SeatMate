import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "How it works – SeatMate for Business",
  description:
    "Tap a seat when someone sits down or leaves, and customers see it on SeatMate right away.",
};

const STEPS = [
  {
    title: "Draw your room",
    description: "Drag tables, seats, the counter and the door onto a map of your space. It takes a few minutes.",
  },
  {
    title: "Tap seats on and off",
    description: "When someone sits down, tap their seat. When they leave, tap it again. You or your staff can do it from any phone.",
  },
  {
    title: "Customers see it right away",
    description: "Your page on SeatMate updates the moment you tap, so people know there's room before they head over.",
  },
];

const PERKS = [
  {
    title: "More walk-ins on slow nights",
    description: "People nearby can see you have open seats and come in.",
  },
  {
    title: "Fewer people turned away",
    description: "Customers who see you're full can plan for later instead of leaving disappointed.",
  },
  {
    title: "Your whole team can help",
    description: "Invite staff by email. They can tap seats, but can't change your settings.",
  },
  {
    title: "A QR sign for your door",
    description: "Print a sign so customers can check seats from their phone.",
  },
  {
    title: "See how people find you",
    description: "Daily counts of page views, saves and QR scans.",
  },
];

// A row of seats showing one being tapped from open to taken.
function SeatToggleDemo() {
  const seats = ["open", "taken", "open", "taken", "open", "open"] as const;

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-7">
      <p className="text-sm font-semibold text-gray-500">Window counter</p>
      <div className="mt-5 grid grid-cols-6 gap-3">
        {seats.map((state, index) => (
          <span
            key={index}
            className={`aspect-square rounded-full border-4 ${
              state === "open"
                ? "bg-green-500 border-green-200"
                : "bg-red-500 border-red-200"
            } ${index === 2 ? "ring-4 ring-[#101811]/15" : ""}`}
          />
        ))}
      </div>
      <p className="mt-6 text-sm text-gray-500 leading-6">
        Tap a seat once to mark it taken. Tap it again when it frees up.
      </p>
      <div className="mt-4 flex gap-4 text-xs font-semibold text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" /> Taken
        </span>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#f7f8f5] text-[#101811]">
      <SiteHeader />

      <section className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05]">
            Show customers you have room.
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-8 max-w-lg">
            SeatMate shows people which seats are open at your place right now. You tap a seat when
            someone sits down or leaves, and your page updates instantly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/business/login"
              className="rounded-xl bg-[#101811] px-6 py-3.5 font-bold text-white hover:bg-black transition"
            >
              List your business free
              <ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" />
            </Link>
          </div>
        </div>

        <SeatToggleDemo />
      </section>

      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 lg:py-24 grid lg:grid-cols-[1fr_2fr] gap-10">
          <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
          <ol className="divide-y divide-gray-200 border-y border-gray-200">
            {STEPS.map(({ title, description }, index) => (
              <li key={title} className="grid grid-cols-[3rem_1fr] gap-4 py-7">
                <span className="text-3xl font-bold tabular-nums text-gray-300">{index + 1}</span>
                <div>
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-gray-600 leading-7 max-w-xl">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-16 lg:py-24 grid lg:grid-cols-[1fr_2fr] gap-10">
        <h2 className="text-3xl md:text-4xl font-bold">What you get</h2>
        <dl className="grid sm:grid-cols-2 gap-x-10">
          {PERKS.map(({ title, description }) => (
            <div key={title} className="border-t border-gray-200 py-6">
              <dt className="font-bold text-lg">{title}</dt>
              <dd className="mt-1.5 text-gray-600 leading-7">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="max-w-6xl w-full mx-auto px-5 sm:px-8 pb-16 lg:pb-24">
        <div className="bg-[#101811] text-white rounded-3xl px-8 py-12 md:px-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold">Free while we launch.</h2>
            <p className="mt-2 text-white/70">
              Create an account, add your business and we&apos;ll review it before it goes live.
            </p>
          </div>
          <Link
            href="/business/login"
            className="shrink-0 self-start md:self-auto rounded-xl bg-white px-6 py-3.5 font-bold text-[#101811] hover:bg-gray-100 transition"
          >
            Get started
            <ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
