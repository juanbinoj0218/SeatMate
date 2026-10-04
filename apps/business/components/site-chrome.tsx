import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { consumerUrl } from "@seatmate/shared/site-urls";

import { CONTACT_EMAIL } from "@/lib/site-info";

// Header and footer for the business site's public pages (about, terms,
// privacy, not found).

export function SiteHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-4">
        <Link href="/business" className="flex items-center gap-3">
          <span className="w-10 h-10 flex items-center justify-center text-[#101811]">
            <SeatMateMark className="h-[85%] w-[85%]" />
          </span>
          <span>
            <span className="block font-bold">SeatMate</span>
            <span className="block text-xs text-gray-400">Business Portal</span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 text-sm font-semibold text-gray-500">
          <Link href="/about" className="hidden sm:inline hover:text-[#101811] transition">
            How it works
          </Link>
          <Link
            href="/business/login"
            className="rounded-xl bg-[#101811] px-4 py-2.5 text-white hover:bg-black transition"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} SeatMate</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/about" className="hover:text-[#101811]">About</Link>
          <Link href="/terms" className="hover:text-[#101811]">Terms</Link>
          <Link href="/privacy" className="hover:text-[#101811]">Privacy</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#101811]">Contact</a>
          <a href={consumerUrl("/")} className="hover:text-[#101811]">Customer site<ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" /></a>
        </nav>
      </div>
    </footer>
  );
}

// Layout for long text pages (terms, privacy).
export function ProsePage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col bg-[#f7f8f5] text-[#101811]">
      <SiteHeader />
      <article className="flex-1 w-full max-w-3xl mx-auto px-5 sm:px-8 pt-12 pb-24 md:pt-16">
        <h1 className="text-4xl sm:text-5xl font-bold">{title}</h1>
        <p className="mt-4 text-sm text-gray-500">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-[17px] leading-8 text-gray-700 [&_a]:font-semibold [&_a]:text-[#101811] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-2xl [&_h2]:text-[#101811] [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
