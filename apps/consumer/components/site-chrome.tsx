"use client";

import { useRouter } from "next/navigation";

import { businessUrl } from "@seatmate/shared/site-urls";

// Header, footer and brand pieces shared by the consumer pages.

export function SiteHeader({
  current,
}: {
  current?: "search" | "about";
}) {
  const router = useRouter();

  const linkClass = (page: "search" | "about") =>
    `rounded-lg px-3 py-2 transition hover:bg-black/[0.04] hover:text-ink ${
      current === page ? "text-ink" : ""
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5"
          aria-label="SeatMate home"
        >
          <LogoMark className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight">
            SeatMate
          </span>
        </button>

        <nav className="flex items-center gap-1 text-sm font-medium text-gray-600">
          <button
            type="button"
            onClick={() => router.push("/search")}
            aria-current={current === "search" ? "page" : undefined}
            className={`hidden sm:block ${linkClass("search")}`}
          >
            Browse places
          </button>

          <button
            type="button"
            onClick={() => router.push("/about")}
            aria-current={current === "about" ? "page" : undefined}
            className={linkClass("about")}
          >
            About Us
          </button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const router = useRouter();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-semibold">SeatMate</span>
          </span>

          <span className="text-sm text-gray-500">
            Live seating, without the guessing.
          </span>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="transition hover:text-ink"
          >
            Browse places
          </button>

          <button
            type="button"
            onClick={() => router.push("/about")}
            className="transition hover:text-ink"
          >
            About Us
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign(businessUrl("/business/login"))
            }
            className="transition hover:text-ink"
          >
            For businesses
          </button>
        </nav>
      </div>
    </footer>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#101811" />
      <circle cx="16" cy="16" r="5.5" fill="#fff" />
      <circle cx="16" cy="6.5" r="2.6" fill="#22a55b" />
      <circle cx="25.5" cy="16" r="2.6" fill="#22a55b" />
      <circle cx="16" cy="25.5" r="2.6" fill="#e5534b" />
      <circle cx="6.5" cy="16" r="2.6" fill="#22a55b" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}
