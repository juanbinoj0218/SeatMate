"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { businessUrl } from "@seatmate/shared/site-urls";

import AccountMenu from "@/components/account-menu";
import { ANDROID_APP_URL, IOS_APP_URL } from "@/lib/site-info";
import { useFeatures } from "@/lib/use-features";

// Header, footer and brand pieces shared by the consumer pages.

export function SiteHeader({
  current,
  showAccount = true,
}: {
  current?: "search" | "about";
  // Off on the sign-in page, where a "Sign in" button would be redundant.
  showAccount?: boolean;
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

          {showAccount && (
            <span className="ml-1.5 sm:ml-2">
              <AccountMenu />
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Browse places", href: "/search" },
      { label: "Cities", href: "/places" },
      { label: "Suggest a place", href: "/suggest" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Business",
    links: [
      { label: "For businesses", href: businessUrl("/business/login"), external: true },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  const features = useFeatures();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 sm:grid-cols-3 sm:px-8 lg:grid-cols-[1.3fr_repeat(3,1fr)_1.2fr]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-semibold">SeatMate</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-gray-500">
            Live seating, without the guessing.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-sm font-semibold">{column.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {column.links.filter((link) => features.suggestPlace || link.href !== "/suggest").map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a href={link.href} className="transition hover:text-ink">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="transition hover:text-ink">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {features.appBadges && (
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <p className="text-sm font-semibold">Get the app</p>
            <AppBadges className="mt-3" />
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-gray-400 sm:px-8">
          © {new Date().getFullYear()} SeatMate
        </p>
      </div>
    </footer>
  );
}

// App Store / Google Play links, or "coming soon" until they're set.
export function AppBadges({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const stores = [
    { label: "App Store", sub: "Download on the", href: IOS_APP_URL, Icon: AppleIcon },
    { label: "Google Play", sub: "Get it on", href: ANDROID_APP_URL, Icon: PlayIcon },
  ];

  const badge = `flex items-center gap-2.5 rounded-xl px-3.5 py-2 transition ${
    dark ? "bg-white text-ink hover:bg-green-50" : "bg-ink text-white hover:bg-black"
  }`;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {stores.map(({ label, sub, href, Icon }) =>
        href ? (
          <a key={label} href={href} target="_blank" rel="noreferrer" className={badge}>
            <Icon className="h-5 w-5" />
            <span className="leading-tight">
              <span className="block text-[10px] opacity-70">{sub}</span>
              <span className="block text-sm font-semibold">{label}</span>
            </span>
          </a>
        ) : (
          <span
            key={label}
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 ${
              dark ? "border-white/20 text-white/70" : "border-line text-gray-500"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-tight">
              <span className="block text-[10px]">Coming soon to</span>
              <span className="block text-sm font-semibold">{label}</span>
            </span>
          </span>
        )
      )}
    </div>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8ZM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3Z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.3 2.6c-.2.2-.3.6-.3 1v16.8c0 .4.1.8.3 1l9.3-9.4-9.3-9.4Zm10.3 10.4 2.6 2.6-11 6.3c-.4.2-.8.3-1.1.2l9.5-9.1Zm0-2L5.1 1.9c.3-.1.7 0 1.1.2l11 6.3-2.6 2.6Zm3.5-2.1 3 1.7c.9.5.9 1.3 0 1.8l-3 1.7-2.8-2.6 2.8-2.6Z" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return <SeatMateMark className={`text-ink ${className ?? ""}`} />;
}

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}
