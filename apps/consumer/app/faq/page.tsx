import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "FAQ – SeatMate",
  description: "How SeatMate's live seating works, for customers and businesses.",
};

const SECTIONS: { title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "Using SeatMate",
    items: [
      {
        q: "How does SeatMate know which seats are open?",
        a: "Each place's staff tap seats on a floor plan as people sit down and leave. You see those changes live, along with when the place last updated.",
      },
      {
        q: "Can I reserve a seat?",
        a: "No. SeatMate shows what's open right now, not bookings. An open seat is a good sign, not a guarantee.",
      },
      {
        q: "What does “Updated 20 min ago” mean?",
        a: "It's the last time staff changed a seat. The older it is, the more things may have changed since.",
      },
      {
        q: "Can SeatMate tell me when a full place has room?",
        a: "Yes. Sign in, open a full place and tap “Email me when a seat opens”. We'll email you once, the next time a seat opens in the following 12 hours.",
      },
      {
        q: "My favorite place isn't on SeatMate.",
        a: (
          <>
            <Link href="/suggest">Suggest it</Link>. We reach out to the places people ask for most.
          </>
        ),
      },
      {
        q: "Is SeatMate free?",
        a: "Yes, for customers.",
      },
    ],
  },
  {
    title: "For businesses",
    items: [
      {
        q: "How do I add my business?",
        a: "Create an account on the business portal, add your details, and build your floor plan. We review each business before it goes live.",
      },
      {
        q: "How much work is it for staff?",
        a: "One tap per change. Staff get their own invite and only see the seat screen. If nothing changes for a while, they get a reminder and can confirm seats are still accurate in one tap.",
      },
      {
        q: "What do I get out of it?",
        a: "Customers who would otherwise skip a busy-looking place can see there's room. You also get analytics (page views, saves, QR scans and your busiest hours) and a printable QR sign for your door.",
      },
      {
        q: "Which kinds of places can join?",
        a: "Cafés, coffee shops, restaurants, bakeries, food halls, bars, barbershops and bowling alleys. Bars also get pool table and darts markers that staff can mark as in use, bowling alleys show which lanes are open, and barbershops get barber chairs.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8 md:pt-16">
        <h1 className="font-display text-5xl sm:text-6xl">Questions, answered</h1>

        {SECTIONS.map((section) => (
          <div key={section.title} className="mt-12">
            <h2 className="font-display text-2xl">{section.title}</h2>
            <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
              {section.items.map((item) => (
                <details key={item.q} className="group px-5 py-4 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden="true" className="text-xl leading-none text-gray-400 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-gray-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}

        <p className="mt-12 text-gray-600">
          Still stuck?{" "}
          <Link href="/contact" className="font-semibold text-ink underline decoration-line underline-offset-4">
            Contact us
          </Link>
          .
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
