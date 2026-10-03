import { Armchair, ArrowRight } from "lucide-react";
import Link from "next/link";

import { consumerUrl } from "@seatmate/shared/site-urls";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col bg-[#f7f8f5] text-[#101811]">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center px-6 py-20 text-center">
        <div className="max-w-md">
          <Armchair aria-hidden className="mx-auto h-12 w-12" strokeWidth={1.6} />
          <h1 className="mt-5 text-3xl font-bold">This page doesn&apos;t exist</h1>
          <p className="mt-3 text-gray-500">
            You&apos;re on the SeatMate business portal. Looking for places to sit? Head to the
            customer site.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/business"
              className="rounded-xl bg-[#101811] px-5 py-3 font-bold text-white hover:bg-black transition"
            >
              Business dashboard
            </Link>
            <a
              href={consumerUrl("/")}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-bold hover:bg-gray-50 transition"
            >
              Customer site
              <ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" />
            </a>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
