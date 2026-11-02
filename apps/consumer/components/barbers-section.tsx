"use client";

import { AtSign, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import {
  type Barber,
  barberPhotoPath,
  BARBERS,
  initials,
  instagramUrl,
  readBarber,
  sortBarbers,
} from "@seatmate/shared/barbers";
import CutProgress from "@seatmate/shared/components/CutProgress";
import { db } from "@seatmate/shared/firebase";
import type { TableSeat } from "@seatmate/shared/table-geometry";

type Chair = { id: string; name: string; seats: TableSeat[] };

// Live barber profiles for a barbershop (none for other places).
export function useBarbers(businessId: string | undefined, enabled: boolean) {
  const [barbers, setBarbers] = useState<Barber[]>([]);

  useEffect(() => {
    if (!businessId || !enabled) return;
    return onSnapshot(
      collection(db, "businesses", businessId, BARBERS),
      (snapshot) => setBarbers(sortBarbers(snapshot.docs.map((item) => readBarber(item.id, item.data())))),
      (error) => console.error("Could not load barbers:", error)
    );
  }, [businessId, enabled]);

  return barbers;
}

// "Barbers" on a barbershop's page: each barber's profile with a live view
// of the cut in their chair, so customers can walk in as it finishes.
// Chairs nobody is linked to still show their timer.
export default function BarbersSection({
  businessId,
  barbers,
  chairs,
}: {
  businessId: string;
  barbers: Barber[];
  chairs: Chair[];
}) {
  const [viewer, setViewer] = useState<{ barber: Barber; index: number } | null>(null);

  const chairById = new Map(chairs.map((chair) => [chair.id, chair]));
  const linked = new Set(barbers.map((barber) => barber.chairId));
  const freeChairs = chairs.filter((chair) => !linked.has(chair.id));

  if (barbers.length === 0 && chairs.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="barbers-heading">
      <h2 id="barbers-heading" className="text-3xl font-bold text-[#101811]">
        Barbers
      </h2>
      <p className="mt-2 max-w-2xl text-gray-500">
        Each bar fills from red to green as a cut goes on. Head over when it turns green and the chair will be close to free.
      </p>

      <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
        {barbers.map((barber) => {
          const chair = chairById.get(barber.chairId);
          return (
            <BarberCard
              key={barber.id}
              businessId={businessId}
              barber={barber}
              chair={chair}
              onPhoto={(index) => setViewer({ barber, index })}
            />
          );
        })}

        {freeChairs.map((chair) => (
          <article key={chair.id} className="rounded-[26px] border border-[#e3e7e2] bg-white p-6">
            <p className="text-lg font-bold text-[#101811]">{chair.name}</p>
            <CutProgress seat={chair.seats[0]} className="mt-4" />
          </article>
        ))}
      </div>

      {viewer && (
        <PhotoViewer
          businessId={businessId}
          barber={viewer.barber}
          index={viewer.index}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}

function BarberCard({
  businessId,
  barber,
  chair,
  onPhoto,
}: {
  businessId: string;
  barber: Barber;
  chair: Chair | undefined;
  onPhoto: (index: number) => void;
}) {
  const avatar = barber.photos[0];

  return (
    <article className="flex flex-col rounded-[26px] border border-[#e3e7e2] bg-white p-6">
      <div className="flex items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={barberPhotoPath(businessId, barber.id, avatar)}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#101811] text-lg font-bold text-white">
            {initials(barber.name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-[#101811]">{barber.name}</h3>
          {barber.instagram && (
            <a
              href={instagramUrl(barber.instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#101811] hover:underline"
            >
              <AtSign aria-hidden className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{barber.instagram}</span>
            </a>
          )}
        </div>

        {chair && (
          <span className="shrink-0 rounded-full bg-[#f2f4f0] px-3 py-1 text-xs font-bold text-gray-600">{chair.name}</span>
        )}
      </div>

      {barber.bio && <p className="mt-4 text-sm leading-6 text-gray-600">{barber.bio}</p>}

      {chair ? (
        <CutProgress seat={chair.seats[0]} barber={barber} className="mt-5" />
      ) : (
        <p className="mt-5 text-sm text-gray-400">Not at a chair right now.</p>
      )}

      {barber.photos.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-gray-500">Recent cuts</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {barber.photos.slice(0, 4).map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onPhoto(index)}
                className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101811]"
                aria-label={`Open photo ${index + 1} of ${barber.photos.length} by ${barber.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={barberPhotoPath(businessId, barber.id, photo)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
                {index === 3 && barber.photos.length > 4 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white">
                    +{barber.photos.length - 4}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function PhotoViewer({
  businessId,
  barber,
  index,
  onIndex,
  onClose,
}: {
  businessId: string;
  barber: Barber;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const count = barber.photos.length;
  const step = useCallback((by: number) => onIndex((index + by + count) % count), [count, index, onIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, step]);

  const photo = barber.photos[index];
  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cuts by ${barber.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-5 py-4 text-white sm:px-8">
        <p className="font-bold">
          {barber.name}
          <span className="ml-2 font-normal text-white/60 tabular-nums">
            {index + 1} / {count}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Close"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-8 sm:px-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={barberPhotoPath(businessId, barber.id, photo)}
          alt={`Haircut by ${barber.name}, photo ${index + 1}`}
          className="max-h-full max-w-full min-h-0 rounded-2xl object-contain"
          onClick={(event) => event.stopPropagation()}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#101811] sm:left-6"
              aria-label="Previous photo"
            >
              <ChevronLeft aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#101811] sm:right-6"
              aria-label="Next photo"
            >
              <ChevronRight aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
