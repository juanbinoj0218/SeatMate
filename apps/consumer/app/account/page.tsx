"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  firstName,
  type Profile,
  type SavedPlace,
  useAccount,
} from "@/components/account-provider";
import { Avatar, HeartIcon } from "@/components/account-menu";
import SaveButton from "@/components/save-button";
import {
  ArrowRightIcon,
  SiteFooter,
  SiteHeader,
} from "@/components/site-chrome";
import { fetchPlaceSeats, type SeatSummary } from "@/lib/places";

const viewedAtFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function AccountPage() {
  const router = useRouter();
  const {
    user,
    authReady,
    profile,
    profileReady,
    favorites,
    syncError,
    clearRecentlyViewed,
    signOut,
  } = useAccount();

  // This page is only for signed-in customers.
  useEffect(() => {
    if (authReady && !user) {
      router.replace("/login?next=/account");
    }
  }, [authReady, user, router]);

  if (!authReady || !user) {
    return (
      <main className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-5 py-24 text-gray-500 sm:px-8">
          Loading your account…
        </div>
      </main>
    );
  }

  const name = firstName(profile, user);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      {/* GREETING */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 md:pt-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-5">
            <Avatar
              photoUrl={user.photoURL}
              label={profile.displayName || user.email || ""}
              className="h-16 w-16 text-2xl"
            />

            <div>
              <h1 className="font-display text-4xl sm:text-5xl">
                {name ? `Hi, ${name}` : "Your account"}
              </h1>
              <p className="mt-1 text-gray-500">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="self-start rounded-full border border-line bg-white px-4 py-2 text-sm font-medium transition hover:border-gray-300 sm:self-auto"
          >
            Sign out
          </button>
        </div>

        {syncError && (
          <p role="alert" className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {syncError}
          </p>
        )}
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[1fr_340px] lg:gap-12 lg:pb-28">
        <div className="space-y-14">
          {/* SAVED PLACES */}
          <section id="saved" className="scroll-mt-24">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-3xl sm:text-4xl">
                Saved places
              </h2>

              {favorites.length > 0 && (
                <span className="text-sm text-gray-500">
                  {favorites.length} saved
                </span>
              )}
            </div>

            {favorites.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
                <HeartIcon className="h-10 w-10 text-gray-300" />
                <p className="mt-4 font-semibold">No saved places yet</p>
                <p className="mt-1 max-w-sm text-gray-600">
                  Tap the heart on any café or restaurant to keep it here,
                  with its live seat count.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/search")}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
                >
                  Browse places
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <SavedGrid favorites={favorites} />
            )}
          </section>

          {/* RECENTLY VIEWED */}
          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-3xl sm:text-4xl">
                Recently viewed
              </h2>

              {profile.recentlyViewed.length > 0 && (
                <button
                  type="button"
                  onClick={clearRecentlyViewed}
                  className="text-sm font-medium text-gray-500 transition hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>

            {profile.recentlyViewed.length === 0 ? (
              <p className="mt-4 text-gray-600">
                Places you open will show up here.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {profile.recentlyViewed.map((place) => (
                  <li key={place.slug}>
                    <button
                      type="button"
                      onClick={() => router.push(`/place/${place.slug}`)}
                      className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-paper"
                    >
                      <PlaceThumb name={place.name} imageUrl={place.imageUrl} />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold group-hover:text-moss">
                          {place.name}
                        </span>
                        <span className="block truncate text-sm text-gray-500">
                          {place.type}
                          {place.address ? ` · ${place.address}` : ""}
                        </span>
                      </span>

                      <span className="hidden shrink-0 text-sm text-gray-400 sm:block">
                        {viewedAtFormat.format(place.viewedAtMs)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* PROFILE */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {profileReady && (
            <ProfileForm
              key={user.uid}
              initial={profile}
            />
          )}
        </aside>
      </div>

      <SiteFooter />
    </main>
  );
}

function SavedGrid({ favorites }: { favorites: SavedPlace[] }) {
  const router = useRouter();
  const [availability, setAvailability] = useState<
    Record<string, SeatSummary | null>
  >({});

  const slugs = useMemo(
    () => favorites.map((place) => place.slug).join(","),
    [favorites]
  );

  // Live seat counts for each saved place.
  useEffect(() => {
    let cancelled = false;

    Promise.all(
      slugs
        .split(",")
        .filter(Boolean)
        .map(async (slug) => {
          try {
            return [slug, await fetchPlaceSeats(slug)] as const;
          } catch (error) {
            console.error(`Could not load seats for ${slug}:`, error);
            return [slug, undefined] as const;
          }
        })
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      const next: Record<string, SeatSummary | null> = {};

      entries.forEach(([slug, value]) => {
        if (value !== undefined) {
          next[slug] = value;
        }
      });

      setAvailability(next);
    });

    return () => {
      cancelled = true;
    };
  }, [slugs]);

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {favorites.map((place) => {
        const seats = availability[place.slug];

        return (
          <div key={place.slug} className="relative">
            <button
              type="button"
              onClick={() => router.push(`/place/${place.slug}`)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-4 pr-14 text-left transition hover:border-gray-300 hover:shadow-[0_16px_32px_-20px_rgba(16,24,17,0.35)]"
            >
              <PlaceThumb name={place.name} imageUrl={place.imageUrl} large />

              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold group-hover:text-moss">
                  {place.name}
                </span>
                <span className="block truncate text-sm text-gray-500">
                  {place.type}
                </span>

                <span className="mt-2 block text-sm">
                  {seats === undefined ? (
                    <span className="text-gray-400">Checking seats…</span>
                  ) : seats === null ? (
                    <span className="text-gray-400">No longer listed</span>
                  ) : seats.totalSeats === 0 ? (
                    <span className="text-gray-400">No seating data yet</span>
                  ) : (
                    <>
                      <span
                        className={`font-semibold ${
                          seats.availableSeats > 0 ? "text-moss" : "text-seat-taken"
                        }`}
                      >
                        {seats.availableSeats}
                      </span>{" "}
                      <span className="text-gray-500">
                        of {seats.totalSeats} seats open
                      </span>
                    </>
                  )}
                </span>
              </span>
            </button>

            <SaveButton
              place={place}
              className="absolute right-3 top-3 border border-line"
            />
          </div>
        );
      })}
    </div>
  );
}

function ProfileForm({ initial }: { initial: Profile }) {
  const { saveProfile } = useAccount();

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [homeZip, setHomeZip] = useState(initial.homeZip);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  const changed =
    displayName.trim() !== initial.displayName ||
    homeZip !== initial.homeZip;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (homeZip && !/^\d{5}$/.test(homeZip)) {
      setError("Enter a 5-digit ZIP code, or leave it blank.");
      return;
    }

    setStatus("saving");

    try {
      await saveProfile({ displayName: displayName.trim(), homeZip });
      setStatus("saved");
    } catch (caught) {
      console.error("Could not save profile:", caught);
      setStatus("error");
      setError("We couldn't save your profile. Please try again.");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-line bg-white p-6 sm:p-7"
    >
      <h2 className="text-lg font-semibold">Profile</h2>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-medium">Name</span>
        <input
          type="text"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setStatus("idle");
          }}
          autoComplete="name"
          placeholder="Your name"
          className="w-full"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Home ZIP code</span>
        <input
          type="text"
          value={homeZip}
          onChange={(event) => {
            setHomeZip(event.target.value.replace(/\D/g, "").slice(0, 5));
            setStatus("idle");
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="e.g. 94110"
          className="w-full"
        />
        <span className="mt-1.5 block text-sm text-gray-500">
          Used for &ldquo;Open seats near you&rdquo; when location is off.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!changed || status === "saving"}
        className="mt-6 h-11 w-full rounded-xl bg-ink font-semibold text-white transition hover:bg-black disabled:opacity-40"
      >
        {status === "saving" ? "Saving…" : "Save changes"}
      </button>

      {status === "saved" && !changed && (
        <p role="status" className="mt-3 text-center text-sm text-moss">
          Saved
        </p>
      )}
    </form>
  );
}

function PlaceThumb({
  name,
  imageUrl,
  large = false,
}: {
  name: string;
  imageUrl: string;
  large?: boolean;
}) {
  const size = large ? "h-16 w-16" : "h-12 w-12";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={`${size} shrink-0 rounded-xl object-cover`}
      />
    );
  }

  return (
    <span
      className={`${size} font-display flex shrink-0 items-center justify-center rounded-xl bg-[#eef2ec] text-2xl text-moss/80`}
    >
      {name.trim().charAt(0).toUpperCase() || "S"}
    </span>
  );
}
