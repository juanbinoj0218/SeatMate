import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import { type Barber, BARBER_PHOTOS, BARBERS, readBarber, sortBarbers } from "@seatmate/shared/barbers";

import { db } from "@/lib/firebase";

// Live barber profiles for a business (businesses/{id}/barbers).
export function useBarbers(businessId: string | undefined) {
  const [barbers, setBarbers] = useState<Barber[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessId) return;
    return onSnapshot(
      collection(db, "businesses", businessId, BARBERS),
      (snapshot) => {
        setBarbers(sortBarbers(snapshot.docs.map((item) => readBarber(item.id, item.data()))));
        setError("");
      },
      (caught) => {
        console.error("Could not load barbers:", caught);
        setError("Couldn't load your barbers. Check your connection.");
        setBarbers([]);
      }
    );
  }, [businessId]);

  return { barbers, error };
}

// A barber's photos as data URLs, by photo id. The owner reads them straight
// from Firestore; customers get them from the website's image route.
export function useBarberPhotos(businessId: string | undefined, barberId: string | undefined) {
  const [photos, setPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!businessId || !barberId) return;
    return onSnapshot(
      collection(db, "businesses", businessId, BARBERS, barberId, BARBER_PHOTOS),
      (snapshot) => {
        const next: Record<string, string> = {};
        snapshot.docs.forEach((item) => {
          const value = item.data().data;
          if (typeof value === "string") next[item.id] = value;
        });
        setPhotos(next);
      },
      (caught) => console.error("Could not load photos:", caught)
    );
  }, [businessId, barberId]);

  return photos;
}
