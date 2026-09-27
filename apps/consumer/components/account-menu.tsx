"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { firstName, useAccount } from "@/components/account-provider";

// Top-right account control: "Sign in" when signed out, an avatar with a
// small menu when signed in.
export default function AccountMenu() {
  const router = useRouter();
  const { user, authReady, profile, favorites, signOut, goToSignIn } =
    useAccount();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!authReady) {
    // Same footprint as the signed-out button, so the header doesn't jump.
    return <span className="h-9 w-9 sm:w-[92px]" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={goToSignIn}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-2.5 text-sm font-medium text-ink transition hover:border-gray-300 sm:px-3.5"
      >
        <PersonIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
        <span className="sr-only sm:hidden">Sign in</span>
      </button>
    );
  }

  const name = firstName(profile, user);
  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-line transition hover:ring-gray-300"
      >
        <Avatar
          photoUrl={user.photoURL}
          label={profile.displayName || user.email || ""}
          className="h-9 w-9 text-sm"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_48px_-20px_rgba(16,24,17,0.35)]"
        >
          <div className="border-b border-line px-4 py-3.5">
            <p className="truncate font-semibold text-ink">
              {name ? `Hi, ${name}` : "Your account"}
            </p>
            <p className="truncate text-sm text-gray-500">{user.email}</p>
          </div>

          <div className="p-1.5 text-sm">
            <MenuItem onClick={() => go("/account")}>
              <PersonIcon className="h-4 w-4 text-gray-400" />
              Your account
            </MenuItem>

            <MenuItem onClick={() => go("/account#saved")}>
              <HeartIcon className="h-4 w-4 text-gray-400" />
              Saved places
              {favorites.length > 0 && (
                <span className="ml-auto rounded-full bg-paper px-2 text-xs text-gray-500">
                  {favorites.length}
                </span>
              )}
            </MenuItem>

            <MenuItem
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
            >
              <SignOutIcon className="h-4 w-4 text-gray-400" />
              Sign out
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-ink transition hover:bg-paper"
    >
      {children}
    </button>
  );
}

export function Avatar({
  photoUrl,
  label,
  className,
}: {
  photoUrl: string | null;
  label: string;
  className?: string;
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`rounded-full object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center rounded-full bg-ink font-semibold text-white ${className ?? ""}`}
    >
      {initial}
    </span>
  );
}

export function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.8 17c.9-3 3.3-4.6 6.2-4.6s5.3 1.6 6.2 4.6" />
    </svg>
  );
}

export function HeartIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 16.5s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 5.6a3.6 3.6 0 0 1 6.5 2.3c0 4.7-6.5 8.6-6.5 8.6Z" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 13l3-3-3-3M15 10H8" />
    </svg>
  );
}
