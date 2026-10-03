"use client";

import { ArrowUpRight } from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { businessUrl, consumerUrl } from "@seatmate/shared/site-urls";

import { signOutAdmin, useAdminSession } from "@/lib/admin-session";

const NAV = [
  { href: "/", label: "Overview", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" },
  { href: "/businesses", label: "Businesses", icon: "M4 10 5.5 4h13L20 10M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8" },
  { href: "/inbox", label: "Inbox", icon: "M4 13h4l1.5 3h5L16 13h4M5 5h14l1 8v6H4v-6l1-8Z" },
  { href: "/customers", label: "Customers", icon: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 8a5.5 5.5 0 0 1 11 0M17 11a2.3 2.3 0 1 0 0-4.6M16 14.2a4.5 4.5 0 0 1 4.5 4.8" },
  { href: "/admins", label: "Admins", icon: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" },
  { href: "/activity", label: "Activity", icon: "M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4" },
  { href: "/settings", label: "Settings", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" },
];

// Sidebar layout for every admin page. Sends signed-out visitors to the
// login page and blocks accounts that aren't admins.
export default function AdminShell({ children }: { children: ReactNode }) {
  const session = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.state === "signedOut") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.state, pathname, router]);

  if (session.state === "loading" || session.state === "signedOut") {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] text-gray-500">Loading…</main>;
  }

  if (session.state === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] p-6">
        <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-gray-500">
            {session.user.email} isn&apos;t a SeatMate admin. Ask an existing admin to add you.
          </p>
          <button type="button" onClick={() => signOutAdmin()} className="mt-6 rounded-xl bg-[#101811] px-5 py-3 font-semibold text-white">
            Sign in with another account
          </button>
        </div>
      </main>
    );
  }

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-[#f7f8f5] lg:flex">
      <aside className="bg-[#101811] text-white lg:fixed lg:inset-y-0 lg:w-60 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2.5 px-5 lg:h-20">
          <SeatMateMark className="h-7 w-7" />
          <div>
            <p className="font-bold leading-tight">SeatMate</p>
            <p className="text-xs text-white/50">Admin</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active(item.href) ? "bg-white text-[#101811]" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden border-t border-white/10 p-4 text-sm lg:block">
          <p className="truncate text-white/60">{session.user.email}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-white/60">
            <a href={consumerUrl("/")} className="hover:text-white">Customer site<ArrowUpRight aria-hidden className="ml-0.5 inline h-4 w-4 align-[-3px]" /></a>
            <a href={businessUrl("/business")} className="hover:text-white">Business site<ArrowUpRight aria-hidden className="ml-0.5 inline h-4 w-4 align-[-3px]" /></a>
          </div>
          <button type="button" onClick={() => signOutAdmin()} className="mt-4 w-full rounded-xl border border-white/20 py-2 font-semibold hover:bg-white/10">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-60">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}
